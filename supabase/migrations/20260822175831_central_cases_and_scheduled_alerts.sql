-- Central de Casos genérica + envolvidos + histórico + alertas agendados.
-- Aplicada no Supabase em 2026-08-22 como migration central_cases_and_scheduled_alerts.

create table if not exists public.kt_casos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('feedback','ocorrencia','apoio','onboarding','offboarding','reconhecimento','vaga')),
  origem_tabela text,
  origem_id text,
  filial text not null,
  titulo text not null,
  descricao text,
  status text not null default 'aberto',
  confidencialidade text not null default 'ambos' check (confidencialidade in ('ambos','gestor','rh','anonymous_rh')),
  aberto_por_profile_id uuid references public.kt_perfis(id) on delete set null,
  aberto_por_colaborador_id text references public.kt_colaboradores(id) on delete set null,
  responsavel_id uuid references public.kt_perfis(id) on delete set null,
  plano_acao text,
  responsavel_acao_id uuid references public.kt_perfis(id) on delete set null,
  prazo_acao timestamptz,
  acompanhamento_em timestamptz,
  encerrado_em timestamptz,
  encerrado_motivo text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kt_casos_origem_unique on public.kt_casos(origem_tabela, origem_id) where origem_tabela is not null and origem_id is not null;
create index if not exists kt_casos_filial_status_idx on public.kt_casos(filial,status);
create index if not exists kt_casos_responsavel_idx on public.kt_casos(responsavel_id) where responsavel_id is not null;
create index if not exists kt_casos_acompanhamento_idx on public.kt_casos(acompanhamento_em) where acompanhamento_em is not null and encerrado_em is null;

create table if not exists public.kt_caso_envolvidos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.kt_casos(id) on delete cascade,
  colaborador_id text references public.kt_colaboradores(id) on delete set null,
  profile_id uuid references public.kt_perfis(id) on delete set null,
  nome_snapshot text,
  papel text not null check (papel in ('relator','mencionado','testemunha','gestor_responsavel','responsavel_acao','outro')),
  created_at timestamptz not null default now(),
  check (colaborador_id is not null or profile_id is not null or nome_snapshot is not null)
);
create index if not exists kt_caso_envolvidos_caso_idx on public.kt_caso_envolvidos(caso_id);
create index if not exists kt_caso_envolvidos_colaborador_idx on public.kt_caso_envolvidos(colaborador_id) where colaborador_id is not null;
create index if not exists kt_caso_envolvidos_profile_idx on public.kt_caso_envolvidos(profile_id) where profile_id is not null;

create table if not exists public.kt_caso_historico (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.kt_casos(id) on delete cascade,
  actor_profile_id uuid references public.kt_perfis(id) on delete set null,
  actor_colaborador_id text references public.kt_colaboradores(id) on delete set null,
  actor_nome_snapshot text,
  evento text not null,
  mensagem text,
  visibilidade text not null default 'rh' check (visibilidade in ('rh','gestor','colaborador','ambos')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kt_caso_historico_caso_created_idx on public.kt_caso_historico(caso_id,created_at desc);

create table if not exists public.kt_alertas_agendados (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid references public.kt_casos(id) on delete cascade,
  tipo text not null,
  due_at timestamptz not null,
  recipient_user_id uuid not null references public.kt_perfis(id) on delete cascade,
  channel text not null default 'both' check (channel in ('in_app','email','both')),
  status text not null default 'scheduled' check (status in ('scheduled','processing','sent','cancelled','failed')),
  attempts integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kt_alertas_due_idx on public.kt_alertas_agendados(due_at) where status='scheduled';
create index if not exists kt_alertas_recipient_idx on public.kt_alertas_agendados(recipient_user_id,status);
create unique index if not exists kt_alertas_case_dedupe_idx on public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id) where caso_id is not null and status='scheduled';

alter table public.kt_casos enable row level security;
alter table public.kt_caso_envolvidos enable row level security;
alter table public.kt_caso_historico enable row level security;
alter table public.kt_alertas_agendados enable row level security;

create policy kt_casos_select on public.kt_casos for select to authenticated using (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','view'))
  or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial() and confidencialidade not in ('rh','anonymous_rh'))
  or (public.kt_current_employee_id() is not null and aberto_por_colaborador_id=public.kt_current_employee_id() and confidencialidade <> 'anonymous_rh')
);
create policy kt_casos_insert on public.kt_casos for insert to authenticated with check (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit'))
  or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial())
  or (public.kt_current_employee_id() is not null and aberto_por_colaborador_id=public.kt_current_employee_id() and tipo in ('feedback','ocorrencia','reconhecimento'))
);
create policy kt_casos_update on public.kt_casos for update to authenticated using (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit'))
  or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial() and confidencialidade not in ('rh','anonymous_rh'))
) with check (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit'))
  or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial() and confidencialidade not in ('rh','anonymous_rh'))
);
create policy kt_casos_delete on public.kt_casos for delete to authenticated using (
  public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','delete')
);

