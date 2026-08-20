-- Ken Taki intranet: RH operating model
-- Additive/backwards-compatible schema for granular admin access, feedback/support history,
-- content interactions and collaborator edit audit.

alter table public.kt_perfis
  add column if not exists admin_nivel text
    check (admin_nivel is null or admin_nivel in ('geral','parcial'));

update public.kt_perfis
set admin_nivel = 'geral'
where tipo in ('azumi','rh') and admin_nivel is null;

create or replace function public.kt_is_admin_general()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kt_perfis p
    where p.id = auth.uid()
      and p.tipo in ('azumi','rh')
      and p.admin_nivel = 'geral'
      and coalesce(p.ativo,true)
  );
$$;

create table if not exists public.kt_admin_permissions (
  profile_id uuid not null references public.kt_perfis(id) on delete cascade,
  section text not null check (section in (
    'dashboard','feedbacks','apoio','clima','noticias','pesquisas','mural',
    'sugestoes','colaboradores','documentos','acessos'
  )),
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, section)
);

alter table public.kt_admin_permissions enable row level security;

drop policy if exists kt_admin_permissions_select on public.kt_admin_permissions;
create policy kt_admin_permissions_select
on public.kt_admin_permissions for select to authenticated
using (profile_id = auth.uid() or public.kt_is_admin_general());

drop policy if exists kt_admin_permissions_write on public.kt_admin_permissions;
create policy kt_admin_permissions_write
on public.kt_admin_permissions for all to authenticated
using (public.kt_is_admin_general())
with check (public.kt_is_admin_general());

create or replace function public.kt_has_admin_permission(p_section text, p_action text default 'view')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.kt_is_admin_general() then true
    else exists (
      select 1
      from public.kt_perfis p
      join public.kt_admin_permissions ap on ap.profile_id = p.id
      where p.id = auth.uid()
        and p.tipo in ('azumi','rh')
        and p.admin_nivel = 'parcial'
        and coalesce(p.ativo,true)
        and ap.section = p_section
        and case p_action
          when 'delete' then ap.can_delete
          when 'edit' then ap.can_edit
          else ap.can_view
        end
    )
  end;
$$;

create or replace function public.kt_list_my_admin_permissions()
returns table(section text, can_view boolean, can_edit boolean, can_delete boolean)
language sql
stable
security definer
set search_path = public
as $$
  with sections(section) as (
    values ('dashboard'),('feedbacks'),('apoio'),('clima'),('noticias'),('pesquisas'),
           ('mural'),('sugestoes'),('colaboradores'),('documentos'),('acessos')
  )
  select s.section,
         case when public.kt_is_admin_general() then true else coalesce(ap.can_view,false) end,
         case when public.kt_is_admin_general() then true else coalesce(ap.can_edit,false) end,
         case when public.kt_is_admin_general() then true else coalesce(ap.can_delete,false) end
  from sections s
  left join public.kt_admin_permissions ap
    on ap.profile_id = auth.uid() and ap.section = s.section;
$$;

