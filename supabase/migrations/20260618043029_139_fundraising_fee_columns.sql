-- Migration 139 — Stripe fee tracking on fundraising contributions
--
-- Adds explicit gross/fee/net columns so the admin dashboard can show both
-- what donors contributed and what actually landed in the account.
-- Public progress bar continues to use gross (donor-facing).

ALTER TABLE public.fundraising_contributions
  ADD COLUMN IF NOT EXISTS gross_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_fee_cents    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents    INTEGER;

-- Backfill: existing rows have no fee data, treat gross = net = amount_cents
UPDATE public.fundraising_contributions
SET
  gross_amount_cents = amount_cents,
  net_amount_cents   = amount_cents
WHERE gross_amount_cents IS NULL;

ALTER TABLE public.fundraising_contributions
  ALTER COLUMN gross_amount_cents SET NOT NULL,
  ALTER COLUMN net_amount_cents   SET NOT NULL;
