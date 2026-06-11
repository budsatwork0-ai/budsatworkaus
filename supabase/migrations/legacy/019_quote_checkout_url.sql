-- Persist the latest hosted Stripe Checkout URL for manual sharing/resends.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS stripe_checkout_url text;