create or replace function public.kt_set_admin_permissions(p_profile_id uuid, p_permissions jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  if not public.kt_is_admin_general() then
    raise exception 'Apenas administrador geral pode alterar permissões.';
  end if;

  if not exists (
    select 1 from public.kt_perfis
    where id = p_profile_id and tipo in ('azumi','rh') and admin_nivel = 'parcial'
  ) then
    raise exception 'Perfil parcial inválido.';
  end if;

  delete from public.kt_admin_permissions where profile_id = p_profile_id;

  for item in select * from jsonb_array_elements(coalesce(p_permissions,'[]'::jsonb))
  loop
    insert into public.kt_admin_permissions(profile_id,section,can_view,can_edit,can_delete,updated_at)
    values (
      p_profile_id,
      item->>'section',
      coalesce((item->>'can_view')::boolean,false),
      coalesce((item->>'can_edit')::boolean,false),
      coalesce((item->>'can_delete')::boolean,false),
      now()
    );
  end loop;
  return true;
end;
$$;

create or replace function public.kt_list_admin_accounts()
returns table(
  id uuid,
  nome text,
  email text,
  admin_nivel text,
  ativo boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.kt_is_admin_general() then
    raise exception 'Apenas administrador geral pode visualizar todos os acessos administrativos.';
  end if;

  return query
  select p.id,p.nome,u.email,p.admin_nivel,p.ativo,p.created_at
  from public.kt_perfis p
  left join auth.users u on u.id = p.id
  where p.tipo in ('azumi','rh')
  order by p.created_at asc;
end;
$$;

create table if not exists public.kt_profile_preferences (
  profile_id uuid primary key references public.kt_perfis(id) on delete cascade,
  accent_color text not null default '#4b3142',
  background_style text not null default 'ivory'
    check (background_style in ('ivory','paper','plum-soft','graphite-soft')),
  updated_at timestamptz not null default now()
);

alter table public.kt_profile_preferences enable row level security;

drop policy if exists kt_profile_preferences_own on public.kt_profile_preferences;
create policy kt_profile_preferences_own
on public.kt_profile_preferences for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create or replace function public.kt_update_my_ui_preferences(p_accent_color text, p_background_style text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Cor inválida.';
  end if;
  if p_background_style not in ('ivory','paper','plum-soft','graphite-soft') then
    raise exception 'Fundo inválido.';
  end if;
  insert into public.kt_profile_preferences(profile_id,accent_color,background_style,updated_at)
  values(auth.uid(),lower(p_accent_color),p_background_style,now())
  on conflict(profile_id) do update set
    accent_color=excluded.accent_color,
    background_style=excluded.background_style,
    updated_at=now();
  return true;
end;
$$;

alter table public.kt_feedbacks
  add column if not exists referente_colaborador_id text references public.kt_colaboradores(id) on delete set null,
  add column if not exists responsavel_id uuid references public.kt_perfis(id) on delete set null,
  add column if not exists proxima_acao text,
  add column if not exists proxima_acao_em timestamptz,
  add column if not exists encerrado_em timestamptz,
  add column if not exists encerrado_motivo text;

create table if not exists public.kt_feedback_acoes (
  id uuid primary key default gen_random_uuid(),
  feedback_id text not null references public.kt_feedbacks(id) on delete cascade,
  actor_id uuid references public.kt_perfis(id) on delete set null,
  actor_nome text,
  action_type text not null check (action_type in (
    'nota','plano_acao','reuniao','devolutiva','arquivo','status','compartilhamento'
  )),
  message text,
  visibility text not null default 'rh' check (visibility in ('rh','gestor')),
  due_at timestamptz,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_kt_feedback_acoes_feedback_created
  on public.kt_feedback_acoes(feedback_id,created_at desc);

alter table public.kt_feedback_acoes enable row level security;

drop policy if exists kt_feedback_acoes_select on public.kt_feedback_acoes;
create policy kt_feedback_acoes_select
on public.kt_feedback_acoes for select to authenticated
using (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('feedbacks','view'))
  or (
    public.kt_current_profile_type() = 'gestor'
    and visibility = 'gestor'
    and exists (
      select 1 from public.kt_feedbacks f
      where f.id = feedback_id
        and f.filial = public.kt_current_profile_filial()
        and (coalesce(f.gestor_liberado,false) or coalesce(f.destino,'gestor')='gestor')
    )
  )
);

drop policy if exists kt_feedback_acoes_insert on public.kt_feedback_acoes;
create policy kt_feedback_acoes_insert
on public.kt_feedback_acoes for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('feedbacks','edit'))
    or (
      public.kt_current_profile_type() = 'gestor'
      and visibility = 'gestor'
      and exists (
        select 1 from public.kt_feedbacks f
        where f.id = feedback_id
          and f.filial = public.kt_current_profile_filial()
          and (coalesce(f.gestor_liberado,false) or coalesce(f.destino,'gestor')='gestor')
      )
    )
  )
);

alter table public.kt_ajuda
  add column if not exists tipo_apoio text,
  add column if not exists responsavel_id uuid references public.kt_perfis(id) on delete set null,
  add column if not exists proxima_acao text,
  add column if not exists proxima_acao_em timestamptz,
  add column if not exists encerrado_em timestamptz,
  add column if not exists encerrado_motivo text;

create table if not exists public.kt_apoio_mensagens (
  id uuid primary key default gen_random_uuid(),
  pedido_id text not null references public.kt_ajuda(id) on delete cascade,
  actor_id uuid references public.kt_perfis(id) on delete set null,
  actor_nome text,
  message_type text not null default 'mensagem' check (message_type in (
    'mensagem','arquivo','reuniao','devolutiva','status'
  )),
  message text,
  visibility text not null default 'rh' check (visibility in ('rh','gestor')),
  attachment_url text,
  meeting_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_kt_apoio_mensagens_pedido_created
  on public.kt_apoio_mensagens(pedido_id,created_at asc);

alter table public.kt_apoio_mensagens enable row level security;

drop policy if exists kt_apoio_mensagens_select on public.kt_apoio_mensagens;
create policy kt_apoio_mensagens_select
on public.kt_apoio_mensagens for select to authenticated
using (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('apoio','view'))
  or (
    public.kt_current_profile_type()='gestor'
    and visibility='gestor'
    and exists (
      select 1 from public.kt_ajuda a
      where a.id=pedido_id
        and a.filial=public.kt_current_profile_filial()
        and (a.destino_inicial='gestor' or a.gestor_id=auth.uid())
    )
  )
);

drop policy if exists kt_apoio_mensagens_insert on public.kt_apoio_mensagens;
create policy kt_apoio_mensagens_insert
on public.kt_apoio_mensagens for insert to authenticated
with check (
  actor_id=auth.uid()
  and (
    (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('apoio','edit'))
    or (
      public.kt_current_profile_type()='gestor'
      and visibility='gestor'
      and exists (
        select 1 from public.kt_ajuda a
        where a.id=pedido_id
          and a.filial=public.kt_current_profile_filial()
          and (a.destino_inicial='gestor' or a.gestor_id=auth.uid())
      )
    )
  )
);

