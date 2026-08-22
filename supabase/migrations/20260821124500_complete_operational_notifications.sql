-- Complete the collaborator -> manager -> RH routing matrix and keep partial RH permissions respected.

create or replace function public.kt_profile_has_admin_permission(
  p_profile_id uuid,
  p_section text,
  p_action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.kt_perfis p
    where p.id=p_profile_id
      and p.tipo in ('azumi','rh')
      and coalesce(p.ativo,true)
      and (
        coalesce(p.admin_nivel,'geral')='geral'
        or exists (
          select 1
          from public.kt_admin_permissions ap
          where ap.profile_id=p.id
            and ap.section=p_section
            and case p_action
              when 'delete' then ap.can_delete
              when 'edit' then ap.can_edit
              else ap.can_view
            end
        )
      )
  );
$$;

revoke execute on function public.kt_profile_has_admin_permission(uuid,text,text) from public,anon,authenticated;

create or replace function public.kt_notify_feedback()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_sensitive boolean;
  v_body_rh text;
  v_body_manager text;
begin
  v_sensitive := new.tipo in ('Crítica','Reclamação','Denúncia','Situação urgente');
  v_body_rh := case
    when v_sensitive and new.anonimo then 'Novo relato sensível e anônimo aguardando triagem · ' || new.filial || '.'
    when v_sensitive then coalesce(nullif(new.autor,''),'Colaborador') || ' enviou um relato sensível para triagem · ' || new.filial || '.'
    when new.anonimo then 'Novo feedback anônimo recebido · ' || new.filial || '.'
    else coalesce(nullif(new.autor,''),'Colaborador') || ' enviou um feedback · ' || new.filial || '.'
  end;

  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,
    case when v_sensitive then 'feedback_triage_required' else 'feedback_received' end,
    case when v_sensitive then 'Triagem de RH necessária' else 'Novo feedback' end,
    v_body_rh,
    '/azumi#feedbacks'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'feedbacks','view');

  if not v_sensitive and coalesce(new.destino,'gestor')='gestor' then
    v_body_manager := case
      when new.anonimo then 'Novo feedback anônimo recebido para sua unidade.'
      else coalesce(nullif(new.autor,''),'Colaborador') || ' enviou um feedback para sua unidade.'
    end;
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'feedback_received','Novo feedback',v_body_manager,'/gestor#feedbacks'
    from public.kt_perfis p
    where p.tipo='gestor' and p.filial=new.filial and coalesce(p.ativo,true);
  end if;
  return new;
end;
$$;

create or replace function public.kt_escalar_feedback_rh(p_feedback_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_filial text;
begin
  select f.filial into v_filial
  from public.kt_feedbacks f
  join public.kt_perfis p on p.id=auth.uid()
  where f.id=p_feedback_id
    and p.tipo='gestor'
    and p.filial=f.filial
    and coalesce(p.ativo,true)
    and (coalesce(f.gestor_liberado,false) or coalesce(f.destino,'gestor')='gestor');
  if v_filial is null then raise exception 'Gestor sem permissão para escalar este feedback.'; end if;

  update public.kt_feedbacks
  set escalado_rh=true, escalado_rh_em=now(), escalado_rh_por=auth.uid()
  where id=p_feedback_id;

  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,'manager_escalated_to_hr','Gestor solicitou acompanhamento do RH',
         'Um gestor da unidade ' || v_filial || ' pediu apoio do RH em um feedback.',
         '/azumi#feedbacks'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'feedbacks','view');
  return true;
end;
$$;

