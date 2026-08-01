-- sync-live: every 1 minute so in-play scores stay fresh for Realtime clients.
-- Preserves existing net.http_post command / auth headers on each job.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-live-football' LIMIT 1),
  schedule := '* * * * *',
  active := true
);

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-live-rugby' LIMIT 1),
  schedule := '* * * * *',
  active := true
);
