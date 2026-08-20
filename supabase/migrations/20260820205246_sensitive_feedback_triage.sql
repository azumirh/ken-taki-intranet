-- Ken Taki: RH is the system-of-record for people matters.
-- Sensitive feedback is held for RH triage before a manager can see it.

alter table public.kt_feedbacks
  add column if not exists triagem_rh_status text not null default 'nao_necessaria'
    check (triagem_rh_status in ('nao_necessaria','pendente','em_analise','liberado_gestor','retido_rh','concluido')),
  add column if not exists gestor_liberado boolean not null default false,
  add column if not exists gestor_liberado_em timestamptz,
  add column if not exists gestor_liberado_por uuid references public.kt_perfis(id) on delete set null,
  add column if not exists escalado_rh boolean not null default false,
  add column if not exists escalado_rh_em timestamptz,
  add column if not exists escalado_rh_por uuid references public.kt_perfis(id) on delete set null;

create index if not exists idx_kt_feedbacks_triagem_rh
  on public.kt_feedbacks (triagem_rh_status, ts desc);
create index if not exists idx_kt_feedbacks_gestor_liberado
  on public.kt_feedbacks (filial, gestor_liberado, ts desc);

-- Existing sensitive records are kept with RH until explicitly released.
update public.kt_feedbacks
set destino = 'azumi',
    triagem_rh_status = 'pendente',
    gestor_liberado = false
where tipo in ('Crítica','Reclamação','Denúncia','Situação urgente');

update public.kt_feedbacks
set triagem_rh_status = 'nao_necessaria',
    gestor_liberado = (coalesce(destino, 'gestor') = 'gestor')
where tipo not in ('Crítica','Reclamação','Denúncia','Situação urgente');

create or replace function public.kt_prepare_feedback_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo in ('Crítica','Reclamação','Denúncia','Situação urgente') then
    new.destino := 'azumi';
    new.triagem_rh_status := 'pendente';
    new.gestor_liberado := false;
    new.gestor_liberado_em := null;
    new.gestor_liberado_por := null;
  else
    new.triagem_rh_status := 'nao_necessaria';
    new.gestor_liberado := coalesce(new.destino, 'gestor') = 'gestor';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kt_prepare_feedback_visibility on public.kt_feedbacks;
create trigger trg_kt_prepare_feedback_visibility
before insert on public.kt_feedbacks
for each row execute function public.kt_prepare_feedback_visibility();

-- RH is notified of every feedback. Manager is notified only when it is safe/direct.
create or replace function public.kt_notify_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sensitive boolean;
  v_body_rh text;
  v_body_manager text;
begin
  v_sensitive := new.tipo in ('Crítica','Reclamação','Denúncia','Situação urgente');

  v_body_rh := case
    when v_sensitive and new.anonimo then 'Novo relato sensível e anônimo aguardando triagem · ' || new.filial || '.'
    when v_sensitive then coalesce(nullif(new.autor, ''), 'Colaborador') || ' enviou um relato sensível para triagem · ' || new.filial || '.'
    when new.anonimo then 'Novo feedback anônimo recebido · ' || new.filial || '.'
    else coalesce(nullif(new.autor, ''), 'Colaborador') || ' enviou um feedback · ' || new.filial || '.'
  end;

  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    case when v_sensitive then 'feedback_triage_required' else 'feedback_received' end,
    case when v_sensitive then 'Triagem de RH necessária' else 'Novo feedback' end,
    v_body_rh,
    '/azumi#feedbacks'
  from public.kt_perfis p
  where p.tipo in ('azumi','rh') and coalesce(p.ativo, true);

  if not v_sensitive and coalesce(new.destino, 'gestor') = 'gestor' then
    v_body_manager := case
      when new.anonimo then 'Novo feedback anônimo recebido para sua unidade.'
      else coalesce(nullif(new.autor, ''), 'Colaborador') || ' enviou um feedback para sua unidade.'
    end;

    insert into public.app_notifications (user_id, type, title, body, action_url)
    select p.id, 'feedback_received', 'Novo feedback', v_body_manager, '/gestor#feedbacks'
    from public.kt_perfis p
    where p.tipo = 'gestor'
      and p.filial = new.filial
      and coalesce(p.ativo, true);
  end if;

  return new;
