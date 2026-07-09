-- =====================================================================
-- Migration 144: Agent schema_dependencies
-- =====================================================================
-- Adds a schema_dependencies column to agents so each agent explicitly
-- declares which DB tables it reads or writes. NULL means not yet declared.
--
-- This is the Schema as Contract contract: when a migration drops or
-- renames a column, query this table to find all affected agents before
-- applying the change.
--
-- Convention: list every table the agent's execute() function references
-- directly. The agent_runs write (via runtime.ts) is universal and is
-- NOT included here — only agent-specific table access.
-- =====================================================================

alter table public.agents
  add column if not exists schema_dependencies text[];

-- Sub-hourly / hourly agents
update public.agents set schema_dependencies = ARRAY['quotes']
  where id = 'quote-triage';

update public.agents set schema_dependencies = ARRAY['leads', 'lead_conversations', 'agent_actions']
  where id = 'customer-reply';

update public.agents set schema_dependencies = ARRAY['leads', 'quotes', 'jobs']
  where id = 'lead-scorer';

-- Multi-hour agents
update public.agents set schema_dependencies = ARRAY[
  'agents', 'site_settings', 'agent_runs', 'v_pending_agent_actions',
  'bud_tasks', 'bud_insights', 'bud_approval_queue', 'bud_lobby_states', 'bud_activity_feed'
] where id = 'bud';

update public.agents set schema_dependencies = ARRAY['agent_runs', 'design_insights', 'admin_ux_proposals']
  where id = 'bud-observer';

-- Daily agents
update public.agents set schema_dependencies = ARRAY['orders', 'employees']
  where id = 'scheduling';

update public.agents set schema_dependencies = ARRAY['payments', 'orders']
  where id = 'reconciliation';

update public.agents set schema_dependencies = ARRAY['jobs']
  where id = 'reviews';

update public.agents set schema_dependencies = ARRAY[
  'visitor_events', 'analytics_sessions', 'github_events',
  'design_insights', 'admin_optimization_findings', 'analytics_reports', 'analytics_findings'
] where id = 'analytics-intelligence';

update public.agents set schema_dependencies = ARRAY[
  'quotes', 'orders', 'agent_runs', 'applicants', 'admin_optimization_findings'
] where id = 'admin-optimization';

update public.agents set schema_dependencies = ARRAY['design_insights', 'admin_ux_proposals']
  where id = 'ux-intelligence';

update public.agents set schema_dependencies = ARRAY['capture_briefs', 'orders']
  where id = 'field-producer';

update public.agents set schema_dependencies = ARRAY['competitor_pages']
  where id = 'competitor-watcher';

update public.agents set schema_dependencies = ARRAY['research_trends']
  where id = 'trend-scout';

update public.agents set schema_dependencies = ARRAY['research_trends', 'story_arcs']
  where id = 'adaptation-validator';

update public.agents set schema_dependencies = ARRAY['growth_pipeline_events', 'story_open_threads', 'story_opportunities']
  where id = 'thread-progress';

update public.agents set schema_dependencies = ARRAY['content_production_cards', 'growth_pipeline_events']
  where id = 'production-monitor';

update public.agents set schema_dependencies = ARRAY['content_assets', 'content_production_cards', 'growth_pipeline_events']
  where id = 'asset-matcher';

-- Weekly agents
update public.agents set schema_dependencies = ARRAY['whs_records', 'employees']
  where id = 'whs-safety-reminder';

update public.agents set schema_dependencies = ARRAY['orders', 'payables', 'subscriptions', 'cash_flow_forecasts']
  where id = 'cash-flow-forecaster';

update public.agents set schema_dependencies = ARRAY['lapsed_outreach']
  where id = 'lapsed-win-back';

update public.agents set schema_dependencies = ARRAY['design_insights']
  where id = 'seo-meta';

update public.agents set schema_dependencies = ARRAY[
  'service_pricing', 'quotes', 'jobs', 'crew_members',
  'competitor_intel', 'pricing_recommendations', 'agent_memory'
] where id = 'price-optimizer';

update public.agents set schema_dependencies = ARRAY['github_events']
  where id = 'github-historian';

update public.agents set schema_dependencies = ARRAY['design_audits', 'design_insights', 'design_violations']
  where id = 'design-system';

update public.agents set schema_dependencies = ARRAY['competitor_intel']
  where id = 'competitor-scout';

update public.agents set schema_dependencies = ARRAY['growth_pipeline_events', 'story_arcs']
  where id = 'arc-monitor';

update public.agents set schema_dependencies = ARRAY['content_assets', 'growth_pipeline_events']
  where id = 'consent-monitor';

update public.agents set schema_dependencies = ARRAY[
  'growth_pipeline_events', 'marketing_campaign_queue_items',
  'marketing_campaigns', 'marketing_publishing_queue'
] where id = 'campaign-reporter';

update public.agents set schema_dependencies = ARRAY['growth_pipeline_events', 'marketing_publishing_queue', 'marketing_social_channels']
  where id = 'cadence-monitor';

update public.agents set schema_dependencies = ARRAY['growth_pipeline_events', 'marketing_publishing_queue', 'story_arcs']
  where id = 'format-analyst';
