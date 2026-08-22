-- Admin Parcial support access must be enforced in RLS; case workflow writes go through guarded RPCs.

drop policy if exists kt_ajuda_select_scoped on public.kt_ajuda;
create policy kt_ajuda_select_scoped on public.kt_ajuda for select to authenticated using (
  ((select public.kt_current_employee_id()) is not null and colaborador_id=(select public.kt_current_employee_id()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('apoio','view')))
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and (destino_inicial='gestor' or gestor_id=(select auth.uid())))
);

drop policy if exists kt_ajuda_update_scoped on public.kt_ajuda;
create policy kt_ajuda_update_scoped on public.kt_ajuda for update to authenticated using (
  ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('apoio','edit')))
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and (destino_inicial='gestor' or gestor_id=(select auth.uid())))
) with check (
  ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('apoio','edit')))
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and (destino_inicial='gestor' or gestor_id=(select auth.uid())))
);

drop policy if exists kt_casos_update on public.kt_casos;
create policy kt_casos_update on public.kt_casos for update to authenticated using (
  (select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit'))
) with check (
  (select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit'))
);

revoke execute on function public.kt_update_feedback_case(text,text,uuid,text,timestamptz,text,text) from public,anon;
grant execute on function public.kt_update_feedback_case(text,text,uuid,text,timestamptz,text,text) to authenticated,service_role;
revoke execute on function public.kt_update_support_case(text,text,text,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.kt_update_support_case(text,text,text,uuid,text,timestamptz,text) to authenticated,service_role;