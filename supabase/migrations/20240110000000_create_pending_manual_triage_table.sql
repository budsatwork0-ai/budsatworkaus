-- Migration: create pending_manual_triage table for failed quote-triage records
CREATE TABLE IF NOT EXISTS pending_manual_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_quote jsonb NOT NULL,
  status text NOT NULL DEFAULT 'failed',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_manual_triage_status ON pending_manual_triage (status);
CREATE INDEX IF NOT EXISTS idx_pending_manual_triage_created_at ON pending_manual_triage (created_at);
