-- Phase 5D — canonical reply_channel model for leads.
--
-- Adds:
--   leads.reply_channel          — how to reach this person ('email'|'messenger'|'instagram'|'sms'|'phone')
--   leads.messenger_psid         — Facebook Page-Scoped User ID (Messenger leads)
--   leads.instagram_user_id      — Instagram-Scoped User ID (Instagram leads)
--   lead_conversations.external_sender_id — top-level indexed copy of metadata->>'sender_psid'
--
-- Backfill rules (idempotent — only updates NULL rows):
--   source='messenger'           → reply_channel='messenger', messenger_psid from conv metadata
--   source='instagram'           → reply_channel='instagram', instagram_user_id from conv metadata
--   source='phone'               → reply_channel='phone'
--   source='sms'                 → reply_channel='sms'
--   customer_email IS NOT NULL   → reply_channel='email'  (website, referral, email leads)
--   customer_phone IS NOT NULL   → reply_channel='sms'    (phone-only fallback)
--   otherwise                    → NULL (unknown, requires manual review)

-- ── 1. New columns ────────────────────────────────────────────────────────────

alter table public.leads
  add column if not exists reply_channel text
    check (reply_channel in ('email', 'messenger', 'instagram', 'sms', 'phone')),
  add column if not exists messenger_psid text,
  add column if not exists instagram_user_id text;

alter table public.lead_conversations
  add column if not exists external_sender_id text;

-- ── 2. Backfill reply_channel ─────────────────────────────────────────────────

update public.leads
set reply_channel = case
  when source = 'messenger'              then 'messenger'
  when source = 'instagram'              then 'instagram'
  when source = 'phone'                  then 'phone'
  when source = 'sms'                    then 'sms'
  when customer_email is not null        then 'email'
  when customer_phone is not null        then 'sms'
  else null
end
where reply_channel is null;

-- ── 3. Backfill messenger_psid from conversation metadata ─────────────────────

update public.leads l
set messenger_psid = (
  select lc.metadata->>'sender_psid'
  from   public.lead_conversations lc
  where  lc.lead_id = l.id
    and  lc.channel = 'messenger'
    and  lc.metadata->>'sender_psid' is not null
  order  by lc.created_at asc
  limit  1
)
where l.source        = 'messenger'
  and l.messenger_psid is null;

-- ── 4. Backfill instagram_user_id from conversation metadata ─────────────────

update public.leads l
set instagram_user_id = (
  select lc.metadata->>'sender_psid'
  from   public.lead_conversations lc
  where  lc.lead_id = l.id
    and  lc.channel = 'instagram'
    and  lc.metadata->>'sender_psid' is not null
  order  by lc.created_at asc
  limit  1
)
where l.source             = 'instagram'
  and l.instagram_user_id   is null;

-- ── 5. Backfill external_sender_id on conversations ──────────────────────────

update public.lead_conversations
set    external_sender_id = metadata->>'sender_psid'
where  external_sender_id is null
  and  metadata->>'sender_psid' is not null;

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

create index if not exists leads_reply_channel_idx
  on public.leads (reply_channel)
  where reply_channel is not null;

create index if not exists leads_messenger_psid_idx
  on public.leads (messenger_psid)
  where messenger_psid is not null;

create index if not exists leads_instagram_user_id_idx
  on public.leads (instagram_user_id)
  where instagram_user_id is not null;

create index if not exists lead_conversations_external_sender_id_idx
  on public.lead_conversations (external_sender_id)
  where external_sender_id is not null;
