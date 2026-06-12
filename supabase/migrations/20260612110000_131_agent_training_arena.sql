-- Migration 131: Agent Training Arena
-- Creates an isolated sandbox arena for running agents against scripted scenarios.
-- All tables use environment = 'sandbox' by default. Never touches production tables.

-- 1. Scenario definitions -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sandbox_scenarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  category    text NOT NULL, -- 'customer' | 'participant' | 'marketplace' | 'ndis' | 'ops' | 'growth' | 'finance'
  description text NOT NULL,
  agent_id    text NOT NULL,             -- which agent gets exercised
  input       jsonb NOT NULL DEFAULT '{}',
  expected_action_types  text[] DEFAULT '{}',  -- action_types we expect the agent to propose
  difficulty  text NOT NULL DEFAULT 'medium',  -- 'easy' | 'medium' | 'hard'
  tags        text[] DEFAULT '{}',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_scenarios_agent_id  ON public.sandbox_scenarios(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_scenarios_category  ON public.sandbox_scenarios(category);
CREATE INDEX IF NOT EXISTS idx_sandbox_scenarios_environment ON public.sandbox_scenarios(environment);

-- 2. Training run log -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sandbox_training_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   uuid NOT NULL REFERENCES public.sandbox_scenarios(id) ON DELETE CASCADE,
  triggered_by  text,                 -- user id (admin) who launched the run
  trigger       text NOT NULL DEFAULT 'manual',
  status        text NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  agent_run_id  text,                 -- agent_runs.id from the sandbox execution
  duration_ms   integer,
  cost_cents    integer,
  environment   text NOT NULL DEFAULT 'sandbox',
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sandbox_training_runs_scenario ON public.sandbox_training_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_training_runs_status   ON public.sandbox_training_runs(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_training_runs_env      ON public.sandbox_training_runs(environment);

-- 3. Agent responses per scenario run ------------------------------------------
CREATE TABLE IF NOT EXISTS public.sandbox_agent_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_run_id  uuid NOT NULL REFERENCES public.sandbox_training_runs(id) ON DELETE CASCADE,
  scenario_id      uuid NOT NULL REFERENCES public.sandbox_scenarios(id) ON DELETE CASCADE,
  agent_id         text NOT NULL,
  summary          text,
  output           jsonb DEFAULT '{}',
  proposed_actions jsonb DEFAULT '[]',    -- array of ProposedAction objects captured by the sandbox interceptor
  llm_calls        integer DEFAULT 0,
  input_tokens     integer DEFAULT 0,
  output_tokens    integer DEFAULT 0,
  cost_cents       integer DEFAULT 0,
  environment      text NOT NULL DEFAULT 'sandbox',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_agent_responses_agent    ON public.sandbox_agent_responses(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_agent_responses_scenario ON public.sandbox_agent_responses(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_agent_responses_env      ON public.sandbox_agent_responses(environment);

-- 4. Decision quality scores ---------------------------------------------------
-- Auto-scored after each run by comparing proposed actions to expected_action_types.
CREATE TABLE IF NOT EXISTS public.sandbox_decision_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id       uuid NOT NULL REFERENCES public.sandbox_agent_responses(id) ON DELETE CASCADE,
  scenario_id       uuid NOT NULL REFERENCES public.sandbox_scenarios(id) ON DELETE CASCADE,
  agent_id          text NOT NULL,
  -- precision: (expected actions hit) / (total proposed)
  precision_score   numeric(5,4) DEFAULT 0,
  -- recall: (expected actions hit) / (total expected)
  recall_score      numeric(5,4) DEFAULT 0,
  -- f1 = harmonic mean of precision and recall
  f1_score          numeric(5,4) DEFAULT 0,
  -- did the agent propose at least one expected action?
  hit               boolean NOT NULL DEFAULT false,
  notes             text,
  environment       text NOT NULL DEFAULT 'sandbox',
  scored_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_decision_scores_agent   ON public.sandbox_decision_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_decision_scores_scenario ON public.sandbox_decision_scores(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_decision_scores_env     ON public.sandbox_decision_scores(environment);

-- 5. Lessons learned log -------------------------------------------------------
-- Human or auto-generated insights extracted from low-scoring runs.
CREATE TABLE IF NOT EXISTS public.sandbox_lessons_learned (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     text NOT NULL,
  scenario_id  uuid REFERENCES public.sandbox_scenarios(id) ON DELETE SET NULL,
  title        text NOT NULL,
  observation  text NOT NULL,
  recommendation text,
  severity     text NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'critical'
  source       text NOT NULL DEFAULT 'auto', -- 'auto' | 'human'
  environment  text NOT NULL DEFAULT 'sandbox',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_lessons_agent   ON public.sandbox_lessons_learned(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_lessons_env     ON public.sandbox_lessons_learned(environment);

-- 6. Seed scenario definitions -------------------------------------------------
-- ~40 scenarios across 7 categories.

INSERT INTO public.sandbox_scenarios
  (slug, title, category, description, agent_id, input, expected_action_types, difficulty, tags)
VALUES

-- CUSTOMER scenarios
('customer-new-quote-cleaning', 'New quote request — cleaning', 'customer',
 'A new residential customer in Underwood submits a quote for a standard clean.',
 'quote-triage',
 '{"service":"cleaning","suburb":"Underwood","bedrooms":3,"bathrooms":2,"extras":[],"message":"Hi, I need a regular house clean please."}',
 ARRAY['send_email'], 'easy', ARRAY['quote','cleaning']),

('customer-new-quote-windows', 'New quote request — window cleaning', 'customer',
 'Two-storey home in Sunnybank Hills requests interior + exterior window clean.',
 'quote-triage',
 '{"service":"windows","suburb":"Sunnybank Hills","storeys":2,"message":"Need inside and outside windows done ASAP."}',
 ARRAY['send_email'], 'easy', ARRAY['quote','windows']),

('customer-new-quote-yard', 'New quote request — yard care', 'customer',
 'Lawn mowing and edging for a large block in Loganlea.',
 'quote-triage',
 '{"service":"lawn-mowing","suburb":"Loganlea","area_m2":600,"message":"Big backyard, needs mowing and edging."}',
 ARRAY['send_email'], 'easy', ARRAY['quote','yard']),

('customer-lapsed-60-days', 'Lapsed customer — 60 days silent', 'customer',
 'A previous cleaning customer has not booked in 60 days. Win-back campaign.',
 'lapsed-win-back',
 '{"days_since_last_job":60,"service":"cleaning","customer_name":"Sophie Harris"}',
 ARRAY['send_email'], 'medium', ARRAY['lapsed','win-back']),

('customer-complaint-late-job', 'Complaint — late arrival', 'customer',
 'Customer complains crew arrived 90 minutes late without notice.',
 'customer-reply',
 '{"complaint":"Your cleaner arrived 90 minutes late and I was not told. Very unhappy.","customer_name":"Noah Cooper"}',
 ARRAY['send_email','flag_for_review'], 'medium', ARRAY['complaint','support']),

('customer-complaint-quality', 'Complaint — cleaning quality', 'customer',
 'Customer unhappy with the standard of a recent end-of-lease clean.',
 'customer-reply',
 '{"complaint":"The end-of-lease clean was not up to standard. Oven was not cleaned.","customer_name":"Ava Singh"}',
 ARRAY['send_email','flag_for_review'], 'medium', ARRAY['complaint','quality']),

('customer-5-star-review-prompt', 'Review prompt — satisfied customer', 'customer',
 'Customer left 5-star feedback verbally. Prompt for Google review.',
 'reviews',
 '{"sentiment":"positive","customer_name":"Grace Nguyen","service":"cleaning"}',
 ARRAY['send_email'], 'easy', ARRAY['review','growth']),

('customer-negative-review-response', 'Respond to 1-star Google review', 'customer',
 'A 1-star Google review appeared overnight. Agent should draft a professional response.',
 'reviews',
 '{"rating":1,"review_text":"Terrible service. The cleaner did not show up.","platform":"google"}',
 ARRAY['flag_for_review'], 'hard', ARRAY['review','reputation']),

-- PARTICIPANT (NDIS) scenarios
('ndis-new-participant-profile', 'New NDIS participant — profile creation', 'participant',
 'Admin triggers profile creation for a new NDIS support worker.',
 'ndis-compliance',
 '{"worker_name":"Lucas Patel","ndis_worker_screening_id":"NWS-12345","supports":["domestic-assistance","community-participation"]}',
 ARRAY['flag_for_review'], 'medium', ARRAY['ndis','onboarding']),

('ndis-compliance-expiry', 'NDIS screening expiry warning', 'participant',
 'A worker NDIS screening clearance expires in 14 days.',
 'ndis-compliance',
 '{"worker_name":"Ruby Wilson","expiry_days":14,"clearance_type":"worker-screening"}',
 ARRAY['send_email','flag_for_review'], 'medium', ARRAY['ndis','compliance']),

('ndis-plan-match', 'NDIS plan — job matching', 'participant',
 'Match an NDIS participant to suitable open jobs based on their support plan.',
 'ndis-plan-matcher',
 '{"participant_name":"Mia Anderson","support_categories":["domestic-assistance"],"suburb":"Waterford West"}',
 ARRAY['flag_for_review'], 'hard', ARRAY['ndis','matching']),

('ndis-shift-briefing', 'Crew briefing for NDIS shift', 'participant',
 'Generate a shift briefing for crew assigned to an NDIS support job.',
 'scheduling',
 '{"job_type":"ndis-domestic-assistance","participant_name":"Ethan Taylor","suburb":"Meadowbrook","shift_start":"09:00"}',
 ARRAY['send_email'], 'easy', ARRAY['ndis','briefing']),

-- MARKETPLACE scenarios
('marketplace-high-volume-day', 'High-volume day — scheduling crunch', 'marketplace',
 '8 jobs scheduled for the same Saturday. Detect overload and flag.',
 'scheduling',
 '{"date":"2026-06-20","job_count":8,"available_crew":3}',
 ARRAY['flag_for_review'], 'hard', ARRAY['scheduling','ops']),

('marketplace-crew-no-show', 'Crew no-show — job reassignment', 'marketplace',
 'Assigned crew member calls in sick 2 hours before a job.',
 'scheduling',
 '{"job_id":"sandbox-job-001","crew_name":"Liam Davies","hours_before_job":2,"service":"cleaning"}',
 ARRAY['schedule_job','send_email'], 'hard', ARRAY['scheduling','emergency']),

('marketplace-price-query', 'Customer price query — competitive check', 'marketplace',
 'Customer asks why our price is higher than a competitor quote.',
 'customer-reply',
 '{"query":"I got a quote from another company for $80 cheaper. Can you match it?","service":"end-of-lease","our_price":480}',
 ARRAY['send_email'], 'medium', ARRAY['pricing','competitive']),

('marketplace-surge-demand', 'Surge demand — spring clean season', 'marketplace',
 'Spike in quote volume detected. Recommend dynamic pricing or capacity limit.',
 'quote-triage',
 '{"quote_volume_7d":45,"capacity_utilisation":0.92,"season":"spring"}',
 ARRAY['flag_for_review'], 'medium', ARRAY['demand','pricing']),

-- NDIS / COMPLIANCE scenarios
('ndis-compliance-audit', 'NDIS compliance audit — documentation check', 'ndis',
 'Monthly compliance check on NDIS documentation completeness.',
 'ndis-compliance',
 '{"check_type":"monthly","missing_docs":["incident-report-june","worker-screening-renewal"]}',
 ARRAY['flag_for_review'], 'medium', ARRAY['ndis','audit','compliance']),

('ndis-incident-report', 'NDIS incident report — mandatory notification', 'ndis',
 'A participant reported a near-miss injury during a support shift.',
 'ndis-compliance',
 '{"incident_type":"near-miss","severity":"moderate","participant_name":"Mia Anderson","worker_name":"Lucas Patel"}',
 ARRAY['flag_for_review'], 'hard', ARRAY['ndis','incident','compliance']),

('whs-safety-reminder', 'WHS safety reminder — chemical handling', 'ndis',
 'Monthly WHS reminder for crew handling cleaning chemicals.',
 'whs-safety-reminder',
 '{"crew_count":6,"reminder_type":"chemical-handling","due_date":"2026-06-30"}',
 ARRAY['send_email'], 'easy', ARRAY['whs','safety']),

('whs-incident-flag', 'WHS incident — crew injury on site', 'ndis',
 'Crew member reported a slip-and-fall incident on a job site.',
 'whs-safety-reminder',
 '{"incident_type":"slip-fall","severity":"minor","crew_name":"Liam Davies","job_id":"sandbox-job-002"}',
 ARRAY['flag_for_review'], 'hard', ARRAY['whs','incident']),

-- OPS scenarios
('ops-late-job-detection', 'Late job detection', 'ops',
 'A scheduled job is 45 minutes overdue with no status update.',
 'scheduling',
 '{"job_id":"sandbox-job-003","overdue_minutes":45,"service":"windows","crew_name":"Ruby Wilson"}',
 ARRAY['send_email','flag_for_review'], 'medium', ARRAY['ops','scheduling']),

('ops-cash-flow-warning', 'Cash flow warning — receivables spike', 'ops',
 'Outstanding receivables have grown 40% week-on-week.',
 'cash-flow-forecaster',
 '{"receivables_aud":18500,"receivables_wow_change":0.40,"days_outstanding_avg":22}',
 ARRAY['flag_for_review'], 'medium', ARRAY['finance','cashflow']),

('ops-stripe-dispute', 'Stripe dispute — chargeback received', 'ops',
 'A customer has raised a chargeback for a $480 end-of-lease clean.',
 'stripe-dispute-manager',
 '{"dispute_id":"dp_sandbox_001","amount_aud":480,"service":"end-of-lease","reason":"service_not_as_described"}',
 ARRAY['flag_for_review'], 'hard', ARRAY['stripe','dispute','finance']),

('ops-photo-qa', 'Photo QA — before/after review', 'ops',
 'Crew uploaded before/after photos for a completed job. QA check.',
 'photo-qa',
 '{"job_id":"sandbox-job-004","service":"cleaning","photo_count":8}',
 ARRAY['flag_for_review'], 'medium', ARRAY['quality','photos']),

('ops-internal-qa', 'Internal QA — agent output review', 'ops',
 'Internal QA agent reviews the output of the last 5 agent runs for quality.',
 'internal-qa',
 '{"review_window_hours":24,"agent_runs":5}',
 ARRAY['flag_for_review'], 'medium', ARRAY['qa','agents']),

('ops-reconciliation', 'Financial reconciliation — end of week', 'ops',
 'Reconcile Stripe payouts against Supabase orders for the past 7 days.',
 'reconciliation',
 '{"period_days":7,"expected_payout_aud":4200,"recorded_aud":4080}',
 ARRAY['flag_for_review'], 'hard', ARRAY['finance','reconciliation']),

('ops-applicant-screener', 'Applicant screener — new crew application', 'ops',
 'A new crew application submitted. Screen against Buds at Work criteria.',
 'applicant-screener',
 '{"applicant_name":"Jack Martin","role":"cleaner","experience_years":2,"suburb":"Loganlea","has_abn":true}',
 ARRAY['flag_for_review'], 'easy', ARRAY['hiring','crew']),

-- GROWTH scenarios
('growth-lead-scoring', 'Lead scoring — inbound web lead', 'growth',
 'Score an inbound web lead from the public quote form.',
 'lead-scorer',
 '{"service":"end-of-lease","suburb":"Springwood","message":"Need bond clean by end of month.","source":"website"}',
 ARRAY['flag_for_review'], 'easy', ARRAY['leads','growth']),

('growth-seo-meta', 'SEO meta — suburb landing page', 'growth',
 'Generate SEO-optimised meta title and description for a suburb landing page.',
 'seo-meta',
 '{"page_type":"suburb-landing","suburb":"Underwood","service":"cleaning"}',
 ARRAY['flag_for_review'], 'easy', ARRAY['seo','growth']),

('growth-conversion-funnel', 'Conversion funnel analysis', 'growth',
 'Analyse quote funnel drop-off and recommend optimisations.',
 'conversion-funnel',
 '{"funnel_step_views":{"step1":520,"step2":310,"step3":180,"submitted":95},"period_days":30}',
 ARRAY['flag_for_review'], 'medium', ARRAY['growth','conversion']),

('growth-lapsed-pack', 'Lapsed customer pack — 90+ days', 'growth',
 'Run win-back for a batch of customers silent for 90+ days.',
 'lapsed-win-back',
 '{"days_since_last_job":95,"customer_count":12,"service":"cleaning"}',
 ARRAY['send_email'], 'medium', ARRAY['growth','lapsed']),

('growth-ab-test', 'A/B test design — CTA copy', 'growth',
 'Design an A/B test for the primary CTA on the homepage.',
 'ab-test-architect',
 '{"page":"homepage","element":"primary-cta","hypothesis":"Changing CTA copy to action-oriented language increases click-through."}',
 ARRAY['flag_for_review'], 'medium', ARRAY['growth','ab-test']),

-- FINANCE scenarios
('finance-cash-flow-forecast', 'Cash flow forecast — 30-day outlook', 'finance',
 'Produce a 30-day cash flow forecast based on current pipeline and actuals.',
 'cash-flow-forecaster',
 '{"forecast_days":30,"pipeline_aud":12400,"recurring_monthly_aud":8200}',
 ARRAY['flag_for_review'], 'medium', ARRAY['finance','forecast']),

('finance-price-optimizer', 'Price optimisation — window cleaning', 'finance',
 'Evaluate current window cleaning pricing against market rates and recommend adjustment.',
 'price-optimizer',
 '{"service":"windows","current_rate_aud":285,"market_range":{"low":220,"high":320},"jobs_last_30d":18}',
 ARRAY['flag_for_review'], 'hard', ARRAY['finance','pricing']),

('finance-stripe-reconcile', 'Stripe payout reconciliation', 'finance',
 'Match last week Stripe payout against orders in Supabase.',
 'reconciliation',
 '{"payout_id":"po_sandbox_001","payout_aud":5840,"period":"2026-06-01/2026-06-07"}',
 ARRAY['flag_for_review'], 'medium', ARRAY['finance','stripe']),

('finance-invoice-overdue', 'Overdue invoice — follow-up email', 'finance',
 'An invoice for $960 has been outstanding for 21 days. Generate a polite follow-up.',
 'customer-reply',
 '{"invoice_amount_aud":960,"days_overdue":21,"customer_name":"Ethan Taylor","service":"commercial-cleaning"}',
 ARRAY['send_email'], 'medium', ARRAY['finance','invoicing']),

('finance-cfo-review', 'CFO weekly financial review', 'finance',
 'CFO agent runs its weekly snapshot of revenue, cost, and margin.',
 'cfo-agent',
 '{"period":"week","revenue_aud":14200,"cost_aud":8900,"jobs_completed":31}',
 ARRAY['flag_for_review'], 'medium', ARRAY['finance','executive']),

('finance-dispute-resolution', 'Dispute resolution — customer refund demand', 'finance',
 'Customer demands full refund for a $480 clean citing dissatisfaction.',
 'stripe-dispute-manager',
 '{"refund_requested_aud":480,"reason":"dissatisfied","service":"end-of-lease","job_completed":true}',
 ARRAY['flag_for_review'], 'hard', ARRAY['finance','dispute']),

-- STRESS / multi-agent scenario
('stress-agent-cascade', 'Stress test — quote + triage + scheduling cascade', 'ops',
 'A high-urgency quote arrives and triggers triage, scoring, and scheduling in sequence.',
 'quote-triage',
 '{"service":"end-of-lease","suburb":"Loganlea","urgency":"high","message":"Need bond clean tomorrow for settlement.","available_crew":["crew-001"]}',
 ARRAY['send_email','schedule_job'], 'hard', ARRAY['stress','cascade','multi-agent'])

ON CONFLICT (slug) DO NOTHING;
