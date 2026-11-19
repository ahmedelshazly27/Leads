-- Daily membership jobs. Uses invoke_edge_function (20261119000004) with the
-- cron secret from Vault. Times are UTC (Kuwait is UTC+3).
--   included-memberships-daily  ends included months that are over (SQL only,
--                               so it runs even if the function is not deployed)
--   membership-reminders-daily  "your included month ends in 5 days" and the
--                               yearly reminder about 30 days before the 12
--                               months end (terms section 7)

select cron.unschedule(jobname)
from cron.job
where jobname in ('included-memberships-daily', 'membership-reminders-daily');

-- 00:10 UTC (03:10 Kuwait).
select cron.schedule('included-memberships-daily', '10 0 * * *', $$ select public.expire_included_memberships(); $$);

-- 06:20 UTC (09:20 Kuwait), so the email arrives in the morning.
select cron.schedule('membership-reminders-daily', '20 6 * * *', $$ select public.invoke_edge_function('membership-reminders'); $$);
