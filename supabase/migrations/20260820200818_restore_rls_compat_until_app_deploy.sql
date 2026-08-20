-- Temporary compatibility layer.
-- The hardened policies were validated, but production still runs the old frontend until PR merge.
-- Keep current behavior live to avoid breaking collaborator actions; re-harden immediately after app rollout.

drop policy if exists kt_feedbacks_select_scoped on public.kt_feedbacks;
drop policy if exists kt_feedbacks_insert_scoped on public.kt_feedbacks;
drop policy if exists kt_feedbacks_update_scoped on public.kt_feedbacks;
create policy kt_read_public on public.kt_feedbacks for select to anon, authenticated using (true);
create policy kt_insert_public on public.kt_feedbacks for insert to anon, authenticated with check (true);
create policy kt_update_authenticated on public.kt_feedbacks for update to authenticated using (true) with check (true);

drop policy if exists kt_sugestoes_select_scoped on public.kt_sugestoes;
drop policy if exists kt_sugestoes_insert_scoped on public.kt_sugestoes;
drop policy if exists kt_sugestoes_update_scoped on public.kt_sugestoes;
create policy kt_read_public on public.kt_sugestoes for select to anon, authenticated using (true);
create policy kt_insert_public on public.kt_sugestoes for insert to anon, authenticated with check (true);
create policy kt_update_authenticated on public.kt_sugestoes for update to authenticated using (true) with check (true);

drop policy if exists kt_ajuda_select_scoped on public.kt_ajuda;
drop policy if exists kt_ajuda_insert_scoped on public.kt_ajuda;
drop policy if exists kt_ajuda_update_scoped on public.kt_ajuda;
create policy kt_read_public on public.kt_ajuda for select to anon, authenticated using (true);
create policy kt_insert_public on public.kt_ajuda for insert to anon, authenticated with check (true);
create policy kt_update_authenticated on public.kt_ajuda for update to authenticated using (true) with check (true);

drop policy if exists kt_assinaturas_select_scoped on public.kt_assinaturas;
drop policy if exists kt_assinaturas_insert_scoped on public.kt_assinaturas;
create policy kt_read_public on public.kt_assinaturas for select to anon, authenticated using (true);
create policy kt_insert_public on public.kt_assinaturas for insert to anon, authenticated with check (true);

drop policy if exists kt_leituras_select_scoped on public.kt_leituras;
drop policy if exists kt_leituras_insert_scoped on public.kt_leituras;
create policy kt_read_public on public.kt_leituras for select to anon, authenticated using (true);
create policy kt_insert_public on public.kt_leituras for insert to anon, authenticated with check (true);
