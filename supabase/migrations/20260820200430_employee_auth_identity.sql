-- Map each active collaborator to an internal Supabase Auth user.
-- This is additive: existing collaborator access keeps working until the RLS hardening migration lands.

alter table public.kt_colaboradores
  add column if not exists auth_user_id uuid unique;

create index if not exists idx_kt_colaboradores_auth_user_id
  on public.kt_colaboradores(auth_user_id)
  where auth_user_id is not null;

create or replace function public.kt_current_employee_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.kt_colaboradores c
  where c.auth_user_id = auth.uid()
    and c.ativo = true
  limit 1;
$$;

create or replace function public.kt_current_profile_type()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.tipo
  from public.kt_perfis p
  where p.id = auth.uid()
    and coalesce(p.ativo, true) = true
  limit 1;
$$;

create or replace function public.kt_current_profile_filial()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.filial
  from public.kt_perfis p
  where p.id = auth.uid()
    and coalesce(p.ativo, true) = true
  limit 1;
$$;

create or replace function public.kt_set_employee_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id text;
begin
  if new.colaborador_id is null then
    v_employee_id := public.kt_current_employee_id();
    if v_employee_id is not null then
      new.colaborador_id := v_employee_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kt_feedbacks_employee_owner on public.kt_feedbacks;
create trigger trg_kt_feedbacks_employee_owner
before insert on public.kt_feedbacks
for each row execute function public.kt_set_employee_owner();

drop trigger if exists trg_kt_sugestoes_employee_owner on public.kt_sugestoes;
create trigger trg_kt_sugestoes_employee_owner
before insert on public.kt_sugestoes
for each row execute function public.kt_set_employee_owner();

drop trigger if exists trg_kt_ajuda_employee_owner on public.kt_ajuda;
create trigger trg_kt_ajuda_employee_owner
before insert on public.kt_ajuda
for each row execute function public.kt_set_employee_owner();

drop trigger if exists trg_kt_assinaturas_employee_owner on public.kt_assinaturas;
create trigger trg_kt_assinaturas_employee_owner
before insert on public.kt_assinaturas
for each row execute function public.kt_set_employee_owner();

drop trigger if exists trg_kt_leituras_employee_owner on public.kt_leituras;
create trigger trg_kt_leituras_employee_owner
before insert on public.kt_leituras
for each row execute function public.kt_set_employee_owner();
