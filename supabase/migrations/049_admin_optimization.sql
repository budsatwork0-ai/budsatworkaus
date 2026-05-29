-- ── Admin Optimization Agent findings table ─────────────────────────────────
--
-- Stores structured findings from the admin-optimization agent:
--   friction scores, workflow diagrams, redesign proposals, automation
--   candidates, and time-saving estimates.
--
-- Separate from design_insights (UX agent) and admin_ux_proposals
-- (admin-ux-designer) to allow independent querying by friction band.
-- ----------------------------------------------------------------------------

create table if not exists admin_optimization_findings (
  id                        uuid primary key default gen_random_uuid(),

  -- Run context
  agent_id                  text not null default 'admin-optimization',
  run_id                    text not null,

  -- Classification
  focus_area                text not null,   -- scheduling-ux | quote-management | crew-onboarding | repetitive-tasks | operational-dashboard
  page_path                 text not null,
  category                  text not null,   -- scheduling | quoting | onboarding | automation | dashboard | reporting | comms
  title                     text not null,
  body                      text,

  -- Severity / priority
  severity                  text not null default 'medium' check (severity in ('low','medium','high','critical')),
  priority                  text not null default 'P2' check (priority in ('P0','P1','P2','P3')),

  -- Friction scoring
  friction_total            integer not null default 0,
  friction_band             text not null default 'low' check (friction_band in ('low','medium','high','critical')),
  clicks_saved              integer,
  time_saved_min_week       integer,         -- estimated admin minutes saved per week if fixed

  -- Automation intelligence
  automation_candidate      boolean not null default false,
  automation_recipe         text,            -- trigger → action → outcome description

  -- Proposed change
  proposed_change           jsonb,           -- { what, where, design_pattern, clicks_saved, time_saved }

  -- Workflow diagram
  workflow_diagram          text,            -- Mermaid syntax (optional)

  -- Pattern detection
  is_recurring              boolean not null default false,

  -- Evidence
  evidence                  jsonb,           -- { current_flow, proposed_flow, backlinks, affected_pages }

  -- Lifecycle
  status                    text not null default 'new' check (status in ('new','reviewing','resolved','wont_fix')),
  resolved_at               timestamptz,
  resolution_note           text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Indexes for the most common query patterns
create index if not exists admin_opt_findings_run_id      on admin_optimization_findings (run_id);
create index if not exists admin_opt_findings_focus_area  on admin_optimization_findings (focus_area);
create index if not exists admin_opt_findings_friction    on admin_optimization_findings (friction_band, priority);
create index if not exists admin_opt_findings_automation  on admin_optimization_findings (automation_candidate) where automation_candidate = true;
create index if not exists admin_opt_findings_status      on admin_optimization_findings (status);
create index if not exists admin_opt_findings_created     on admin_optimization_findings (created_at desc);

-- Auto-update updated_at
create or replace function admin_opt_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_opt_findings_updated_at on admin_optimization_findings;
create trigger admin_opt_findings_updated_at
  before update on admin_optimization_findings
  for each row execute function admin_opt_set_updated_at();

-- RLS: service role only (agent writes; admin dashboard reads via service role)
alter table admin_optimization_findings enable row level security;

drop policy if exists "service role full access" on admin_optimization_findings;
create policy "service role full access"
  on admin_optimization_findings
  as permissive for all
  to service_role
  using (true)
  with check (true);

-- ── Convenience view: open high-friction findings ────────────────────────────

create or replace view admin_friction_open as
  select
    id,
    focus_area,
    page_path,
    title,
    priority,
    friction_total,
    friction_band,
    clicks_saved,
    time_saved_min_week,
    automation_candidate,
    automation_recipe,
    is_recurring,
    created_at
  from admin_optimization_findings
  where status in ('new', 'reviewing')
    and friction_band in ('high', 'critical')
  order by friction_total desc, created_at desc;
