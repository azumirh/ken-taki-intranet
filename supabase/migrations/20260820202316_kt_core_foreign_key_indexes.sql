create index if not exists idx_app_notifications_user_id
  on public.app_notifications(user_id);

create index if not exists idx_app_notifications_empresa_id
  on public.app_notifications(empresa_id);

create index if not exists idx_kt_ajuda_gestor_id
  on public.kt_ajuda(gestor_id);

create index if not exists idx_kt_anotacoes_apoio_gestor_id
  on public.kt_anotacoes_apoio(gestor_id);

create index if not exists idx_kt_anotacoes_apoio_pedido_id
  on public.kt_anotacoes_apoio(pedido_id);