end;
$$;

create or replace function public.kt_notify_feedback_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.gestor_liberado, false) = false and new.gestor_liberado = true then
    insert into public.app_notifications (user_id, type, title, body, action_url)
    select
      p.id,
      'feedback_released_by_hr',
      'Novo acompanhamento liberado pelo RH',
      case when new.anonimo
        then 'O RH liberou um relato para acompanhamento da sua unidade.'
        else 'O RH liberou um relato de ' || coalesce(nullif(new.autor, ''), 'um colaborador') || ' para acompanhamento.'
      end,
      '/gestor#feedbacks'
    from public.kt_perfis p
    where p.tipo = 'gestor'
      and p.filial = new.filial
      and coalesce(p.ativo, true);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kt_notify_feedback_release on public.kt_feedbacks;
create trigger trg_kt_notify_feedback_release
after update of gestor_liberado on public.kt_feedbacks
for each row execute function public.kt_notify_feedback_release();

create or replace function public.kt_liberar_feedback_gestor(p_feedback_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.kt_perfis
    where id = auth.uid() and tipo in ('azumi','rh') and coalesce(ativo, true)
  ) then
    raise exception 'Apenas RH autorizado pode liberar este relato para o gestor.';
  end if;

  update public.kt_feedbacks
  set gestor_liberado = true,
      gestor_liberado_em = now(),
      gestor_liberado_por = auth.uid(),
      triagem_rh_status = 'liberado_gestor',
      destino = 'gestor'
  where id = p_feedback_id;

  return found;
end;
$$;

create or replace function public.kt_reter_feedback_rh(p_feedback_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.kt_perfis
    where id = auth.uid() and tipo in ('azumi','rh') and coalesce(ativo, true)
  ) then
    raise exception 'Apenas RH autorizado pode manter este relato restrito.';
  end if;

  update public.kt_feedbacks
  set gestor_liberado = false,
      gestor_liberado_em = null,
      gestor_liberado_por = null,
      triagem_rh_status = 'retido_rh',
      destino = 'azumi'
  where id = p_feedback_id;

  return found;
end;
$$;

create or replace function public.kt_escalar_feedback_rh(p_feedback_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filial text;
begin
  select f.filial into v_filial
  from public.kt_feedbacks f
  join public.kt_perfis p on p.id = auth.uid()
  where f.id = p_feedback_id
    and p.tipo = 'gestor'
    and p.filial = f.filial
    and coalesce(p.ativo, true);

  if v_filial is null then
    raise exception 'Gestor sem permissão para escalar este feedback.';
  end if;

  update public.kt_feedbacks
  set escalado_rh = true,
      escalado_rh_em = now(),
      escalado_rh_por = auth.uid()
  where id = p_feedback_id;

  insert into public.app_notifications (user_id, type, title, body, action_url)
  select p.id,
         'manager_escalated_to_hr',
         'Gestor solicitou acompanhamento do RH',
         'Um gestor da unidade ' || v_filial || ' pediu apoio do RH em um feedback.',
         '/azumi#feedbacks'
  from public.kt_perfis p
  where p.tipo in ('azumi','rh') and coalesce(p.ativo, true);

  return true;
end;
$$;

revoke execute on function public.kt_prepare_feedback_visibility() from public, anon, authenticated;
revoke execute on function public.kt_notify_feedback() from public, anon, authenticated;
revoke execute on function public.kt_notify_feedback_release() from public, anon, authenticated;

revoke execute on function public.kt_liberar_feedback_gestor(text) from public, anon;
revoke execute on function public.kt_reter_feedback_rh(text) from public, anon;
revoke execute on function public.kt_escalar_feedback_rh(text) from public, anon;
grant execute on function public.kt_liberar_feedback_gestor(text) to authenticated;
grant execute on function public.kt_reter_feedback_rh(text) to authenticated;
grant execute on function public.kt_escalar_feedback_rh(text) to authenticated;
