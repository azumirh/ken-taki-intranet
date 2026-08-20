-- Ken Taki: complete two-way support routing.
-- RH sees every support request; managers see only direct or explicitly assigned requests.

alter table public.kt_ajuda
  add column if not exists rh_solicitado boolean not null default false,
  add column if not exists rh_solicitado_em timestamptz,
  add column if not exists rh_solicitado_por uuid references public.kt_perfis(id) on delete set null;

create index if not exists idx_kt_ajuda_rh_solicitado
  on public.kt_ajuda (rh_solicitado, filial, ts desc);

create or replace function public.kt_notify_ajuda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- RH is the system-of-record and is notified of every request.
  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'support_requested',
    case
      when new.destino_inicial = 'gestor' then 'Pedido de apoio direcionado à liderança'
      else 'Novo pedido de apoio'
    end,
    new.nome || ' registrou um pedido de apoio · ' || new.filial || '.',
    '/azumi#apoio'
  from public.kt_perfis p
  where p.tipo in ('azumi', 'rh')
    and coalesce(p.ativo, true);

  -- Direct manager requests notify active managers in the same unit.
  if new.destino_inicial = 'gestor' then
    insert into public.app_notifications (user_id, type, title, body, action_url)
    select
      p.id,
      'support_requested',
      'Colaborador pediu uma conversa',
      new.nome || ' pediu uma conversa com a liderança.',
      '/gestor#apoio'
    from public.kt_perfis p
    where p.tipo = 'gestor'
      and p.filial = new.filial
      and coalesce(p.ativo, true);
  elsif new.gestor_id is not null then
    perform public.kt_insert_notification(
      new.gestor_id,
      'support_requested',
      'RH envolveu você em um atendimento',
      'O RH direcionou um pedido de apoio para seu acompanhamento.',
      '/gestor#apoio'
    );
  end if;

  return new;
end;
$$;

create or replace function public.kt_envolver_gestor_apoio(p_pedido_id text, p_gestor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filial text;
begin
  if not exists (
    select 1
    from public.kt_perfis
    where id = auth.uid()
      and tipo in ('azumi', 'rh')
      and coalesce(ativo, true)
  ) then
    raise exception 'Apenas RH autorizado pode envolver um gestor neste atendimento.';
  end if;

  select filial into v_filial
  from public.kt_ajuda
  where id = p_pedido_id;

  if v_filial is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.kt_perfis
    where id = p_gestor_id
      and tipo = 'gestor'
      and filial = v_filial
      and coalesce(ativo, true)
  ) then
    raise exception 'Gestor inválido para a unidade deste atendimento.';
  end if;

  update public.kt_ajuda
  set gestor_id = p_gestor_id,
      gestor_envolvido_em = now(),
      gestor_envolvido_por = auth.uid()
  where id = p_pedido_id;

  return found;
end;
$$;

create or replace function public.kt_escalar_apoio_rh(p_pedido_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_filial text;
begin
  select a.nome, a.filial
  into v_nome, v_filial
  from public.kt_ajuda a
  join public.kt_perfis p on p.id = auth.uid()
  where a.id = p_pedido_id
    and p.tipo = 'gestor'
    and p.filial = a.filial
    and coalesce(p.ativo, true)
    and (a.destino_inicial = 'gestor' or a.gestor_id = auth.uid());

  if v_filial is null then
    raise exception 'Gestor sem permissão para acionar o RH neste atendimento.';
  end if;

  update public.kt_ajuda
  set rh_solicitado = true,
      rh_solicitado_em = now(),
      rh_solicitado_por = auth.uid()
  where id = p_pedido_id;

  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'manager_escalated_support_to_hr',
    'Gestor solicitou atuação do RH',
    'A liderança de ' || v_filial || ' pediu atuação do RH em um atendimento de ' || coalesce(nullif(v_nome, ''), 'colaborador') || '.',
    '/azumi#apoio'
  from public.kt_perfis p
  where p.tipo in ('azumi', 'rh')
    and coalesce(p.ativo, true);

  return true;
end;
$$;

-- Keep the hardened policy definitions aligned with the new routing model.
-- During the compatibility rollout, the temporary permissive policies still coexist;
-- when they are removed, these scoped policies remain ready.
drop policy if exists kt_ajuda_select_scoped on public.kt_ajuda;
create policy kt_ajuda_select_scoped
on public.kt_ajuda
for select
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and (destino_inicial = 'gestor' or gestor_id = (select auth.uid()))
  )
);

drop policy if exists kt_ajuda_update_scoped on public.kt_ajuda;
create policy kt_ajuda_update_scoped
on public.kt_ajuda
for update
to authenticated
using (
  (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and (destino_inicial = 'gestor' or gestor_id = (select auth.uid()))
  )
)
with check (
  (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and (destino_inicial = 'gestor' or gestor_id = (select auth.uid()))
  )
);

revoke execute on function public.kt_notify_ajuda() from public, anon, authenticated;
revoke execute on function public.kt_envolver_gestor_apoio(text, uuid) from public, anon;
revoke execute on function public.kt_escalar_apoio_rh(text) from public, anon;
grant execute on function public.kt_envolver_gestor_apoio(text, uuid) to authenticated;
grant execute on function public.kt_escalar_apoio_rh(text) to authenticated;
