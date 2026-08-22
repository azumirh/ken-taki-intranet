-- Pesquisa de clima interna com perguntas, respostas anônimas e histórico.
-- Aplicada no Supabase em 2026-08-22.

alter table public.kt_pesquisas add column if not exists modo text not null default 'externa';
alter table public.kt_pesquisas add column if not exists anonima boolean not null default true;
alter table public.kt_pesquisas add column if not exists filial_alvo text;
alter table public.kt_pesquisas add column if not exists encerrada_em timestamptz;
alter table public.kt_pesquisas alter column link drop not null;
alter table public.kt_pesquisas drop constraint if exists kt_pesquisas_modo_check;
alter table public.kt_pesquisas add constraint kt_pesquisas_modo_check check (modo in ('externa','interna'));

create table if not exists public.kt_pesquisa_perguntas (
  id uuid primary key default gen_random_uuid(), pesquisa_id text not null references public.kt_pesquisas(id) on delete cascade,
  pergunta text not null, tipo text not null default 'escala_1_5' check (tipo in ('escala_1_5','sim_nao','texto','multipla')),
  opcoes jsonb, ordem integer not null default 0, obrigatoria boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists kt_pesquisa_perguntas_parent_idx on public.kt_pesquisa_perguntas(pesquisa_id,ordem);

create table if not exists public.kt_pesquisa_submissoes (
  id uuid primary key default gen_random_uuid(), pesquisa_id text not null references public.kt_pesquisas(id) on delete cascade,
  filial text not null, submitted_at timestamptz not null default now()
);
create index if not exists kt_pesquisa_submissoes_idx on public.kt_pesquisa_submissoes(pesquisa_id,filial,submitted_at);

create table if not exists public.kt_pesquisa_respostas_internas (
  id uuid primary key default gen_random_uuid(), submissao_id uuid not null references public.kt_pesquisa_submissoes(id) on delete cascade,
  pesquisa_id text not null references public.kt_pesquisas(id) on delete cascade, pergunta_id uuid not null references public.kt_pesquisa_perguntas(id) on delete cascade,
  filial text not null, resposta jsonb not null, created_at timestamptz not null default now()
);
create index if not exists kt_pesquisa_respostas_internal_idx on public.kt_pesquisa_respostas_internas(pesquisa_id,pergunta_id,filial);

create table if not exists public.kt_pesquisa_participacoes (
  pesquisa_id text not null references public.kt_pesquisas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filial text not null, submitted_at timestamptz not null default now(), primary key(pesquisa_id,user_id)
);

alter table public.kt_pesquisa_perguntas enable row level security;
alter table public.kt_pesquisa_submissoes enable row level security;
alter table public.kt_pesquisa_respostas_internas enable row level security;
alter table public.kt_pesquisa_participacoes enable row level security;

create policy kt_survey_questions_select on public.kt_pesquisa_perguntas for select to authenticated using (exists(select 1 from public.kt_pesquisas p where p.id=pesquisa_id and ((p.ativa and (p.filial_alvo is null or p.filial_alvo=public.kt_current_profile_filial() or p.filial_alvo=(select filial from public.kt_colaboradores where id=public.kt_current_employee_id()))) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','view')))));
create policy kt_survey_questions_write on public.kt_pesquisa_perguntas for all to authenticated using (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','edit')) with check (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','edit'));
create policy kt_survey_submissions_rh_select on public.kt_pesquisa_submissoes for select to authenticated using ((public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','view')) or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()));
create policy kt_survey_answers_rh_select on public.kt_pesquisa_respostas_internas for select to authenticated using (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','view'));
create policy kt_survey_participation_own on public.kt_pesquisa_participacoes for select to authenticated using (user_id=auth.uid());

create or replace function public.kt_submit_internal_survey(p_pesquisa_id text,p_respostas jsonb) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_employee text; v_filial text; v_submission uuid; v_item jsonb; v_question uuid; v_response jsonb; v_count int;
begin
  v_employee:=public.kt_current_employee_id(); if v_employee is null then raise exception 'Apenas colaborador autenticado pode responder.'; end if;
  select filial into v_filial from public.kt_colaboradores where id=v_employee and ativo=true; if v_filial is null then raise exception 'Colaborador não encontrado ou inativo.'; end if;
  if not exists(select 1 from public.kt_pesquisas p where p.id=p_pesquisa_id and p.ativa=true and p.modo='interna' and (p.filial_alvo is null or p.filial_alvo=v_filial)) then raise exception 'Pesquisa interna não disponível.'; end if;
  if exists(select 1 from public.kt_pesquisa_participacoes where pesquisa_id=p_pesquisa_id and user_id=auth.uid()) then raise exception 'Pesquisa já respondida.'; end if;
  if jsonb_typeof(p_respostas)<>'array' then raise exception 'Formato de respostas inválido.'; end if;
  select count(*) into v_count from public.kt_pesquisa_perguntas where pesquisa_id=p_pesquisa_id and obrigatoria=true;
  if (select count(*) from jsonb_array_elements(p_respostas))<v_count then raise exception 'Responda todas as perguntas obrigatórias.'; end if;
  insert into public.kt_pesquisa_submissoes(pesquisa_id,filial) values(p_pesquisa_id,v_filial) returning id into v_submission;
  for v_item in select value from jsonb_array_elements(p_respostas) loop v_question:=(v_item->>'pergunta_id')::uuid; v_response:=v_item->'resposta'; if not exists(select 1 from public.kt_pesquisa_perguntas q where q.id=v_question and q.pesquisa_id=p_pesquisa_id) then raise exception 'Pergunta inválida.'; end if; insert into public.kt_pesquisa_respostas_internas(submissao_id,pesquisa_id,pergunta_id,filial,resposta) values(v_submission,p_pesquisa_id,v_question,v_filial,v_response); end loop;
  insert into public.kt_pesquisa_participacoes(pesquisa_id,user_id,filial) values(p_pesquisa_id,auth.uid(),v_filial); return v_submission;
end; $$;
revoke all on function public.kt_submit_internal_survey(text,jsonb) from public,anon; grant execute on function public.kt_submit_internal_survey(text,jsonb) to authenticated;

create or replace function public.kt_internal_survey_summary(p_pesquisa_id text,p_filial text default null)
returns table(pergunta_id uuid,pergunta text,tipo text,total_respostas bigint,media numeric,sim bigint,nao bigint)
language sql stable security definer set search_path=public as $$
  select q.id,q.pergunta,q.tipo,count(r.id),case when q.tipo='escala_1_5' then round(avg(nullif(trim(both '"' from r.resposta::text),'')::numeric),2) else null end,
    count(*) filter(where q.tipo='sim_nao' and lower(trim(both '"' from r.resposta::text))='sim'),
    count(*) filter(where q.tipo='sim_nao' and lower(trim(both '"' from r.resposta::text))='não')
  from public.kt_pesquisa_perguntas q left join public.kt_pesquisa_respostas_internas r on r.pergunta_id=q.id and (p_filial is null or r.filial=p_filial)
  where q.pesquisa_id=p_pesquisa_id and ((public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','view')) or (public.kt_current_profile_type()='gestor' and (p_filial is null or p_filial=public.kt_current_profile_filial())))
  group by q.id,q.pergunta,q.tipo,q.ordem order by q.ordem;
$$;
revoke all on function public.kt_internal_survey_summary(text,text) from public,anon; grant execute on function public.kt_internal_survey_summary(text,text) to authenticated;
