-- Migration 130: First-class Sandbox environment isolation.
-- Production remains the default. Existing is_test rows are promoted to sandbox.

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'customers',
    'leads',
    'quotes',
    'orders',
    'lead_conversations',
    'conversations',
    'messages',
    'ratings',
    'agent_runs',
    'agent_actions',
    'bud_improvement_signals',
    'bud_root_cause_initiatives',
    'bud_approval_queue',
    'analytics_sessions',
    'visitor_events'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT %L CHECK (environment IN (%L, %L))',
        table_name,
        'production',
        'production',
        'sandbox'
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(environment)',
        'idx_' || table_name || '_environment',
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- Keep compatibility with the previous is_test flag.
DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'customers',
    'leads',
    'quotes',
    'orders',
    'lead_conversations',
    'conversations',
    'messages',
    'ratings'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET environment = %L WHERE is_test = true',
        table_name,
        'sandbox'
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_environment_from_is_test()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_test = true THEN
    NEW.environment = 'sandbox';
  END IF;

  IF NEW.environment = 'sandbox' THEN
    NEW.is_test = true;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'customers',
    'leads',
    'quotes',
    'orders',
    'lead_conversations',
    'conversations',
    'messages',
    'ratings'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_sync_environment ON public.%I', table_name, table_name);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test()',
        'trg_' || table_name || '_sync_environment',
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- Propagation: sandbox quotes create sandbox orders.
CREATE OR REPLACE FUNCTION public.propagate_order_environment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_environment text;
  parent_is_test boolean;
BEGIN
  IF NEW.quote_id IS NOT NULL THEN
    SELECT environment, is_test
    INTO parent_environment, parent_is_test
    FROM public.quotes
    WHERE id = NEW.quote_id;

    IF parent_environment = 'sandbox' OR parent_is_test = true THEN
      NEW.environment = 'sandbox';
      NEW.is_test = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_inherit_environment ON public.orders;
CREATE TRIGGER trg_order_inherit_environment
  BEFORE INSERT OR UPDATE OF quote_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.propagate_order_environment();

-- Propagation: sandbox conversations create sandbox messages.
CREATE OR REPLACE FUNCTION public.propagate_message_environment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_environment text;
  parent_is_test boolean;
BEGIN
  SELECT environment, is_test
  INTO parent_environment, parent_is_test
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF parent_environment = 'sandbox' OR parent_is_test = true THEN
    NEW.environment = 'sandbox';
    NEW.is_test = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_inherit_environment ON public.messages;
CREATE TRIGGER trg_message_inherit_environment
  BEFORE INSERT OR UPDATE OF conversation_id ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.propagate_message_environment();

-- Guardrail view for reporting code that wants production data explicitly.
CREATE OR REPLACE VIEW public.production_orders AS
SELECT *
FROM public.orders
WHERE environment = 'production'
  AND COALESCE(is_test, false) = false;

-- Production approval surfaces stay production-only by default.
DROP VIEW IF EXISTS public.v_pending_agent_actions CASCADE;
CREATE VIEW public.v_pending_agent_actions AS
SELECT
  a.id              AS action_id,
  a.id,
  a.run_id,
  a.agent_id,
  ag.name           AS agent_name,
  a.action_type,
  a.target_table,
  a.target_id,
  a.preview,
  a.payload,
  a.requires_approval,
  a.status,
  a.action_identity,
  a.root_cause_id,
  a.root_cause_key,
  a.initiative_id,
  a.superseded_by,
  a.is_duplicate,
  a.environment,
  a.created_at
FROM public.agent_actions a
JOIN public.agents ag ON ag.id = a.agent_id
WHERE a.status = 'pending'
  AND COALESCE(a.is_duplicate, false) = false
  AND a.environment = 'production'
ORDER BY a.created_at DESC;

DROP VIEW IF EXISTS public.v_bud_approval_truth CASCADE;
CREATE VIEW public.v_bud_approval_truth AS
SELECT
  q.id,
  q.task_id,
  q.action_type,
  q.status,
  q.created_at,
  q.archived_at,
  q.archive_reason,
  q.blocked_reason,
  q.payload,
  q.approval_identity,
  q.root_cause_id,
  q.root_cause_key,
  q.initiative_id,
  q.superseded_by,
  q.is_duplicate,
  q.environment,
  t.status AS task_status,
  t.risk_level,
  t.linked_pr,
  CASE
    WHEN COALESCE(q.is_duplicate, false) THEN 'Archived'
    WHEN q.status = 'archived' THEN 'Archived'
    WHEN q.status = 'blocked' THEN 'Blocked'
    WHEN q.status <> 'pending' THEN 'Archived'
    WHEN q.created_at < now() - interval '24 hours'
      AND (
        t.status IN ('archived', 'completed')
        OR (
          t.risk_level IN ('high', 'critical')
          AND COALESCE(t.linked_pr, '') = ''
          AND COALESCE(q.payload->>'pr_url', '') = ''
          AND COALESCE(q.payload->>'pull_request_url', '') = ''
          AND COALESCE(q.payload->>'diff', '') = ''
          AND COALESCE(q.payload->>'diff_summary', '') = ''
          AND COALESCE(q.payload->>'patch', '') = ''
        )
      )
      THEN 'Blocked'
    WHEN t.risk_level IN ('high', 'critical')
      AND COALESCE(t.linked_pr, '') = ''
      AND COALESCE(q.payload->>'pr_url', '') = ''
      AND COALESCE(q.payload->>'pull_request_url', '') = ''
      AND COALESCE(q.payload->>'diff', '') = ''
      AND COALESCE(q.payload->>'diff_summary', '') = ''
      AND COALESCE(q.payload->>'patch', '') = ''
      THEN 'Needs manual review'
    ELSE 'Actionable'
  END AS truth_label
FROM public.bud_approval_queue q
LEFT JOIN public.bud_tasks t ON t.id = q.task_id
WHERE q.environment = 'production';

CREATE OR REPLACE VIEW public.v_agent_intelligence_quality AS
WITH signal_stats AS (
  SELECT
    count(*)::integer AS signal_count,
    count(distinct coalesce(root_cause_key, fingerprint, id::text))::integer AS root_cause_count
  FROM public.bud_improvement_signals
  WHERE status IN ('new', 'queued', 'executing')
    AND environment = 'production'
),
approval_stats AS (
  SELECT
    (
      SELECT count(*) FROM public.v_pending_agent_actions
    )::integer
    +
    (
      SELECT count(*) FROM public.v_bud_approval_truth
      WHERE truth_label IN ('Actionable', 'Needs manual review')
        AND COALESCE(is_duplicate, false) = false
    )::integer AS approval_count
),
initiative_stats AS (
  SELECT count(*)::integer AS initiative_count
  FROM public.bud_root_cause_initiatives
  WHERE status IN ('open', 'patching', 'validating', 'blocked')
    AND approval_count > 0
    AND environment = 'production'
)
SELECT
  signal_stats.signal_count,
  CASE
    WHEN signal_stats.signal_count = 0 THEN 0::numeric
    ELSE round(
      ((signal_stats.signal_count - signal_stats.root_cause_count)::numeric / signal_stats.signal_count::numeric),
      4
    )
  END AS duplicate_rate,
  signal_stats.root_cause_count,
  approval_stats.approval_count,
  initiative_stats.initiative_count
FROM signal_stats, approval_stats, initiative_stats;
