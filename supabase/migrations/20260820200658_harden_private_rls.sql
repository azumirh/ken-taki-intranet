-- Harden private employee data without changing the public informational content tables.
-- Collaborators use an internal Auth identity mapped through kt_colaboradores.auth_user_id.

-- Backfill legacy ownership only where name + filial identify exactly one active collaborator.
with unique_people as (
  select lower(trim(nome)) as nome_key, filial, min(id) as colaborador_id
  from public.kt_colaboradores
  where ativo = true
  group by lower(trim(nome)), filial
  having count(*) = 1
)
update public.kt_feedbacks f
set colaborador_id = u.colaborador_id
from unique_people u
where f.colaborador_id is null
  and nullif(trim(f.autor), '') is not null
  and lower(trim(f.autor)) = u.nome_key
  and f.filial = u.filial;

with unique_people as (
  select lower(trim(nome)) as nome_key, filial, min(id) as colaborador_id
  from public.kt_colaboradores
  where ativo = true
  group by lower(trim(nome)), filial
  having count(*) = 1
)
update public.kt_ajuda a
set colaborador_id = u.colaborador_id
from unique_people u
where a.colaborador_id is null
  and lower(trim(a.nome)) = u.nome_key
  and a.filial = u.filial;

with unique_people as (
  select lower(trim(nome)) as nome_key, filial, min(id) as colaborador_id
  from public.kt_colaboradores
  where ativo = true
  group by lower(trim(nome)), filial
  having count(*) = 1
)
update public.kt_assinaturas a
set colaborador_id = u.colaborador_id
from unique_people u
where a.colaborador_id is null
  and lower(trim(a.nome)) = u.nome_key
  and a.filial = u.filial;

with unique_people as (
  select lower(trim(nome)) as nome_key, filial, min(id) as colaborador_id
  from public.kt_colaboradores
  where ativo = true
  group by lower(trim(nome)), filial
  having count(*) = 1
)
update public.kt_leituras l
set colaborador_id = u.colaborador_id
from unique_people u
where l.colaborador_id is null
  and lower(trim(l.nome)) = u.nome_key
  and l.filial = u.filial;

-- FEEDBACKS -----------------------------------------------------------------
drop policy if exists kt_read_public on public.kt_feedbacks;
drop policy if exists kt_insert_public on public.kt_feedbacks;
drop policy if exists kt_update_authenticated on public.kt_feedbacks;

create policy kt_feedbacks_select_scoped
on public.kt_feedbacks
for select
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and coalesce(destino, 'gestor') = 'gestor'
  )
);

create policy kt_feedbacks_insert_scoped
on public.kt_feedbacks
for insert
to authenticated
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('gestor', 'azumi', 'rh')
);

create policy kt_feedbacks_update_scoped
on public.kt_feedbacks
for update
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and coalesce(destino, 'gestor') = 'gestor'
  )
)
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and coalesce(destino, 'gestor') = 'gestor'
  )
);

-- SUGESTÕES -----------------------------------------------------------------
drop policy if exists kt_read_public on public.kt_sugestoes;
drop policy if exists kt_insert_public on public.kt_sugestoes;
drop policy if exists kt_update_authenticated on public.kt_sugestoes;

create policy kt_sugestoes_select_scoped
on public.kt_sugestoes
for select
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and categoria <> 'Equipe Azumi RH'
  )
);

create policy kt_sugestoes_insert_scoped
on public.kt_sugestoes
for insert
to authenticated
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('gestor', 'azumi', 'rh')
);

create policy kt_sugestoes_update_scoped
on public.kt_sugestoes
for update
to authenticated
using (
  (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and categoria <> 'Equipe Azumi RH'
  )
)
with check (
  (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
    and categoria <> 'Equipe Azumi RH'
  )
);

-- PEDIDOS DE APOIO -----------------------------------------------------------
drop policy if exists kt_read_public on public.kt_ajuda;
drop policy if exists kt_insert_public on public.kt_ajuda;
drop policy if exists kt_update_authenticated on public.kt_ajuda;

create policy kt_ajuda_select_scoped
on public.kt_ajuda
for select
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and gestor_id = auth.uid()
  )
);

create policy kt_ajuda_insert_scoped
on public.kt_ajuda
for insert
to authenticated
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('gestor', 'azumi', 'rh')
);

create policy kt_ajuda_update_scoped
on public.kt_ajuda
for update
to authenticated
using (
  (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and gestor_id = auth.uid()
  )
)
with check (
  (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and gestor_id = auth.uid()
  )
);

-- ASSINATURAS ---------------------------------------------------------------
drop policy if exists kt_read_public on public.kt_assinaturas;
drop policy if exists kt_insert_public on public.kt_assinaturas;

create policy kt_assinaturas_select_scoped
on public.kt_assinaturas
for select
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
  )
);

create policy kt_assinaturas_insert_scoped
on public.kt_assinaturas
for insert
to authenticated
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('gestor', 'azumi', 'rh')
);

-- LEITURAS ------------------------------------------------------------------
drop policy if exists kt_read_public on public.kt_leituras;
drop policy if exists kt_insert_public on public.kt_leituras;

create policy kt_leituras_select_scoped
on public.kt_leituras
for select
to authenticated
using (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('azumi', 'rh')
  or (
    (select public.kt_current_profile_type()) = 'gestor'
    and filial = (select public.kt_current_profile_filial())
  )
);

create policy kt_leituras_insert_scoped
on public.kt_leituras
for insert
to authenticated
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and colaborador_id = (select public.kt_current_employee_id())
  )
  or (select public.kt_current_profile_type()) in ('gestor', 'azumi', 'rh')
);
