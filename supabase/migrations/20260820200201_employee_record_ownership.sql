-- Adds stable employee ownership to private records without changing existing behavior.
-- Existing rows remain nullable; new writes will be migrated to populate colaborador_id.

alter table public.kt_feedbacks
  add column if not exists colaborador_id text references public.kt_colaboradores(id) on delete set null;

alter table public.kt_sugestoes
  add column if not exists colaborador_id text references public.kt_colaboradores(id) on delete set null;

alter table public.kt_ajuda
  add column if not exists colaborador_id text references public.kt_colaboradores(id) on delete set null;

alter table public.kt_assinaturas
  add column if not exists colaborador_id text references public.kt_colaboradores(id) on delete set null;

alter table public.kt_leituras
  add column if not exists colaborador_id text references public.kt_colaboradores(id) on delete set null;

create index if not exists idx_kt_feedbacks_colaborador_id on public.kt_feedbacks(colaborador_id);
create index if not exists idx_kt_sugestoes_colaborador_id on public.kt_sugestoes(colaborador_id);
create index if not exists idx_kt_ajuda_colaborador_id on public.kt_ajuda(colaborador_id);
create index if not exists idx_kt_assinaturas_colaborador_id on public.kt_assinaturas(colaborador_id);
create index if not exists idx_kt_leituras_colaborador_id on public.kt_leituras(colaborador_id);
