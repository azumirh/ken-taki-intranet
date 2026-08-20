-- Allow authenticated users to remove only their own interaction rows so
-- mutually exclusive choices (like/dislike, responded yes/no) can be changed.
drop policy if exists "kt_content_interactions_own_delete" on public.kt_content_interactions;

create policy "kt_content_interactions_own_delete"
on public.kt_content_interactions
for delete
to authenticated
using (actor_auth_id = auth.uid());
