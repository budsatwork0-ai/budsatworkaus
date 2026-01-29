-- Orders & Subscriptions Schema for Buds at Work
-- Run this migration in your Supabase SQL Editor

-- =============================================================================
-- CUSTOMERS TABLE
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- =============================================================================
-- ORDERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT NOT NULL,  -- windows|cleaning|yard|dump|auto|sneakers
  context TEXT NOT NULL,        -- home|commercial
  scope TEXT,
  frequency TEXT DEFAULT 'none', -- none|daily|3x_weekly|weekly|fortnightly|monthly
  base_price DECIMAL NOT NULL,
  discount_percent DECIMAL DEFAULT 0,
  final_price DECIMAL NOT NULL,
  scheduled_date DATE,
  scheduled_time TEXT,
  status TEXT DEFAULT 'pending', -- pending|confirmed|scheduled|in_progress|completed|cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common order queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- =============================================================================
-- SUBSCRIPTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT NOT NULL,
  context TEXT NOT NULL,
  scope TEXT,
  frequency TEXT NOT NULL,      -- daily|3x_weekly|weekly|fortnightly|monthly
  base_price DECIMAL NOT NULL,
  discount_percent DECIMAL DEFAULT 0,
  price_per_cycle DECIMAL NOT NULL,
  status TEXT DEFAULT 'active', -- active|paused|cancelled
  start_date DATE NOT NULL,
  next_service_date DATE,
  last_service_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_frequency ON subscriptions(frequency);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_service_date ON subscriptions(next_service_date);

-- =============================================================================
-- SUBSCRIPTION_ORDERS TABLE (links subscriptions to generated orders)
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for subscription order lookups
CREATE INDEX IF NOT EXISTS idx_subscription_orders_subscription_id ON subscription_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_order_id ON subscription_orders(order_id);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (optional - enable if needed)
-- =============================================================================
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SAMPLE DATA (optional - uncomment to seed test data)
-- =============================================================================
/*
-- Sample customer
INSERT INTO customers (full_name, email, phone, region, company_name)
VALUES
  ('John Smith', 'john@example.com', '0412345678', 'Brisbane', NULL),
  ('ABC Corp', 'contact@abccorp.com', '0798765432', 'Gold Coast', 'ABC Corporation');

-- Sample orders
INSERT INTO orders (customer_name, customer_email, service_type, context, scope, base_price, final_price, status, scheduled_date)
VALUES
  ('John Smith', 'john@example.com', 'cleaning', 'home', 'standard', 180, 180, 'pending', CURRENT_DATE + INTERVAL '3 days'),
  ('ABC Corp', 'contact@abccorp.com', 'windows', 'commercial', 'full', 450, 450, 'confirmed', CURRENT_DATE + INTERVAL '5 days');

-- Sample subscriptions
INSERT INTO subscriptions (customer_name, customer_email, service_type, context, scope, frequency, base_price, discount_percent, price_per_cycle, status, start_date, next_service_date)
VALUES
  ('ABC Corp', 'contact@abccorp.com', 'cleaning', 'commercial', 'standard', 'weekly', 500, 12, 440, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days');
*/
