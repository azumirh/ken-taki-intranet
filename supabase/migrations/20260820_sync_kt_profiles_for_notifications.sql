-- app_notifications is a shared table whose user_id FK targets public.profiles.
-- Keep that shared contract intact and mirror Ken Taki manager/RH identities into profiles.

create or replace function public.kt_sync_shared_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_kt public.kt_perfis%rowtype;
  v_email text;
  v_role text;
begin
  select * into v_kt from public.kt_perfis where id = p_user_id;
  if not found then return; end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null or v_email = '' then return; end if;

  v_role := case
    when v_kt.tipo = 'gestor' then 'gestor'
    when v_kt.tipo in ('azumi','rh') then 'rh'
    else v_kt.tipo
  end;

  insert into public.profiles (id,nome,email,role,ativo)
  values (v_kt.id,v_kt.nome,v_email,v_role,coalesce(v_kt.ativo,true))
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        ativo = excluded.ativo;
end;
$$;

create or replace function public.kt_sync_shared_profile_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.kt_sync_shared_profile(new.id);
  return new;
end;
$$;

drop trigger if exists trg_kt_sync_shared_profile on public.kt_perfis;
create trigger trg_kt_sync_shared_profile
after insert or update of nome,tipo,ativo on public.kt_perfis
for each row execute function public.kt_sync_shared_profile_trigger();

-- Backfill current manager/RH identities.
do $$
declare
  r record;
begin
  for r in select id from public.kt_perfis loop
    perform public.kt_sync_shared_profile(r.id);
  end loop;
end $$;
