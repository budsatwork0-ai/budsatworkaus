-- 111_executive_agent_seeds.sql
-- Register the 5 executive agents so runAgent() can find them.
--
-- Step 1: Extend the agents.category check constraint to include 'executive'.
-- Step 2: Seed all 5 rows with on conflict (id) do nothing for idempotency.

-- ── 1. Extend category constraint ──────────────────────────────────────────

alter table public.agents
  drop constraint if exists agents_category_check;

alter table public.agents
  add constraint agents_category_check
  check (category in (
    'sales', 'support', 'ops', 'hiring', 'finance', 'compliance', 'executive'
  ));

-- ── 2. Seed executive agents ────────────────────────────────────────────────

insert into public.agents (id, name, description, category, autonomy, status, schedule, config)
values
  ('ceo-agent',
   'CEO',
   'Strategic business review — revenue, growth, and overall health. Issues high-level decisions from weekly metrics.',
   'executive', 'review', 'enabled', '0 6 * * *', '{}'::jsonb),

  ('coo-agent',
   'COO',
   'Operations review — crew utilisation, job completion rate, scheduling efficiency, and late delivery flags.',
   'executive', 'review', 'enabled', '5 6 * * *', '{}'::jsonb),

  ('cmo-agent',
   'CMO',
   'Marketing review — lead volume, quote conversion, channel performance, and growth opportunities.',
   'executive', 'review', 'enabled', '10 6 * * *', '{}'::jsonb),

  ('cfo-agent',
   'CFO',
   'Finance review — receivables, overdue invoices, MRR, cash position, and financial risk flags.',
   'executive', 'review', 'enabled', '15 6 * * *', '{}'::jsonb),

  ('chief-of-staff',
   'Chief of Staff',
   'Reads decisions from CEO, COO, CMO, and CFO and routes them as actionable tasks to the right fleet agents.',
   'executive', 'review', 'enabled', '30 6 * * *', '{}'::jsonb)

on conflict (id) do nothing;
