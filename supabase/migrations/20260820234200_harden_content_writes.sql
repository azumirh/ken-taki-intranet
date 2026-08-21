-- Legacy policies allowed every authenticated user to mutate news and surveys.
-- With collaborators now using Supabase Auth, writes must be restricted to RH
-- accounts with the matching section edit permission. Read policies stay intact
-- because published content is intentionally available to the workforce.

drop policy if exists kt_write_authenticated on public.kt_noticias;
drop policy if exists kt_noticias_rh_write on public.kt_noticias;
create policy kt_noticias_rh_write
on public.kt_noticias
for all
to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('noticias','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('noticias','edit')
);

drop policy if exists kt_write_authenticated on public.kt_pesquisas;
drop policy if exists kt_pesquisas_rh_write on public.kt_pesquisas;
create policy kt_pesquisas_rh_write
on public.kt_pesquisas
for all
to authenticated
using (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('pesquisas','edit')
)
with check (
  public.kt_current_profile_type() in ('azumi','rh')
  and public.kt_has_admin_permission('pesquisas','edit')
);
