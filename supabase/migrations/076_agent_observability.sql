-- =====================================================================
-- Migration 076: Agent Observability
-- =====================================================================
-- Adds observable proof fields to the agent runtime:
--   - agents.status: adds planned, idle, watch values
--   - agent_runs.status: adds needs_repair value
--   - agents.last_run_at, agents.last_success_at (auto-updated by trigger)
--   - agent_runs.confidence_score (0–1), agent_runs.evidence_payload (jsonb)
--   - v_agent_latest_run: one row per agent with most recent run data
--   - 7 agents requiring external integrations marked as 'planned'
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Expand agents.status constraint
-- ---------------------------------------------------------------------
alter table public.agents drop constraint if exists agents_status_check;
alter table public.agents
  add constraint agents_status_check check (status in (
    'enabled', 'paused', 'disabled', 'planned', 'idle', 'watch'
  ));

-- ---------------------------------------------------------------------
-- 2. Expand agent_runs.status constraint
-- ---------------------------------------------------------------------
alter table public.agent_runs drop constraint if exists agent_runs_status_check;
alter table public.agent_runs
  add constraint agent_runs_status_check check (status in (
    'running', 'succeeded', 'failed', 'needs_approval', 'needs_repair', 'cancelled'
  ));

-- ---------------------------------------------------------------------
-- 3. Observable columns on agents
-- ---------------------------------------------------------------------
alter table public.agents
  add column if not exists last_run_at     timestamptz,
  add column if not exists last_success_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. Evidence columns on agent_runs
-- ---------------------------------------------------------------------
alter table public.agent_runs
  add column if not exists confidence_score real
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  add column if not exists evidence_payload jsonb;

-- ---------------------------------------------------------------------
-- 5. Trigger: keep last_run_at / last_success_at in sync automatically
-- ---------------------------------------------------------------------
create or replace function public.trg_fn_agent_runs_update_last_run()
returns trigger language plpgsql as $$
begin
  if NEW.finished_at is not null then
    update public.agents
    set
      last_run_at = greatest(coalesce(last_run_at, '1970-01-01'::timestamptz), NEW.finished_at),
      last_success_at = case
        when NEW.status = 'succeeded'
          then greatest(coalesce(last_success_at, '1970-01-01'::timestamptz), NEW.finished_at)
        else last_success_at
      end,
      updated_at = now()
    where id = NEW.agent_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_agent_runs_update_last_run on public.agent_runs;
create trigger trg_agent_runs_update_last_run
  after insert or update of status, finished_at
  on public.agent_runs
  for each row
  execute function public.trg_fn_agent_runs_update_last_run();

-- ---------------------------------------------------------------------
-- 6. View: latest finished run per agent (for UI confidence display)
-- ---------------------------------------------------------------------
create or replace view public.v_agent_latest_run as
select distinct on (agent_id)
  agent_id,
  id            as run_id,
  status,
  summary,
  confidence_score,
  evidence_payload,
  finished_at
from public.agent_runs
where finished_at is not null
order by agent_id, finished_at desc;

-- ---------------------------------------------------------------------
-- 7. Mark agents that need external integrations as 'planned'
--    (they have real code but can't run until Twilio / Whisper / etc. wired)
-- ---------------------------------------------------------------------
update public.agents
set status = 'planned', updated_at = now()
where id in (
  'phone-transcriber',
  'photo-qa',
  'competitor-scout',
  'crew-briefing',
  'browser-agent',
  'heatmap-analyst',
  'github-historian'
);
