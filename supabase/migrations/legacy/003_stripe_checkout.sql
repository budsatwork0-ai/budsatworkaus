-- Add Stripe Checkout columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Index for webhook lookups by session ID
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session
  ON orders(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Index for payment intent lookups
CREATE INDEX IF NOT EXISTS idx_orders_stripe_pi
  ON orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
