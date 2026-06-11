-- Stabilise analytics history and enrich event records for funnel attribution.
-- This migration is intentionally self-contained so it can run even when the
-- earlier visitor analytics migration (028) was not applied remotely.

-- =============================================================================
-- CORE PERSISTENT SESSION TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id        text        PRIMARY KEY,
  referrer          text,
  user_agent        text,
  city              text,
  country           text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_term          text,
  utm_content       text,
  is_returning      boolean     NOT NULL DEFAULT false,
  pages_visited     integer     NOT NULL DEFAULT 1,
  total_seconds     integer     NOT NULL DEFAULT 0,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_first_seen
  ON analytics_sessions (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_country
  ON analytics_sessions (country);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_utm_source
  ON analytics_sessions (utm_source);

-- =============================================================================
-- QUOTE + ORDER ATTRIBUTION
-- =============================================================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS analytics_session_id text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS analytics_session_id text;

CREATE INDEX IF NOT EXISTS quotes_analytics_session_id_idx
  ON quotes (analytics_session_id);

CREATE INDEX IF NOT EXISTS orders_analytics_session_id_idx
  ON orders (analytics_session_id);

-- =============================================================================
-- PAGE VIEW ENRICHMENT
-- =============================================================================
ALTER TABLE page_views
  ADD COLUMN IF NOT EXISTS scroll_depth  integer,
  ADD COLUMN IF NOT EXISTS time_on_page  integer,
  ADD COLUMN IF NOT EXISTS utm_source    text,
  ADD COLUMN IF NOT EXISTS utm_medium    text,
  ADD COLUMN IF NOT EXISTS utm_campaign  text;

CREATE INDEX IF NOT EXISTS idx_page_views_page
  ON page_views (page);

-- =============================================================================
-- UNIFIED ANALYTICS EVENT STREAM
-- =============================================================================
CREATE TABLE IF NOT EXISTS visitor_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text        REFERENCES analytics_sessions(session_id) ON DELETE SET NULL,
  event_name   text        NOT NULL,
  event_label  text,
  page         text,
  source       text        NOT NULL DEFAULT 'client',
  quote_id     uuid        REFERENCES quotes(id) ON DELETE SET NULL,
  order_id     uuid        REFERENCES orders(id) ON DELETE SET NULL,
  payment_id   uuid        REFERENCES payments(id) ON DELETE SET NULL,
  event_value  numeric(10,2),
  event_data   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visitor_events
  DROP CONSTRAINT IF EXISTS visitor_events_session_id_fkey;

ALTER TABLE visitor_events
  ALTER COLUMN session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS event_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE visitor_events
  ADD CONSTRAINT visitor_events_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_events_session_id
  ON visitor_events (session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at
  ON visitor_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_events_name
  ON visitor_events (event_name);

CREATE INDEX IF NOT EXISTS idx_visitor_events_quote_id
  ON visitor_events (quote_id);

CREATE INDEX IF NOT EXISTS idx_visitor_events_order_id
  ON visitor_events (order_id);

CREATE INDEX IF NOT EXISTS idx_visitor_events_payment_id
  ON visitor_events (payment_id);

CREATE INDEX IF NOT EXISTS idx_visitor_events_source
  ON visitor_events (source);

CREATE INDEX IF NOT EXISTS idx_visitor_events_name_created_at
  ON visitor_events (event_name, created_at DESC);

-- =============================================================================
-- HISTORICAL SESSION BACKFILL
-- =============================================================================
INSERT INTO analytics_sessions (
  session_id,
  pages_visited,
  total_seconds,
  first_seen_at,
  last_seen_at
)
SELECT
  pv.session_id,
  COUNT(*)::integer,
  COALESCE(SUM(COALESCE(pv.time_on_page, 0)), 0)::integer,
  MIN(pv.viewed_at),
  MAX(pv.viewed_at)
FROM page_views pv
LEFT JOIN analytics_sessions s ON s.session_id = pv.session_id
WHERE s.session_id IS NULL
GROUP BY pv.session_id;

INSERT INTO analytics_sessions (
  session_id,
  pages_visited,
  total_seconds,
  first_seen_at,
  last_seen_at
)
SELECT
  ve.session_id,
  0,
  0,
  MIN(ve.created_at),
  MAX(ve.created_at)
FROM visitor_events ve
LEFT JOIN analytics_sessions s ON s.session_id = ve.session_id
WHERE ve.session_id IS NOT NULL
  AND s.session_id IS NULL
GROUP BY ve.session_id;

-- Historical page views must survive stale live-visitor cleanup. Repoint the
-- foreign key at the persistent analytics session table.
ALTER TABLE page_views
  DROP CONSTRAINT IF EXISTS page_views_session_id_fkey;

ALTER TABLE page_views
  ADD CONSTRAINT page_views_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE;

-- Backfill order attribution where the order was already created from a quote.
UPDATE orders AS o
SET analytics_session_id = q.analytics_session_id
FROM quotes AS q
WHERE q.converted_order_id = o.id
  AND o.analytics_session_id IS NULL
  AND q.analytics_session_id IS NOT NULL;

-- =============================================================================
-- HELPER RPCS
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_session_pages(p_session_id text, p_now timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE analytics_sessions
  SET pages_visited = pages_visited + 1,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION increment_session_time(p_session_id text, p_seconds integer, p_now timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE analytics_sessions
  SET total_seconds = total_seconds + p_seconds,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analytics_sessions'
      AND policyname = 'Public can insert analytics_sessions'
  ) THEN
    CREATE POLICY "Public can insert analytics_sessions"
      ON analytics_sessions FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analytics_sessions'
      AND policyname = 'Public can update analytics_sessions'
  ) THEN
    CREATE POLICY "Public can update analytics_sessions"
      ON analytics_sessions FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analytics_sessions'
      AND policyname = 'Staff can read analytics_sessions'
  ) THEN
    CREATE POLICY "Staff can read analytics_sessions"
      ON analytics_sessions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM employees e
          WHERE e.user_id = auth.uid() AND e.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'visitor_events'
      AND policyname = 'Public can insert visitor_events'
  ) THEN
    CREATE POLICY "Public can insert visitor_events"
      ON visitor_events FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'visitor_events'
      AND policyname = 'Staff can read visitor_events'
  ) THEN
    CREATE POLICY "Staff can read visitor_events"
      ON visitor_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM employees e
          WHERE e.user_id = auth.uid() AND e.status = 'active'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- REALTIME
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'analytics_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE analytics_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'visitor_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE visitor_events;
  END IF;
END $$;
