-- Remove permissive prototype-era policies and enforce production role/filial/confidentiality rules.

drop policy if exists kt_read_public on public.kt_colaboradores;
drop policy if exists kt_write_authenticated on public.kt_colaboradores;
drop policy if exists kt_colaboradores_scoped_select on public.kt_colaboradores;
drop policy if exists kt_colaboradores_rh_insert on public.kt_colaboradores;
drop policy if exists kt_colaboradores_rh_update on public.kt_colaboradores;
drop policy if exists kt_colaboradores_rh_delete on public.kt_colaboradores;
create policy kt_colaboradores_scoped_select on public.kt_colaboradores for select to authenticated using (
  auth_user_id=(select auth.uid())
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('colaboradores','view')))
);
create policy kt_colaboradores_rh_insert on public.kt_colaboradores for insert to authenticated with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('colaboradores','edit')));
create policy kt_colaboradores_rh_update on public.kt_colaboradores for update to authenticated using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('colaboradores','edit'))) with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('colaboradores','edit')));
create policy kt_colaboradores_rh_delete on public.kt_colaboradores for delete to authenticated using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('colaboradores','delete')));

drop policy if exists kt_read_public on public.kt_feedbacks;
drop policy if exists kt_update_authenticated on public.kt_feedbacks;
drop policy if exists kt_insert_public on public.kt_feedbacks;
drop policy if exists kt_feedbacks_scoped_select on public.kt_feedbacks;
drop policy if exists kt_feedbacks_scoped_insert on public.kt_feedbacks;
drop policy if exists kt_feedbacks_scoped_update on public.kt_feedbacks;
drop policy if exists kt_feedbacks_rh_delete on public.kt_feedbacks;
create policy kt_feedbacks_scoped_select on public.kt_feedbacks for select to authenticated using (
  (colaborador_id is not null and colaborador_id=(select public.kt_current_employee_id()))
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and (coalesce(gestor_liberado,false) or (coalesce(destino,'gestor')='gestor' and coalesce(triagem_rh_status,'nao_necessaria')='nao_necessaria')))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('feedbacks','view')))
);
create policy kt_feedbacks_scoped_insert on public.kt_feedbacks for insert to authenticated with check (
  (colaborador_id is not null and colaborador_id=(select public.kt_current_employee_id()))
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and criado_por_profile_id=(select auth.uid()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('feedbacks','edit')))
);
create policy kt_feedbacks_scoped_update on public.kt_feedbacks for update to authenticated using (
  ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and (coalesce(gestor_liberado,false) or (coalesce(destino,'gestor')='gestor' and coalesce(triagem_rh_status,'nao_necessaria')='nao_necessaria')))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('feedbacks','edit')))
) with check (
  ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and (coalesce(gestor_liberado,false) or (coalesce(destino,'gestor')='gestor' and coalesce(triagem_rh_status,'nao_necessaria')='nao_necessaria')))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('feedbacks','edit')))
);
create policy kt_feedbacks_rh_delete on public.kt_feedbacks for delete to authenticated using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('feedbacks','delete')));

drop policy if exists kt_read_public on public.kt_ajuda;
drop policy if exists kt_update_authenticated on public.kt_ajuda;
drop policy if exists kt_insert_public on public.kt_ajuda;
drop policy if exists kt_ajuda_insert_scoped on public.kt_ajuda;
create policy kt_ajuda_insert_scoped on public.kt_ajuda for insert to authenticated with check (
  (colaborador_id is not null and colaborador_id=(select public.kt_current_employee_id()))
  or ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()) and criado_por_profile_id=(select auth.uid()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('apoio','edit')))
);

drop policy if exists kt_insert_public on public.kt_sugestoes;
drop policy if exists kt_sugestoes_employee_insert on public.kt_sugestoes;
create policy kt_sugestoes_employee_insert on public.kt_sugestoes for insert to authenticated with check (
  (colaborador_id is not null and colaborador_id=(select public.kt_current_employee_id()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('sugestoes','edit')))
);

drop policy if exists kt_insert_public on public.kt_mural;
drop policy if exists kt_mural_rh_insert on public.kt_mural;
create policy kt_mural_rh_insert on public.kt_mural for insert to authenticated with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('mural','edit')));

revoke all on table public.kt_colaboradores from anon;
revoke all on table public.kt_feedbacks from anon;
revoke all on table public.kt_ajuda from anon;
revoke insert,update,delete on table public.kt_sugestoes from anon;
revoke insert,update,delete on table public.kt_mural from anon;