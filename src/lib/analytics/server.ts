import { createServiceClientSafe } from '@/lib/supabase/server';
import type { AnalyticsEventData } from '@/lib/analytics/shared';

type AnalyticsEventInput = {
  sessionId?: string | null;
  eventName: string;
  eventLabel?: string | null;
  page?: string | null;
  source?: 'client' | 'server';
  quoteId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  eventValue?: number | null;
  eventData?: AnalyticsEventData;
};

export async function recordAnalyticsEvent(event: AnalyticsEventInput): Promise<void> {
  const client = createServiceClientSafe();
  if (!client) return;

  const {
    sessionId = null,
    eventName,
    eventLabel = null,
    page = null,
    source = 'server',
    quoteId = null,
    orderId = null,
    paymentId = null,
    eventValue = null,
    eventData = {},
  } = event;

  try {
    await (client as any).from('visitor_events').insert({
      session_id: sessionId,
      event_name: eventName,
      event_label: eventLabel,
      page,
      source,
      quote_id: quoteId,
      order_id: orderId,
      payment_id: paymentId,
      event_value: eventValue,
      event_data: eventData,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[analytics] Failed to record event:', eventName, error);
  }
}