alter table public.kt_sugestoes
  add column if not exists responsavel_id uuid references public.kt_perfis(id) on delete set null,
  add column if not exists gestor_compartilhado boolean not null default false,
  add column if not exists gestor_compartilhado_em timestamptz,
  add column if not exists gestor_compartilhado_por uuid references public.kt_perfis(id) on delete set null;

create table if not exists public.kt_content_interactions (
  id uuid primary key default gen_random_uuid(),
  actor_auth_id uuid not null,
  content_type text not null check (content_type in ('noticia','mural','pesquisa')),
  content_id text not null,
  action text not null check (action in ('view','click','like','dislike','ack','responded_yes','responded_no')),
  created_at timestamptz not null default now(),
  unique(actor_auth_id,content_type,content_id,action)
);

create index if not exists idx_kt_content_interactions_content
  on public.kt_content_interactions(content_type,content_id,created_at desc);

alter table public.kt_content_interactions enable row level security;

drop policy if exists kt_content_interactions_own_insert on public.kt_content_interactions;
create policy kt_content_interactions_own_insert
on public.kt_content_interactions for insert to authenticated
with check (actor_auth_id=auth.uid());

drop policy if exists kt_content_interactions_select on public.kt_content_interactions;
create policy kt_content_interactions_select
on public.kt_content_interactions for select to authenticated
using (
  actor_auth_id=auth.uid()
  or (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('noticias','view'))
);

create table if not exists public.kt_colaborador_auditoria (
  id uuid primary key default gen_random_uuid(),
  colaborador_id text not null references public.kt_colaboradores(id) on delete cascade,
  actor_id uuid references public.kt_perfis(id) on delete set null,
  filial text not null,
  fields_changed text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_kt_colaborador_auditoria_colaborador
  on public.kt_colaborador_auditoria(colaborador_id,created_at desc);

alter table public.kt_colaborador_auditoria enable row level security;

drop policy if exists kt_colaborador_auditoria_select on public.kt_colaborador_auditoria;
create policy kt_colaborador_auditoria_select
on public.kt_colaborador_auditoria for select to authenticated
using (
  (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('colaboradores','view'))
  or (public.kt_current_profile_type()='gestor' and filial=public.kt_current_profile_filial())
);

create or replace function public.kt_audit_colaborador_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_fields text[] := '{}';
  v_body text;
begin
  if old.nome is distinct from new.nome then v_fields := array_append(v_fields,'nome'); end if;
  if old.cargo is distinct from new.cargo then v_fields := array_append(v_fields,'cargo'); end if;
  if old.filial is distinct from new.filial then v_fields := array_append(v_fields,'filial'); end if;
  if old.admissao is distinct from new.admissao then v_fields := array_append(v_fields,'admissao'); end if;
  if old.ativo is distinct from new.ativo then v_fields := array_append(v_fields,'status'); end if;

  if cardinality(v_fields)=0 then return new; end if;

  insert into public.kt_colaborador_auditoria(
    colaborador_id,actor_id,filial,fields_changed,old_values,new_values
  ) values (
    new.id,auth.uid(),new.filial,v_fields,
    jsonb_build_object('nome',old.nome,'cargo',old.cargo,'filial',old.filial,'admissao',old.admissao,'ativo',old.ativo),
    jsonb_build_object('nome',new.nome,'cargo',new.cargo,'filial',new.filial,'admissao',new.admissao,'ativo',new.ativo)
  );

  v_body := new.nome || ': ' || array_to_string(v_fields,', ') || '.';
  insert into public.app_notifications(user_id,type,title,body,action_url)
  select p.id,'employee_record_updated','Cadastro de colaborador atualizado',v_body,'/gestor#equipe'
  from public.kt_perfis p
  where p.tipo='gestor'
    and p.filial in (old.filial,new.filial)
    and coalesce(p.ativo,true)
    and p.id is distinct from auth.uid();

  return new;
end;
$$;

drop trigger if exists trg_kt_audit_colaborador_update on public.kt_colaboradores;
create trigger trg_kt_audit_colaborador_update
after update on public.kt_colaboradores
for each row execute function public.kt_audit_colaborador_update();

revoke execute on function public.kt_is_admin_general() from public,anon;
revoke execute on function public.kt_has_admin_permission(text,text) from public,anon;
revoke execute on function public.kt_list_my_admin_permissions() from public,anon;
revoke execute on function public.kt_set_admin_permissions(uuid,jsonb) from public,anon;
revoke execute on function public.kt_list_admin_accounts() from public,anon;
revoke execute on function public.kt_update_my_ui_preferences(text,text) from public,anon;
revoke execute on function public.kt_audit_colaborador_update() from public,anon,authenticated;

grant execute on function public.kt_is_admin_general() to authenticated;
grant execute on function public.kt_has_admin_permission(text,text) to authenticated;
grant execute on function public.kt_list_my_admin_permissions() to authenticated;
grant execute on function public.kt_set_admin_permissions(uuid,jsonb) to authenticated;
grant execute on function public.kt_list_admin_accounts() to authenticated;
grant execute on function public.kt_update_my_ui_preferences(text,text) to authenticated;
