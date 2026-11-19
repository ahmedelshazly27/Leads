-- Daily retention job (privacy policy section 8): purge-records clears
-- measurements, health answers, plans, reviewer notes and visuals 24 months
-- after a customer's last order or membership ends, and deletes waitlist
-- entries older than 24 months. Uses invoke_edge_function (20261119000004)
-- with the cron secret from Vault. Times are UTC (Kuwait is UTC+3).

select cron.unschedule(jobname)
from cron.job
where jobname = 'purge-records-daily';

-- 02:45 UTC (05:45 Kuwait), after purge-photos-daily.
select cron.schedule('purge-records-daily', '45 2 * * *', $$ select public.invoke_edge_function('purge-records'); $$);
