-- Reconhecimento + onboarding integrados à Central de Casos.
-- Aplicada no Supabase em 2026-08-22.

create table if not exists public.kt_reconhecimentos (
  id uuid primary key default gen_random_uuid(), colaborador_id text not null references public.kt_colaboradores(id) on delete restrict,
  filial text not null, motivo text not null, elogio_cliente boolean not null default false,
  registrado_por_profile_id uuid references public.kt_perfis(id) on delete set null,
  registrado_por_colaborador_id text references public.kt_colaboradores(id) on delete set null,
  destaque_mes date, status text not null default 'ativo' check (status in ('ativo','destaque','arquivado')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists kt_reconhecimentos_colab_idx on public.kt_reconhecimentos(colaborador_id,created_at desc);
create index if not exists kt_reconhecimentos_filial_idx on public.kt_reconhecimentos(filial,created_at desc);
alter table public.kt_reconhecimentos enable row level security;
create policy kt_rec_select on public.kt_reconhecimentos for select to authenticated using ((public.kt_current_employee_id() is not null and colaborador_id=public.kt_current_employee_id()) or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('reconhecimento','view')));
create policy kt_rec_insert on public.kt_reconhecimentos for insert to authenticated with check ((public.kt_current_employee_id() is not null and registrado_por_colaborador_id=public.kt_current_employee_id() and exists(select 1 from public.kt_colaboradores c where c.id=colaborador_id and c.filial=(select filial from public.kt_colaboradores where id=public.kt_current_employee_id()))) or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial() and registrado_por_profile_id=auth.uid()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('reconhecimento','edit')));
create policy kt_rec_update on public.kt_reconhecimentos for update to authenticated using ((public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('reconhecimento','edit'))) with check ((public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('reconhecimento','edit')));

create or replace function public.kt_recognition_sync_case() returns trigger language plpgsql security definer set search_path=public as $$
declare v_nome text; v_case_id uuid;
begin
  select nome into v_nome from public.kt_colaboradores where id=new.colaborador_id;
  new.updated_at=now();
  insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,aberto_por_colaborador_id,metadata,encerrado_em,encerrado_motivo)
  values('reconhecimento','kt_reconhecimentos',new.id::text,new.filial,'Reconhecimento · '||coalesce(v_nome,'Colaborador'),new.motivo,new.status,'ambos',new.registrado_por_profile_id,new.registrado_por_colaborador_id,jsonb_build_object('elogio_cliente',new.elogio_cliente,'destaque_mes',new.destaque_mes),case when new.status='arquivado' then now() else null end,case when new.status='arquivado' then 'Reconhecimento arquivado' else null end)
  on conflict (origem_tabela,origem_id) where origem_tabela is not null and origem_id is not null do update set titulo=excluded.titulo,descricao=excluded.descricao,status=excluded.status,metadata=excluded.metadata,encerrado_em=excluded.encerrado_em,encerrado_motivo=excluded.encerrado_motivo,updated_at=now()
  returning id into v_case_id;
  insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel) select v_case_id,new.colaborador_id,v_nome,'mencionado' where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.colaborador_id and papel='mencionado');
  return new;
end; $$;
revoke all on function public.kt_recognition_sync_case() from public,anon,authenticated;
drop trigger if exists trg_kt_recognition_sync_case on public.kt_reconhecimentos; create trigger trg_kt_recognition_sync_case before insert or update on public.kt_reconhecimentos for each row execute function public.kt_recognition_sync_case();

create table if not exists public.kt_onboardings (
  id uuid primary key default gen_random_uuid(), colaborador_id text not null references public.kt_colaboradores(id) on delete restrict,
  filial text not null, inicio_em date not null,
  status text not null default 'pre_admissao' check (status in ('pre_admissao','documentacao_pendente','primeira_semana','experiencia','efetivado','cancelado')),
  buddy_colaborador_id text references public.kt_colaboradores(id) on delete set null,
  responsavel_profile_id uuid references public.kt_perfis(id) on delete set null,
  experiencia_fim_em date, iniciado_por uuid references public.kt_perfis(id) on delete set null,
  observacao text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(colaborador_id,inicio_em)
);
create index if not exists kt_onboarding_filial_status_idx on public.kt_onboardings(filial,status);
create index if not exists kt_onboarding_colab_idx on public.kt_onboardings(colaborador_id,created_at desc);
create table if not exists public.kt_onboarding_checklist (
  id uuid primary key default gen_random_uuid(), onboarding_id uuid not null references public.kt_onboardings(id) on delete cascade,
  item_key text not null,label text not null,categoria text not null default 'documentos',obrigatorio boolean not null default true,
  concluido boolean not null default false,concluido_em timestamptz,concluido_por uuid references public.kt_perfis(id) on delete set null,
  unique(onboarding_id,item_key)
);
create index if not exists kt_onboarding_checklist_parent_idx on public.kt_onboarding_checklist(onboarding_id);
alter table public.kt_onboardings enable row level security; alter table public.kt_onboarding_checklist enable row level security;
create policy kt_onboarding_select on public.kt_onboardings for select to authenticated using ((public.kt_current_employee_id() is not null and colaborador_id=public.kt_current_employee_id()) or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('onboarding','view')));
create policy kt_onboarding_write on public.kt_onboardings for all to authenticated using ((public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('onboarding','edit'))) with check ((public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('onboarding','edit')));
create policy kt_onboarding_checklist_select on public.kt_onboarding_checklist for select to authenticated using (exists(select 1 from public.kt_onboardings o where o.id=onboarding_id and ((public.kt_current_employee_id() is not null and o.colaborador_id=public.kt_current_employee_id()) or (public.kt_current_profile_type()='gestor' and o.filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('onboarding','view')))));
create policy kt_onboarding_checklist_write on public.kt_onboarding_checklist for all to authenticated using (exists(select 1 from public.kt_onboardings o where o.id=onboarding_id and ((public.kt_current_profile_type()='gestor' and o.filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('onboarding','edit'))))) with check (exists(select 1 from public.kt_onboardings o where o.id=onboarding_id and ((public.kt_current_profile_type()='gestor' and o.filial=public.kt_current_profile_filial()) or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('onboarding','edit')))));

