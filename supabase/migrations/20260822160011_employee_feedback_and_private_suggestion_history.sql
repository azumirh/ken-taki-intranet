alter table public.kt_feedbacks
  add column if not exists fato_em timestamptz,
  add column if not exists destinatario_tipo text,
  add column if not exists destinatario_colaborador_id text,
  add column if not exists destinatario_nome text,
  add column if not exists destinatario_filial text,
  add column if not exists testemunhas text;

alter table public.kt_feedbacks
  drop constraint if exists kt_feedbacks_destinatario_tipo_check;

alter table public.kt_feedbacks
  add constraint kt_feedbacks_destinatario_tipo_check
  check (destinatario_tipo is null or destinatario_tipo in ('gestor','colaborador','rh','outro'));

alter table public.kt_sugestoes
  add column if not exists resposta_colaborador text;

create table if not exists public.kt_sugestao_autoria_privada (
  sugestao_id text primary key references public.kt_sugestoes(id) on delete cascade,
  actor_auth_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists kt_sugestao_autoria_privada_actor_idx
  on public.kt_sugestao_autoria_privada(actor_auth_id, created_at desc);

alter table public.kt_sugestao_autoria_privada enable row level security;

drop policy if exists kt_sugestao_autoria_own on public.kt_sugestao_autoria_privada;
create policy kt_sugestao_autoria_own
on public.kt_sugestao_autoria_privada
for select
to authenticated
using (actor_auth_id = auth.uid());

revoke all on table public.kt_sugestao_autoria_privada from anon, authenticated;
grant select on table public.kt_sugestao_autoria_privada to authenticated;

create or replace function public.kt_submit_employee_suggestion(
  p_id text,
  p_categoria text,
  p_mensagem text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filial text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if nullif(trim(coalesce(p_mensagem,'')), '') is null then raise exception 'message_required'; end if;

  select c.filial into v_filial
  from public.kt_colaboradores c
  where c.auth_user_id = auth.uid() and coalesce(c.ativo,true)
  limit 1;

  if v_filial is null then raise exception 'employee_not_found'; end if;

  insert into public.kt_sugestoes(id,categoria,mensagem,filial,ts,status,colaborador_id)
  values (p_id, trim(coalesce(p_categoria,'Geral')), trim(p_mensagem), v_filial, now(), 'enviado-rh', null);

  insert into public.kt_sugestao_autoria_privada(sugestao_id,actor_auth_id)
  values (p_id,auth.uid());

  return p_id;
end;
$$;

revoke all on function public.kt_submit_employee_suggestion(text,text,text) from public;
grant execute on function public.kt_submit_employee_suggestion(text,text,text) to authenticated;

create or replace function public.kt_my_suggestions()
returns table(
  id text,
  categoria text,
  mensagem text,
  ts timestamptz,
  status text,
  status_ts timestamptz,
  resposta text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.categoria,
    s.mensagem,
    s.ts,
    s.status,
    s.status_ts,
    coalesce(nullif(s.resposta_colaborador,''),
      case when s.status in ('desconsiderado','descartado') then nullif(s.justificativa,'') else null end)
  from public.kt_sugestoes s
  join public.kt_sugestao_autoria_privada a on a.sugestao_id = s.id
  where a.actor_auth_id = auth.uid()
  order by s.ts desc;
$$;

revoke all on function public.kt_my_suggestions() from public;
grant execute on function public.kt_my_suggestions() to authenticated;

create or replace function public.kt_employee_feedback_directory()
returns table(id text, nome text, cargo text, filial text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.nome, c.cargo, c.filial
  from public.kt_colaboradores c
  where coalesce(c.ativo,true)
    and exists (
      select 1 from public.kt_colaboradores me
      where me.auth_user_id = auth.uid() and coalesce(me.ativo,true)
    )
  order by c.filial, c.nome;
$$;

revoke all on function public.kt_employee_feedback_directory() from public;
grant execute on function public.kt_employee_feedback_directory() to authenticated;

create or replace function public.kt_submit_employee_feedback(
  p_id text,
  p_tipo text,
  p_mensagem text,
  p_anonimo boolean,
  p_destinatario_tipo text,
  p_destinatario_colaborador_id text default null,
  p_destinatario_nome text default null,
  p_destinatario_filial text default null,
  p_fato_em timestamptz default null,
  p_testemunhas text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.kt_colaboradores%rowtype;
  v_target public.kt_colaboradores%rowtype;
  v_sensitive boolean;
  v_destino text;
  v_target_name text;
  v_target_filial text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_tipo not in ('Elogio','Dúvida','Crítica','Reclamação','Denúncia','Situação urgente') then raise exception 'invalid_type'; end if;
  if nullif(trim(coalesce(p_mensagem,'')), '') is null then raise exception 'message_required'; end if;
  if p_destinatario_tipo not in ('gestor','colaborador','rh','outro') then raise exception 'invalid_recipient'; end if;

  select * into v_actor
  from public.kt_colaboradores c
  where c.auth_user_id = auth.uid() and coalesce(c.ativo,true)
  limit 1;
  if v_actor.id is null then raise exception 'employee_not_found'; end if;

  if p_destinatario_colaborador_id is not null then
    select * into v_target from public.kt_colaboradores c
    where c.id = p_destinatario_colaborador_id and coalesce(c.ativo,true)
    limit 1;
  end if;

  v_target_name := coalesce(nullif(trim(coalesce(v_target.nome,'')), ''), nullif(trim(coalesce(p_destinatario_nome,'')), ''));
  v_target_filial := coalesce(nullif(trim(coalesce(v_target.filial,'')), ''), nullif(trim(coalesce(p_destinatario_filial,'')), ''), v_actor.filial);
  v_sensitive := p_tipo in ('Crítica','Reclamação','Denúncia','Situação urgente');
  v_destino := case when v_sensitive or p_destinatario_tipo='rh' then 'azumi' else 'gestor' end;

  if v_sensitive and p_fato_em is null then raise exception 'fact_date_required'; end if;

  insert into public.kt_feedbacks(
    id,tipo,mensagem,anonimo,autor,filial,ts,status,destino,colaborador_id,
    triagem_rh_status,gestor_liberado,referente_colaborador_id,fato_em,
    destinatario_tipo,destinatario_colaborador_id,destinatario_nome,destinatario_filial,testemunhas,protocolo
  ) values (
    p_id,p_tipo,trim(p_mensagem),coalesce(p_anonimo,false),v_actor.nome,v_actor.filial,now(),'em-andamento',v_destino,v_actor.id,
    case when v_sensitive then 'aguardando' else null end,false,
    case when p_destinatario_tipo='colaborador' then v_target.id else null end,
    p_fato_em,p_destinatario_tipo,
    case when p_destinatario_tipo='colaborador' then v_target.id else null end,
    v_target_name,v_target_filial,nullif(trim(coalesce(p_testemunhas,'')), ''),
    'KT-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8))
  );

  return p_id;
end;
$$;

revoke all on function public.kt_submit_employee_feedback(text,text,text,boolean,text,text,text,text,timestamptz,text) from public;
grant execute on function public.kt_submit_employee_feedback(text,text,text,boolean,text,text,text,text,timestamptz,text) to authenticated;

create or replace function public.kt_notify_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sensitive boolean;
  v_body_rh text;
  v_body_manager text;
  v_manager_filial text;
begin
  v_sensitive := new.tipo in ('Crítica','Reclamação','Denúncia','Situação urgente');
  v_manager_filial := coalesce(nullif(new.destinatario_filial,''), new.filial);

  v_body_rh := case
    when v_sensitive and new.anonimo then 'Novo relato sensível e anônimo aguardando triagem · '||new.filial||'.'
    when v_sensitive then coalesce(nullif(new.autor,''),'Colaborador')||' enviou um relato sensível para triagem · '||new.filial||'.'
    when new.anonimo then 'Novo feedback anônimo recebido · '||new.filial||'.'
    else coalesce(nullif(new.autor,''),'Colaborador')||' enviou um feedback · '||new.filial||'.'
  end;

  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,
    case when v_sensitive then 'feedback_triage_required' else 'feedback_received' end,
    case when v_sensitive then 'Triagem de RH necessária' else 'Novo feedback' end,
    v_body_rh,'/azumi#feedbacks'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'feedbacks','view');

  if not v_sensitive and coalesce(new.destino,'gestor')='gestor' then
    v_body_manager := case
      when new.anonimo then 'Novo feedback anônimo recebido para sua unidade.'
      else coalesce(nullif(new.autor,''),'Colaborador')||' enviou um feedback para sua unidade.'
    end;
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'feedback_received','Novo feedback',v_body_manager,'/gestor#feedbacks'
    from public.kt_perfis p
    where p.tipo='gestor' and p.filial=v_manager_filial and coalesce(p.ativo,true);
  end if;

  return new;
end;
$$;
