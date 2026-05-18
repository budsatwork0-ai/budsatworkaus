-- ── Analytics Intelligence Layer ────────────────────────────────────────────
--
-- Tables backing the Analytics Intelligence Agent:
--
--   analytics_reports   — periodic report snapshots (one row per agent run)
--   analytics_findings  — individual insights extracted from each report
--   analytics_funnels   — funnel stage performance snapshots (written by API if needed)
--
-- PostHog + Clarity + Hotjar data stays in those platforms. These tables are
-- the agent's processed intelligence layer: LLM-synthesised, priority-scored,
-- backlinked to affected systems, and queryable by downstream agents.
-- ----------------------------------------------------------------------------

-- ── analytics_reports ────────────────────────────────────────────────────────

create table if not exists analytics_reports (
  id                    uuid primary key default gen_random_uuid(),
  run_id                text not null,                -- agent_runs.id
  period_days           int  not null default 14,
  period_end            date not null,

  -- Summary text stored for quick dashboard display
  executive_summary     text,

  -- Structured health scores (jsonb so they're flexible as PostHog schema evolves)
  funnel_health         jsonb,
  cta_health            jsonb,
  mobile_health         jsonb,
  deployment_correlation jsonb,

  -- Trend analysis
  trend_summary         text,
  regression_alerts     text[],

  -- Data source availability
  posthog_available     boolean not null default false,

  created_at            timestamptz not null default now()
);

create index if not exists analytics_reports_run_id
  on analytics_reports (run_id);

create index if not exists analytics_reports_created
  on analytics_reports (created_at desc);

-- ── analytics_findings ───────────────────────────────────────────────────────

create table if not exists analytics_findings (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid references analytics_reports (id) on delete cascade,
  run_id          text not null,
  finding_id      text not null,         -- stable slug from LLM

  -- Classification
  category        text not null,         -- funnel | cta | rage-click | admin-bottleneck | mobile | drop-off | deployment-impact
  title           text not null,
  severity        text not null          -- low | medium | high | critical
                    check (severity in ('low', 'medium', 'high', 'critical')),
  priority        text not null          -- P0 | P1 | P2 | P3
                    check (priority in ('P0', 'P1', 'P2', 'P3')),
  metric          text,                  -- e.g. "43% step-2 abandonment"

  -- Rich content
  body            text,
  proposed_action jsonb,                 -- { what, where, expected_impact }
  affected_systems text[],
  backlinks        text[],               -- [[Obsidian backlink]] targets

  -- Deployment correlation flag
  correlates_with_deployment boolean not null default false,
  deployment_note text,

  -- Lifecycle
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'resolved', 'wont_fix')),
  resolved_at     timestamptz,
  resolution_note text,

  created_at      timestamptz not null default now()
);

create index if not exists analytics_findings_report_id
  on analytics_findings (report_id);

create index if not exists analytics_findings_priority
  on analytics_findings (priority, status);

create index if not exists analytics_findings_category
  on analytics_findings (category, status);

create index if not exists analytics_findings_created
  on analytics_findings (created_at desc);

-- ── analytics_funnels ────────────────────────────────────────────────────────
-- Optional: raw funnel snapshots if the agent wants to persist step-by-step
-- data independently from the report JSONB.

create table if not exists analytics_funnels (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references analytics_reports (id) on delete cascade,
  funnel_name  text not null default 'quote',
  step_index   int  not null,
  step_name    text not null,
  entered      int  not null default 0,
  dropped      int  not null default 0,
  drop_rate    numeric(5,2) not null default 0,
  period_end   date not null,
  created_at   timestamptz not null default now()
);

create index if not exists analytics_funnels_report_id
  on analytics_funnels (report_id);

create index if not exists analytics_funnels_period
  on analytics_funnels (period_end desc, funnel_name, step_index);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table analytics_reports enable row level security;
alter table analytics_findings enable row level security;
alter table analytics_funnels  enable row level security;

-- Agent runtime (service_role) gets full access
create policy "service role full access" on analytics_reports
  as permissive for all to service_role using (true) with check (true);

create policy "service role full access" on analytics_findings
  as permissive for all to service_role using (true) with check (true);

create policy "service role full access" on analytics_funnels
  as permissive for all to service_role using (true) with check (true);

-- Admin users can read (for dashboard display)
create policy "admin read" on analytics_reports
  as permissive for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

create policy "admin read" on analytics_findings
  as permissive for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

create policy "admin read" on analytics_funnels
  as permissive for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

-- ── Convenience views ─────────────────────────────────────────────────────────

-- Latest report for dashboard display
create or replace view analytics_latest_report as
  select
    r.id,
    r.run_id,
    r.period_days,
    r.period_end,
    r.executive_summary,
    r.funnel_health,
    r.cta_health,
    r.mobile_health,
    r.deployment_correlation,
    r.trend_summary,
    r.regression_alerts,
    r.posthog_available,
    r.created_at,
    (select count(*) from analytics_findings f where f.report_id = r.id)   as total_findings,
    (select count(*) from analytics_findings f where f.report_id = r.id and f.priority = 'P0') as p0_count,
    (select count(*) from analytics_findings f where f.report_id = r.id and f.priority = 'P1') as p1_count
  from analytics_reports r
  order by r.created_at desc
  limit 1;

-- Open high-priority findings (P0/P1)
create or replace view analytics_open_critical as
  select
    f.id,
    f.report_id,
    f.finding_id,
    f.category,
    f.title,
    f.severity,
    f.priority,
    f.metric,
    f.proposed_action,
    f.affected_systems,
    f.correlates_with_deployment,
    f.created_at,
    r.period_end
  from analytics_findings f
  join analytics_reports r on r.id = f.report_id
  where f.status = 'open'
    and f.priority in ('P0', 'P1')
  order by
    case f.priority when 'P0' then 0 else 1 end,
    f.created_at desc;

-- Funnel trend — last 8 weeks of weakest-step dropout rate
create or replace view analytics_funnel_trend as
  select
    period_end,
    (funnel_health->>'weakest_step')::int        as weakest_step,
    (funnel_health->>'weakest_step_dropout_pct')::numeric as weakest_step_dropout_pct,
    (funnel_health->>'overall_conversion_rate')::numeric  as overall_conversion_rate
  from analytics_reports
  where funnel_health is not null
  order by period_end desc
  limit 8;
