-- Migration 138 — Calculated fundraising contributions
--
-- Adds contribution records linked to fundraising items and moves the public
-- amount-raised workflow to verified paid contributions plus a clearly named
-- manual adjustment for legacy/imported funds.

ALTER TABLE public.fundraising_items
  ADD COLUMN IF NOT EXISTS manual_adjustment_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

UPDATE public.fundraising_items
SET manual_adjustment_cents = raised_amount_cents
WHERE manual_adjustment_cents = 0
  AND raised_amount_cents <> 0;

CREATE TABLE IF NOT EXISTS public.fundraising_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraising_item_id UUID NOT NULL REFERENCES public.fundraising_items(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'aud',
  payment_provider TEXT NOT NULL DEFAULT 'stripe',
  payment_reference TEXT,
  stripe_event_id TEXT,
  payer_name TEXT,
  payer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_contributions_item_status
  ON public.fundraising_contributions (fundraising_item_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fundraising_contributions_payment_reference
  ON public.fundraising_contributions (payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fundraising_contributions_stripe_event
  ON public.fundraising_contributions (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE public.fundraising_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fundraising_contributions_no_public_read" ON public.fundraising_contributions;
CREATE POLICY "fundraising_contributions_no_public_read"
  ON public.fundraising_contributions
  FOR SELECT
  TO anon, authenticated
  USING (false);
