-- ── GitHub event log ────────────────────────────────────────────────────────
--
-- Raw delivery log for all GitHub webhook events. Serves three purposes:
--   1. Idempotency guard (delivery_id unique index)
--   2. ADR flag queue (adr_flag events with status='pending')
--   3. Deployment failure tracking for foreman / rollback runbook
--
-- memory_documents (written by the webhook handler via writeMemory) is the
-- canonical Obsidian-synced store; this table is the processing audit log.
-- ----------------------------------------------------------------------------

create table if not exists github_events (
  id           uuid primary key default gen_random_uuid(),

  -- GitHub delivery header — uniquely identifies each webhook delivery
  delivery_id  text not null,

  -- Event classification
  event_type   text not null,   -- pull_request | push | deployment_status | release | adr_flag | deployment_failure
  action       text,            -- opened | closed | success | failure | published | …
  repo         text,            -- owner/repo

  -- Structured metadata (varies by event type)
  metadata     jsonb,

  -- Processing lifecycle
  status       text not null default 'received'
                 check (status in ('received', 'processed', 'error', 'pending', 'flagged')),
  processed_at timestamptz,
  error_message text,

  created_at   timestamptz not null default now()
);

-- Prevent re-processing the same delivery
create unique index if not exists github_events_delivery_id
  on github_events (delivery_id);

-- Query patterns
create index if not exists github_events_event_type
  on github_events (event_type, status);

create index if not exists github_events_created
  on github_events (created_at desc);

create index if not exists github_events_adr_flags
  on github_events (event_type, status)
  where event_type = 'adr_flag' and status = 'pending';

create index if not exists github_events_deploy_failures
  on github_events (event_type, created_at desc)
  where event_type = 'deployment_failure';

-- RLS: service role only
alter table github_events enable row level security;

drop policy if exists "service role full access" on github_events;
create policy "service role full access"
  on github_events
  as permissive for all
  to service_role
  using (true)
  with check (true);

-- ── Vault directory scaffold ─────────────────────────────────────────────────
-- These are informational comments only — the actual directories are created
-- by the webhook handler's first write via writeMemory() with explicit vaultPath.
--
-- Dev/PRs/            → PR notes (one per PR, indexed by date)
-- Dev/Deployments/    → Deployment logs (one per terminal deploy event)
-- Dev/Journal/        → Push implementation journal entries + weekly timelines
-- Dev/Releases/       → Release changelog notes
-- Dev/ADR-Drafts/     → Draft ADRs pending review and numbering
-- (Dev/ADR-*.md already exists — managed by vault-adr.ts script)
-- ----------------------------------------------------------------------------

-- ── Convenience views ─────────────────────────────────────────────────────────

-- Open ADR flags awaiting review
create or replace view github_adr_queue as
  select
    id,
    delivery_id,
    repo,
    metadata->>'pr_number'    as pr_number,
    metadata->>'pr_title'     as pr_title,
    metadata->'affected_systems' as affected_systems,
    metadata->>'note'         as note,
    created_at
  from github_events
  where event_type = 'adr_flag'
    and status = 'pending'
  order by created_at desc;

-- Recent deployment failures
create or replace view github_recent_failures as
  select
    id,
    metadata->>'environment'  as environment,
    metadata->>'sha'          as sha,
    metadata->>'branch'       as branch,
    metadata->>'description'  as description,
    metadata->>'url'          as url,
    created_at
  from github_events
  where event_type = 'deployment_failure'
  order by created_at desc
  limit 20;


