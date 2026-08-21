-- RH suggestion workflow: status, justification, responsible and controlled manager sharing.

create or replace function public.kt_update_suggestion_case(
  p_sugestao_id text,
  p_status text default null,
  p_justificativa text default null,
  p_observacao text default null,
  p_responsavel_id uuid default null,
  p_compartilhar_gestor boolean default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_filial text;
  v_message text;
begin
  if public.kt_current_profile_type() not in ('azumi','rh')
     or not public.kt_has_admin_permission('sugestoes','edit') then
    raise exception 'Sem permissão para tratar sugestões.';
  end if;

  select filial,mensagem into v_filial,v_message
  from public.kt_sugestoes where id=p_sugestao_id;
  if v_filial is null then raise exception 'Sugestão não encontrada.'; end if;

  if p_status='desconsiderado' and length(trim(coalesce(p_justificativa,''))) < 3 then
    raise exception 'Informe a justificativa para não considerar a sugestão.';
  end if;

  update public.kt_sugestoes
  set status=coalesce(p_status,status),
      status_ts=case when p_status is not null then extract(epoch from now())*1000 else status_ts end,
      justificativa=case when p_justificativa is not null then p_justificativa else justificativa end,
      observacao=case when p_observacao is not null then p_observacao else observacao end,
      responsavel_id=coalesce(p_responsavel_id,responsavel_id),
      gestor_compartilhado=case when p_compartilhar_gestor is not null then p_compartilhar_gestor else gestor_compartilhado end,
      gestor_compartilhado_em=case when p_compartilhar_gestor=true then now() when p_compartilhar_gestor=false then null else gestor_compartilhado_em end,
      gestor_compartilhado_por=case when p_compartilhar_gestor=true then auth.uid() when p_compartilhar_gestor=false then null else gestor_compartilhado_por end
  where id=p_sugestao_id;

  if p_compartilhar_gestor=true then
    insert into public.app_notifications(user_id,type,title,body,action_url)
    select p.id,'suggestion_shared_with_manager','Sugestão para discussão',
           'O RH compartilhou uma sugestão anônima da unidade para análise da gestão.',
           '/gestor#sugestoes'
    from public.kt_perfis p
    where p.tipo='gestor' and p.filial=v_filial and coalesce(p.ativo,true);
  end if;

  return found;
end;
$$;

revoke execute on function public.kt_update_suggestion_case(text,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.kt_update_suggestion_case(text,text,text,text,uuid,boolean) to authenticated;
