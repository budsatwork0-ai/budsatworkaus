import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260722090000_151_payment_workspace_hardening.sql', import.meta.url),
  'utf8'
);
const fanoutMigration = readFileSync(
  new URL('../../supabase/migrations/20260722100000_152_refund_event_fanout.sql', import.meta.url),
  'utf8'
);

describe('payment refund ledger migration', () => {
  it('creates an append-only refund ledger with durable provider replay keys', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.payment_refunds');
    expect(migration).toContain('payment_refunds_provider_refund_unique UNIQUE (provider, provider_refund_reference)');
    expect(migration).toContain('idx_payment_refunds_provider_event_unique');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.payment_refund_events');
    expect(migration).toContain('payment_refund_events_provider_event_unique UNIQUE (provider, provider_event_reference)');
    expect(migration).toContain('Refund event replay conflicts with another durable refund');
    expect(migration).toContain('Refund financial identity cannot be rewritten');
    expect(migration).toContain('ON DELETE RESTRICT');
  });

  it('allows one charge delivery to describe multiple durable refunds', () => {
    expect(fanoutMigration).toContain('payment_refund_events_refund_event_unique');
    expect(fanoutMigration).toContain('UNIQUE (payment_refund_id, provider, provider_event_reference)');
    expect(fanoutMigration).toContain('DROP INDEX IF EXISTS public.idx_payment_refunds_provider_event_unique');
  });

  it('adds atomic parent transitions and payment-scoped customer association', () => {
    expect(fanoutMigration).toContain('CREATE OR REPLACE FUNCTION public.transition_operational_payment');
    expect(fanoutMigration).toContain('CREATE OR REPLACE FUNCTION public.expire_operational_checkout');
    expect(fanoutMigration).toContain('CREATE OR REPLACE FUNCTION public.apply_refund_parent_state');
    expect(fanoutMigration).toContain('CREATE OR REPLACE FUNCTION public.attach_payment_stripe_customer');
    expect(fanoutMigration).toContain("payment.status NOT IN ('completed', 'partial_refund', 'refunded', 'failed')");
  });

  it('serializes refunds on the captured payment and fails closed on incompatibility', () => {
    expect(migration).toMatch(/FROM public\.payments\s+WHERE id = refund_payment_id\s+FOR UPDATE/);
    expect(migration).toContain('Payment workspace mismatch');
    expect(migration).toContain('Refund provider mismatch');
    expect(migration).toContain('Refund currency mismatch');
    expect(migration).toContain('Cumulative successful refunds exceed captured payment amount');
  });

  it('uses atomic conflict handling and derives partial and full refund states', () => {
    expect(migration).toContain('ON CONFLICT DO NOTHING');
    expect(migration).toContain("WHEN total_succeeded = captured.amount THEN 'refunded'");
    expect(migration).toContain("WHEN total_succeeded > 0 THEN 'partial_refund'");
    expect(migration).not.toMatch(/SET\s+provider_event_id\s*=/);
  });
});
