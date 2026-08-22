create or replace function public.kt_operational_people_directory()
returns table(id text,nome text,filial text,cargo text,ativo boolean)
language sql stable security definer set search_path=public as $$
  select c.id,c.nome,c.filial,c.cargo,c.ativo
  from public.kt_colaboradores c
  where
    (public.kt_current_profile_type()='gestor' and c.filial=public.kt_current_profile_filial())
    or (
      public.kt_current_profile_type() in ('azumi','rh')
      and (
        public.kt_has_admin_permission('casos','view')
        or public.kt_has_admin_permission('offboarding','view')
        or public.kt_has_admin_permission('reconhecimento','view')
        or public.kt_has_admin_permission('onboarding','view')
        or public.kt_has_admin_permission('colaboradores','view')
      )
    )
  order by c.filial,c.nome;
$$;
revoke all on function public.kt_operational_people_directory() from public,anon;
grant execute on function public.kt_operational_people_directory() to authenticated,service_role;