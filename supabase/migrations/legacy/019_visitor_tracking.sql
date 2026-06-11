-- 019_visitor_tracking.sql
-- Real-time public site visitor tracking for the admin dashboard.
-- Tracks anonymous sessions and page view events via a lightweight JS tracker.

-- =============================================================================
-- SITE VISITORS TABLE
-- One row per active browser session. Upserted on every heartbeat/pageview.
-- Stale rows (older than 10 min) are cleaned up server-side on each API call.
-- =============================================================================
CREATE TABLE IF NOT EXISTS site_visitors (
  session_id    text        PRIMARY KEY,
  current_page  text        NOT NULL,
  page_title    text,
  referrer      text,
  user_agent    text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visitors_last_seen
  ON site_visitors (last_seen_at DESC);

-- =============================================================================
-- PAGE VIEWS TABLE
-- Append-only log — one row per page navigation event (not heartbeats).
-- FK cascades on delete so cleaning site_visitors also purges page_views.
-- =============================================================================
CREATE TABLE IF NOT EXISTS page_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text        NOT NULL REFERENCES site_visitors(session_id) ON DELETE CASCADE,
  page        text        NOT NULL,
  page_title  text,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_session_id
  ON page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at
  ON page_views (viewed_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- Anonymous callers (public tracker via API route): INSERT only.
-- Authenticated staff/admin: SELECT only.
-- The /api/track route uses createServiceClient() which bypasses RLS for
-- upserts, updates, and deletes — no UPDATE/DELETE policies needed.
-- =============================================================================
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert visitors"
  ON site_visitors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can insert page_views"
  ON page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can read visitors"
  ON site_visitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

CREATE POLICY "Staff can read page_views"
  ON page_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

-- =============================================================================
-- ENABLE SUPABASE REALTIME
-- Allows the dashboard VisitorsTab to subscribe to live changes via WebSocket.
-- After running this migration, verify in Supabase dashboard:
--   Database > Replication — both tables should appear as enabled.
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE site_visitors;
ALTER PUBLICATION supabase_realtime ADD TABLE page_views;
