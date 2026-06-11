-- Quotes table for real quote persistence
CREATE TABLE IF NOT EXISTS quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  service_type text NOT NULL,
  context text NOT NULL DEFAULT 'home',
  scope text,
  frequency text NOT NULL DEFAULT 'none',
  total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',  -- pending, approved, adjusted, denied, converted
  notes text,
  converted_order_id uuid REFERENCES orders(id),
  converted_subscription_id uuid REFERENCES subscriptions(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes(status);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes(created_at DESC);

-- Ratings table for customer feedback after job completion
CREATE TABLE IF NOT EXISTS ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) NOT NULL,
  customer_id uuid REFERENCES customers(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_order_id_idx ON ratings(order_id);

-- Add user_email to audit_log for display purposes
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details text;
