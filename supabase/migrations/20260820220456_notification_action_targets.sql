-- Ken Taki: keep notification CTAs aligned with the actual workspace section IDs.

update public.app_notifications
set action_url = '/gestor#politicas'
where action_url = '/gestor#documentos';

update public.app_notifications
set action_url = '/azumi#politicas'
where action_url = '/azumi#documentos';

create or replace function public.kt_notify_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, type, title, body, action_url)
  select
    p.id,
    'document_signed',
    'Documento assinado',
    new.nome || ' assinou “' || new.politica || '”.',
    case when p.tipo = 'gestor' then '/gestor#politicas' else '/azumi#politicas' end
  from public.kt_perfis p
  where ((p.tipo = 'gestor' and p.filial = new.filial) or p.tipo in ('azumi', 'rh'))
    and coalesce(p.ativo, true);

  return new;
end;
$$;

revoke execute on function public.kt_notify_assinatura() from public, anon, authenticated;
