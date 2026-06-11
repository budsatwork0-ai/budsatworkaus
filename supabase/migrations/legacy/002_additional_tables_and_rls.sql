-- Additional Tables and Row Level Security for Buds at Work
-- Run this migration in your Supabase SQL Editor after 001_orders_subscriptions.sql

-- =============================================================================
-- REGO CACHE TABLE (Vehicle Registration Lookup Cache)
-- =============================================================================
CREATE TABLE IF NOT EXISTS rego_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL,
  state TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  body_type TEXT,
  category TEXT,
  raw_response JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(plate, state)
);

-- Index for cache lookups and expiry cleanup
CREATE INDEX IF NOT EXISTS idx_rego_cache_plate_state ON rego_cache(plate, state);
CREATE INDEX IF NOT EXISTS idx_rego_cache_expires_at ON rego_cache(expires_at);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_rego_cache_updated_at ON rego_cache;
CREATE TRIGGER update_rego_cache_updated_at
  BEFORE UPDATE ON rego_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VEHICLE OVERRIDES TABLE (Manual Vehicle Classification Overrides)
-- =============================================================================
CREATE TABLE IF NOT EXISTS vehicle_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pattern matching lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_overrides_make ON vehicle_overrides(make);
CREATE INDEX IF NOT EXISTS idx_vehicle_overrides_priority ON vehicle_overrides(priority DESC);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_vehicle_overrides_updated_at ON vehicle_overrides;
CREATE TRIGGER update_vehicle_overrides_updated_at
  BEFORE UPDATE ON vehicle_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SITE SETTINGS TABLE (Application Configuration Key-Value Store)
-- =============================================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default site settings
INSERT INTO site_settings (key, value, description) VALUES
  ('jobs_completed', '"1500+"', 'Display value for completed jobs count'),
  ('avg_rating', '"4.9"', 'Display value for average customer rating'),
  ('repeat_customers', '"85%"', 'Display value for repeat customer percentage'),
  ('business_hours', '{"weekdays": "7am-6pm", "saturday": "8am-4pm", "sunday": "Closed"}', 'Business operating hours'),
  ('service_areas', '["Logan", "South Brisbane", "Gold Coast North"]', 'Service coverage areas')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- PAYABLES TABLE (Track Business Expenses)
-- =============================================================================
CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- utilities|supplies|wages|fuel|insurance|other
  amount DECIMAL NOT NULL,
  due_date DATE,
  paid_date DATE,
  status TEXT DEFAULT 'pending', -- pending|paid|overdue
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payables
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON payables(due_date);
CREATE INDEX IF NOT EXISTS idx_payables_category ON payables(category);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_payables_updated_at ON payables;
CREATE TRIGGER update_payables_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================
-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rego_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- ADMIN-ONLY POLICIES
-- Service role (used by server-side API routes) bypasses RLS automatically.
-- These policies apply to authenticated users accessing via anon key.
-- =============================================================================

-- For authenticated admin access via Clerk JWT, we check the 'admin' claim
-- Note: Clerk JWT must be configured to include custom claims in Supabase

-- Customers: Admin-only access
CREATE POLICY admin_all_customers ON customers
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Orders: Admin-only access
CREATE POLICY admin_all_orders ON orders
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Subscriptions: Admin-only access
CREATE POLICY admin_all_subscriptions ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Subscription Orders: Admin-only access
CREATE POLICY admin_all_subscription_orders ON subscription_orders
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Rego Cache: Admin-only access
CREATE POLICY admin_all_rego_cache ON rego_cache
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Vehicle Overrides: Admin-only access
CREATE POLICY admin_all_vehicle_overrides ON vehicle_overrides
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Site Settings: Admin-only for write, public read for display values
CREATE POLICY admin_write_site_settings ON site_settings
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- Public can read site settings (for display on public pages)
CREATE POLICY public_read_site_settings ON site_settings
  FOR SELECT
  TO anon
  USING (true);

-- Payables: Admin-only access
CREATE POLICY admin_all_payables ON payables
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role') = 'admin'
  );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to clean up expired rego cache entries (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_rego_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rego_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate outstanding receivables total
CREATE OR REPLACE FUNCTION calculate_outstanding_receivables()
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(final_price) FROM orders WHERE status IN ('pending', 'confirmed', 'scheduled', 'in_progress')),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate pending payables total
CREATE OR REPLACE FUNCTION calculate_pending_payables()
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount) FROM payables WHERE status = 'pending'),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get revenue by service type for a date range
CREATE OR REPLACE FUNCTION get_revenue_by_service(start_date DATE, end_date DATE)
RETURNS TABLE(service_type TEXT, total_revenue DECIMAL, order_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.service_type,
    COALESCE(SUM(o.final_price), 0) as total_revenue,
    COUNT(*) as order_count
  FROM orders o
  WHERE o.status = 'completed'
    AND o.completed_at >= start_date
    AND o.completed_at < end_date + INTERVAL '1 day'
  GROUP BY o.service_type
  ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
