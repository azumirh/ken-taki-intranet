create or replace function public.kt_employee_feedback_directory()
returns table(id text,nome text,cargo text,filial text)
language sql stable security definer set search_path=public as $$
  select c.id,c.nome,c.cargo,c.filial
  from public.kt_colaboradores c
  join public.kt_colaboradores me on me.auth_user_id=(select auth.uid()) and coalesce(me.ativo,true)
  where coalesce(c.ativo,true) and c.filial=me.filial
  order by c.nome;
$$;
revoke all on function public.kt_employee_feedback_directory() from public,anon;
grant execute on function public.kt_employee_feedback_directory() to authenticated,service_role;