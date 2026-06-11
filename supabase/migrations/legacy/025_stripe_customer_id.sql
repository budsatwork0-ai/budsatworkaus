-- Add stripe_customer_id to customers table to enable saved payment methods.
-- When a Stripe Customer object is created during checkout, its ID is stored here
-- so future checkouts can attach to the same Customer and surface saved cards.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Partial unique index: only enforces uniqueness for non-null values
-- (most customers won't have a stripe_customer_id until their first paid checkout).
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_stripe_customer_id
  ON customers(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
