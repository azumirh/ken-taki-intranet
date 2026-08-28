alter table public.kt_colaboradores
  add column if not exists aniversario_visivel boolean not null default true;

update public.kt_colaboradores
set aniversario_visivel = false,
    updated_at = now()
where lower(nome) = 'laura'
  and filial = 'champagnat'
  and auth_user_id is null;

insert into public.kt_colaboradores (
  id, nome, cpf3, cargo, filial, nascimento, admissao, foto, ativo, aniversario_visivel
)
select
  concat('demo-', substr(md5('carolina-mendes-birthday-demo-2026'), 1, 12)),
  'CAROLINA MENDES · DEMO',
  '681',
  'Atendente',
  'champagnat',
  '1996-08-23',
  '2025-04-14',
  'https://i.pravatar.cc/400?img=32',
  true,
  true
where not exists (
  select 1 from public.kt_colaboradores
  where nome = 'CAROLINA MENDES · DEMO' and filial = 'champagnat'
);

create or replace function public.kt_employee_month_birthdays()
returns table(id text, nome text, cargo text, filial text, nascimento date, foto text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with me as (
    select c.filial
    from public.kt_colaboradores c
    where c.auth_user_id = auth.uid()
      and c.ativo = true
    limit 1
  )
  select c.id, c.nome, c.cargo, c.filial, c.nascimento::date, c.foto
  from public.kt_colaboradores c
  join me on me.filial = c.filial
  where c.ativo = true
    and coalesce(c.aniversario_visivel, true) = true
    and nullif(c.nascimento, '') is not null
    and extract(month from c.nascimento::date) = extract(month from current_date)
  order by extract(day from c.nascimento::date), c.nome;
$function$;

with ranked as (
  select id,
         row_number() over (partition by para_id, de order by ts desc, id desc) as rn
  from public.kt_bday_msgs
  where mensagem = '__reacao__'
)
delete from public.kt_bday_msgs b
using ranked r
where b.id = r.id and r.rn > 1;

create unique index if not exists kt_bday_msgs_one_reaction_per_person
  on public.kt_bday_msgs (para_id, de)
  where mensagem = '__reacao__';

create or replace function public.kt_set_birthday_reaction(
  p_para_id text,
  p_emoji text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nome text;
  v_filial text;
  v_target_ok boolean;
begin
  select c.nome, c.filial
    into v_nome, v_filial
  from public.kt_colaboradores c
  where c.auth_user_id = auth.uid()
    and c.ativo = true
  limit 1;

  if v_nome is null then
    raise exception 'Colaborador autenticado não encontrado';
  end if;

  select exists(
    select 1
    from public.kt_colaboradores c
    where c.id = p_para_id
      and c.ativo = true
      and coalesce(c.aniversario_visivel, true) = true
      and c.filial = v_filial
  ) into v_target_ok;

  if not v_target_ok then
    raise exception 'Aniversariante não disponível para este colaborador';
  end if;

  delete from public.kt_bday_msgs
  where para_id = p_para_id
    and de = v_nome
    and mensagem = '__reacao__';

  if p_emoji is null or btrim(p_emoji) = '' then
    return true;
  end if;

  if p_emoji <> all(array['🎉','🎂','❤️','🥳']::text[]) then
    raise exception 'Reação inválida';
  end if;

  insert into public.kt_bday_msgs (id, para_id, de, emoji, mensagem, ts)
  values (gen_random_uuid()::text, p_para_id, v_nome, p_emoji, '__reacao__', now());

  return true;
end;
$function$;

revoke all on function public.kt_set_birthday_reaction(text,text) from public;
revoke all on function public.kt_set_birthday_reaction(text,text) from anon;
grant execute on function public.kt_set_birthday_reaction(text,text) to authenticated;
