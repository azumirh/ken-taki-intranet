alter table public.kt_feedbacks
  add column if not exists origem text not null default 'colaborador',
  add column if not exists criado_por_profile_id uuid references public.kt_perfis(id) on delete set null;

alter table public.kt_ajuda
  add column if not exists origem text not null default 'colaborador',
  add column if not exists criado_por_profile_id uuid references public.kt_perfis(id) on delete set null;

alter table public.kt_colaboradores
  add column if not exists desligamento_informado_em date,
  add column if not exists ultimo_dia_em date;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin_azumi'::text,'consultor'::text,'gestor_cliente'::text,'candidato'::text,'colaborador_ken_taki'::text]));

create or replace function public.kt_sync_employee_shared_profile_row()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_email text;
begin
  if new.auth_user_id is null then return new; end if;
  select email into v_email from auth.users where id = new.auth_user_id;
  if v_email is null or v_email = '' then return new; end if;
  insert into public.profiles(id,nome,email,role,avatar_url,ativo)
  values(new.auth_user_id,new.nome,v_email,'colaborador_ken_taki',new.foto,coalesce(new.ativo,true))
  on conflict(id) do update set
    nome=excluded.nome,
    email=excluded.email,
    role='colaborador_ken_taki',
    avatar_url=excluded.avatar_url,
    ativo=excluded.ativo;
  return new;
end;
$$;

drop trigger if exists trg_kt_sync_employee_shared_profile on public.kt_colaboradores;
create trigger trg_kt_sync_employee_shared_profile
after insert or update of auth_user_id,nome,foto,ativo on public.kt_colaboradores
for each row execute function public.kt_sync_employee_shared_profile_row();

insert into public.profiles(id,nome,email,role,avatar_url,ativo)
select c.auth_user_id,c.nome,u.email,'colaborador_ken_taki',c.foto,coalesce(c.ativo,true)
from public.kt_colaboradores c
join auth.users u on u.id=c.auth_user_id
where c.auth_user_id is not null and u.email is not null
on conflict(id) do update set
  nome=excluded.nome,email=excluded.email,role='colaborador_ken_taki',avatar_url=excluded.avatar_url,ativo=excluded.ativo;

