-- 132_sandbox_rls_lockdown
-- Phase 0: enable RLS on the five existing sandbox tables and add the
-- same policy pattern used on agents / agent_runs / agent_evolutions:
--   {t}_admin_read   : SELECT for profiles.role in ('admin','owner')
--   {t}_admin_write  : ALL    for profiles.role in ('admin','owner')
--   {t}_service      : ALL    for auth.role() = 'service_role'
-- Service-role key bypasses RLS regardless; the explicit policy matches
-- the existing codebase convention.
-- Safe to run repeatedly (idempotent).

-- ── sandbox_scenarios ────────────────────────────────────────────────
alter table public.sandbox_scenarios enable row level security;

drop policy if exists sandbox_scenarios_admin_read on public.sandbox_scenarios;
create policy sandbox_scenarios_admin_read on public.sandbox_scenarios
  for select using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_scenarios_admin_write on public.sandbox_scenarios;
create policy sandbox_scenarios_admin_write on public.sandbox_scenarios
  for all using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_scenarios_service on public.sandbox_scenarios;
create policy sandbox_scenarios_service on public.sandbox_scenarios
  for all using (auth.role() = 'service_role');

-- ── sandbox_training_runs ────────────────────────────────────────────
alter table public.sandbox_training_runs enable row level security;

drop policy if exists sandbox_training_runs_admin_read on public.sandbox_training_runs;
create policy sandbox_training_runs_admin_read on public.sandbox_training_runs
  for select using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_training_runs_admin_write on public.sandbox_training_runs;
create policy sandbox_training_runs_admin_write on public.sandbox_training_runs
  for all using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_training_runs_service on public.sandbox_training_runs;
create policy sandbox_training_runs_service on public.sandbox_training_runs
  for all using (auth.role() = 'service_role');

-- ── sandbox_agent_responses ──────────────────────────────────────────
alter table public.sandbox_agent_responses enable row level security;

drop policy if exists sandbox_agent_responses_admin_read on public.sandbox_agent_responses;
create policy sandbox_agent_responses_admin_read on public.sandbox_agent_responses
  for select using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_agent_responses_admin_write on public.sandbox_agent_responses;
create policy sandbox_agent_responses_admin_write on public.sandbox_agent_responses
  for all using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_agent_responses_service on public.sandbox_agent_responses;
create policy sandbox_agent_responses_service on public.sandbox_agent_responses
  for all using (auth.role() = 'service_role');

-- ── sandbox_decision_scores ──────────────────────────────────────────
alter table public.sandbox_decision_scores enable row level security;

drop policy if exists sandbox_decision_scores_admin_read on public.sandbox_decision_scores;
create policy sandbox_decision_scores_admin_read on public.sandbox_decision_scores
  for select using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_decision_scores_admin_write on public.sandbox_decision_scores;
create policy sandbox_decision_scores_admin_write on public.sandbox_decision_scores
  for all using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_decision_scores_service on public.sandbox_decision_scores;
create policy sandbox_decision_scores_service on public.sandbox_decision_scores
  for all using (auth.role() = 'service_role');

-- ── sandbox_lessons_learned ──────────────────────────────────────────
alter table public.sandbox_lessons_learned enable row level security;

drop policy if exists sandbox_lessons_learned_admin_read on public.sandbox_lessons_learned;
create policy sandbox_lessons_learned_admin_read on public.sandbox_lessons_learned
  for select using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_lessons_learned_admin_write on public.sandbox_lessons_learned;
create policy sandbox_lessons_learned_admin_write on public.sandbox_lessons_learned
  for all using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = any (array['admin','owner'])));

drop policy if exists sandbox_lessons_learned_service on public.sandbox_lessons_learned;
create policy sandbox_lessons_learned_service on public.sandbox_lessons_learned
  for all using (auth.role() = 'service_role');
