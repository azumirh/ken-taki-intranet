-- Enforce the RH permission matrix at database level.
-- Published news/documents/surveys remain readable by the workforce, but
-- administrative mutations are split between edit and delete permissions.
-- Anonymous suggestions are no longer publicly readable.

-- NEWS -----------------------------------------------------------------------
drop policy if exists kt_noticias_rh_write on public.kt_noticias;
drop policy if exists kt_noticias_rh_insert on public.kt_noticias;
drop policy if exists kt_noticias_rh_update on public.kt_noticias;
drop policy if exists kt_noticias_rh_delete on public.kt_noticias;

create policy kt_noticias_rh_insert
on public.kt_noticias for insert to authenticated
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('noticias','edit')
);

create policy kt_noticias_rh_update
on public.kt_noticias for update to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('noticias','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('noticias','edit')
);

create policy kt_noticias_rh_delete
on public.kt_noticias for delete to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('noticias','delete')
);

-- SURVEYS --------------------------------------------------------------------
drop policy if exists kt_pesquisas_rh_write on public.kt_pesquisas;
drop policy if exists kt_pesquisas_rh_insert on public.kt_pesquisas;
drop policy if exists kt_pesquisas_rh_update on public.kt_pesquisas;
drop policy if exists kt_pesquisas_rh_delete on public.kt_pesquisas;

create policy kt_pesquisas_rh_insert
on public.kt_pesquisas for insert to authenticated
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('pesquisas','edit')
);

create policy kt_pesquisas_rh_update
on public.kt_pesquisas for update to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('pesquisas','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('pesquisas','edit')
);

create policy kt_pesquisas_rh_delete
on public.kt_pesquisas for delete to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('pesquisas','delete')
);

-- DOCUMENTS ------------------------------------------------------------------
drop policy if exists kt_write_authenticated on public.kt_documentos;
drop policy if exists kt_documentos_rh_insert on public.kt_documentos;
drop policy if exists kt_documentos_rh_update on public.kt_documentos;
drop policy if exists kt_documentos_rh_delete on public.kt_documentos;

create policy kt_documentos_rh_insert
on public.kt_documentos for insert to authenticated
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('documentos','edit')
);

create policy kt_documentos_rh_update
on public.kt_documentos for update to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('documentos','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('documentos','edit')
);

create policy kt_documentos_rh_delete
on public.kt_documentos for delete to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('documentos','delete')
);

-- MURAL ----------------------------------------------------------------------
-- Keep the legacy public INSERT temporarily: the production collaborator UI
-- still uses anonymous Supabase access until the new authenticated frontend is
-- promoted. Administrative update/delete are nevertheless permission-bound.
drop policy if exists kt_mural_rh_update on public.kt_mural;
drop policy if exists kt_mural_rh_delete on public.kt_mural;

create policy kt_mural_rh_update
on public.kt_mural for update to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('mural','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('mural','edit')
);

create policy kt_mural_rh_delete
on public.kt_mural for delete to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('mural','delete')
);

-- SUGGESTIONS ----------------------------------------------------------------
drop policy if exists kt_read_public on public.kt_sugestoes;
drop policy if exists kt_update_authenticated on public.kt_sugestoes;
drop policy if exists kt_sugestoes_private_select on public.kt_sugestoes;
drop policy if exists kt_sugestoes_rh_update on public.kt_sugestoes;
drop policy if exists kt_sugestoes_rh_delete on public.kt_sugestoes;

create policy kt_sugestoes_private_select
on public.kt_sugestoes for select to authenticated
using (
  (
    public.kt_current_profile_type() in ('azumi','rh')
    and public.kt_has_admin_permission('sugestoes','view')
  )
  or (
    public.kt_current_profile_type() = 'gestor'
    and coalesce(gestor_compartilhado,false)
    and filial = public.kt_current_profile_filial()
  )
  or (
    colaborador_id is not null
    and colaborador_id = public.kt_current_employee_id()
  )
);

create policy kt_sugestoes_rh_update
on public.kt_sugestoes for update to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('sugestoes','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('sugestoes','edit')
);

create policy kt_sugestoes_rh_delete
on public.kt_sugestoes for delete to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('sugestoes','delete')
);
