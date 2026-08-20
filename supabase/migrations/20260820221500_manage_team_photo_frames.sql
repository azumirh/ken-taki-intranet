-- Ken Taki: managers can adjust photos from their own unit; RH can adjust all units.
-- The original image is never altered; only framing metadata is changed.

create or replace function public.kt_list_manageable_photo_frames()
returns table (
  id text,
  nome text,
  cargo text,
  filial text,
  foto text,
  foto_pos_x smallint,
  foto_pos_y smallint,
  foto_zoom numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with caller as (
    select p.tipo, p.filial
    from public.kt_perfis p
    where p.id = auth.uid()
      and coalesce(p.ativo, true)
    limit 1
  )
  select
    c.id,
    c.nome,
    c.cargo,
    c.filial,
    c.foto,
    c.foto_pos_x,
    c.foto_pos_y,
    c.foto_zoom
  from public.kt_colaboradores c
  cross join caller
  where coalesce(c.ativo, true)
    and c.foto is not null
    and (
      caller.tipo in ('azumi', 'rh')
      or (caller.tipo = 'gestor' and caller.filial = c.filial)
    )
  order by c.filial, c.nome;
$$;

create or replace function public.kt_update_managed_photo_frame(
  p_colaborador_id text,
  p_x integer,
  p_y integer,
  p_zoom numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
  v_filial text;
  v_target_filial text;
begin
  if p_x not between 0 and 100
     or p_y not between 0 and 100
     or p_zoom < 1.00
     or p_zoom > 1.80 then
    raise exception 'Enquadramento de foto inválido.';
  end if;

  select p.tipo, p.filial
  into v_tipo, v_filial
  from public.kt_perfis p
  where p.id = auth.uid()
    and coalesce(p.ativo, true)
  limit 1;

  if v_tipo is null or v_tipo not in ('gestor', 'azumi', 'rh') then
    raise exception 'Usuário sem permissão para ajustar fotos.';
  end if;

  select c.filial
  into v_target_filial
  from public.kt_colaboradores c
  where c.id = p_colaborador_id
    and coalesce(c.ativo, true)
  limit 1;

  if v_target_filial is null then
    return false;
  end if;

  if v_tipo = 'gestor' and v_filial is distinct from v_target_filial then
    raise exception 'Gestor só pode ajustar fotos da própria unidade.';
  end if;

  update public.kt_colaboradores
  set foto_pos_x = p_x,
      foto_pos_y = p_y,
      foto_zoom = p_zoom
  where id = p_colaborador_id;

  return found;
end;
$$;

revoke execute on function public.kt_list_manageable_photo_frames() from public, anon;
revoke execute on function public.kt_update_managed_photo_frame(text, integer, integer, numeric) from public, anon;
grant execute on function public.kt_list_manageable_photo_frames() to authenticated;
grant execute on function public.kt_update_managed_photo_frame(text, integer, integer, numeric) to authenticated;
