create or replace function public.kt_sync_employee_profile_photo_from_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if new.bucket_id <> 'kt-documentos'
     or new.name not like 'fotos/%'
     or new.owner is null then
    return new;
  end if;

  update public.kt_colaboradores
     set foto = 'https://nxmwhtkygiljkbovwixk.supabase.co/storage/v1/object/public/'
                || new.bucket_id || '/' || new.name,
         updated_at = now()
   where auth_user_id = new.owner;

  return new;
end;
$$;

revoke all on function public.kt_sync_employee_profile_photo_from_storage() from public, anon, authenticated;

drop trigger if exists kt_sync_employee_profile_photo_from_storage on storage.objects;
create trigger kt_sync_employee_profile_photo_from_storage
after insert or update of name, bucket_id, owner
on storage.objects
for each row
execute function public.kt_sync_employee_profile_photo_from_storage();

with latest_photo as (
  select distinct on (o.owner)
         o.owner,
         o.bucket_id,
         o.name
    from storage.objects o
   where o.bucket_id = 'kt-documentos'
     and o.name like 'fotos/%'
     and o.owner is not null
   order by o.owner, o.created_at desc
)
update public.kt_colaboradores c
   set foto = 'https://nxmwhtkygiljkbovwixk.supabase.co/storage/v1/object/public/'
              || p.bucket_id || '/' || p.name,
       updated_at = now()
  from latest_photo p
 where c.auth_user_id = p.owner
   and coalesce(c.foto, '') = '';
