-- Ken Taki: authenticated collaborators may render saved photo framing for
-- colleagues in the same unit without exposing employee private fields.

create or replace function public.kt_list_employee_photo_frames()
returns table (
  id text,
  nome text,
  filial text,
  foto_pos_x smallint,
  foto_pos_y smallint,
  foto_zoom numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with current_employee as (
    select c.filial
    from public.kt_colaboradores c
    where c.auth_user_id = (select auth.uid())
      and c.ativo = true
    limit 1
  )
  select
    c.id,
    c.nome,
    c.filial,
    c.foto_pos_x,
    c.foto_pos_y,
    c.foto_zoom
  from public.kt_colaboradores c
  join current_employee me on me.filial = c.filial
  where c.ativo = true
  order by c.nome;
$$;

revoke execute on function public.kt_list_employee_photo_frames() from public, anon;
grant execute on function public.kt_list_employee_photo_frames() to authenticated;
