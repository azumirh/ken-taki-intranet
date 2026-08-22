-- Guarded case APIs, survey notifications/reminders, recognition routine and RPC execution hardening.

create or replace function public.kt_update_case_workflow(
  p_case_id uuid,
  p_status text default null,
  p_responsavel_id uuid default null,
  p_plano_acao text default null,
  p_prazo_acao timestamptz default null,
  p_acompanhamento_em timestamptz default null,
  p_encerrado_motivo text default null
)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_case public.kt_casos%rowtype; v_type text; v_allowed boolean:=false; v_source_status text;
begin
  select * into v_case from public.kt_casos where id=p_case_id;
  if not found then raise exception 'Caso não encontrado.'; end if;
  v_type:=public.kt_current_profile_type();
  if v_type in ('azumi','rh') then v_allowed:=public.kt_has_admin_permission('casos','edit');
  elsif v_type='gestor' then v_allowed:=public.kt_current_profile_filial()=v_case.filial and v_case.confidencialidade not in ('rh','anonymous_rh'); end if;
  if not v_allowed then raise exception 'Sem permissão para alterar este caso.'; end if;
  if p_status is not null and v_case.origem_tabela not in ('kt_feedbacks','kt_ajuda') and v_case.tipo in ('offboarding','vaga','onboarding','reconhecimento') then raise exception 'Altere o status pelo módulo operacional correspondente.'; end if;

  if v_case.origem_tabela='kt_feedbacks' then
    update public.kt_feedbacks set
      status=coalesce(p_status,status),
      status_alterado_em=case when p_status is not null then now() else status_alterado_em end,
      responsavel_id=coalesce(p_responsavel_id,responsavel_id),
      proxima_acao=case when p_plano_acao is not null then p_plano_acao else proxima_acao end,
      proxima_acao_em=case when coalesce(p_prazo_acao,p_acompanhamento_em) is not null then coalesce(p_acompanhamento_em,p_prazo_acao) else proxima_acao_em end,
      encerrado_em=case when p_status in ('concluido','cancelado','arquivado') then now() else encerrado_em end,
      encerrado_motivo=case when p_encerrado_motivo is not null then p_encerrado_motivo else encerrado_motivo end
    where id=v_case.origem_id;
  elsif v_case.origem_tabela='kt_ajuda' then
    v_source_status:=case when p_status='concluido' then 'resolvido' else p_status end;
    update public.kt_ajuda set
      status=coalesce(v_source_status,status),
      responsavel_id=coalesce(p_responsavel_id,responsavel_id),
      proxima_acao=case when p_plano_acao is not null then p_plano_acao else proxima_acao end,
      proxima_acao_em=case when coalesce(p_prazo_acao,p_acompanhamento_em) is not null then coalesce(p_acompanhamento_em,p_prazo_acao) else proxima_acao_em end,
      encerrado_em=case when v_source_status in ('resolvido','cancelado','arquivado') then now() else encerrado_em end,
      encerrado_motivo=case when p_encerrado_motivo is not null then p_encerrado_motivo else encerrado_motivo end
    where id=v_case.origem_id;
  else
    update public.kt_casos set
      status=coalesce(p_status,status),
      responsavel_id=coalesce(p_responsavel_id,responsavel_id),
      plano_acao=case when p_plano_acao is not null then p_plano_acao else plano_acao end,
      prazo_acao=case when p_prazo_acao is not null then p_prazo_acao else prazo_acao end,
      acompanhamento_em=case when p_acompanhamento_em is not null then p_acompanhamento_em else acompanhamento_em end,
      encerrado_em=case when p_status in ('concluido','resolvido','arquivado','cancelado') then now() else encerrado_em end,
      encerrado_motivo=case when p_encerrado_motivo is not null then p_encerrado_motivo else encerrado_motivo end
    where id=p_case_id;
  end if;

  update public.kt_casos set
    responsavel_id=coalesce(p_responsavel_id,responsavel_id),
    plano_acao=case when p_plano_acao is not null then p_plano_acao else plano_acao end,
    prazo_acao=case when p_prazo_acao is not null then p_prazo_acao else prazo_acao end,
    acompanhamento_em=case when p_acompanhamento_em is not null then p_acompanhamento_em else acompanhamento_em end,
    encerrado_motivo=case when p_encerrado_motivo is not null then p_encerrado_motivo else encerrado_motivo end
  where id=p_case_id;
  return true;
