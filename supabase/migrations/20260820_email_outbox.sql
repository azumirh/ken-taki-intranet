-- Durable transactional email queue for Ken Taki notifications.
-- Delivery is asynchronous: business actions never fail because the email provider is unavailable.

create table if not exists public.kt_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.app_notifications(id) on delete cascade,
  user_id uuid not null,
  recipient text not null,
  event_type text not null,
  subject text not null,
  body text,
  action_url text,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  provider_id text,
  created_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(notification_id, recipient)
);

create index if not exists idx_kt_email_outbox_status_created
  on public.kt_email_outbox(status, created_at);

create index if not exists idx_kt_email_outbox_user_id
  on public.kt_email_outbox(user_id);

alter table public.kt_email_outbox enable row level security;

-- Only RH/Admin profiles can inspect delivery diagnostics through the client.
drop policy if exists kt_email_outbox_rh_read on public.kt_email_outbox;
create policy kt_email_outbox_rh_read
on public.kt_email_outbox
for select
to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh'));

create or replace function public.kt_queue_email_from_notification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_profile_type text;
begin
  -- Only operational events should create email. Pure informational/read events stay in-app.
  if new.type not in ('document_signed','feedback_received','support_requested') then
    return new;
  end if;

  select u.email, p.tipo
    into v_email, v_profile_type
  from auth.users u
  left join public.kt_perfis p on p.id = u.id
  where u.id = new.user_id
  limit 1;

  -- Ignore users without a deliverable address and synthetic collaborator identities.
  if v_email is null
     or v_email = ''
     or v_email like '%@colaborador.kentaki.com.br'
     or v_profile_type not in ('gestor','azumi','rh') then
    return new;
  end if;

  insert into public.kt_email_outbox (
    notification_id,
    user_id,
    recipient,
    event_type,
    subject,
    body,
    action_url
  )
  values (
    new.id,
    new.user_id,
    lower(v_email),
    new.type,
    new.title,
    new.body,
    new.action_url
  )
  on conflict (notification_id, recipient) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_kt_queue_notification_email on public.app_notifications;
create trigger trg_kt_queue_notification_email
after insert on public.app_notifications
for each row execute function public.kt_queue_email_from_notification();
