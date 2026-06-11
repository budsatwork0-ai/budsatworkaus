-- =====================================================================
-- Migration 038: Design / UX Agents + Insights Storage
-- =====================================================================
-- Adds 6 more agents focused on site design, plus a `design_insights`
-- table for storing long-form recommendations (with severity, evidence,
-- and an approval state so you can promote them to actual work tickets).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. design_insights table
-- ---------------------------------------------------------------------
create table if not exists public.design_insights (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null references public.agents(id) on delete cascade,
  run_id          uuid references public.agent_runs(id) on delete set null,
  page_path       text,                      -- e.g. '/services/yard-care'
  insight_type    text not null,             -- 'heatmap','copy','funnel','a11y','seo','ab_test'
  title           text not null,
  body            text not null,             -- markdown
  severity        text not null default 'medium' check (severity in ('low','medium','high','critical')),
  evidence        jsonb default '{}'::jsonb, -- urls to recordings, screenshots, metrics
  proposed_change jsonb,                     -- structured diff: {selector, before, after}
  status          text not null default 'new' check (status in (
                    'new','reviewing','accepted','rejected','shipped'
                  )),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_design_insights_status
  on public.design_insights(status) where status in ('new','reviewing');
create index if not exists idx_design_insights_page
  on public.design_insights(page_path);

alter table public.design_insights enable row level security;

create policy if not exists "design_insights_admin_read"
  on public.design_insights for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'));
create policy if not exists "design_insights_admin_write"
  on public.design_insights for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'));
create policy if not exists "design_insights_service"
  on public.design_insights for all
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- 2. Seed the 6 new agents
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('heatmap-analyst', 'Heatmap Analyst',
     'Pulls Lucky Orange heatmaps and recordings, finds dead clicks, rage clicks, and scroll dropoffs.',
     'ops', 'review', '0 5 * * 1',  '{"lucky_orange_site_id":"a592b727","min_sessions":30}'::jsonb),

  ('copy-optimizer', 'Copy Optimizer',
     'Audits page copy — headings, CTAs, microcopy — and proposes clearer, higher-converting alternatives.',
     'sales', 'review', '0 3 * * 2',  '{"voice":"warm-australian-tradie"}'::jsonb),

  ('conversion-funnel', 'Conversion Funnel Watcher',
     'Watches the quote → confirmed → paid funnel; spots leaks and proposes fixes.',
     'sales', 'review', '0 4 * * *',  '{"funnel_steps":["visit","quote_started","quote_submitted","quote_accepted","paid"]}'::jsonb),

  ('layout-critic', 'Layout Critic',
     'Reviews live pages for visual hierarchy, accessibility (WCAG AA), and mobile UX issues.',
     'ops', 'review', '0 4 * * 3',  '{"wcag":"AA","check_mobile":true}'::jsonb),

  ('seo-meta', 'SEO & Meta Agent',
     'Audits titles, meta descriptions, structured data, and internal links. Logan & Brisbane suburb coverage.',
     'sales', 'review', '0 5 * * 4',  '{"region":"Logan,South Brisbane"}'::jsonb),

  ('ab-test-architect', 'A/B Test Architect',
     'Reviews heatmap + conversion data and proposes high-leverage A/B tests with predicted impact.',
     'sales', 'manual', null,           '{"min_traffic_per_variant":300}'::jsonb)
on conflict (id) do nothing;