create or replace function public.kt_onboarding_seed_and_sync() returns trigger language plpgsql security definer set search_path=public as $$
declare v_nome text; v_case_id uuid; r record; v_due timestamptz;
begin
  select nome into v_nome from public.kt_colaboradores where id=new.colaborador_id;
  if tg_op='INSERT' then insert into public.kt_onboarding_checklist(onboarding_id,item_key,label,categoria) values (new.id,'rg','Documento de identificação conferido','documentos'),(new.id,'ctps','Dados de CTPS/documentação trabalhista conferidos','documentos'),(new.id,'exame','Exame admissional conferido','documentos'),(new.id,'politicas','Políticas obrigatórias disponibilizadas para assinatura','integracao'),(new.id,'apresentacao','Apresentação da equipe e rotina realizada','integracao') on conflict do nothing; end if;
  if new.experiencia_fim_em is null then new.experiencia_fim_em:=new.inicio_em+90; end if; new.updated_at:=now();
  insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,responsavel_id,metadata,encerrado_em,encerrado_motivo)
  values('onboarding','kt_onboardings',new.id::text,new.filial,'Onboarding · '||coalesce(v_nome,'Colaborador'),new.observacao,new.status,'ambos',new.iniciado_por,new.responsavel_profile_id,jsonb_build_object('inicio_em',new.inicio_em,'experiencia_fim_em',new.experiencia_fim_em,'buddy_colaborador_id',new.buddy_colaborador_id),case when new.status in ('efetivado','cancelado') then now() else null end,case when new.status='efetivado' then 'Onboarding concluído / efetivado' when new.status='cancelado' then 'Onboarding cancelado' else null end)
  on conflict (origem_tabela,origem_id) where origem_tabela is not null and origem_id is not null do update set titulo=excluded.titulo,descricao=excluded.descricao,status=excluded.status,responsavel_id=excluded.responsavel_id,metadata=excluded.metadata,encerrado_em=excluded.encerrado_em,encerrado_motivo=excluded.encerrado_motivo,updated_at=now() returning id into v_case_id;
  insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel) select v_case_id,new.colaborador_id,v_nome,'mencionado' where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.colaborador_id and papel='mencionado');
  if tg_op='INSERT' then for r in select id from public.kt_perfis where coalesce(ativo,true) and ((tipo='gestor' and filial=new.filial) or tipo in ('azumi','rh')) loop v_due:=(new.inicio_em+40)::timestamp + interval '09:00'; if v_due>now() then insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(v_case_id,'onboarding_40',v_due,r.id,jsonb_build_object('title','Acompanhamento de experiência · 40 dias','body','Revise a integração e a continuidade do colaborador.','action_url','/azumi#onboarding')) on conflict do nothing; end if; v_due:=(new.inicio_em+75)::timestamp + interval '09:00'; if v_due>now() then insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(v_case_id,'onboarding_75',v_due,r.id,jsonb_build_object('title','Acompanhamento de experiência · 75 dias','body','A data final do período de experiência está próxima. Registre a decisão.','action_url','/azumi#onboarding')) on conflict do nothing; end if; end loop; end if;
  return new;
end; $$;
revoke all on function public.kt_onboarding_seed_and_sync() from public,anon,authenticated;
drop trigger if exists trg_kt_onboarding_seed_sync on public.kt_onboardings; create trigger trg_kt_onboarding_seed_sync before insert or update on public.kt_onboardings for each row execute function public.kt_onboarding_seed_and_sync();
