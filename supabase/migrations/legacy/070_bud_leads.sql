-- =============================================================================
-- 070_bud_leads.sql — Bud Leads schema foundation (Module 9)
-- =============================================================================
-- This migration lays the relational groundwork for Bud Leads. It is safe to
-- run before any Bud Leads code reads from these tables — the adapter
-- (src/app/(app)/dashboard/insights/leads/lib/leadAdapter.ts) currently
-- derives Lead[] entirely from the existing `quotes` table.
--
-- Once Messenger, SMS, and other channels start writing to `leads` directly,
-- the dashboard reads from `leads` and `conversations` instead. The Lead
-- schema (TS) intentionally mirrors the columns here for an easy swap.
--
-- Everything is idempotent (IF NOT EXISTS) so this can be re-run safely.
-- =============================================================================

-- ---------- quotes.source ----------------------------------------------------
-- Source attribution on quotes. Until Messenger/SMS integrations write Lead
-- rows directly, every quote remains the canonical lead unit, so we tag the
-- source here. The TS adapter already understands this column.

ALTER TABLE IF EXISTS quotes
  ADD COLUMN IF NOT EXISTS source TEXT
  CHECK (source IN ('website','messenger','sms','instagram','email','phone','referral','unknown'));

COMMENT ON COLUMN quotes.source IS
  'Where this quote/lead originated. Set on insert by the route that created the quote (e.g. /api/quotes/submit defaults to ''website''). Read by Bud Leads to attribute conversion by channel.';

CREATE INDEX IF NOT EXISTS idx_quotes_source ON quotes (source);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes (created_at DESC);

-- ---------- leads ------------------------------------------------------------
-- The canonical lead unit when channels other than the website are wired in.
-- Each lead may *resolve to* a quote (1-1 fk → quotes.id) once the
-- conversation produces a formal quote. Until then it lives on its own.

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT,
  suburb TEXT,
  service_address TEXT,
  source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('website','messenger','sms','instagram','email','phone','referral','unknown')),

  -- Operational state. The dashboard maps these to the LeadResponseStatus TS enum.
  response_status TEXT NOT NULL DEFAULT 'awaiting_response'
    CHECK (response_status IN (
      'awaiting_response','in_conversation','quoted','booked','completed','no_response','lost'
    )),

  -- Latest computed temperature. Computed nightly by a cron-style job; the
  -- dashboard also re-computes on read for freshness.
  temperature TEXT
    CHECK (temperature IN ('HOT','WARM','COLD','LOST')),

  -- Linkage. A lead may roll up into a quote (and thus an order) eventually.
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,

  -- Lifecycle timestamps.
  first_response_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_response_status ON leads (response_status);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads (temperature);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_suburb ON leads (suburb);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
-- Fast "open leads only" filter — partial index keeps Postgres efficient.
CREATE INDEX IF NOT EXISTS idx_leads_open
  ON leads (created_at DESC)
  WHERE response_status NOT IN ('lost','completed');

COMMENT ON TABLE leads IS
  'Universal lead record. Wired in once channels other than the website (Messenger, SMS, Instagram, etc.) start producing leads. Until then, Bud Leads derives Lead[] from quotes.';

-- updated_at trigger (helper function created idempotently)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- conversations ----------------------------------------------------
-- Append-only message log. Each row is one inbound or outbound message
-- against a lead. The first row's created_at - lead.created_at gives the
-- first-response time the Response Performance panel needs.

