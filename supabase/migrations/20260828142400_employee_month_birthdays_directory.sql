create or replace function public.kt_employee_month_birthdays()
returns table(
  id text,
  nome text,
  cargo text,
  filial text,
  nascimento date,
  foto text
)
language sql
stable
security definer
set search_path = public
as $$
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
    and nullif(c.nascimento, '') is not null
    and extract(month from c.nascimento::date) = extract(month from current_date)
  order by extract(day from c.nascimento::date), c.nome;
$$;

revoke all on function public.kt_employee_month_birthdays() from public;
revoke all on function public.kt_employee_month_birthdays() from anon;
grant execute on function public.kt_employee_month_birthdays() to authenticated;