end; $$;
revoke all on function public.kt_update_case_workflow(uuid,text,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.kt_update_case_workflow(uuid,text,uuid,text,timestamptz,timestamptz,text) to authenticated,service_role;

create or replace function public.kt_add_case_note(p_case_id uuid,p_evento text,p_mensagem text,p_visibilidade text default 'ambos')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_case public.kt_casos%rowtype; v_type text; v_id uuid; v_visibility text;
begin
  if length(trim(coalesce(p_mensagem,'')))<2 then raise exception 'Informe o registro do histórico.'; end if;
  select * into v_case from public.kt_casos where id=p_case_id;
  if not found then raise exception 'Caso não encontrado.'; end if;
  v_type:=public.kt_current_profile_type();
  if v_type in ('azumi','rh') then
    if not public.kt_has_admin_permission('casos','edit') then raise exception 'Sem permissão para registrar histórico.'; end if;
  elsif v_type='gestor' then
    if public.kt_current_profile_filial()<>v_case.filial or v_case.confidencialidade in ('rh','anonymous_rh') then raise exception 'Sem acesso ao caso.'; end if;
  else raise exception 'Perfil sem permissão.'; end if;
  v_visibility:=case when v_type='gestor' and p_visibilidade='rh' then 'gestor' when p_visibilidade in ('rh','gestor','colaborador','ambos') then p_visibilidade else 'ambos' end;
  insert into public.kt_caso_historico(caso_id,actor_profile_id,actor_nome_snapshot,evento,mensagem,visibilidade)
  values(p_case_id,(select auth.uid()),(select nome from public.kt_perfis where id=(select auth.uid())),coalesce(nullif(trim(p_evento),''),'nota'),trim(p_mensagem),v_visibility)
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.kt_add_case_note(uuid,text,text,text) from public,anon;
grant execute on function public.kt_add_case_note(uuid,text,text,text) to authenticated,service_role;

create or replace function public.kt_internal_survey_notify_and_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
declare r record; v_due timestamptz; v_date date;
begin
  update public.kt_alertas_agendados set status='cancelled',updated_at=now() where status='scheduled' and tipo='survey_deadline' and payload->>'survey_id'=new.id;
  if new.modo<>'interna' or not new.ativa then return new; end if;
  if tg_op='INSERT' or old.ativa is distinct from new.ativa then
    for r in select c.auth_user_id from public.kt_colaboradores c where c.ativo=true and c.auth_user_id is not null and (new.filial_alvo is null or c.filial=new.filial_alvo) loop
      insert into public.app_notifications(user_id,type,title,body,action_url) values(r.auth_user_id,'kt_internal_survey','Nova pesquisa interna',new.titulo,'/painel#minha-jornada');
    end loop;
  end if;
  begin v_date:=new.prazo::date; exception when others then v_date:=null; end;
  if v_date is not null then
    v_due:=(v_date::timestamp - interval '1 day') + interval '09:00';
    if v_due>now() then
      for r in select c.auth_user_id from public.kt_colaboradores c where c.ativo=true and c.auth_user_id is not null and (new.filial_alvo is null or c.filial=new.filial_alvo) loop
        insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload)
        values(null,'survey_deadline',v_due,r.auth_user_id,jsonb_build_object('survey_id',new.id,'title','Pesquisa interna encerra em breve','body',new.titulo,'action_url','/painel#minha-jornada')) on conflict do nothing;
      end loop;
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.kt_internal_survey_notify_and_schedule() from public,anon,authenticated;
drop trigger if exists trg_zz_kt_internal_survey_notify on public.kt_pesquisas;
create trigger trg_zz_kt_internal_survey_notify after insert or update of ativa,prazo on public.kt_pesquisas for each row execute function public.kt_internal_survey_notify_and_schedule();

create or replace function public.kt_recognition_schedule_month_review()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_case_id uuid; v_due timestamptz; r record;
begin
  select id into v_case_id from public.kt_casos where origem_tabela='kt_reconhecimentos' and origem_id=new.id::text;
  if v_case_id is null then return new; end if;
  v_due:=(date_trunc('month',new.created_at)+interval '1 month - 1 day')::date::timestamp + interval '09:00';
  if v_due<=now() then return new; end if;
  for r in select id,tipo from public.kt_perfis where coalesce(ativo,true) and (tipo in ('azumi','rh') or (tipo='gestor' and filial=new.filial)) loop
    insert into public.kt_alertas_agendados(caso_id,tipo,due_at,recipient_user_id,payload)
    values(v_case_id,'recognition_monthly_review',v_due,r.id,jsonb_build_object('title','Revisão de reconhecimentos do mês','body','Revise os reconhecimentos e defina destaques quando fizer sentido.','action_url',case when r.tipo='gestor' then '/gestor#reconhecimento' else '/azumi#reconhecimento' end)) on conflict do nothing;
  end loop;
  return new;
end; $$;
revoke all on function public.kt_recognition_schedule_month_review() from public,anon,authenticated;
drop trigger if exists trg_zz_kt_recognition_month_review on public.kt_reconhecimentos;
create trigger trg_zz_kt_recognition_month_review after insert on public.kt_reconhecimentos for each row execute function public.kt_recognition_schedule_month_review();

revoke execute on function public.kt_employee_feedback_directory() from public,anon;
revoke execute on function public.kt_my_suggestions() from public,anon;
revoke execute on function public.kt_submit_employee_feedback(text,text,text,boolean,text,text,text,text,timestamptz,text) from public,anon;
revoke execute on function public.kt_submit_employee_suggestion(text,text,text) from public,anon;
revoke execute on function public.kt_update_my_profile_preferences(text,text) from public,anon;
revoke execute on function public.kt_sync_employee_shared_profile_row() from public,anon;
revoke execute on function public.kt_notify_document_read() from public,anon;
revoke execute on function public.kt_notify_mural_question() from public,anon;
revoke execute on function public.kt_notify_suggestion() from public,anon;
revoke execute on function public.kt_notify_support_message() from public,anon;