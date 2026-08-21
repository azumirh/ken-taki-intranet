-- Ken Taki intranet: event-driven in-app notifications
-- Versioned in Git first. Apply to Supabase only after PR validation.

create or replace function public.kt_insert_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_action_url text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_notifications (user_id, type, title, body, action_url)
  values (p_user_id, p_type, p_title, p_body, p_action_url);
$$;

create or replace function public.kt_notify_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'document_signed',
    'Documento assinado',
    new.nome || ' assinou “' || new.politica || '”.',
    case when p.tipo = 'gestor' then '/gestor#documentos' else '/azumi#documentos' end
  from public.kt_perfis p
  where (p.tipo = 'gestor' and p.filial = new.filial)
     or p.tipo in ('azumi', 'rh');

  return new;
end;
$$;

drop trigger if exists trg_kt_notify_assinatura on public.kt_assinaturas;
create trigger trg_kt_notify_assinatura
after insert on public.kt_assinaturas
for each row execute function public.kt_notify_assinatura();

create or replace function public.kt_notify_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  v_body := case
    when new.anonimo then 'Novo feedback ' || lower(new.tipo) || ' recebido para a unidade.'
    else coalesce(nullif(new.autor, ''), 'Colaborador') || ' enviou um feedback ' || lower(new.tipo) || '.'
  end;

  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'feedback_received',
    'Novo feedback',
    v_body,
    case when p.tipo = 'gestor' then '/gestor#feedbacks' else '/azumi#feedbacks' end
  from public.kt_perfis p
  where (
      coalesce(new.destino, 'gestor') = 'gestor'
      and p.tipo = 'gestor'
      and p.filial = new.filial
    )
    or (
      p.tipo in ('azumi', 'rh')
      and (coalesce(new.destino, 'gestor') = 'azumi' or new.tipo = 'Situação urgente')
    );

  return new;
end;
$$;

drop trigger if exists trg_kt_notify_feedback on public.kt_feedbacks;
create trigger trg_kt_notify_feedback
after insert on public.kt_feedbacks
for each row execute function public.kt_notify_feedback();

create or replace function public.kt_notify_ajuda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pedidos de apoio são confidenciais por padrão e chegam ao RH.
  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'support_requested',
    'Novo pedido de apoio',
    new.nome || ' registrou um pedido de apoio · ' || new.filial || '.',
    '/azumi#apoio'
  from public.kt_perfis p
  where p.tipo in ('azumi', 'rh');

  -- Se houver gestor explicitamente associado ao pedido, ele também é notificado.
  if new.gestor_id is not null then
    perform public.kt_insert_notification(
      new.gestor_id,
      'support_requested',
      'Pedido de apoio direcionado',
      new.nome || ' registrou um pedido que requer seu acompanhamento.',
      '/gestor#apoio'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_kt_notify_ajuda on public.kt_ajuda;
create trigger trg_kt_notify_ajuda
after insert on public.kt_ajuda
for each row execute function public.kt_notify_ajuda();

-- Realtime precisa incluir app_notifications na publicação do Supabase.
-- A inclusão é idempotente apenas se verificada antes; faça isso no deploy da migration.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end $$;
