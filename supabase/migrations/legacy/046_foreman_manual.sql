-- 046_foreman_manual.sql
--
-- Corrects the Foreman agent row: manual-only, no schedule.
-- Idempotent — safe to re-run.

update public.agents
set autonomy = 'manual',
    schedule = null
where id = 'foreman';
