-- Quote finalization lifecycle and onboarding role-flow hardening

-- ============================================================
-- Quotes: preserve submitted pricing and defer Stripe checkout
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  service_type text NOT NULL,
  context text NOT NULL DEFAULT 'home',
  scope text,
  frequency text NOT NULL DEFAULT 'none',
  total numeric(10,2) NOT NULL DEFAULT 0,
  submitted_total numeric(10,2),
  reviewed_total numeric(10,2),
  status text NOT NULL DEFAULT 'submitted',
  payment_status text NOT NULL DEFAULT 'not_requested'
    CHECK (payment_status IN ('not_requested', 'pending_payment', 'paid', 'cancelled')),
  payment_requested_at timestamptz,
  paid_at timestamptz,
  finalized_at timestamptz,
  finalized_by text,
  notes text,
  converted_order_id uuid REFERENCES orders(id),
  converted_subscription_id uuid REFERENCES subscriptions(id),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS reviewed_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_requested'
    CHECK (payment_status IN ('not_requested', 'pending_payment', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

UPDATE quotes
SET submitted_total = total
WHERE submitted_total IS NULL;

ALTER TABLE quotes
  ALTER COLUMN submitted_total SET NOT NULL;

CREATE INDEX IF NOT EXISTS quotes_customer_id_idx ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS quotes_payment_status_idx ON quotes(payment_status);
CREATE INDEX IF NOT EXISTS quotes_status_payment_idx ON quotes(status, payment_status);

-- ============================================================
-- Employees: required photo_url for onboarding completion
-- ============================================================
ALTER TABLE IF EXISTS employees
  ADD COLUMN IF NOT EXISTS photo_url text;
