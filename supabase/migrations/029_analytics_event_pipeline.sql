-- Stabilise analytics history and enrich event records for funnel attribution.

-- Quotes and orders need to remember the originating analytics session so
-- checkout and payment lifecycle events can be tied back to acquisition.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS analytics_session_id text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS analytics_session_id text;

CREATE INDEX IF NOT EXISTS quotes_analytics_session_id_idx
  ON quotes (analytics_session_id);

CREATE INDEX IF NOT EXISTS orders_analytics_session_id_idx
  ON orders (analytics_session_id);

-- Backfill persistent sessions for any historical page views/events that were
-- captured before analytics_sessions became the canonical session store.
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

-- Visitor events now serve as the unified analytics stream for browser and
-- server-side lifecycle events.
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

-- Backfill order attribution where the order was already created from a quote.
UPDATE orders AS o
SET analytics_session_id = q.analytics_session_id
FROM quotes AS q
WHERE q.converted_order_id = o.id
  AND o.analytics_session_id IS NULL
  AND q.analytics_session_id IS NOT NULL;