create or replace function public.kt_manager_create_feedback(
  p_tipo text,
  p_mensagem text,
  p_referente_colaborador_id text default null,
  p_envolver_rh boolean default false,
  p_fato_em timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.kt_perfis%rowtype;
  v_id text := gen_random_uuid()::text;
  v_target public.kt_colaboradores%rowtype;
begin
  select * into v_profile from public.kt_perfis
  where id=auth.uid() and tipo='gestor' and coalesce(ativo,true);
  if not found or v_profile.filial is null then raise exception 'Perfil de gestor inválido ou inativo.'; end if;
  if nullif(trim(p_mensagem),'') is null then raise exception 'Descreva o feedback.'; end if;
  if p_referente_colaborador_id is not null then
    select * into v_target from public.kt_colaboradores where id=p_referente_colaborador_id and filial=v_profile.filial;
    if not found then raise exception 'Colaborador fora da sua unidade.'; end if;
  end if;
  insert into public.kt_feedbacks(
    id,tipo,mensagem,anonimo,autor,filial,ts,status,status_alterado_em,destino,
    gestor_liberado,escalado_rh,escalado_rh_em,escalado_rh_por,
    referente_colaborador_id,fato_em,origem,criado_por_profile_id
  ) values (
    v_id,coalesce(nullif(trim(p_tipo),''),'Feedback'),trim(p_mensagem),false,v_profile.nome,v_profile.filial,now(),
    'novo',now(),'gestor',true,coalesce(p_envolver_rh,false),
    case when p_envolver_rh then now() else null end,
    case when p_envolver_rh then auth.uid() else null end,
    p_referente_colaborador_id,coalesce(p_fato_em,now()),'gestor',auth.uid()
  );
  insert into public.kt_feedback_acoes(feedback_id,actor_id,actor_nome,action_type,message,visibility,created_at)
  values(v_id,auth.uid(),v_profile.nome,'abertura','Feedback registrado pela gestão.','gestor',now());
  if coalesce(p_envolver_rh,false) then
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'manager_created_feedback_for_hr','Gestor solicitou acompanhamento do RH',
      'A gestão de '||v_profile.filial||' registrou um feedback e pediu acompanhamento do RH.',
      '/azumi#feedbacks'
    from public.kt_perfis p
    where public.kt_profile_has_admin_permission(p.id,'feedbacks','view');
  end if;
  return v_id;
end;
$$;

create or replace function public.kt_manager_create_support(
  p_assunto text,
  p_tipo_apoio text default 'Conversa e orientação',
  p_mensagem text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.kt_perfis%rowtype;
  v_id text := gen_random_uuid()::text;
begin
  select * into v_profile from public.kt_perfis where id=auth.uid() and tipo='gestor' and coalesce(ativo,true);
  if not found or v_profile.filial is null then raise exception 'Perfil de gestor inválido ou inativo.'; end if;
  if nullif(trim(p_assunto),'') is null then raise exception 'Descreva o apoio que você precisa.'; end if;
  insert into public.kt_ajuda(
    id,nome,filial,assunto,ts,status,gestor_id,destino_inicial,rh_solicitado,rh_solicitado_em,
    rh_solicitado_por,tipo_apoio,origem,criado_por_profile_id
  ) values(
    v_id,v_profile.nome,v_profile.filial,trim(p_assunto),now(),'novo',auth.uid(),'gestor',true,now(),auth.uid(),
    coalesce(nullif(trim(p_tipo_apoio),''),'Conversa e orientação'),'gestor',auth.uid()
  );
  if nullif(trim(p_mensagem),'') is not null then
    insert into public.kt_apoio_mensagens(pedido_id,actor_id,actor_nome,message_type,message,visibility,created_at)
    values(v_id,auth.uid(),v_profile.nome,'mensagem',trim(p_mensagem),'gestor',now());
  end if;
  return v_id;
end;
$$;

create or replace function public.kt_manager_offboard_employee(
  p_colaborador_id text,
  p_informado_em date,
  p_ultimo_dia_em date,
  p_motivo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.kt_perfis%rowtype;
  v_employee public.kt_colaboradores%rowtype;
begin
  select * into v_profile from public.kt_perfis where id=auth.uid() and tipo='gestor' and coalesce(ativo,true);
  if not found or v_profile.filial is null then raise exception 'Perfil de gestor inválido ou inativo.'; end if;
  select * into v_employee from public.kt_colaboradores where id=p_colaborador_id and filial=v_profile.filial;
  if not found then raise exception 'Colaborador fora da sua unidade.'; end if;
  if p_informado_em is null or p_ultimo_dia_em is null then raise exception 'Informe a data da comunicação e o último dia.'; end if;
  if nullif(trim(p_motivo),'') is null then raise exception 'Informe o motivo do desligamento.'; end if;
  update public.kt_colaboradores set
    ativo=false,
    motivo_desligamento=trim(p_motivo),
    desligamento_informado_em=p_informado_em,
    ultimo_dia_em=p_ultimo_dia_em,
    desligado_em=round(extract(epoch from now())*1000)::bigint,
    desligado_por=v_profile.nome,
    updated_at=now()
  where id=p_colaborador_id;
  insert into public.kt_colaborador_auditoria(colaborador_id,actor_id,filial,fields_changed,old_values,new_values)
  values(
    p_colaborador_id,auth.uid(),v_profile.filial,
    array['ativo','motivo_desligamento','desligamento_informado_em','ultimo_dia_em'],
    jsonb_build_object('ativo',v_employee.ativo,'motivo_desligamento',v_employee.motivo_desligamento),
    jsonb_build_object('ativo',false,'motivo_desligamento',trim(p_motivo),'desligamento_informado_em',p_informado_em,'ultimo_dia_em',p_ultimo_dia_em)
  );
  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,'employee_offboarded','Desligamento registrado',
    v_profile.nome||' registrou o desligamento de '||v_employee.nome||' ('||v_profile.filial||'). Último dia: '||to_char(p_ultimo_dia_em,'DD/MM/YYYY')||'.',
    '/azumi#colaboradores'
  from public.kt_perfis p
  where public.kt_profile_has_admin_permission(p.id,'colaboradores','view');
  return true;
end;
$$;

create or replace function public.kt_manager_remind_document(p_colaborador_id text,p_documento_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.kt_perfis%rowtype;
  v_employee public.kt_colaboradores%rowtype;
  v_doc public.kt_documentos%rowtype;
begin
  select * into v_profile from public.kt_perfis where id=auth.uid() and tipo='gestor' and coalesce(ativo,true);
  if not found or v_profile.filial is null then raise exception 'Perfil de gestor inválido ou inativo.'; end if;
  select * into v_employee from public.kt_colaboradores where id=p_colaborador_id and filial=v_profile.filial and ativo=true;
  if not found then raise exception 'Colaborador fora da sua unidade ou inativo.'; end if;
  select * into v_doc from public.kt_documentos where id=p_documento_id and (filial=v_profile.filial or filial='todas');
  if not found then raise exception 'Documento não disponível para sua unidade.'; end if;
  if v_employee.auth_user_id is null then raise exception 'Este colaborador ainda não possui acesso autenticado para receber alerta na plataforma.'; end if;
  if exists(select 1 from public.kt_assinaturas a where a.politica=p_documento_id and (a.colaborador_id=p_colaborador_id or a.nome=v_employee.nome)) then
    raise exception 'Este colaborador já assinou o documento.';
  end if;
  perform public.kt_insert_notification(
    v_employee.auth_user_id,
    'document_reminder',
    'Assinatura pendente',
    'A gestão lembrou você de concluir a assinatura de “'||v_doc.titulo||'”.',
    '/painel#politicas'
  );
  return true;
end;
$$;

revoke all on function public.kt_manager_create_feedback(text,text,text,boolean,timestamptz) from public, anon;
revoke all on function public.kt_manager_create_support(text,text,text) from public, anon;
revoke all on function public.kt_manager_offboard_employee(text,date,date,text) from public, anon;
revoke all on function public.kt_manager_remind_document(text,text) from public, anon;
grant execute on function public.kt_manager_create_feedback(text,text,text,boolean,timestamptz) to authenticated;
grant execute on function public.kt_manager_create_support(text,text,text) to authenticated;
grant execute on function public.kt_manager_offboard_employee(text,date,date,text) to authenticated;
grant execute on function public.kt_manager_remind_document(text,text) to authenticated;