create policy kt_caso_envolvidos_select on public.kt_caso_envolvidos for select to authenticated using (
  exists (select 1 from public.kt_casos c where c.id=caso_id and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','view'))
    or (public.kt_current_profile_type()='gestor' and c.filial=public.kt_current_profile_filial() and c.confidencialidade not in ('rh','anonymous_rh'))
    or (public.kt_current_employee_id() is not null and c.aberto_por_colaborador_id=public.kt_current_employee_id() and c.confidencialidade <> 'anonymous_rh' and colaborador_id=public.kt_current_employee_id())
  ))
);
create policy kt_caso_envolvidos_write on public.kt_caso_envolvidos for all to authenticated using (
  exists (select 1 from public.kt_casos c where c.id=caso_id and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit'))
    or (public.kt_current_profile_type()='gestor' and c.filial=public.kt_current_profile_filial() and c.confidencialidade not in ('rh','anonymous_rh'))
  ))
) with check (
  exists (select 1 from public.kt_casos c where c.id=caso_id and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit'))
    or (public.kt_current_profile_type()='gestor' and c.filial=public.kt_current_profile_filial() and c.confidencialidade not in ('rh','anonymous_rh'))
  ))
);

create policy kt_caso_historico_select on public.kt_caso_historico for select to authenticated using (
  exists (select 1 from public.kt_casos c where c.id=caso_id and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','view'))
    or (public.kt_current_profile_type()='gestor' and c.filial=public.kt_current_profile_filial() and c.confidencialidade not in ('rh','anonymous_rh') and visibilidade in ('gestor','ambos'))
    or (public.kt_current_employee_id() is not null and c.aberto_por_colaborador_id=public.kt_current_employee_id() and c.confidencialidade <> 'anonymous_rh' and visibilidade in ('colaborador','ambos'))
  ))
);
create policy kt_caso_historico_insert on public.kt_caso_historico for insert to authenticated with check (
  exists (select 1 from public.kt_casos c where c.id=caso_id and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit'))
    or (public.kt_current_profile_type()='gestor' and c.filial=public.kt_current_profile_filial() and c.confidencialidade not in ('rh','anonymous_rh'))
    or (public.kt_current_employee_id() is not null and c.aberto_por_colaborador_id=public.kt_current_employee_id() and c.confidencialidade <> 'anonymous_rh' and actor_colaborador_id=public.kt_current_employee_id())
  ))
);

create policy kt_alertas_select on public.kt_alertas_agendados for select to authenticated using (
  recipient_user_id=auth.uid() or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','view'))
);
create policy kt_alertas_write on public.kt_alertas_agendados for all to authenticated using (
  public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit')
) with check (
  public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('casos','edit')
);

create or replace function public.kt_case_touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function public.kt_case_touch_updated_at() from public, anon, authenticated;
drop trigger if exists trg_kt_case_touch on public.kt_casos;
create trigger trg_kt_case_touch before update on public.kt_casos for each row execute function public.kt_case_touch_updated_at();
drop trigger if exists trg_kt_alert_touch on public.kt_alertas_agendados;
create trigger trg_kt_alert_touch before update on public.kt_alertas_agendados for each row execute function public.kt_case_touch_updated_at();