create or replace function public.kt_liberar_feedback_gestor(p_feedback_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.kt_current_profile_type() not in ('azumi','rh')
     or not public.kt_has_admin_permission('feedbacks','edit') then
    raise exception 'Apenas RH autorizado pode liberar este relato para o gestor.';
  end if;
  update public.kt_feedbacks
  set gestor_liberado=true,
      gestor_liberado_em=now(),
      gestor_liberado_por=auth.uid(),
      triagem_rh_status='liberado_gestor',
      destino='gestor'
  where id=p_feedback_id;
  return found;
end;
$$;

create or replace function public.kt_reter_feedback_rh(p_feedback_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.kt_current_profile_type() not in ('azumi','rh')
     or not public.kt_has_admin_permission('feedbacks','edit') then
    raise exception 'Apenas RH autorizado pode manter este relato restrito.';
  end if;
  update public.kt_feedbacks
  set gestor_liberado=false,
      gestor_liberado_em=null,
      gestor_liberado_por=null,
      triagem_rh_status='retido_rh',
      destino='azumi'
  where id=p_feedback_id;
  return found;
end;
$$;

create or replace function public.kt_notify_ajuda()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,
    'support_requested',
    case when new.destino_inicial='gestor' then 'Pedido de apoio direcionado à liderança' else 'Novo pedido de apoio' end,
    new.nome || ' registrou um pedido de apoio · ' || new.filial || '.',
    '/azumi#apoio'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'apoio','view');

  if new.destino_inicial='gestor' then
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'support_requested','Colaborador pediu uma conversa',
      new.nome || ' pediu uma conversa com a liderança.','/gestor#apoio'
    from public.kt_perfis p
    where p.tipo='gestor' and p.filial=new.filial and coalesce(p.ativo,true);
  elsif new.gestor_id is not null then
    perform public.kt_insert_notification(
      new.gestor_id,'support_requested','RH envolveu você em um atendimento',
      'O RH direcionou um pedido de apoio para seu acompanhamento.','/gestor#apoio'
    );
  end if;
  return new;
end;
$$;

create or replace function public.kt_escalar_apoio_rh(p_pedido_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_nome text;
  v_filial text;
begin
  select a.nome,a.filial into v_nome,v_filial
  from public.kt_ajuda a
  join public.kt_perfis p on p.id=auth.uid()
  where a.id=p_pedido_id
    and p.tipo='gestor'
    and p.filial=a.filial
    and coalesce(p.ativo,true)
    and (a.destino_inicial='gestor' or a.gestor_id=auth.uid());
  if v_filial is null then raise exception 'Gestor sem permissão para acionar o RH neste atendimento.'; end if;

  update public.kt_ajuda
  set rh_solicitado=true,rh_solicitado_em=now(),rh_solicitado_por=auth.uid()
  where id=p_pedido_id;

  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,'manager_escalated_support_to_hr','Gestor solicitou atuação do RH',
    'A liderança de ' || v_filial || ' pediu atuação do RH em um atendimento de ' || coalesce(nullif(v_nome,''),'colaborador') || '.',
    '/azumi#apoio'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'apoio','view');
  return true;
end;
$$;

create or replace function public.kt_notify_suggestion()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,'suggestion_received','Nova sugestão recebida',
    'Uma nova sugestão anônima foi registrada · ' || new.filial || '.',
    '/azumi#sugestoes'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'sugestoes','view');
  return new;
end;
$$;

drop trigger if exists trg_kt_notify_suggestion on public.kt_sugestoes;
create trigger trg_kt_notify_suggestion
after insert on public.kt_sugestoes
for each row execute function public.kt_notify_suggestion();

create or replace function public.kt_notify_document_read()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_title text;
  v_first boolean;
begin
  select not exists (
    select 1 from public.kt_leituras l
    where l.id<>new.id
      and l.documento_id=new.documento_id
      and (
        (new.colaborador_id is not null and l.colaborador_id=new.colaborador_id)
        or (new.colaborador_id is null and l.nome=new.nome and l.filial=new.filial)
      )
  ) into v_first;
  if not v_first then return new; end if;

  select titulo into v_title from public.kt_documentos where id=new.documento_id limit 1;

  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,'document_read','Documento aberto',
    new.nome || ' abriu “' || coalesce(v_title,'um documento') || '”.',
    case when p.tipo='gestor' then '/gestor#politicas' else '/azumi#politicas' end
  from public.kt_perfis p
  where (p.tipo='gestor' and p.filial=new.filial and coalesce(p.ativo,true))
     or public.kt_profile_has_admin_permission(p.id,'documentos','view');
  return new;
