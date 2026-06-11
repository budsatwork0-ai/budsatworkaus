-- =====================================================================
-- Migration 087: action_identity dedup for agent_actions
-- Prevents duplicate pending send_messenger / send_email approval cards
-- from accumulating in Mission Control.
-- =====================================================================

-- 1. Add identity column (nullable — NULL bypasses unique constraint, safe fallback)
ALTER TABLE public.agent_actions
  ADD COLUMN IF NOT EXISTS action_identity text;

-- 2. Backfill pending send_messenger rows
--    Identity: send_messenger:<lead_id>:<conversation_id>
UPDATE public.agent_actions
SET action_identity =
  'send_messenger:' || (payload->>'lead_id') || ':' || coalesce(payload->>'conversation_id', '')
WHERE action_type = 'send_messenger'
  AND status    = 'pending'
  AND payload->>'lead_id' IS NOT NULL;

-- 3. Backfill pending send_email rows (both quote-triage and customer-reply set target_table+target_id)
--    Identity: send_email:<target_table>:<target_id>
UPDATE public.agent_actions
SET action_identity = 'send_email:' || target_table || ':' || target_id
WHERE action_type = 'send_email'
  AND status      = 'pending'
  AND target_table IS NOT NULL
  AND target_id    IS NOT NULL;

-- 4. Archive older duplicate pending rows — keep the most-recent per identity,
--    reject the rest. Audit trail preserved: review_notes explains why.
WITH canonical AS (
  SELECT DISTINCT ON (action_identity) id
  FROM public.agent_actions
  WHERE action_identity IS NOT NULL
    AND status = 'pending'
  ORDER BY action_identity, created_at DESC
)
UPDATE public.agent_actions
SET status       = 'rejected',
    review_notes = 'superseded: duplicate pending action',
    reviewed_at  = now()
WHERE action_identity IS NOT NULL
  AND status = 'pending'
  AND id NOT IN (SELECT id FROM canonical);

-- 5. Partial unique index — only enforces uniqueness among live pending rows.
--    NULLs fall through (no constraint) so non-communication action types are unaffected.
--    Approved/executed/rejected rows are excluded, preserving full history.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_actions_identity_pending
  ON public.agent_actions(action_identity)
  WHERE status = 'pending' AND action_identity IS NOT NULL;
