-- RH admin level/profile controls.

create or replace function public.kt_set_admin_level(p_profile_id uuid, p_level text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.kt_is_admin_general() then
    raise exception 'Apenas administrador geral pode alterar o nível administrativo.';
  end if;
  if p_profile_id = auth.uid() and p_level <> 'geral' then
    raise exception 'O administrador geral não pode reduzir o próprio acesso.';
  end if;
  if p_level not in ('geral','parcial') then
    raise exception 'Nível administrativo inválido.';
  end if;
  update public.kt_perfis
  set admin_nivel=p_level, updated_at=now()
  where id=p_profile_id and tipo in ('azumi','rh');
  if not found then raise exception 'Perfil de RH não encontrado.'; end if;
  if p_level='geral' then
    delete from public.kt_admin_permissions where profile_id=p_profile_id;
  end if;
  return true;
end;
$$;

create or replace function public.kt_update_my_profile_name(p_nome text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if length(trim(coalesce(p_nome,''))) < 2 then
    raise exception 'Nome inválido.';
  end if;
  update public.kt_perfis set nome=trim(p_nome), updated_at=now() where id=auth.uid();
  return found;
end;
$$;

revoke execute on function public.kt_set_admin_level(uuid,text) from public,anon;
revoke execute on function public.kt_update_my_profile_name(text) from public,anon;
grant execute on function public.kt_set_admin_level(uuid,text) to authenticated;
grant execute on function public.kt_update_my_profile_name(text) to authenticated;