end;
$$;

drop trigger if exists trg_kt_notify_document_read on public.kt_leituras;
create trigger trg_kt_notify_document_read
after insert on public.kt_leituras
for each row execute function public.kt_notify_document_read();

create or replace function public.kt_notify_support_message()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_filial text;
  v_destino text;
  v_gestor uuid;
  v_actor_type text;
begin
  select a.filial,a.destino_inicial,a.gestor_id into v_filial,v_destino,v_gestor
  from public.kt_ajuda a where a.id=new.pedido_id;
  if v_filial is null then return new; end if;
  select tipo into v_actor_type from public.kt_perfis where id=new.actor_id;

  if v_actor_type='gestor' then
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'support_message_added','Nova atualização em atendimento',
      'A gestão adicionou uma atualização em um pedido de apoio · ' || v_filial || '.',
      '/azumi#apoio'
    from public.kt_perfis p
    where public.kt_profile_has_admin_permission(p.id,'apoio','view');
  elsif v_actor_type in ('azumi','rh') and new.visibility='gestor' then
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'support_message_added','RH atualizou um atendimento',
      'O RH adicionou uma atualização compartilhada no atendimento.','/gestor#apoio'
    from public.kt_perfis p
    where p.tipo='gestor'
      and p.filial=v_filial
      and coalesce(p.ativo,true)
      and (v_destino='gestor' or p.id=v_gestor)
      and p.id<>new.actor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kt_notify_support_message on public.kt_apoio_mensagens;
create trigger trg_kt_notify_support_message
after insert on public.kt_apoio_mensagens
for each row execute function public.kt_notify_support_message();

create or replace function public.kt_queue_email_from_notification()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text;
  v_profile_type text;
begin
  if new.type not in (
    'document_read',
    'document_signed',
    'feedback_received',
    'feedback_triage_required',
    'feedback_released_by_hr',
    'manager_escalated_to_hr',
    'support_requested',
    'support_released_by_hr',
    'manager_escalated_support_to_hr',
    'support_message_added',
    'suggestion_received',
    'suggestion_shared_with_manager',
    'employee_record_updated'
  ) then
    return new;
  end if;

  select u.email,p.tipo into v_email,v_profile_type
  from auth.users u
  left join public.kt_perfis p on p.id=u.id
  where u.id=new.user_id
  limit 1;

  if v_email is null
     or v_email=''
     or v_email like '%@colaborador.kentaki.com.br'
     or v_profile_type not in ('gestor','azumi','rh') then
    return new;
  end if;

  insert into public.kt_email_outbox(
    notification_id,user_id,recipient,event_type,subject,body,action_url
  ) values (
    new.id,new.user_id,lower(v_email),new.type,new.title,new.body,new.action_url
  ) on conflict(notification_id,recipient) do nothing;
  return new;
end;
$$;

-- Keep these RPCs callable only from authenticated sessions. Their bodies perform role/permission checks.
revoke execute on function public.kt_escalar_feedback_rh(text) from public,anon;
grant execute on function public.kt_escalar_feedback_rh(text) to authenticated;
revoke execute on function public.kt_liberar_feedback_gestor(text) from public,anon;
grant execute on function public.kt_liberar_feedback_gestor(text) to authenticated;
revoke execute on function public.kt_reter_feedback_rh(text) from public,anon;
grant execute on function public.kt_reter_feedback_rh(text) to authenticated;
revoke execute on function public.kt_escalar_apoio_rh(text) from public,anon;
grant execute on function public.kt_escalar_apoio_rh(text) to authenticated;
