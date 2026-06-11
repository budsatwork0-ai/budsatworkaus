-- 028_enhanced_visitor_tracking.sql
-- Advanced visitor analytics: persistent sessions, UTM tracking, engagement
-- metrics, and a CTA/event table for conversion funnel analysis.

-- =============================================================================
-- ANALYTICS SESSIONS — persistent, never deleted
-- One row per unique browser session. Unlike site_visitors (which is the live
-- presence table and gets cleaned every 10 min), this table is append-only and
-- keeps every session forever for trend analysis.
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
  total_seconds     integer     NOT NULL DEFAULT 0,  -- total time on site
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
-- ENHANCE PAGE_VIEWS — add engagement columns
-- =============================================================================
ALTER TABLE page_views
  ADD COLUMN IF NOT EXISTS scroll_depth  integer,    -- max % scrolled (0–100)
  ADD COLUMN IF NOT EXISTS time_on_page  integer,    -- seconds spent on page
  ADD COLUMN IF NOT EXISTS utm_source    text,
  ADD COLUMN IF NOT EXISTS utm_medium    text,
  ADD COLUMN IF NOT EXISTS utm_campaign  text;

CREATE INDEX IF NOT EXISTS idx_page_views_page
  ON page_views (page);

-- =============================================================================
-- VISITOR EVENTS — CTA clicks, form submits, custom events
-- Used for funnel analysis and conversion tracking.
-- =============================================================================
CREATE TABLE IF NOT EXISTS visitor_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text        NOT NULL REFERENCES site_visitors(session_id) ON DELETE CASCADE,
  event_name   text        NOT NULL,   -- e.g. 'cta_click', 'quote_request', 'form_submit'
  event_label  text,                   -- human-readable label
  page         text,
  event_data   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_session_id  ON visitor_events (session_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at  ON visitor_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_name        ON visitor_events (event_name);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_events     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert analytics_sessions"
  ON analytics_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update analytics_sessions"
  ON analytics_sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Staff can read analytics_sessions"
  ON analytics_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid() AND e.status = 'active'
    )
  );

CREATE POLICY "Public can insert visitor_events"
  ON visitor_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can read visitor_events"
  ON visitor_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid() AND e.status = 'active'
    )
  );

-- =============================================================================
-- HELPER RPC FUNCTIONS (called from /api/track to avoid race conditions)
-- =============================================================================

-- Increment pages_visited atomically when a returning session views a new page
CREATE OR REPLACE FUNCTION increment_session_pages(p_session_id text, p_now timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE analytics_sessions
  SET pages_visited = pages_visited + 1,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;

-- Increment total_seconds atomically when engagement data arrives
CREATE OR REPLACE FUNCTION increment_session_time(p_session_id text, p_seconds integer, p_now timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE analytics_sessions
  SET total_seconds = total_seconds + p_seconds,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;

-- =============================================================================
-- REALTIME
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_events;
