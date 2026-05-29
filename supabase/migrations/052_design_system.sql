-- ── Design System Intelligence Layer ────────────────────────────────────────
--
-- Tables backing the Design System Agent:
--
--   design_audits      — one row per agent run (score snapshot)
--   design_violations  — individual violations extracted from each audit
--
-- The canonical design spec and component inventory live in Obsidian
-- (memory_documents where category='design'). These tables are the
-- processed intelligence layer: scored, prioritised, lifecycle-tracked.
-- ----------------------------------------------------------------------------

-- ── design_audits ────────────────────────────────────────────────────────────

create table if not exists design_audits (
  id               uuid primary key default gen_random_uuid(),
  run_id           text not null,
  audit_date       date not null,

  -- Consistency score
  overall_score    int  not null check (overall_score between 0 and 100),
  score_label      text not null
                     check (score_label in ('critical', 'poor', 'fair', 'good', 'excellent')),

  -- Per-area breakdown (keys: glass-consistency, typography-hierarchy,
  -- color-literals, component-duplication, spacing-consistency,
  -- cta-interactive-patterns, sticky-footer, apple-simplicity)
  area_scores      jsonb not null default '{}',

  -- Summary content
  executive_summary text,
  quick_wins        text[],

  -- Counts
  violation_count  int not null default 0,
  p0_count         int not null default 0,
  p1_count         int not null default 0,

  created_at       timestamptz not null default now()
);

create index if not exists design_audits_run_id    on design_audits (run_id);
create index if not exists design_audits_date      on design_audits (audit_date desc);
create index if not exists design_audits_score     on design_audits (overall_score desc);

-- ── design_violations ────────────────────────────────────────────────────────

create table if not exists design_violations (
  id              uuid primary key default gen_random_uuid(),
  audit_id        uuid references design_audits (id) on delete cascade,
  run_id          text not null,
  violation_id    text not null,         -- stable LLM slug

  -- Classification
  area            text not null,         -- glass-consistency | typography-hierarchy | etc.
  title           text not null,
  severity        text not null
                    check (severity in ('low', 'medium', 'high', 'critical')),
  priority        text not null
                    check (priority in ('P0', 'P1', 'P2', 'P3')),
  component       text,                  -- ComponentName or filename
  violation_type  text not null
                    check (violation_type in (
                      'drift', 'duplication', 'missing-token',
                      'accessibility', 'simplicity', 'spacing'
                    )),

  -- Content
  description     text,
  proposed_fix    text,
  affected_files  text[],
  effort          text,                  -- < 30min | 1–2h | half-day | 1+ days
  backlinks       text[],

  -- Lifecycle
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'resolved', 'wont_fix', 'accepted')),
  resolved_at     timestamptz,
  resolution_note text,

  created_at      timestamptz not null default now()
);

create index if not exists design_violations_audit_id  on design_violations (audit_id);
create index if not exists design_violations_priority  on design_violations (priority, status);
create index if not exists design_violations_area      on design_violations (area, status);
create index if not exists design_violations_created   on design_violations (created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table design_audits     enable row level security;
alter table design_violations enable row level security;

drop policy if exists "service role full access" on design_audits;
create policy "service role full access" on design_audits
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on design_violations;
create policy "service role full access" on design_violations
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "admin read" on design_audits;
create policy "admin read" on design_audits
  as permissive for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "admin read" on design_violations;
create policy "admin read" on design_violations
  as permissive for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

-- ── Convenience views ─────────────────────────────────────────────────────────

-- Latest audit summary for dashboard display
create or replace view design_latest_audit as
  select
    a.id,
    a.run_id,
    a.audit_date,
    a.overall_score,
    a.score_label,
    a.area_scores,
    a.executive_summary,
    a.violation_count,
    a.p0_count,
    a.p1_count,
    a.created_at
  from design_audits a
  order by a.audit_date desc
  limit 1;

-- Score trend — last 8 weeks
create or replace view design_score_trend as
  select
    audit_date,
    overall_score,
    score_label,
    violation_count,
    p0_count,
    p1_count,
    (area_scores->>'glass-consistency')::int      as glass_score,
    (area_scores->>'typography-hierarchy')::int   as typography_score,
    (area_scores->>'component-duplication')::int  as duplication_score,
    (area_scores->>'apple-simplicity')::int       as simplicity_score
  from design_audits
  order by audit_date desc
  limit 8;

-- Open P0/P1 violations (for dashboard action queue)
create or replace view design_open_critical as
  select
    v.id,
    v.audit_id,
    v.violation_id,
    v.area,
    v.title,
    v.severity,
    v.priority,
    v.component,
    v.violation_type,
    v.description,
    v.proposed_fix,
    v.effort,
    v.affected_files,
    v.created_at,
    a.audit_date
  from design_violations v
  join design_audits a on a.id = v.audit_id
  where v.status = 'open'
    and v.priority in ('P0', 'P1')
  order by
    case v.priority when 'P0' then 0 else 1 end,
    case v.severity when 'critical' then 0 when 'high' then 1 else 2 end,
    v.created_at desc;

-- Component duplication queue (easy wins)
create or replace view design_duplication_queue as
  select
    v.id,
    v.violation_id,
    v.title,
    v.component,
    v.description,
    v.proposed_fix,
    v.effort,
    v.created_at
  from design_violations v
  where v.violation_type = 'duplication'
    and v.status = 'open'
  order by v.priority, v.created_at desc;

