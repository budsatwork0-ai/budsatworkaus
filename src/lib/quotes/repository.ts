/**
 * Quote-specific repository — composes the generic workspace primitive
 * (`createWorkspaceRepository`) rather than a universal CRUD API. Every
 * *listing* read is scoped to the bound workspace; every create is stamped
 * with it. `getById`/`update` are deliberately id-keyed and NOT
 * workspace-scoped — see the note on `getById` below.
 *
 * The generated `Database` type for `quotes` is missing most of the columns
 * these routes already use (`source`, every `ndis_*` field, `environment`,
 * `is_test`, ...) — a pre-existing, unrelated gap, more severe here than on
 * `customers`. Every raw Supabase call in this file already worked around it
 * with the same `(client as any)` cast the original routes used before this
 * migration; this file does not introduce that gap, only preserves it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createWorkspaceRepository, WORKSPACE_COLUMN, type Workspace, type WorkspaceRepositoryOptions } from '@/lib/workspace/server';

export interface QuoteRow {
  id: string;
  status: string;
  payment_status: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string;
  context: string;
  scope: string | null;
  service_address: string | null;
  frequency: string;
  analytics_session_id: string | null;
  total: number;
  submitted_total: number;
  reviewed_total: number | null;
  notes: string | null;
  stripe_checkout_session_id: string | null;
  environment: string;
  converted_order_id: string | null;
  [key: string]: unknown;
}

export interface CreateQuoteInput {
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null | undefined;
  customer_phone: string | null | undefined;
  service_type: string;
  context: string;
  scope: string | null | undefined;
  frequency: string;
  analytics_session_id: string | null;
  total: number;
  submitted_total: number;
  reviewed_total: number | null;
  status: string;
  payment_status: string;
  service_address: string | null;
  notes: string | null;
  source: string;
  ndis_management_type: string | null;
  ndis_forward_contact: string | null;
  ndis_forward_email: string | null;
  ndis_estimated_hours: number | null;
  ndis_hourly_rate: number | null;
}

export interface QuoteListParams {
  /** Comma-separated status list, or 'all' — matches the current route's exact filter syntax. */
  status?: string | null;
  customerId?: string;
  limit?: number;
}

export interface QuoteResult<T> {
  data: T;
  error: string | null;
}

export interface QuoteRepository {
  readonly workspace: Workspace;
  list(params?: QuoteListParams): Promise<QuoteResult<QuoteRow[]>>;
  listOrphanedByEmail(email: string, limit?: number): Promise<QuoteResult<QuoteRow[]>>;
  /**
   * Finds a quote by id with no workspace scoping applied. Quote detail/
   * action routes are id-first — the UUID functions like a bearer token —
   * so the workspace is a property *of* the fetched record, discovered from
   * it, not something the caller selects in advance (there's no `?workspace=`
   * step before "click this quote row"). Callers must read `data.environment`
   * themselves and apply workspace-aware authorization; see
   * `canAccessQuote` in src/app/api/quotes/[id]/route.ts.
   */
  getById(id: string): Promise<QuoteResult<QuoteRow | null>>;
  create(input: CreateQuoteInput): Promise<QuoteResult<QuoteRow | null>>;
  /** Updates by id only — no workspace re-check, since `id` already uniquely identifies the row. */
  update(id: string, patch: Record<string, unknown>): Promise<QuoteResult<QuoteRow | null>>;
}

interface ScopableQuery<R> {
  eq(column: typeof WORKSPACE_COLUMN, value: Workspace): ScopableQuery<R>;
  then<TResult>(
    onfulfilled: (value: { data: R[] | null; error: { message: string } | null }) => TResult
  ): PromiseLike<TResult>;
}

export function createQuoteRepository(options: WorkspaceRepositoryOptions = {}): QuoteRepository {
  const repo = createWorkspaceRepository('quotes', options);
  const client: SupabaseClient<Database> = repo.client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  return {
    workspace: repo.workspace,

    async list({ status, customerId, limit = 50 }: QuoteListParams = {}) {
      let query = db.from('quotes').select('*').order('created_at', { ascending: false }).limit(limit);

      if (status && status !== 'all') {
        const statuses = status
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (statuses.length > 1) query = query.in('status', statuses);
        else if (statuses.length === 1) query = query.eq('status', statuses[0]);
      }

      if (customerId) query = query.eq('customer_id', customerId);

      const { data, error } = await repo.scope(query as unknown as ScopableQuery<QuoteRow>);
      return { data: data ?? [], error: error?.message ?? null };
    },

    async listOrphanedByEmail(email: string, limit = 50) {
      const query = db
        .from('quotes')
        .select('*')
        .ilike('customer_email', email)
        .is('customer_id', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data, error } = await repo.scope(query as unknown as ScopableQuery<QuoteRow>);
      return { data: data ?? [], error: error?.message ?? null };
    },

    async getById(id: string) {
      const { data, error } = await db.from('quotes').select('*').eq('id', id).single();
      return { data: data ?? null, error: error?.message ?? null };
    },

    async create(input: CreateQuoteInput) {
      const payload = repo.stamp(input);
      const { data, error } = await db.from('quotes').insert(payload).select().single();
      return { data: data ?? null, error: error?.message ?? null };
    },

    async update(id: string, patch: Record<string, unknown>) {
      const { data, error } = await db.from('quotes').update(patch).eq('id', id).select().single();
      return { data: data ?? null, error: error?.message ?? null };
    },
  };
}
