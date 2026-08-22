alter table public.kt_colaboradores
  add column if not exists nome_preferido text,
  add column if not exists cor_perfil text;

alter table public.kt_colaboradores
  drop constraint if exists kt_colaboradores_cor_perfil_check;

alter table public.kt_colaboradores
  add constraint kt_colaboradores_cor_perfil_check
  check (cor_perfil is null or cor_perfil ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.kt_update_my_profile_preferences(
  p_nome_preferido text,
  p_cor_perfil text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_cor_perfil is not null and p_cor_perfil !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid_color';
  end if;

  update public.kt_colaboradores
  set
    nome_preferido = nullif(trim(coalesce(p_nome_preferido, '')), ''),
    cor_perfil = p_cor_perfil,
    updated_at = now()
  where auth_user_id = auth.uid()
    and coalesce(ativo, true) = true;

  if not found then
    raise exception 'employee_not_found';
  end if;
end;
$$;

revoke all on function public.kt_update_my_profile_preferences(text, text) from public;
grant execute on function public.kt_update_my_profile_preferences(text, text) to authenticated;

alter table public.kt_content_interactions
  drop constraint if exists kt_content_interactions_action_check;

alter table public.kt_content_interactions
  add constraint kt_content_interactions_action_check
  check (action = any (array[
    'view'::text,
    'click'::text,
    'like'::text,
    'dislike'::text,
    'heart'::text,
    'question'::text,
    'ack'::text,
    'responded_yes'::text,
    'responded_no'::text
  ]));

create or replace function public.kt_notify_mural_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filial text;
  v_nome text;
begin
  if new.content_type <> 'mural' or new.action <> 'question' then
    return new;
  end if;

  select m.filial into v_filial
  from public.kt_mural m
  where m.id = new.content_id;

  select coalesce(nullif(c.nome_preferido, ''), c.nome)
  into v_nome
  from public.kt_colaboradores c
  where c.auth_user_id = new.actor_auth_id
  limit 1;

  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'mural_question',
    'Dúvida em um recado do mural',
    coalesce(v_nome, 'Um colaborador') || ' sinalizou que ficou com dúvida em uma publicação do mural.',
    '/gestor#mural'
  from public.kt_perfis p
  where p.tipo = 'gestor'
    and coalesce(p.ativo, true) = true
    and (v_filial is null or v_filial = 'todas' or p.filial = v_filial);

  return new;
end;
$$;

revoke all on function public.kt_notify_mural_question() from public;

drop trigger if exists trg_kt_notify_mural_question on public.kt_content_interactions;
create trigger trg_kt_notify_mural_question
after insert on public.kt_content_interactions
for each row execute function public.kt_notify_mural_question();
