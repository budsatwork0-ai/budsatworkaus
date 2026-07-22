import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createPaymentRepository } from '@/lib/payments/repository';

function makeClient() {
  const events = new Map<string, Record<string, unknown>>();
  let lock = Promise.resolve();
  let sequence = 0;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const previous = lock;
    let release = () => {};
    lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (name === 'claim_payment_event') {
        const key = `${args.event_provider}:${args.event_provider_id}`;
        let event = events.get(key);
        let claimed = false;
        if (!event) {
          event = { id: `event-${++sequence}`, payment_id: null, environment: null, provider: args.event_provider, provider_event_id: args.event_provider_id, event_type: args.event_type_value, status: 'pending', failure_reason: null };
          events.set(key, event);
          claimed = true;
        } else if (event.status === 'failed') {
          event.status = 'pending'; event.failure_reason = null;
          claimed = true;
        }
        return { data: { event: { ...event }, claimed }, error: null };
      }
      if (name === 'finish_payment_event') {
        const event = [...events.values()].find((candidate) => candidate.id === args.event_row_id);
        if (!event) return { data: null, error: { message: 'missing event' } };
        if (event.status === 'quarantined') return { data: { ...event }, error: null };
        event.status = args.event_status; event.payment_id = args.resolved_payment_id;
        event.environment = args.resolved_payment_id ? 'production' : null;
        event.failure_reason = args.event_failure_reason;
        return { data: { ...event }, error: null };
      }
      return { data: null, error: { message: 'unexpected rpc' } };
    } finally { release(); }
  };
  return { client: { rpc } as unknown as SupabaseClient<Database>, events };
}

describe('payment event repository', () => {
  it('atomically converges duplicate and concurrent claims', async () => {
    const state = makeClient();
    const repository = createPaymentRepository(state.client, 'production');
    const input = { provider: 'stripe' as const, eventId: 'evt_1', eventType: 'payment_intent.succeeded', objectType: 'payment_intent', objectId: 'pi_1' };
    const [first, second] = await Promise.all([repository.claimEvent(input), repository.claimEvent(input)]);
    expect(first.event.id).toBe(second.event.id);
    expect([first.claimed, second.claimed].sort()).toEqual([false, true]);
    expect(state.events.size).toBe(1);
  });

  it('reopens failed events but leaves quarantined events terminal', async () => {
    const state = makeClient();
    const repository = createPaymentRepository(state.client, 'production');
    const input = { provider: 'stripe' as const, eventId: 'evt_retry', eventType: 'payment_intent.succeeded' };
    const claimed = await repository.claimEvent(input);
    await repository.finishEvent(claimed.event.id, 'failed', null, 'temporary database failure');
    await expect(repository.claimEvent(input)).resolves.toMatchObject({ claimed: true, event: { status: 'pending', failure_reason: null } });
    await repository.finishEvent(claimed.event.id, 'quarantined', null, 'ownership mismatch');
    await expect(repository.claimEvent(input)).resolves.toMatchObject({ claimed: false, event: { status: 'quarantined' } });
  });

  it('keeps provider mappings and event identifiers independent', async () => {
    const state = makeClient();
    const repository = createPaymentRepository(state.client, 'production');
    await repository.claimEvent({ provider: 'stripe', eventId: 'evt_1', eventType: 'checkout.session.completed', objectType: 'checkout_session', objectId: 'cs_1' });
    expect([...state.events.values()][0]).toMatchObject({ provider_event_id: 'evt_1' });
    expect([...state.events.values()][0]).not.toHaveProperty('object_id', 'evt_1');
  });
});
