-- Ken Taki: cover audit foreign keys introduced by RH/manager routing.

create index if not exists idx_kt_ajuda_gestor_envolvido_por
  on public.kt_ajuda (gestor_envolvido_por)
  where gestor_envolvido_por is not null;

create index if not exists idx_kt_ajuda_rh_solicitado_por
  on public.kt_ajuda (rh_solicitado_por)
  where rh_solicitado_por is not null;

create index if not exists idx_kt_feedbacks_gestor_liberado_por
  on public.kt_feedbacks (gestor_liberado_por)
  where gestor_liberado_por is not null;

create index if not exists idx_kt_feedbacks_escalado_rh_por
  on public.kt_feedbacks (escalado_rh_por)
  where escalado_rh_por is not null;
