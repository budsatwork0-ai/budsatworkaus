import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { QuoteRow } from '@/lib/quotes/repository';
import { createQuoteRepository } from '@/lib/quotes/repository';
import { createOrderRepository, type OrderRow } from '@/lib/orders/repository';
import { quoteWorkspace } from '@/lib/quotes/workspace';
import { assertWorkspaceCompatibility, withWorkspaceContext } from '@/lib/workspace/server';

export async function ensureOrderForPayableQuote(client: SupabaseClient<Database>, quote: QuoteRow): Promise<OrderRow> {
  const workspace = quoteWorkspace(quote);
  return withWorkspaceContext(workspace, async () => {
    const orders = createOrderRepository({ client, workspace });
    const quotes = createQuoteRepository({ client, workspace });
    const verify = (order: OrderRow | null): OrderRow => {
      if (!order || order.quote_id !== quote.id) throw new Error('Converted order does not belong to this quote');
      assertWorkspaceCompatibility(workspace, order.environment as typeof workspace);
      return order;
    };
    if (quote.converted_order_id) {
      const result = await orders.getById(quote.converted_order_id);
      if (result.error) throw new Error(result.error);
      return verify(result.data);
    }
    const amount = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total);
    const input = {
      quote_id: quote.id, customer_id: quote.customer_id, customer_name: quote.customer_name,
      customer_email: quote.customer_email, customer_phone: quote.customer_phone,
      service_type: quote.service_type, context: quote.context, scope: quote.scope,
      frequency: quote.frequency, analytics_session_id: quote.analytics_session_id ?? null,
      base_price: Number(quote.submitted_total ?? quote.total ?? amount), discount_percent: 0,
      final_price: amount, scheduled_date: null, scheduled_time: null, status: 'pending', notes: quote.notes,
    };
    let created = await orders.create(input);
    if (created.error?.includes('duplicate key')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const winner = await (client as any).from('orders').select('*').eq('quote_id', quote.id).single();
      created = { data: winner.data, error: winner.error?.message ?? null };
    }
    if (created.error) throw new Error(created.error);
    const order = verify(created.data);
    const updated = await quotes.update(quote.id, { converted_order_id: order.id });
    if (updated.error) throw new Error(updated.error);
    return order;
  });
}
