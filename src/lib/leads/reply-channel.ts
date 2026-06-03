import type { LeadSource } from './source';

export type ReplyChannel = 'email' | 'messenger' | 'instagram' | 'sms' | 'phone';

/**
 * Derives how a lead can be contacted from available data at ingest time.
 * Mirrors the backfill logic in migration 084_lead_reply_channel.sql — keep in sync.
 */
export function deriveReplyChannel(
  source: LeadSource | null | undefined,
  customerEmail: string | null | undefined,
  customerPhone: string | null | undefined,
): ReplyChannel | null {
  switch (source) {
    case 'messenger': return 'messenger';
    case 'instagram': return 'instagram';
    case 'phone':     return 'phone';
    case 'sms':       return 'sms';
  }
  if (customerEmail) return 'email';
  if (customerPhone) return 'sms';
  return null;
}