create or replace function public.kt_case_audit_changes() returns trigger language plpgsql security definer set search_path=public as $$
declare v_event text; v_message text; v_visibility text;
begin
  if tg_op='INSERT' then
    insert into public.kt_caso_historico(caso_id,actor_profile_id,actor_colaborador_id,actor_nome_snapshot,evento,mensagem,visibilidade)
    values (new.id,auth.uid(),public.kt_current_employee_id(),coalesce((select nome from public.kt_perfis where id=auth.uid()),(select nome from public.kt_colaboradores where id=public.kt_current_employee_id())),'caso_aberto','Caso registrado.',case when new.confidencialidade in ('rh','anonymous_rh') then 'rh' else 'ambos' end);
    return new;
  end if;
  if new.status is distinct from old.status then v_event:='status_alterado'; v_message:='Status alterado de '||coalesce(old.status,'—')||' para '||coalesce(new.status,'—')||'.';
  elsif new.responsavel_id is distinct from old.responsavel_id then v_event:='responsavel_alterado'; v_message:='Responsável pelo caso atualizado.';
  elsif new.plano_acao is distinct from old.plano_acao then v_event:='plano_acao_atualizado'; v_message:='Plano de ação atualizado.';
  elsif new.acompanhamento_em is distinct from old.acompanhamento_em then v_event:='acompanhamento_agendado'; v_message:='Data de acompanhamento atualizada.';
  elsif new.encerrado_em is distinct from old.encerrado_em and new.encerrado_em is not null then v_event:='caso_encerrado'; v_message:=coalesce(new.encerrado_motivo,'Caso encerrado.');
  else return new; end if;
  v_visibility:=case when new.confidencialidade in ('rh','anonymous_rh') then 'rh' else 'ambos' end;
  insert into public.kt_caso_historico(caso_id,actor_profile_id,actor_colaborador_id,actor_nome_snapshot,evento,mensagem,visibilidade)
  values (new.id,auth.uid(),public.kt_current_employee_id(),coalesce((select nome from public.kt_perfis where id=auth.uid()),(select nome from public.kt_colaboradores where id=public.kt_current_employee_id())),v_event,v_message,v_visibility);
  return new;
end; $$;
revoke all on function public.kt_case_audit_changes() from public, anon, authenticated;
drop trigger if exists trg_kt_case_audit on public.kt_casos;
create trigger trg_kt_case_audit after insert or update on public.kt_casos for each row execute function public.kt_case_audit_changes();

create or replace function public.kt_case_schedule_alerts() returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if tg_op='UPDATE' then
    if new.acompanhamento_em is distinct from old.acompanhamento_em then update public.kt_alertas_agendados set status='cancelled',updated_at=now() where caso_id=new.id and tipo='case_follow_up' and status='scheduled'; end if;
    if new.prazo_acao is distinct from old.prazo_acao then update public.kt_alertas_agendados set status='cancelled',updated_at=now() where caso_id=new.id and tipo='action_due' and status='scheduled'; end if;
  end if;
  if new.encerrado_em is not null then update public.kt_alertas_agendados set status='cancelled',updated_at=now() where caso_id=new.id and status='scheduled'; return new; end if;
  if new.acompanhamento_em is not null and new.acompanhamento_em > now() then
    if new.responsavel_id is not null then insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(new.id,'case_follow_up',new.acompanhamento_em,new.responsavel_id,jsonb_build_object('title','Acompanhamento de caso','body','Há um caso agendado para reavaliação.','action_url','/azumi#casos')) on conflict do nothing; end if;
    for r in select id from public.kt_perfis where tipo in ('azumi','rh') and coalesce(ativo,true) loop
      insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(new.id,'case_follow_up',new.acompanhamento_em,r.id,jsonb_build_object('title','Acompanhamento de caso','body','Há um caso agendado para reavaliação.','action_url','/azumi#casos')) on conflict do nothing;
    end loop;
  end if;
  if new.prazo_acao is not null and new.prazo_acao > now() and new.responsavel_acao_id is not null then insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(new.id,'action_due',new.prazo_acao,new.responsavel_acao_id,jsonb_build_object('title','Prazo de plano de ação','body','Um plano de ação chegou à data prevista.','action_url','/azumi#casos')) on conflict do nothing; end if;
  return new;
end; $$;
revoke all on function public.kt_case_schedule_alerts() from public, anon, authenticated;
drop trigger if exists trg_kt_case_schedule_alerts on public.kt_casos;
create trigger trg_kt_case_schedule_alerts after insert or update of acompanhamento_em,prazo_acao,responsavel_id,responsavel_acao_id,encerrado_em on public.kt_casos for each row execute function public.kt_case_schedule_alerts();

