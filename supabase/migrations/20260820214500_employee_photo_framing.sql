-- Ken Taki: persist non-destructive photo framing for employee images.
-- The original image URL is preserved; only object-position/zoom metadata changes.

alter table public.kt_colaboradores
  add column if not exists foto_pos_x smallint not null default 50
    check (foto_pos_x between 0 and 100),
  add column if not exists foto_pos_y smallint not null default 35
    check (foto_pos_y between 0 and 100),
  add column if not exists foto_zoom numeric(4,2) not null default 1.00
    check (foto_zoom between 1.00 and 1.80);

create or replace function public.kt_update_my_photo_frame(
  p_x integer,
  p_y integer,
  p_zoom numeric
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_x not between 0 and 100
     or p_y not between 0 and 100
     or p_zoom < 1.00
     or p_zoom > 1.80 then
    raise exception 'Enquadramento de foto inválido.';
  end if;

  update public.kt_colaboradores
  set foto_pos_x = p_x,
      foto_pos_y = p_y,
      foto_zoom = p_zoom
  where auth_user_id = (select auth.uid())
    and ativo = true;

  return found;
end;
$$;

revoke execute on function public.kt_update_my_photo_frame(integer, integer, numeric) from public, anon;
grant execute on function public.kt_update_my_photo_frame(integer, integer, numeric) to authenticated;
