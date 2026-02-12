-- Combined Migration for Buds at Work (with Schema Improvements)
-- Run this single file in Supabase SQL Editor

-- =============================================================================
-- PART 1: CORE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  region TEXT,
  company_name TEXT,
  abn TEXT,
  default_address TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(id) WHERE deleted_at IS NULL;

-- Quotes table (created before orders for FK reference)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT NOT NULL,
  context TEXT NOT NULL,
  scope TEXT,
  frequency TEXT DEFAULT 'none' CHECK (frequency IN ('none', 'weekly', 'fortnightly', 'monthly', 'quarterly')),
  base_price DECIMAL NOT NULL CHECK (base_price >= 0),
  discount_percent DECIMAL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  quoted_price DECIMAL NOT NULL CHECK (quoted_price >= 0),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT NOT NULL,
  context TEXT NOT NULL,
  scope TEXT,
  frequency TEXT DEFAULT 'none' CHECK (frequency IN ('none', 'weekly', 'fortnightly', 'monthly', 'quarterly')),
  base_price DECIMAL NOT NULL CHECK (base_price >= 0),
  discount_percent DECIMAL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  final_price DECIMAL NOT NULL CHECK (final_price >= 0),
  scheduled_date DATE,
  scheduled_time TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_active ON orders(id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT NOT NULL,
  context TEXT NOT NULL,
  scope TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly')),
  base_price DECIMAL NOT NULL CHECK (base_price >= 0),
  discount_percent DECIMAL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  price_per_cycle DECIMAL NOT NULL CHECK (price_per_cycle >= 0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  start_date DATE NOT NULL,
  next_service_date DATE,
  last_service_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_frequency ON subscriptions(frequency);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_service_date ON subscriptions(next_service_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_subscription_id ON subscription_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_order_id ON subscription_orders(order_id);

-- =============================================================================
-- PART 2: PAYMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount DECIMAL NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'invoice', 'other')),
  payment_reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial_refund')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payments_has_reference CHECK (order_id IS NOT NULL OR subscription_id IS NOT NULL OR notes IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- =============================================================================
-- PART 3: UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to core tables
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PART 4: ADDITIONAL TABLES
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

CREATE INDEX IF NOT EXISTS idx_rego_cache_plate_state ON rego_cache(plate, state);
CREATE INDEX IF NOT EXISTS idx_rego_cache_expires_at ON rego_cache(expires_at);

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

CREATE INDEX IF NOT EXISTS idx_vehicle_overrides_make ON vehicle_overrides(make);
CREATE INDEX IF NOT EXISTS idx_vehicle_overrides_priority ON vehicle_overrides(priority DESC);

DROP TRIGGER IF EXISTS update_vehicle_overrides_updated_at ON vehicle_overrides;
CREATE TRIGGER update_vehicle_overrides_updated_at
  BEFORE UPDATE ON vehicle_overrides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO site_settings (key, value, description) VALUES
  ('jobs_completed', '"1500+"', 'Display value for completed jobs count'),
  ('avg_rating', '"4.9"', 'Display value for average customer rating'),
  ('repeat_customers', '"85%"', 'Display value for repeat customer percentage'),
  ('business_hours', '{"weekdays": "7am-6pm", "saturday": "8am-4pm", "sunday": "Closed"}', 'Business operating hours'),
  ('service_areas', '["Logan", "South Brisbane", "Gold Coast North"]', 'Service coverage areas')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  amount DECIMAL NOT NULL CHECK (amount >= 0),
  due_date DATE,
  paid_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON payables(due_date);
CREATE INDEX IF NOT EXISTS idx_payables_category ON payables(category);
CREATE INDEX IF NOT EXISTS idx_payables_active ON payables(id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_payables_updated_at ON payables;
CREATE TRIGGER update_payables_updated_at
  BEFORE UPDATE ON payables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PART 5: AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  performed_by TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    INSERT INTO audit_log (table_name, record_id, action, old_data, performed_at)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', old_data, NOW());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    SELECT array_agg(key) INTO changed_fields
    FROM jsonb_each(old_data) AS o(key, value)
    WHERE o.value IS DISTINCT FROM new_data->o.key;

    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_fields, performed_at)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', old_data, new_data, changed_fields, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    INSERT INTO audit_log (table_name, record_id, action, new_data, performed_at)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', new_data, NOW());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit triggers (uncomment to enable - generates significant data)
-- DROP TRIGGER IF EXISTS audit_orders ON orders;
-- CREATE TRIGGER audit_orders
--   AFTER INSERT OR UPDATE OR DELETE ON orders
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- DROP TRIGGER IF EXISTS audit_customers ON customers;
-- CREATE TRIGGER audit_customers
--   AFTER INSERT OR UPDATE OR DELETE ON customers
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- DROP TRIGGER IF EXISTS audit_subscriptions ON subscriptions;
-- CREATE TRIGGER audit_subscriptions
--   AFTER INSERT OR UPDATE OR DELETE ON subscriptions
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =============================================================================
-- PART 6: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rego_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Public can read site settings
DROP POLICY IF EXISTS public_read_site_settings ON site_settings;
CREATE POLICY public_read_site_settings ON site_settings
  FOR SELECT TO anon USING (true);

-- Authenticated users can manage all business data
DROP POLICY IF EXISTS authenticated_manage_customers ON customers;
CREATE POLICY authenticated_manage_customers ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_orders ON orders;
CREATE POLICY authenticated_manage_orders ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_subscriptions ON subscriptions;
CREATE POLICY authenticated_manage_subscriptions ON subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_subscription_orders ON subscription_orders;
CREATE POLICY authenticated_manage_subscription_orders ON subscription_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_quotes ON quotes;
CREATE POLICY authenticated_manage_quotes ON quotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_payments ON payments;
CREATE POLICY authenticated_manage_payments ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_payables ON payables;
CREATE POLICY authenticated_manage_payables ON payables
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_rego_cache ON rego_cache;
CREATE POLICY authenticated_manage_rego_cache ON rego_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_vehicle_overrides ON vehicle_overrides;
CREATE POLICY authenticated_manage_vehicle_overrides ON vehicle_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_site_settings ON site_settings;
CREATE POLICY authenticated_manage_site_settings ON site_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read_audit_log ON audit_log;
CREATE POLICY authenticated_read_audit_log ON audit_log
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- PART 7: HELPER FUNCTIONS
-- =============================================================================

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

CREATE OR REPLACE FUNCTION calculate_outstanding_receivables()
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(final_price) FROM orders WHERE status IN ('pending', 'confirmed', 'scheduled', 'in_progress') AND deleted_at IS NULL),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_pending_payables()
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount) FROM payables WHERE status = 'pending' AND deleted_at IS NULL),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_order_payments(order_uuid UUID)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount) FROM payments WHERE order_id = order_uuid AND status = 'completed'),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_order_balance(order_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
  order_total DECIMAL;
  paid_amount DECIMAL;
BEGIN
  SELECT final_price INTO order_total FROM orders WHERE id = order_uuid;
  paid_amount := calculate_order_payments(order_uuid);
  RETURN COALESCE(order_total - paid_amount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION soft_delete(table_name TEXT, record_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', table_name)
  USING record_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restore_deleted(table_name TEXT, record_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL', table_name)
  USING record_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