create or replace function public.kt_process_due_alerts() returns integer language plpgsql security definer set search_path=public,auth as $$
declare r record; v_notification_id uuid; v_email text; v_count integer:=0;
begin
  for r in select * from public.kt_alertas_agendados where status='scheduled' and due_at<=now() order by due_at limit 100 for update skip locked loop
    begin
      update public.kt_alertas_agendados set status='processing',attempts=attempts+1,updated_at=now() where id=r.id;
      if r.channel in ('in_app','both') then insert into public.app_notifications(user_id,type,title,body,action_url) values(r.recipient_user_id,'scheduled_followup',coalesce(r.payload->>'title','Acompanhamento pendente'),coalesce(r.payload->>'body','Há uma ação que precisa de acompanhamento.'),coalesce(r.payload->>'action_url','/azumi#casos')) returning id into v_notification_id; end if;
      if r.channel in ('email','both') then select email into v_email from auth.users where id=r.recipient_user_id; if v_email is not null then insert into public.kt_email_outbox(notification_id,user_id,recipient,event_type,subject,body,action_url,status,attempts) values(v_notification_id,r.recipient_user_id,v_email,'scheduled_followup',coalesce(r.payload->>'title','Acompanhamento pendente'),coalesce(r.payload->>'body','Há uma ação que precisa de acompanhamento.'),coalesce(r.payload->>'action_url','/azumi#casos'),'queued',0); end if; end if;
      update public.kt_alertas_agendados set status='sent',processed_at=now(),last_error=null,updated_at=now() where id=r.id; v_count:=v_count+1;
    exception when others then update public.kt_alertas_agendados set status=case when attempts+1>=5 then 'failed' else 'scheduled' end,last_error=sqlerrm,updated_at=now() where id=r.id; end;
  end loop;
  return v_count;
end; $$;
revoke all on function public.kt_process_due_alerts() from public, anon, authenticated;

create or replace function public.kt_sync_feedback_case() returns trigger language plpgsql security definer set search_path=public as $$
declare v_type text; v_conf text; v_case_id uuid;
begin
  v_type:=case when new.tipo='Ocorrência disciplinar' then 'ocorrencia' else 'feedback' end;
  v_conf:=case when new.anonimo or new.triagem_rh_status in ('pendente','restrito') or new.tipo in ('Denúncia','Situação urgente','Reclamação') then 'rh' when new.destino='gestor' then 'gestor' else 'ambos' end;
  insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,aberto_por_colaborador_id,responsavel_id,plano_acao,prazo_acao,acompanhamento_em,encerrado_em,encerrado_motivo,metadata)
  values(v_type,'kt_feedbacks',new.id,new.filial,coalesce(new.tipo,'Feedback'),new.mensagem,coalesce(new.status,'aberto'),v_conf,new.criado_por_profile_id,new.colaborador_id,new.responsavel_id,new.proxima_acao,new.proxima_acao_em,new.proxima_acao_em,new.encerrado_em,new.encerrado_motivo,jsonb_build_object('anonimo',new.anonimo,'protocolo',new.protocolo,'fato_em',new.fato_em))
  on conflict (origem_tabela,origem_id) where origem_tabela is not null and origem_id is not null do update set filial=excluded.filial,titulo=excluded.titulo,descricao=excluded.descricao,status=excluded.status,confidencialidade=excluded.confidencialidade,responsavel_id=excluded.responsavel_id,plano_acao=excluded.plano_acao,prazo_acao=excluded.prazo_acao,acompanhamento_em=excluded.acompanhamento_em,encerrado_em=excluded.encerrado_em,encerrado_motivo=excluded.encerrado_motivo,metadata=excluded.metadata,updated_at=now() returning id into v_case_id;
  if new.colaborador_id is not null then insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel) select v_case_id,new.colaborador_id,coalesce(new.autor,'Colaborador'),'relator' where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.colaborador_id and papel='relator'); end if;
  if new.destinatario_colaborador_id is not null then insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel) select v_case_id,new.destinatario_colaborador_id,new.destinatario_nome,'mencionado' where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.destinatario_colaborador_id and papel='mencionado'); end if;
  return new;
end; $$;
revoke all on function public.kt_sync_feedback_case() from public, anon, authenticated;
drop trigger if exists trg_kt_sync_feedback_case on public.kt_feedbacks;
create trigger trg_kt_sync_feedback_case after insert or update on public.kt_feedbacks for each row execute function public.kt_sync_feedback_case();

