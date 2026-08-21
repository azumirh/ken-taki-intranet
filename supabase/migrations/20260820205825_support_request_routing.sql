-- Ken Taki: support requests always remain visible to RH.
-- The employee can choose a direct manager conversation without turning it into a sensitive complaint.

alter table public.kt_ajuda
  add column if not exists destino_inicial text not null default 'rh'
    check (destino_inicial in ('rh','gestor')),
  add column if not exists gestor_envolvido_em timestamptz,
  add column if not exists gestor_envolvido_por uuid references public.kt_perfis(id) on delete set null;

create index if not exists idx_kt_ajuda_destino_filial
  on public.kt_ajuda (destino_inicial, filial, ts desc);

create or replace function public.kt_notify_ajuda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- RH acompanha todos os pedidos, independentemente do destino inicial.
  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'support_requested',
    case when new.destino_inicial = 'gestor' then 'Pedido de apoio direcionado à liderança' else 'Novo pedido de apoio' end,
    new.nome || ' registrou um pedido de apoio · ' || new.filial || '.',
    '/azumi#apoio'
  from public.kt_perfis p
  where p.tipo = 'azumi' and coalesce(p.ativo, true);

  -- Se o colaborador escolheu explicitamente falar com a liderança,
  -- o(s) gestor(es) ativo(s) da filial recebem o pedido sem depender do RH liberar.
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

create or replace function public.kt_notify_ajuda_manager_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.gestor_id is null and new.gestor_id is not null and new.destino_inicial = 'rh' then
    perform public.kt_insert_notification(
      new.gestor_id,
      'support_released_by_hr',
      'RH solicitou seu acompanhamento',
      'Um atendimento foi compartilhado pelo RH para sua atuação.',
      '/gestor#apoio'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kt_notify_ajuda_manager_assignment on public.kt_ajuda;
create trigger trg_kt_notify_ajuda_manager_assignment
after update of gestor_id on public.kt_ajuda
for each row execute function public.kt_notify_ajuda_manager_assignment();

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
    select 1 from public.kt_perfis
    where id = auth.uid() and tipo = 'azumi' and coalesce(ativo, true)
  ) then
    raise exception 'Apenas RH autorizado pode envolver um gestor neste atendimento.';
  end if;

  select filial into v_filial from public.kt_ajuda where id = p_pedido_id;
  if v_filial is null then return false; end if;

  if not exists (
    select 1 from public.kt_perfis
    where id = p_gestor_id and tipo = 'gestor' and filial = v_filial and coalesce(ativo, true)
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

revoke execute on function public.kt_notify_ajuda() from public, anon, authenticated;
revoke execute on function public.kt_notify_ajuda_manager_assignment() from public, anon, authenticated;
revoke execute on function public.kt_envolver_gestor_apoio(text, uuid) from public, anon;
grant execute on function public.kt_envolver_gestor_apoio(text, uuid) to authenticated;
