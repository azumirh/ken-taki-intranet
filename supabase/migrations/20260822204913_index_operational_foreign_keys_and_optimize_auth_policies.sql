-- Cover operational foreign keys used by joins/history and avoid per-row auth.uid() reevaluation in hot insert policies.

create index if not exists idx_kt_ajuda_criado_por_profile_id on public.kt_ajuda(criado_por_profile_id);
create index if not exists idx_kt_ajuda_responsavel_id on public.kt_ajuda(responsavel_id);
create index if not exists idx_kt_caso_historico_actor_colaborador_id on public.kt_caso_historico(actor_colaborador_id);
create index if not exists idx_kt_caso_historico_actor_profile_id on public.kt_caso_historico(actor_profile_id);
create index if not exists idx_kt_casos_aberto_por_colaborador_id on public.kt_casos(aberto_por_colaborador_id);
create index if not exists idx_kt_casos_aberto_por_profile_id on public.kt_casos(aberto_por_profile_id);
create index if not exists idx_kt_casos_responsavel_acao_id on public.kt_casos(responsavel_acao_id);
create index if not exists idx_kt_feedbacks_criado_por_profile_id on public.kt_feedbacks(criado_por_profile_id);
create index if not exists idx_kt_feedbacks_referente_colaborador_id on public.kt_feedbacks(referente_colaborador_id);
create index if not exists idx_kt_feedbacks_responsavel_id on public.kt_feedbacks(responsavel_id);
create index if not exists idx_kt_offboarding_checklist_concluido_por on public.kt_offboarding_checklist(concluido_por);
create index if not exists idx_kt_offboardings_iniciado_por on public.kt_offboardings(iniciado_por);
create index if not exists idx_kt_offboardings_revisado_por on public.kt_offboardings(revisado_por);
create index if not exists idx_kt_onboarding_checklist_concluido_por on public.kt_onboarding_checklist(concluido_por);
create index if not exists idx_kt_onboardings_buddy_colaborador_id on public.kt_onboardings(buddy_colaborador_id);
create index if not exists idx_kt_onboardings_iniciado_por on public.kt_onboardings(iniciado_por);
create index if not exists idx_kt_onboardings_responsavel_profile_id on public.kt_onboardings(responsavel_profile_id);
create index if not exists idx_kt_pesquisa_participacoes_user_id on public.kt_pesquisa_participacoes(user_id);
create index if not exists idx_kt_pesquisa_respostas_pergunta_id on public.kt_pesquisa_respostas_internas(pergunta_id);
create index if not exists idx_kt_pesquisa_respostas_submissao_id on public.kt_pesquisa_respostas_internas(submissao_id);
create index if not exists idx_kt_reconhecimentos_registrado_por_colaborador_id on public.kt_reconhecimentos(registrado_por_colaborador_id);
create index if not exists idx_kt_reconhecimentos_registrado_por_profile_id on public.kt_reconhecimentos(registrado_por_profile_id);
create index if not exists idx_kt_vaga_historico_actor_id on public.kt_vaga_historico(actor_id);
create index if not exists idx_kt_vagas_solicitante_id on public.kt_vagas(solicitante_id);

drop policy if exists kt_offboarding_insert on public.kt_offboardings;
create policy kt_offboarding_insert on public.kt_offboardings for insert to authenticated
with check (
  ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('offboarding','edit')))
  or (
    (select public.kt_current_profile_type())='gestor'
    and filial=(select public.kt_current_profile_filial())
    and iniciado_por=(select auth.uid())
    and status in ('rascunho','aguardando_rh')
  )
);

drop policy if exists kt_vagas_insert on public.kt_vagas;
create policy kt_vagas_insert on public.kt_vagas for insert to authenticated
with check (
  (
    (select public.kt_current_profile_type())='gestor'
    and filial=(select public.kt_current_profile_filial())
    and status='solicitado'
    and solicitante_id=(select auth.uid())
  )
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('vagas','edit')))
);

drop policy if exists kt_rec_insert on public.kt_reconhecimentos;
create policy kt_rec_insert on public.kt_reconhecimentos for insert to authenticated
with check (
  (
    (select public.kt_current_employee_id()) is not null
    and registrado_por_colaborador_id=(select public.kt_current_employee_id())
    and exists (
      select 1 from public.kt_colaboradores c
      where c.id=kt_reconhecimentos.colaborador_id
        and c.filial=(select me.filial from public.kt_colaboradores me where me.id=(select public.kt_current_employee_id()))
    )
  )
  or (
    (select public.kt_current_profile_type())='gestor'
    and filial=(select public.kt_current_profile_filial())
    and registrado_por_profile_id=(select auth.uid())
  )
  or ((select public.kt_current_profile_type()) in ('azumi','rh') and (select public.kt_has_admin_permission('reconhecimento','edit')))
);