alter table public.kt_profile_preferences
  drop constraint if exists kt_profile_preferences_profile_id_fkey;

alter table public.kt_profile_preferences
  add constraint kt_profile_preferences_profile_id_fkey
  foreign key (profile_id) references auth.users(id) on delete cascade;

alter table public.kt_profile_preferences
  add column if not exists display_name text,
  add column if not exists nickname text,
  add column if not exists gender text,
  add column if not exists bio text,
  add column if not exists instagram_url text,
  add column if not exists linkedin_url text,
  add column if not exists tiktok_url text,
  add column if not exists website_url text,
  add column if not exists avatar_url text,
  add column if not exists avatar_pos_x smallint not null default 50,
  add column if not exists avatar_pos_y smallint not null default 35,
  add column if not exists avatar_zoom numeric(4,2) not null default 1.00,
  add column if not exists show_gender boolean not null default false,
  add column if not exists show_bio boolean not null default true,
  add column if not exists show_socials boolean not null default true;

alter table public.kt_profile_preferences
  drop constraint if exists kt_profile_preferences_display_name_len,
  drop constraint if exists kt_profile_preferences_nickname_len,
  drop constraint if exists kt_profile_preferences_gender_len,
  drop constraint if exists kt_profile_preferences_bio_len,
  drop constraint if exists kt_profile_preferences_avatar_x_check,
  drop constraint if exists kt_profile_preferences_avatar_y_check,
  drop constraint if exists kt_profile_preferences_avatar_zoom_check;

alter table public.kt_profile_preferences
  add constraint kt_profile_preferences_display_name_len check (display_name is null or char_length(display_name) <= 80),
  add constraint kt_profile_preferences_nickname_len check (nickname is null or char_length(nickname) <= 40),
  add constraint kt_profile_preferences_gender_len check (gender is null or char_length(gender) <= 40),
  add constraint kt_profile_preferences_bio_len check (bio is null or char_length(bio) <= 280),
  add constraint kt_profile_preferences_avatar_x_check check (avatar_pos_x between 0 and 100),
  add constraint kt_profile_preferences_avatar_y_check check (avatar_pos_y between 0 and 100),
  add constraint kt_profile_preferences_avatar_zoom_check check (avatar_zoom between 1.00 and 2.00);

revoke all on table public.kt_profile_preferences from anon;
grant select, insert, update, delete on table public.kt_profile_preferences to authenticated;

insert into public.kt_profile_preferences (
  profile_id,
  display_name,
  avatar_url,
  avatar_pos_x,
  avatar_pos_y,
  avatar_zoom,
  updated_at
)
select
  c.auth_user_id,
  c.nome,
  c.foto,
  c.foto_pos_x,
  c.foto_pos_y,
  c.foto_zoom,
  now()
from public.kt_colaboradores c
where c.auth_user_id is not null
on conflict (profile_id) do update set
  display_name = coalesce(public.kt_profile_preferences.display_name, excluded.display_name),
  avatar_url = coalesce(public.kt_profile_preferences.avatar_url, excluded.avatar_url),
  avatar_pos_x = coalesce(public.kt_profile_preferences.avatar_pos_x, excluded.avatar_pos_x),
  avatar_pos_y = coalesce(public.kt_profile_preferences.avatar_pos_y, excluded.avatar_pos_y),
  avatar_zoom = coalesce(public.kt_profile_preferences.avatar_zoom, excluded.avatar_zoom),
  updated_at = now();

update public.kt_profile_preferences p
set display_name = coalesce(p.display_name, kp.nome), updated_at = now()
from public.kt_perfis kp
where kp.id = p.profile_id;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kt-profile-photos',
  'kt-profile-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists kt_profile_photos_public_read on storage.objects;
create policy kt_profile_photos_public_read
on storage.objects for select
to public
using (bucket_id = 'kt-profile-photos');

drop policy if exists kt_profile_photos_insert_own on storage.objects;
create policy kt_profile_photos_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'kt-profile-photos'
  and name like ((select auth.uid())::text || '/%')
);

drop policy if exists kt_profile_photos_update_own on storage.objects;
create policy kt_profile_photos_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'kt-profile-photos'
  and name like ((select auth.uid())::text || '/%')
)
with check (
  bucket_id = 'kt-profile-photos'
  and name like ((select auth.uid())::text || '/%')
);

drop policy if exists kt_profile_photos_delete_own on storage.objects;
create policy kt_profile_photos_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'kt-profile-photos'
  and name like ((select auth.uid())::text || '/%')
);

create or replace function public.kt_sync_employee_profile_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.kt_colaboradores
  set
    foto = coalesce(new.avatar_url, foto),
    foto_pos_x = new.avatar_pos_x,
    foto_pos_y = new.avatar_pos_y,
    foto_zoom = new.avatar_zoom,
    updated_at = now()
  where auth_user_id = new.profile_id;
  return new;
end;
$$;

revoke all on function public.kt_sync_employee_profile_preferences() from public, anon, authenticated;

drop trigger if exists trg_kt_sync_employee_profile_preferences on public.kt_profile_preferences;
create trigger trg_kt_sync_employee_profile_preferences
after insert or update of avatar_url, avatar_pos_x, avatar_pos_y, avatar_zoom
on public.kt_profile_preferences
for each row execute function public.kt_sync_employee_profile_preferences();