-- Align case synchronization with the final feedback model and scope survey summaries by role/filial.

create or replace function public.kt_sync_feedback_case()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_type text; v_conf text; v_case_id uuid;
begin
  v_type:=case when new.tipo='Ocorrência disciplinar' then 'ocorrencia' else 'feedback' end;
  v_conf:=case when new.anonimo or new.triagem_rh_status in ('pendente','restrito') or new.tipo in ('Denúncia','Situação urgente','Reclamação') then 'rh' when new.destino='gestor' then 'gestor' else 'ambos' end;
  insert into public.kt_casos(tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,aberto_por_profile_id,aberto_por_colaborador_id,responsavel_id,plano_acao,prazo_acao,acompanhamento_em,encerrado_em,encerrado_motivo,metadata)
  values(v_type,'kt_feedbacks',new.id,new.filial,coalesce(new.tipo,'Feedback'),new.mensagem,coalesce(new.status,'aberto'),v_conf,new.criado_por_profile_id,new.colaborador_id,new.responsavel_id,new.proxima_acao,new.proxima_acao_em,new.proxima_acao_em,new.encerrado_em,new.encerrado_motivo,jsonb_build_object('anonimo',new.anonimo,'protocolo',new.protocolo,'fato_em',new.fato_em))
  on conflict (origem_tabela,origem_id) where origem_tabela is not null and origem_id is not null do update set filial=excluded.filial,titulo=excluded.titulo,descricao=excluded.descricao,status=excluded.status,confidencialidade=excluded.confidencialidade,responsavel_id=excluded.responsavel_id,plano_acao=excluded.plano_acao,prazo_acao=excluded.prazo_acao,acompanhamento_em=excluded.acompanhamento_em,encerrado_em=excluded.encerrado_em,encerrado_motivo=excluded.encerrado_motivo,metadata=excluded.metadata,updated_at=now()
  returning id into v_case_id;
  if new.colaborador_id is not null then
    insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel)
    select v_case_id,new.colaborador_id,coalesce(new.autor,'Colaborador'),'relator'
    where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.colaborador_id and papel='relator');
  end if;
  if new.destinatario_colaborador_id is not null then
    insert into public.kt_caso_envolvidos(caso_id,colaborador_id,nome_snapshot,papel)
    select v_case_id,new.destinatario_colaborador_id,new.destinatario_nome,'mencionado'
    where not exists(select 1 from public.kt_caso_envolvidos where caso_id=v_case_id and colaborador_id=new.destinatario_colaborador_id and papel='mencionado');
  end if;
  return new;
end;
$$;

create or replace function public.kt_internal_survey_summary(p_pesquisa_id text, p_filial text default null)
returns table(pergunta_id uuid, pergunta text, tipo text, total_respostas bigint, media numeric, sim bigint, nao bigint)
language sql
stable
security definer
set search_path=public
as $$
  with scope as (
    select case
      when public.kt_current_profile_type()='gestor' then public.kt_current_profile_filial()
      else p_filial
    end as filial_efetiva
  )
  select q.id,q.pergunta,q.tipo,count(r.id),
    case when q.tipo='escala_1_5' then round(avg(nullif(trim(both '"' from r.resposta::text),'')::numeric),2) else null end,
    count(*) filter (where q.tipo='sim_nao' and lower(trim(both '"' from r.resposta::text))='sim'),
    count(*) filter (where q.tipo='sim_nao' and lower(trim(both '"' from r.resposta::text)) in ('não','nao'))
  from public.kt_pesquisa_perguntas q
  cross join scope s
  left join public.kt_pesquisa_respostas_internas r
    on r.pergunta_id=q.id and (s.filial_efetiva is null or r.filial=s.filial_efetiva)
  where q.pesquisa_id=p_pesquisa_id
    and (
      (public.kt_current_profile_type() in ('azumi','rh') and public.kt_has_admin_permission('pesquisas','view'))
      or public.kt_current_profile_type()='gestor'
    )
  group by q.id,q.pergunta,q.tipo,q.ordem
  order by q.ordem;
$$;