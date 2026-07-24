import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../supabase/migrations/20260722090000_151_payment_workspace_hardening.sql', import.meta.url), 'utf8');

describe('payment correlation migration', () => {
  it('normalizes immutable provider objects with global identity uniqueness', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.payment_provider_objects');
    expect(sql).toContain('payment_provider_objects_identity_unique UNIQUE (provider, object_type, object_id)');
    expect(sql).toContain('payment_provider_objects_payment_type_unique UNIQUE (payment_id, provider, object_type)');
    expect(sql).toContain('Provider object mapping cannot be rewritten');
    expect(sql).toContain('Provider object workspace mismatch');
  });

  it('creates pending payments and mappings with atomic insert-or-conflict semantics', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_or_get_pending_payment');
    expect(sql).toContain('idx_payments_provider_order_unique');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.attach_payment_provider_object');
    expect(sql.match(/ON CONFLICT/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps webhook replay identities in a separate retry-aware event ledger', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.payment_events');
    expect(sql).toContain('payment_events_provider_event_unique UNIQUE (provider, provider_event_id)');
    expect(sql).toContain("IF result.status = 'failed'");
    expect(sql).toContain("'claimed', claimed");
    expect(sql).toContain("status IN ('pending', 'processed', 'failed', 'quarantined')");
  });
});