CREATE TABLE IF NOT EXISTS lead_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel TEXT NOT NULL
    CHECK (channel IN ('website','messenger','sms','instagram','email','phone','referral','internal','unknown')),
  body TEXT,
  -- Where this message came from in the channel's native system.
  external_id TEXT,
  author_id UUID,           -- internal staff user_id when outbound
  author_label TEXT,        -- "Customer", "Buds At Work", "Auto-reply", etc.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_conversations_lead_id_created
  ON lead_conversations (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_conversations_channel
  ON lead_conversations (channel, created_at DESC);
-- Realtime subscriptions filter by lead — this composite is the hot path.
CREATE INDEX IF NOT EXISTS idx_lead_conversations_lead_direction
  ON lead_conversations (lead_id, direction);

COMMENT ON TABLE lead_conversations IS
  'Append-only message log per lead. Source of truth for first-response timing and inbox rendering.';

-- ---------- follow_ups -------------------------------------------------------
-- Operator-scheduled follow-ups. The Needs Attention panel surfaces overdue
-- entries with a one-click action.

CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  channel TEXT
    CHECK (channel IN ('messenger','sms','email','phone','website','internal')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','done','cancelled','snoozed')),
  done_at TIMESTAMPTZ,
  assignee_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_due
  ON lead_follow_ups (status, due_at);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead
  ON lead_follow_ups (lead_id, status);

DROP TRIGGER IF EXISTS trg_lead_follow_ups_updated_at ON lead_follow_ups;
CREATE TRIGGER trg_lead_follow_ups_updated_at BEFORE UPDATE ON lead_follow_ups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- response metrics (materialized for fast dashboard reads) --------
-- One row per (source, day). Backfilled by a job; the dashboard joins this
-- for the Response Performance "by channel" table without scanning all
-- conversations on every render.

CREATE TABLE IF NOT EXISTS lead_response_metrics (
  metric_day DATE NOT NULL,
  source TEXT NOT NULL,
  leads_total INTEGER NOT NULL DEFAULT 0,
  leads_responded INTEGER NOT NULL DEFAULT 0,
  leads_booked INTEGER NOT NULL DEFAULT 0,
  avg_first_response_minutes NUMERIC(10,2),
  median_first_response_minutes NUMERIC(10,2),
  missed_leads INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_day, source)
);

CREATE INDEX IF NOT EXISTS idx_lead_response_metrics_day
  ON lead_response_metrics (metric_day DESC);

COMMENT ON TABLE lead_response_metrics IS
  'Daily roll-up of response performance per source. Refreshed by a scheduled job; never edited by hand.';

-- ---------- suburb analytics -----------------------------------------------
-- Daily roll-up per suburb. Powers the Suburb Heatmap and the future
-- Opportunity Radar (Module 6).

CREATE TABLE IF NOT EXISTS lead_suburb_analytics (
  metric_day DATE NOT NULL,
  suburb TEXT NOT NULL,
  active_leads INTEGER NOT NULL DEFAULT 0,
  hot_leads INTEGER NOT NULL DEFAULT 0,
  booked_jobs INTEGER NOT NULL DEFAULT 0,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  -- 7-day momentum: positive = warming up, negative = cooling.
  momentum NUMERIC(6,3),
  -- Cached geocode so the dashboard can render a heatmap without re-geocoding.
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_day, suburb)
);

CREATE INDEX IF NOT EXISTS idx_lead_suburb_analytics_day
  ON lead_suburb_analytics (metric_day DESC);
CREATE INDEX IF NOT EXISTS idx_lead_suburb_analytics_suburb
  ON lead_suburb_analytics (suburb, metric_day DESC);

-- ---------- RLS scaffolding ------------------------------------------------
-- Enable RLS now so the columns aren't accidentally exposed before policies
-- land. Server reads use the service-role key (bypasses RLS).

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_response_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_suburb_analytics ENABLE ROW LEVEL SECURITY;

-- Owner / admin staff policy. Adjust to your existing auth.users + role
-- conventions; this is a safe baseline.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leads' AND policyname='leads_staff_read') THEN
    CREATE POLICY leads_staff_read ON leads FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_conversations' AND policyname='lead_conversations_staff_read') THEN
    CREATE POLICY lead_conversations_staff_read ON lead_conversations FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_follow_ups' AND policyname='lead_follow_ups_staff_read') THEN
    CREATE POLICY lead_follow_ups_staff_read ON lead_follow_ups FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_response_metrics' AND policyname='lead_response_metrics_staff_read') THEN
    CREATE POLICY lead_response_metrics_staff_read ON lead_response_metrics FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_suburb_analytics' AND policyname='lead_suburb_analytics_staff_read') THEN
    CREATE POLICY lead_suburb_analytics_staff_read ON lead_suburb_analytics FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ---------- realtime publication -------------------------------------------
-- Subscribe to lead and conversation changes from the client (Bud Leads
-- listens for new HOT leads in real time once channels are wired in).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE leads;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE lead_conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE lead_follow_ups;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
