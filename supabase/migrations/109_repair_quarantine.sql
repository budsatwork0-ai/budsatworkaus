-- 109_repair_quarantine.sql
-- Tracks quarantined bud/* branches that have failed autonomous repair.
-- Prevents the feedback loop where a rejected repair signal is immediately
-- re-attempted on the same branch after a ~10-minute cron cycle.
--
-- Lifecycle:
--   (no record)              — branch has never failed repair
--   blocked_for_repair       — failed once, blocked for 24h
--   abandoned                — failed twice in 24h, requires fresh branch from main
--   resolved                 — repair succeeded, quarantine lifted

create table if not exists public.bud_repair_quarantine (
  id                uuid        primary key default gen_random_uuid(),
  branch            text        not null unique,
  commit_sha        text,
  deployment_id     text,
  error_text        text,
  failing_file      text,
  failing_line      integer,
  source_agent      text,
  rejection_reason  text,
  attempt_count     integer     not null default 1,
  status            text        not null default 'blocked_for_repair'
                                check (status in ('blocked_for_repair', 'abandoned', 'resolved')),
  blocked_until     timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists bud_repair_quarantine_status_idx
  on public.bud_repair_quarantine (status, blocked_until);

alter table public.bud_repair_quarantine enable row level security;

-- Service role only — all access goes through the server-side client
create policy "Service role full access to bud_repair_quarantine"
  on public.bud_repair_quarantine
  using (true)
  with check (true);
