-- =============================================================================
-- 071_leads_external_ref.sql — external dedup key on leads (Module 9)
-- =============================================================================
-- The leads table from 070 doesn't carry an external identifier — it was
-- written assuming every lead originates from a form fill. Once the
-- Messenger ingest route (/api/leads/messenger) goes live, the same FB
-- conversation can fire the webhook multiple times (re-delivery, page
-- refresh on Facebook's side, retry on error). We need an idempotency key
-- so duplicate deliveries collapse to the same lead row.
--
-- `external_ref` holds the channel-native identifier — Messenger PSID,
-- IG thread id, Twilio MessageSid, etc. Paired with `source` it's globally
-- unique; a partial unique index enforces that without preventing manually
-- created leads (where external_ref is NULL).
-- =============================================================================

ALTER TABLE IF EXISTS leads
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

COMMENT ON COLUMN leads.external_ref IS
  'Channel-native unique identifier (Messenger PSID, IG thread id, Twilio MessageSid, etc.). Paired with source to deduplicate webhook re-deliveries. NULL for leads created without an external system (manual entry, form fills).';

-- Unique on (source, external_ref) but only when external_ref is provided.
-- Manually-created leads stay free of any constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external_ref
  ON leads (source, external_ref)
  WHERE external_ref IS NOT NULL;

