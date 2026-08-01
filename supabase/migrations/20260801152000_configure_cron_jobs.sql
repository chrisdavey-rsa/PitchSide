-- Align pg_cron schedules with the production sync suite.
-- Existing job commands (net.http_post + auth headers) are preserved;
-- only schedules / active flags are updated.

-- sync-schedule: every 6 hours (7d history + 14d upcoming via Edge Function)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-schedule-football' LIMIT 1),
  schedule := '0 */6 * * *',
  active := true
);

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-schedule-rugby' LIMIT 1),
  schedule := '15 */6 * * *',
  active := true
);

-- sync-live: every 5 minutes (live=all / active window gate)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-live-football' LIMIT 1),
  schedule := '*/5 * * * *',
  active := true
);

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-live-rugby' LIMIT 1),
  schedule := '*/5 * * * *',
  active := true
);

-- sync-live-settle: every 5 minutes (FT kill-switch + grading)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-live-settle' LIMIT 1),
  schedule := '*/5 * * * *',
  active := true
);
