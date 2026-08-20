-- Internal SECURITY DEFINER functions should not be exposed as public RPCs.
-- RLS helper functions remain callable only by authenticated users.

revoke execute on function public.kt_current_employee_id() from public, anon;
grant execute on function public.kt_current_employee_id() to authenticated;

revoke execute on function public.kt_current_profile_type() from public, anon;
grant execute on function public.kt_current_profile_type() to authenticated;

revoke execute on function public.kt_current_profile_filial() from public, anon;
grant execute on function public.kt_current_profile_filial() to authenticated;

revoke execute on function public.kt_insert_notification(uuid,text,text,text,text)
  from public, anon, authenticated;
revoke execute on function public.kt_notify_assinatura()
  from public, anon, authenticated;
revoke execute on function public.kt_notify_feedback()
  from public, anon, authenticated;
revoke execute on function public.kt_notify_ajuda()
  from public, anon, authenticated;
revoke execute on function public.kt_set_employee_owner()
  from public, anon, authenticated;
revoke execute on function public.kt_queue_email_from_notification()
  from public, anon, authenticated;
revoke execute on function public.kt_sync_shared_profile(uuid)
  from public, anon, authenticated;
revoke execute on function public.kt_sync_shared_profile_trigger()
  from public, anon, authenticated;
