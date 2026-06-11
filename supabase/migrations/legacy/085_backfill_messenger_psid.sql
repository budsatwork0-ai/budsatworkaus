-- 085_backfill_messenger_psid.sql
--
-- Backfills leads.messenger_psid from lead_conversations for any Messenger leads
-- where the PSID was not captured at initial ingest (e.g. leads created before
-- the messenger_psid column existed, or via an older ingest path that omitted it).
--
-- Source priority: external_sender_id (set by the normalised ingest route) takes
-- precedence over metadata->>'sender_psid' (the original fallback field).
--
-- Idempotent: the WHERE clause restricts to rows where messenger_psid IS NULL,
-- so running this migration more than once is safe.
--
-- All four existing Messenger leads already have messenger_psid set, so this
-- migration is a no-op on current production data.

UPDATE leads l
SET messenger_psid = lc.psid
FROM (
  SELECT DISTINCT ON (lead_id)
    lead_id,
    COALESCE(
      NULLIF(external_sender_id, ''),
      NULLIF(metadata->>'sender_psid', '')
    ) AS psid
  FROM lead_conversations
  WHERE channel = 'messenger'
    AND COALESCE(
          NULLIF(external_sender_id, ''),
          NULLIF(metadata->>'sender_psid', '')
        ) IS NOT NULL
  ORDER BY lead_id, created_at ASC
) lc
WHERE l.id = lc.lead_id
  AND l.source = 'messenger'
  AND l.messenger_psid IS NULL
  AND lc.psid IS NOT NULL;
