-- Preserve profile history when disabling manager/HR access.

alter table public.kt_perfis
  add column if not exists ativo boolean not null default true;

create index if not exists idx_kt_perfis_ativo_tipo_filial
  on public.kt_perfis (ativo, tipo, filial);
