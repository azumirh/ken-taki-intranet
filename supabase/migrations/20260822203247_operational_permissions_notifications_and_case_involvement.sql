-- Production hardening: granular RH permissions for new modules, scoped surveys,
-- case participants backfill/maintenance, and operational notifications/reminders.

alter table public.kt_admin_permissions drop constraint if exists kt_admin_permissions_section_check;
alter table public.kt_admin_permissions add constraint kt_admin_permissions_section_check check (
  section = any (array['dashboard','feedbacks','apoio','casos','offboarding','vagas','reconhecimento','onboarding','clima','noticias','pesquisas','mural','sugestoes','colaboradores','documentos','acessos']::text[])
);

create or replace function public.kt_list_my_admin_permissions()
returns table(section text, can_view boolean, can_edit boolean, can_delete boolean)
language sql stable security definer set search_path=public as $$
  with sections(section) as (values ('dashboard'),('feedbacks'),('apoio'),('casos'),('offboarding'),('vagas'),('reconhecimento'),('onboarding'),('clima'),('noticias'),('pesquisas'),('mural'),('sugestoes'),('colaboradores'),('documentos'),('acessos'))
  select s.section,
         case when public.kt_is_admin_general() then true else coalesce(ap.can_view,false) end,
         case when public.kt_is_admin_general() then true else coalesce(ap.can_edit,false) end,
         case when public.kt_is_admin_general() then true else coalesce(ap.can_delete,false) end
  from sections s left join public.kt_admin_permissions ap on ap.profile_id=(select auth.uid()) and ap.section=s.section;
$$;
revoke all on function public.kt_list_my_admin_permissions() from public,anon;
grant execute on function public.kt_list_my_admin_permissions() to authenticated,service_role;

drop policy if exists kt_read_public on public.kt_pesquisas;
drop policy if exists kt_pesquisas_scoped_select on public.kt_pesquisas;
create policy kt_pesquisas_scoped_select on public.kt_pesquisas for select to authenticated using (
  ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('pesquisas','view')))
  or (ativa and (select public.kt_current_profile_type())='gestor' and (filial_alvo is null or filial_alvo=(select public.kt_current_profile_filial())))
  or (ativa and (select public.kt_current_employee_id()) is not null and (filial_alvo is null or filial_alvo=(select c.filial from public.kt_colaboradores c where c.id=(select public.kt_current_employee_id()))))
);

create or replace function public.kt_case_sync_responsible_participants()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.responsavel_id is not null then
    insert into public.kt_caso_envolvidos(caso_id,profile_id,nome_snapshot,papel)
    select new.id,new.responsavel_id,p.nome,'gestor_responsavel' from public.kt_perfis p
    where p.id=new.responsavel_id and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=new.id and e.profile_id=new.responsavel_id and e.papel='gestor_responsavel');
  end if;
  if new.responsavel_acao_id is not null then
    insert into public.kt_caso_envolvidos(caso_id,profile_id,nome_snapshot,papel)
    select new.id,new.responsavel_acao_id,p.nome,'responsavel_acao' from public.kt_perfis p
    where p.id=new.responsavel_acao_id and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=new.id and e.profile_id=new.responsavel_acao_id and e.papel='responsavel_acao');
  end if;
  return new;
end; $$;
revoke all on function public.kt_case_sync_responsible_participants() from public,anon,authenticated;
drop trigger if exists trg_kt_case_sync_responsible_participants on public.kt_casos;
create trigger trg_kt_case_sync_responsible_participants after insert or update of responsavel_id,responsavel_acao_id on public.kt_casos for each row execute function public.kt_case_sync_responsible_participants();

insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel)
select c.id,f.colaborador_id,coalesce(f.autor,col.nome,'Colaborador'),'relator' from public.kt_casos c join public.kt_feedbacks f on c.origem_tabela='kt_feedbacks' and c.origem_id=f.id left join public.kt_colaboradores col on col.id=f.colaborador_id
where f.colaborador_id is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.colaborador_id=f.colaborador_id and e.papel='relator');
insert into public.kt_caso_envolvidos(caso_id,profile_id,nome_snapshot,papel)
select c.id,f.criado_por_profile_id,p.nome,'relator' from public.kt_casos c join public.kt_feedbacks f on c.origem_tabela='kt_feedbacks' and c.origem_id=f.id join public.kt_perfis p on p.id=f.criado_por_profile_id
where f.criado_por_profile_id is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.profile_id=f.criado_por_profile_id and e.papel='relator');
insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel)
select c.id,coalesce(f.destinatario_colaborador_id,f.referente_colaborador_id),coalesce(f.destinatario_nome,col.nome,'Colaborador'),'mencionado' from public.kt_casos c join public.kt_feedbacks f on c.origem_tabela='kt_feedbacks' and c.origem_id=f.id left join public.kt_colaboradores col on col.id=coalesce(f.destinatario_colaborador_id,f.referente_colaborador_id)
where coalesce(f.destinatario_colaborador_id,f.referente_colaborador_id) is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.colaborador_id=coalesce(f.destinatario_colaborador_id,f.referente_colaborador_id) and e.papel='mencionado');
insert into public.kt_caso_envolvidos(caso_id,nome_snapshot,papel)
select c.id,trim(f.testemunhas),'testemunha' from public.kt_casos c join public.kt_feedbacks f on c.origem_tabela='kt_feedbacks' and c.origem_id=f.id
where nullif(trim(coalesce(f.testemunhas,'')),'') is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.nome_snapshot=trim(f.testemunhas) and e.papel='testemunha');
insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel)
select c.id,a.colaborador_id,coalesce(a.nome,col.nome,'Colaborador'),'relator' from public.kt_casos c join public.kt_ajuda a on c.origem_tabela='kt_ajuda' and c.origem_id=a.id left join public.kt_colaboradores col on col.id=a.colaborador_id
where a.colaborador_id is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.colaborador_id=a.colaborador_id and e.papel='relator');
insert into public.kt_caso_envolvidos(caso_id,profile_id,nome_snapshot,papel)
select c.id,a.criado_por_profile_id,p.nome,'relator' from public.kt_casos c join public.kt_ajuda a on c.origem_tabela='kt_ajuda' and c.origem_id=a.id join public.kt_perfis p on p.id=a.criado_por_profile_id
where a.criado_por_profile_id is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.profile_id=a.criado_por_profile_id and e.papel='relator');
insert into public.kt_caso_envolvidos(caso_id,profile_id,nome_snapshot,papel)
select c.id,a.gestor_id,p.nome,'gestor_responsavel' from public.kt_casos c join public.kt_ajuda a on c.origem_tabela='kt_ajuda' and c.origem_id=a.id join public.kt_perfis p on p.id=a.gestor_id
where a.gestor_id is not null and not exists (select 1 from public.kt_caso_envolvidos e where e.caso_id=c.id and e.profile_id=a.gestor_id and e.papel='gestor_responsavel');

create or replace function public.kt_notify_operational_case()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_employee_user uuid; v_action_url text; v_title text; r record;
begin
  if new.tipo not in ('offboarding','vaga','reconhecimento','onboarding') then return new; end if;
  v_action_url:=case when new.tipo='offboarding' then '/azumi#offboarding' when new.tipo='vaga' then '/azumi#vagas' when new.tipo='reconhecimento' then '/azumi#reconhecimento' else '/azumi#onboarding' end;
  v_title:=case when new.tipo='offboarding' then 'Desligamento para acompanhamento' when new.tipo='vaga' then 'Solicitação de vaga atualizada' when new.tipo='reconhecimento' then 'Novo reconhecimento' else 'Onboarding para acompanhamento' end;
  if tg_op='INSERT' then
    if new.tipo in ('offboarding','vaga','onboarding') then insert into public.app_notifications(user_id,type,title,body,action_url) select p.id,'kt_'||new.tipo||'_opened',v_title,new.titulo,v_action_url from public.kt_perfis p where p.tipo in ('azumi','rh') and coalesce(p.ativo,true); end if;
    if new.tipo in ('reconhecimento','onboarding') then
      select c.auth_user_id into v_employee_user from public.kt_caso_envolvidos e join public.kt_colaboradores c on c.id=e.colaborador_id where e.caso_id=new.id and e.papel='mencionado' and c.auth_user_id is not null limit 1;
      if v_employee_user is not null then insert into public.app_notifications(user_id,type,title,body,action_url) values(v_employee_user,'kt_'||new.tipo||'_employee',v_title,new.titulo,'/painel#minha-jornada'); end if;
    end if;
  elsif new.status is distinct from old.status then
    if new.aberto_por_profile_id is not null then insert into public.app_notifications(user_id,type,title,body,action_url) values(new.aberto_por_profile_id,'kt_'||new.tipo||'_status',v_title,'Novo status: '||new.status,case when (select tipo from public.kt_perfis where id=new.aberto_por_profile_id)='gestor' then replace(v_action_url,'/azumi','/gestor') else v_action_url end); end if;
    for r in select p.id from public.kt_perfis p where p.tipo='gestor' and p.filial=new.filial and coalesce(p.ativo,true) loop
      if r.id is distinct from new.aberto_por_profile_id then insert into public.app_notifications(user_id,type,title,body,action_url) values(r.id,'kt_'||new.tipo||'_status',v_title,'Novo status: '||new.status,replace(v_action_url,'/azumi','/gestor')); end if;
    end loop;
  end if;
  return new;
