/**
 * Order-specific repository — composes the generic workspace primitive
 * (`createWorkspaceRepository`) rather than a universal CRUD abstraction.
 * `list()` is scoped to the bound workspace; `create()` is stamped with it.
 * `getById()`/`update()` are deliberately id-keyed and NOT workspace-scoped
 * — see the note on `getById` below.
 *
 * The generated `Database` type for `orders` does not model the
 * `environment` column (the same pre-existing gap already noted in
 * `src/lib/quotes/repository.ts` and `src/lib/customers/repository.ts`).
 * Every raw Supabase call in this file works around it with the same
 * `(client as any)` cast the original routes already used before this
 * migration; this file does not introduce that gap, only preserves it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createWorkspaceRepository, WORKSPACE_COLUMN, type Workspace, type WorkspaceRepositoryOptions } from '@/lib/workspace/server';

export interface OrderRow {
  id: string;
  quote_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string;
  context: string;
  scope: string | null;
  frequency: string;
  analytics_session_id: string | null;
  base_price: number;
  discount_percent: number;
  final_price: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  assigned_crew_id: string | null;
  day_before_reminder_sent: boolean | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  auto_completed_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  environment: string;
  [key: string]: unknown;
}

export interface CreateOrderInput {
  quote_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string;
  context: string;
  scope: string | null;
  frequency: string;
  analytics_session_id: string | null;
  base_price: number;
  discount_percent: number;
  final_price: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  notes: string | null;
}

export interface OrderListParams {
  status?: string | null;
  serviceType?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  unscheduled?: boolean;
  customerId?: string;
  limit?: number;
  offset?: number;
}

export interface OrderResult<T> {
  data: T;
  error: string | null;
}

export interface OrderListResult<T> extends OrderResult<T> {
  count: number | null;
}

export interface OrderRepository {
  readonly workspace: Workspace;
  list(params?: OrderListParams): Promise<OrderListResult<OrderRow[]>>;
  /**
   * Finds an order by id with no workspace scoping applied. Order detail/
   * action routes ([id], assign, remind-day-before, by-session) are
   * id-first — the UUID (or Stripe session id) functions like a bearer
   * token — so the workspace is a property *of* the fetched record,
   * discovered from it, not something the caller selects in advance.
   * Callers must read `data.environment` themselves (via `orderWorkspace`)
   * and apply workspace-aware authorization before exposing anything from
   * the returned row or performing a side effect.
   */
  getById(id: string): Promise<OrderResult<OrderRow | null>>;
  create(input: CreateOrderInput): Promise<OrderResult<OrderRow | null>>;
  /** Updates by id only — no workspace re-check, since `id` already uniquely identifies the row. */
  update(id: string, patch: Record<string, unknown>): Promise<OrderResult<OrderRow | null>>;
}

interface ScopableQuery<R> {
  eq(column: typeof WORKSPACE_COLUMN, value: Workspace): ScopableQuery<R>;
  then<TResult>(
    onfulfilled: (value: { data: R[] | null; count: number | null; error: { message: string } | null }) => TResult
  ): PromiseLike<TResult>;
}

export function createOrderRepository(options: WorkspaceRepositoryOptions = {}): OrderRepository {
  const repo = createWorkspaceRepository('orders', options);
  const client: SupabaseClient<Database> = repo.client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  return {
    workspace: repo.workspace,

    async list({
      status,
      serviceType,
      search,
      dateFrom,
      dateTo,
      unscheduled,
      customerId,
      limit = 100,
      offset = 0,
    }: OrderListParams = {}) {
      let query = db
        .from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Preserves the exact filter semantics of the original route: an
      // unscheduled query replaces the status/date-range filters entirely
      // rather than combining with them.
      if (unscheduled) {
        query = query.is('scheduled_date', null).not('status', 'in', '("cancelled","completed")');
      } else {
        if (status && status !== 'all') query = query.eq('status', status);
        if (dateFrom) query = query.gte('scheduled_date', dateFrom);
        if (dateTo) query = query.lte('scheduled_date', dateTo);
      }

      if (serviceType && serviceType !== 'all') query = query.eq('service_type', serviceType);
      if (search) query = query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data, count, error } = await repo.scope(query as unknown as ScopableQuery<OrderRow>);
      return { data: data ?? [], count: count ?? null, error: error?.message ?? null };
    },

    async getById(id: string) {
      const { data, error } = await db.from('orders').select('*').eq('id', id).single();
      return { data: data ?? null, error: error?.message ?? null };
    },

    async create(input: CreateOrderInput) {
      const payload = repo.stamp(input);
      const { data, error } = await db.from('orders').insert(payload).select().single();
      return { data: data ?? null, error: error?.message ?? null };
    },

    async update(id: string, patch: Record<string, unknown>) {
      const { data, error } = await db.from('orders').update(patch).eq('id', id).select().single();
      return { data: data ?? null, error: error?.message ?? null };
    },
  };
}
