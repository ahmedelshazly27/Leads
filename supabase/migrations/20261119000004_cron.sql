-- Scheduled jobs (pg_cron) that call edge functions over HTTP (pg_net).
-- The project URL and a dedicated cron secret are read from Supabase Vault at
-- run time, never stored here. Create them once (see supabase/README.md); the
-- same cron secret is set as the CRON_SECRET function secret:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random cron secret>', 'cron_secret');
-- A 'service_role_key' Vault secret is still accepted as a fallback.
-- Times are UTC (Kuwait is UTC+3).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Calls an edge function with the cron secret from Vault.
create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_key is null then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  end if;
  if v_url is null or v_key is null then
    raise warning 'invoke_edge_function(%): vault secrets project_url / cron_secret are not set', p_name;
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := p_body,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke execute on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- Re-running this migration replaces the jobs instead of duplicating them.
select cron.unschedule(jobname)
from cron.job
where jobname in ('purge-photos-daily', 'sync-meta-ads-daily', 'monthly-checkins-daily');

-- 02:15 UTC (05:15 Kuwait): delete photos 90 days after delivery.
select cron.schedule('purge-photos-daily', '15 2 * * *', $$ select public.invoke_edge_function('purge-photos'); $$);

-- 03:40 UTC (06:40 Kuwait): pull the last 7 days of Meta ad insights.
select cron.schedule('sync-meta-ads-daily', '40 3 * * *', $$ select public.invoke_edge_function('sync-meta-ads', '{"days": 7}'::jsonb); $$);

-- 04:05 UTC: monthly check-in orders for yearly members.
select cron.schedule('monthly-checkins-daily', '5 4 * * *', $$ select public.ensure_monthly_checkins(); $$);
