-- =====================================================================
-- Migration 147: schema_dependencies batch 2
-- =====================================================================
-- Populates schema_dependencies for 28 agents that were unannotated
-- after migration 144. Derived from direct .from() call audit of each
-- agent source file. Excludes design-developer (no DB access),
-- foreman (no source file), and browser-agent (indirect/delegated).
-- =====================================================================

-- Compliance
update public.agents set schema_dependencies = ARRAY['jobs', 'ndis_documents']
  where id = 'ndis-compliance';

update public.agents set schema_dependencies = ARRAY['ndis_plan_matches']
  where id = 'ndis-plan-matcher';

-- Executive
update public.agents set schema_dependencies = ARRAY['orders', 'leads', 'quotes', 'subscriptions', 'story_opportunities']
  where id = 'ceo-agent';

update public.agents set schema_dependencies = ARRAY['orders', 'payables', 'subscriptions', 'payments', 'executive_decisions']
  where id = 'cfo-agent';

update public.agents set schema_dependencies = ARRAY['executive_decisions', 'executive_tasks', 'executive_agent_runs_meta']
  where id = 'chief-of-staff';

update public.agents set schema_dependencies = ARRAY['leads', 'quotes', 'story_opportunities', 'story_drafts']
  where id = 'cmo-agent';

update public.agents set schema_dependencies = ARRAY['orders', 'crew_members', 'job_assignments', 'executive_decisions']
  where id = 'coo-agent';

-- Finance
update public.agents set schema_dependencies = ARRAY['stripe_disputes', 'jobs', 'job_photos', 'customer_messages']
  where id = 'stripe-dispute-manager';

-- Hiring
update public.agents set schema_dependencies = ARRAY['applicants']
  where id = 'applicant-screener';

update public.agents set schema_dependencies = ARRAY['crew_members', 'jobs', 'job_photos', 'reviews', 'crew_coach_notes']
  where id = 'crew-coach';

-- Ops
update public.agents set schema_dependencies = ARRAY['admin_ux_proposals']
  where id = 'admin-ux-designer';

update public.agents set schema_dependencies = ARRAY['agent_runs', 'agent_actions', 'agents', 'agent_evolutions']
  where id = 'agent-architect';

update public.agents set schema_dependencies = ARRAY['crew_members', 'jobs']
  where id = 'crew-briefing';

update public.agents set schema_dependencies = ARRAY['agents', 'agent_runs', 'agent_actions', 'bud_approval_queue', 'bud_tasks']
  where id = 'efficiency-architect';

update public.agents set schema_dependencies = ARRAY['design_insights']
  where id = 'heatmap-analyst';

update public.agents set schema_dependencies = ARRAY['design_insights']
  where id = 'layout-critic';

update public.agents set schema_dependencies = ARRAY['lobby_themes']
  where id = 'lobby-theme-curator';

update public.agents set schema_dependencies = ARRAY['job_photos']
  where id = 'photo-qa';

update public.agents set schema_dependencies = ARRAY['quotes']
  where id = 'yard-map-geo';

-- Sales
update public.agents set schema_dependencies = ARRAY['design_insights']
  where id = 'ab-test-architect';

update public.agents set schema_dependencies = ARRAY['content_drafts', 'marketing_metrics']
  where id = 'attention-seeker';

update public.agents set schema_dependencies = ARRAY['jobs', 'job_photos', 'content_drafts']
  where id = 'content-agent';

update public.agents set schema_dependencies = ARRAY['design_insights']
  where id = 'conversion-funnel';

update public.agents set schema_dependencies = ARRAY['design_insights']
  where id = 'copy-optimizer';

update public.agents set schema_dependencies = ARRAY['marketing_metrics']
  where id = 'scoreboard-keeper';

update public.agents set schema_dependencies = ARRAY['marketing_campaigns', 'jobs']
  where id = 'stanley-henry';

-- Support
update public.agents set schema_dependencies = ARRAY['knowledge_articles']
  where id = 'internal-qa';

update public.agents set schema_dependencies = ARRAY['phone_calls']
  where id = 'phone-transcriber';
