-- Support admin-side cancellation of approved quotes with an audit trail.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text;

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'adjusted',
    'converted',
    'submitted',
    'in_review',
    'finalized',
    'payment_pending',
    'paid',
    'denied',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS quotes_cancelled_at_idx ON quotes(cancelled_at DESC);
