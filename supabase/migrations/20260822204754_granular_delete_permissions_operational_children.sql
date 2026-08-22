-- Preserve independent visualizar/editar/excluir semantics all the way through RLS.

-- Case participants: insert/update are operational edits; delete requires section delete.
drop policy if exists kt_caso_envolvidos_write on public.kt_caso_envolvidos;
create policy kt_caso_envolvidos_insert on public.kt_caso_envolvidos for insert to authenticated
with check (exists (
  select 1 from public.kt_casos c where c.id=kt_caso_envolvidos.caso_id and (
    ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit')))
    or ((select public.kt_current_profile_type())='gestor' and c.filial=(select public.kt_current_profile_filial()) and c.confidencialidade not in ('rh','anonymous_rh'))
  )
));
create policy kt_caso_envolvidos_update on public.kt_caso_envolvidos for update to authenticated
using (exists (
  select 1 from public.kt_casos c where c.id=kt_caso_envolvidos.caso_id and (
    ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit')))
    or ((select public.kt_current_profile_type())='gestor' and c.filial=(select public.kt_current_profile_filial()) and c.confidencialidade not in ('rh','anonymous_rh'))
  )
))
with check (exists (
  select 1 from public.kt_casos c where c.id=kt_caso_envolvidos.caso_id and (
    ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit')))
    or ((select public.kt_current_profile_type())='gestor' and c.filial=(select public.kt_current_profile_filial()) and c.confidencialidade not in ('rh','anonymous_rh'))
  )
));
create policy kt_caso_envolvidos_delete on public.kt_caso_envolvidos for delete to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','delete')));

-- Scheduled alerts: editing schedule is edit; destructive removal is delete.
drop policy if exists kt_alertas_write on public.kt_alertas_agendados;
create policy kt_alertas_insert on public.kt_alertas_agendados for insert to authenticated
with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit')));
create policy kt_alertas_update on public.kt_alertas_agendados for update to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit')))
with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','edit')));
create policy kt_alertas_delete on public.kt_alertas_agendados for delete to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('casos','delete')));

-- Offboarding checklist follows the parent section permission model.
drop policy if exists kt_offboarding_checklist_write on public.kt_offboarding_checklist;
create policy kt_offboarding_checklist_insert on public.kt_offboarding_checklist for insert to authenticated
with check (exists (
  select 1 from public.kt_offboardings o where o.id=kt_offboarding_checklist.offboarding_id and (
    ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('offboarding','edit')))
    or ((select public.kt_current_profile_type())='gestor' and o.filial=(select public.kt_current_profile_filial()) and o.status in ('rascunho','aguardando_rh'))
  )
));
create policy kt_offboarding_checklist_update on public.kt_offboarding_checklist for update to authenticated
using (exists (
  select 1 from public.kt_offboardings o where o.id=kt_offboarding_checklist.offboarding_id and (
    ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('offboarding','edit')))
    or ((select public.kt_current_profile_type())='gestor' and o.filial=(select public.kt_current_profile_filial()) and o.status in ('rascunho','aguardando_rh'))
  )
))
with check (exists (
  select 1 from public.kt_offboardings o where o.id=kt_offboarding_checklist.offboarding_id and (
    ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('offboarding','edit')))
    or ((select public.kt_current_profile_type())='gestor' and o.filial=(select public.kt_current_profile_filial()) and o.status in ('rascunho','aguardando_rh'))
  )
));
create policy kt_offboarding_checklist_delete on public.kt_offboarding_checklist for delete to authenticated
using (exists (
  select 1 from public.kt_offboardings o where o.id=kt_offboarding_checklist.offboarding_id
    and (select public.kt_current_profile_type()) in ('azumi','rh')
    and (select public.kt_has_admin_permission('offboarding','delete'))
));

-- Onboarding parent and checklist: no DELETE through edit-only access.
drop policy if exists kt_onboarding_write on public.kt_onboardings;
create policy kt_onboarding_insert on public.kt_onboardings for insert to authenticated
with check (
  ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','edit')))
);
create policy kt_onboarding_update on public.kt_onboardings for update to authenticated
using (
  ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','edit')))
)
with check (
  ((select public.kt_current_profile_type())='gestor' and filial=(select public.kt_current_profile_filial()))
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','edit')))
);
create policy kt_onboarding_delete on public.kt_onboardings for delete to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','delete')));

drop policy if exists kt_onboarding_checklist_write on public.kt_onboarding_checklist;
create policy kt_onboarding_checklist_insert on public.kt_onboarding_checklist for insert to authenticated
with check (exists (
  select 1 from public.kt_onboardings o where o.id=kt_onboarding_checklist.onboarding_id and (
    ((select public.kt_current_profile_type())='gestor' and o.filial=(select public.kt_current_profile_filial()))
    or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','edit')))
  )
));
create policy kt_onboarding_checklist_update on public.kt_onboarding_checklist for update to authenticated
using (exists (
  select 1 from public.kt_onboardings o where o.id=kt_onboarding_checklist.onboarding_id and (
    ((select public.kt_current_profile_type())='gestor' and o.filial=(select public.kt_current_profile_filial()))
    or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','edit')))
  )
))
with check (exists (
  select 1 from public.kt_onboardings o where o.id=kt_onboarding_checklist.onboarding_id and (
    ((select public.kt_current_profile_type())='gestor' and o.filial=(select public.kt_current_profile_filial()))
    or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('onboarding','edit')))
  )
));
create policy kt_onboarding_checklist_delete on public.kt_onboarding_checklist for delete to authenticated
using (exists (
  select 1 from public.kt_onboardings o where o.id=kt_onboarding_checklist.onboarding_id
    and (select public.kt_current_profile_type()) in ('azumi','rh')
    and (select public.kt_has_admin_permission('onboarding','delete'))
));

-- Survey question deletion is a destructive operation and must require delete permission.
drop policy if exists kt_survey_questions_write on public.kt_pesquisa_perguntas;
create policy kt_survey_questions_insert on public.kt_pesquisa_perguntas for insert to authenticated
with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('pesquisas','edit')));
create policy kt_survey_questions_update on public.kt_pesquisa_perguntas for update to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('pesquisas','edit')))
with check ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('pesquisas','edit')));
create policy kt_survey_questions_delete on public.kt_pesquisa_perguntas for delete to authenticated
using ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('pesquisas','delete')));