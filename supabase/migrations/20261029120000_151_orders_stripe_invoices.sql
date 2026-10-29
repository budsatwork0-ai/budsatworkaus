-- Stripe Invoicing for jobs ("Send invoice" on the Jobs & Orders detail panel).
-- Not applied automatically; run with `supabase db push` (or the SQL editor).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_invoice_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_status  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_url     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_number  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_invoice_paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_invoice_id_key
  ON public.orders (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
