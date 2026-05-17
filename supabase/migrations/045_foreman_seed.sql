-- 045_foreman_seed.sql
--
-- Seeds the Foreman meta-agent row into the agents table so the runtime
-- can find and execute it. Depends on 044_foreman.sql having been applied.

insert into public.agents (id, name, description, category, autonomy, schedule, status, config)
values (
  'foreman',
  'The Foreman',
  'Operations brain — monitors all agents, detects bottlenecks, and generates the adaptive lobby state for the admin console.',
  'ops',
  'auto',
  '0 * * * *',
  'enabled',
  '{}'::jsonb
)
on conflict (id) do nothing;
