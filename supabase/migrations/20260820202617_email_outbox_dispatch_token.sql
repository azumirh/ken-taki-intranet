-- Ken Taki: per-message dispatch token for idempotent email delivery.
alter table public.kt_email_outbox
  add column if not exists dispatch_token uuid not null default gen_random_uuid();

create unique index if not exists idx_kt_email_outbox_dispatch_token
  on public.kt_email_outbox (dispatch_token);
