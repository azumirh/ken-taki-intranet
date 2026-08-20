-- Content engagement visibility must follow the permission for the content type.
-- A partial RH admin with access only to Mural or Pesquisas must not depend on
-- the Notícias permission, and must not see interaction rows from other sections.
drop policy if exists kt_content_interactions_select on public.kt_content_interactions;

create policy kt_content_interactions_select
on public.kt_content_interactions
for select
to authenticated
using (
  actor_auth_id = auth.uid()
  or (
    public.kt_current_profile_type() in ('azumi','rh')
    and (
      (content_type = 'noticia' and public.kt_has_admin_permission('noticias','view'))
      or (content_type = 'mural' and public.kt_has_admin_permission('mural','view'))
      or (content_type = 'pesquisa' and public.kt_has_admin_permission('pesquisas','view'))
    )
  )
);
