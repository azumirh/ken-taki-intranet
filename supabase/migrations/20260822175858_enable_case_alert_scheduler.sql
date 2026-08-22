-- Instala pg_cron e agenda o processamento dos alertas de acompanhamento.
-- Aplicada no Supabase em 2026-08-22 como migration enable_case_alert_scheduler.

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='kt_process_due_alerts' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
  perform cron.schedule(
    'kt_process_due_alerts',
    '*/5 * * * *',
    'select public.kt_process_due_alerts();'
  );
end $$;