create or replace function public.kt_sync_support_case() returns trigger language plpgsql security definer set search_path=public as $$
declare v_conf text; v_case_id uuid;
begin
  v_conf:=case when new.destino_inicial='rh' and new.gestor_id is null then 'rh' when new.destino_inicial='gestor' then 'ambos' else 'ambos' end;
  insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,aberto_por_colaborador_id,responsavel_id,plano_acao,prazo_acao,acompanhamento_em,encerrado_em,encerrado_motivo,metadata)
  values('apoio','kt_ajuda',new.id,new.filial,coalesce(new.tipo_apoio,'Pedido de apoio'),new.assunto,coalesce(new.status,'aberto'),v_conf,new.criado_por_profile_id,new.colaborador_id,new.responsavel_id,new.proxima_acao,new.proxima_acao_em,new.proxima_acao_em,new.encerrado_em,new.encerrado_motivo,jsonb_build_object('protocolo',new.protocolo,'origem',new.origem,'gestor_id',new.gestor_id))
  on conflict (origem_tabela,origem_id) where origem_tabela is not null and origem_id is not null do update set filial=excluded.filial,titulo=excluded.titulo,descricao=excluded.descricao,status=excluded.status,confidencialidade=excluded.confidencialidade,responsavel_id=excluded.responsavel_id,plano_acao=excluded.plano_acao,prazo_acao=excluded.prazo_acao,acompanhamento_em=excluded.acompanhamento_em,encerrado_em=excluded.encerrado_em,encerrado_motivo=excluded.encerrado_motivo,metadata=excluded.metadata,updated_at=now() returning id into v_case_id;
  if new.colaborador_id is not null then insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel) select v_case_id,new.colaborador_id,new.nome,'relator' where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.colaborador_id and papel='relator'); end if;
  if new.gestor_id is not null then insert into public.kt_caso_envolvidos(caso_id,profile_id,nome_snapshot,papel) select v_case_id,new.gestor_id,(select nome from public.kt_perfis where id=new.gestor_id),'gestor_responsavel' where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and profile_id=new.gestor_id and papel='gestor_responsavel'); end if;
  return new;
end; $$;
revoke all on function public.kt_sync_support_case() from public, anon, authenticated;
drop trigger if exists trg_kt_sync_support_case on public.kt_ajuda;
create trigger trg_kt_sync_support_case after insert or update on public.kt_ajuda for each row execute function public.kt_sync_support_case();

insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,aberto_por_colaborador_id,responsavel_id,plano_acao,prazo_acao,acompanhamento_em,encerrado_em,encerrado_motivo,metadata)
select case when f.tipo='Ocorrência disciplinar' then 'ocorrencia' else 'feedback' end,'kt_feedbacks',f.id,f.filial,coalesce(f.tipo,'Feedback'),f.mensagem,coalesce(f.status,'aberto'),case when f.anonimo or f.triagem_rh_status in ('pendente','restrito') or f.tipo in ('Denúncia','Situação urgente','Reclamação') then 'rh' when f.destino='gestor' then 'gestor' else 'ambos' end,f.criado_por_profile_id,f.colaborador_id,f.responsavel_id,f.proxima_acao,f.proxima_acao_em,f.proxima_acao_em,f.encerrado_em,f.encerrado_motivo,jsonb_build_object('anonimo',f.anonimo,'protocolo',f.protocolo,'fato_em',f.fato_em) from public.kt_feedbacks f on conflict do nothing;
insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,aberto_por_colaborador_id,responsavel_id,plano_acao,prazo_acao,acompanhamento_em,encerrado_em,encerrado_motivo,metadata)
select 'apoio','kt_ajuda',a.id,a.filial,coalesce(a.tipo_apoio,'Pedido de apoio'),a.assunto,coalesce(a.status,'aberto'),case when a.destino_inicial='rh' and a.gestor_id is null then 'rh' else 'ambos' end,a.criado_por_profile_id,a.colaborador_id,a.responsavel_id,a.proxima_acao,a.proxima_acao_em,a.proxima_acao_em,a.encerrado_em,a.encerrado_motivo,jsonb_build_object('protocolo',a.protocolo,'origem',a.origem,'gestor_id',a.gestor_id) from public.kt_ajuda a on conflict do nothing;