end; $$;
revoke all on function public.kt_notify_operational_case() from public,anon,authenticated;
drop trigger if exists trg_kt_notify_operational_case on public.kt_casos;
create trigger trg_kt_notify_operational_case after insert or update of status on public.kt_casos for each row execute function public.kt_notify_operational_case();

create or replace function public.kt_schedule_operational_reminders()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_case_id uuid; v_due timestamptz; r record;
begin
  select id into v_case_id from public.kt_casos where origem_tabela=tg_table_name and origem_id=new.id::text;
  if v_case_id is null then return new; end if;
  if tg_table_name='kt_offboardings' then
    update public.kt_alertas_agendados set status='cancelled',updated_at=now() where caso_id=v_case_id and tipo='offboarding_last_day' and status='scheduled';
    if new.status not in ('aprovado','cancelado') and new.ultimo_dia_em is not null then
      v_due:=(new.ultimo_dia_em::timestamp - interval '1 day') + interval '09:00';
      if v_due>now() then for r in select id from public.kt_perfis where coalesce(ativo,true) and (tipo in ('azumi','rh') or (tipo='gestor' and filial=new.filial)) loop insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(v_case_id,'offboarding_last_day',v_due,r.id,jsonb_build_object('title','Desligamento próximo do último dia','body','Confira checklist, comunicação e pendências do desligamento.','action_url',case when (select tipo from public.kt_perfis where id=r.id)='gestor' then '/gestor#offboarding' else '/azumi#offboarding' end)) on conflict do nothing; end loop; end if;
    end if;
  elsif tg_table_name='kt_vagas' then
    update public.kt_alertas_agendados set status='cancelled',updated_at=now() where caso_id=v_case_id and tipo='vacancy_stale' and status='scheduled';
    if new.status not in ('preenchida','cancelada') then
      v_due:=coalesce(new.status_at,new.updated_at,new.ts,now()) + interval '7 days';
      if v_due>now() then for r in select id from public.kt_perfis where coalesce(ativo,true) and (tipo in ('azumi','rh') or id=new.solicitante_id) loop insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload) values(v_case_id,'vacancy_stale',v_due,r.id,jsonb_build_object('title','Vaga sem atualização há 7 dias','body','Revise o status e registre o próximo passo da vaga.','action_url',case when r.id=new.solicitante_id then '/gestor#vagas' else '/azumi#vagas' end)) on conflict do nothing; end loop; end if;
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.kt_schedule_operational_reminders() from public,anon,authenticated;
drop trigger if exists trg_zz_kt_offboarding_schedule on public.kt_offboardings;
create trigger trg_zz_kt_offboarding_schedule after insert or update of status,ultimo_dia_em on public.kt_offboardings for each row execute function public.kt_schedule_operational_reminders();
drop trigger if exists trg_zz_kt_vaga_schedule on public.kt_vagas;
create trigger trg_zz_kt_vaga_schedule after insert or update of status,status_at on public.kt_vagas for each row execute function public.kt_schedule_operational_reminders();