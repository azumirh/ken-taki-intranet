-- Guarded update RPCs for RH/manager case management.

create or replace function public.kt_update_feedback_case(
  p_feedback_id text,
  p_status text default null,
  p_responsavel_id uuid default null,
  p_proxima_acao text default null,
  p_proxima_acao_em timestamptz default null,
  p_encerrado_motivo text default null,
  p_referente_colaborador_id text default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tipo text;
  v_filial text;
  v_visible boolean;
begin
  select f.filial, (coalesce(f.gestor_liberado,false) or coalesce(f.destino,'gestor')='gestor')
  into v_filial,v_visible from public.kt_feedbacks f where f.id=p_feedback_id;
  if v_filial is null then raise exception 'Feedback não encontrado.'; end if;
  v_tipo := public.kt_current_profile_type();
  if v_tipo in ('azumi','rh') then
    if not public.kt_has_admin_permission('feedbacks','edit') then raise exception 'Sem permissão para editar feedbacks.'; end if;
  elsif v_tipo='gestor' then
    if public.kt_current_profile_filial()<>v_filial or not v_visible then raise exception 'Gestor sem acesso a este feedback.'; end if;
  else
    raise exception 'Perfil sem permissão.';
  end if;

  update public.kt_feedbacks
  set status=coalesce(p_status,status),
      status_alterado_em=case when p_status is not null then now() else status_alterado_em end,
      responsavel_id=coalesce(p_responsavel_id,responsavel_id),
      proxima_acao=case when p_proxima_acao is not null then p_proxima_acao else proxima_acao end,
      proxima_acao_em=case when p_proxima_acao_em is not null then p_proxima_acao_em else proxima_acao_em end,
      referente_colaborador_id=case when p_referente_colaborador_id is not null then p_referente_colaborador_id else referente_colaborador_id end,
      encerrado_em=case when p_status in ('concluido','cancelado') then now() else encerrado_em end,
      encerrado_motivo=case when p_encerrado_motivo is not null then p_encerrado_motivo else encerrado_motivo end
  where id=p_feedback_id;
  return found;
end;
$$;

create or replace function public.kt_update_support_case(
  p_pedido_id text,
  p_status text default null,
  p_tipo_apoio text default null,
  p_responsavel_id uuid default null,
  p_proxima_acao text default null,
  p_proxima_acao_em timestamptz default null,
  p_encerrado_motivo text default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tipo text;
  v_filial text;
  v_destino text;
  v_gestor uuid;
begin
  select a.filial,a.destino_inicial,a.gestor_id into v_filial,v_destino,v_gestor
  from public.kt_ajuda a where a.id=p_pedido_id;
  if v_filial is null then raise exception 'Pedido de apoio não encontrado.'; end if;
  v_tipo := public.kt_current_profile_type();
  if v_tipo in ('azumi','rh') then
    if not public.kt_has_admin_permission('apoio','edit') then raise exception 'Sem permissão para editar pedidos de apoio.'; end if;
  elsif v_tipo='gestor' then
    if public.kt_current_profile_filial()<>v_filial or not (v_destino='gestor' or v_gestor=auth.uid()) then
      raise exception 'Gestor sem acesso a este atendimento.';
    end if;
  else
    raise exception 'Perfil sem permissão.';
  end if;

  update public.kt_ajuda
  set status=coalesce(p_status,status),
      tipo_apoio=case when p_tipo_apoio is not null then p_tipo_apoio else tipo_apoio end,
      responsavel_id=coalesce(p_responsavel_id,responsavel_id),
      proxima_acao=case when p_proxima_acao is not null then p_proxima_acao else proxima_acao end,
      proxima_acao_em=case when p_proxima_acao_em is not null then p_proxima_acao_em else proxima_acao_em end,
      encerrado_em=case when p_status='resolvido' then now() else encerrado_em end,
      encerrado_motivo=case when p_encerrado_motivo is not null then p_encerrado_motivo else encerrado_motivo end
  where id=p_pedido_id;
  return found;
end;
$$;

revoke execute on function public.kt_update_feedback_case(text,text,uuid,text,timestamptz,text,text) from public,anon;
revoke execute on function public.kt_update_support_case(text,text,text,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.kt_update_feedback_case(text,text,uuid,text,timestamptz,text,text) to authenticated;
grant execute on function public.kt_update_support_case(text,text,text,uuid,text,timestamptz,text) to authenticated;
