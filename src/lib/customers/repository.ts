/**
 * Customer-specific repository — composes the generic workspace primitive
 * (`createWorkspaceRepository`) instead of inheriting a universal CRUD API.
 * Every read is scoped to the bound workspace, every create is stamped with
 * it, and the exact filters/sort/pagination/metric formulas already used by
 * the Customers routes are preserved unchanged.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createWorkspaceRepository, WORKSPACE_COLUMN, type Workspace, type WorkspaceRepositoryOptions } from '@/lib/workspace/server';

type CustomerRow = Database['public']['Tables']['customers']['Row'];

export interface CustomerListParams {
  search?: string | null;
  limit?: number;
}

export interface CreateCustomerInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  company_name?: string | null;
  abn?: string | null;
  default_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CustomerStats {
  totalCustomers: number;
  activeThisMonth: number;
  avgOrderValue: number;
  totalRevenue: number;
}

export interface CustomerResult<T> {
  data: T;
  error: string | null;
}

export interface CustomerRepository {
  readonly workspace: Workspace;
  list(params?: CustomerListParams): Promise<CustomerResult<CustomerRow[]>>;
  getById(id: string): Promise<CustomerResult<CustomerRow | null>>;
  create(input: CreateCustomerInput): Promise<CustomerResult<CustomerRow | null>>;
  getStats(): Promise<CustomerResult<CustomerStats>>;
}

/**
 * Minimal, honest shape for "a query this module can scope and then await
 * directly to a row array/count". Independent of Supabase's generated
 * `Database` types (which don't model the `environment` column on any table
 * yet — the same pre-existing gap noted in `@/lib/workspace/repository`),
 * bridged with a single narrow cast at each query's construction site.
 */
interface ScopableQuery<R> {
  eq(column: typeof WORKSPACE_COLUMN, value: Workspace): ScopableQuery<R>;
  then<TResult>(
    onfulfilled: (value: { data: R[] | null; count: number | null; error: { message: string } | null }) => TResult
  ): PromiseLike<TResult>;
}

export function createCustomerRepository(options: WorkspaceRepositoryOptions = {}): CustomerRepository {
  const repo = createWorkspaceRepository('customers', options);
  const client: SupabaseClient<Database> = repo.client;

  return {
    workspace: repo.workspace,

    async list({ search, limit = 50 }: CustomerListParams = {}) {
      const base = client.from('customers').select('*').order('created_at', { ascending: false }).limit(limit);
      const filtered = search
        ? base.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
        : base;

      const { data, error } = await repo.scope(filtered as unknown as ScopableQuery<CustomerRow>);
      return { data: data ?? [], error: error?.message ?? null };
    },

    async getById(id: string) {
      const { data, error } = await repo.getById(id);
      return { data: data ?? null, error: error?.message ?? null };
    },

    async create(input: CreateCustomerInput) {
      const payload = repo.stamp(input);
      // `.insert()`'s generated overloads resolve to `never` against this
      // hand-written `Database` type regardless of what's passed in — it's
      // missing the `__InternalSupabase.PostgrestVersion` marker current
      // supabase-js expects, a pre-existing, codebase-wide gap unrelated to
      // workspace scoping (every other route's `.insert()` call already
      // works around it the same way). `payload` itself is correctly typed
      // and correctly stamped; only Postgrest's insert-overload resolution
      // is bypassed here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (client as any).from('customers').insert(payload).select().single();
      return { data: data ?? null, error: error?.message ?? null };
    },

    async getStats() {
      const { count: totalCustomers, error: totalError } = await repo.scope(
        client.from('customers').select('*', { count: 'exact', head: true }) as unknown as ScopableQuery<CustomerRow>
      );

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyOrders, error: monthlyError } = await repo.scope(
        client
          .from('orders')
          .select('customer_id')
          .gte('created_at', startOfMonth.toISOString())
          .not('customer_id', 'is', null) as unknown as ScopableQuery<{ customer_id: string }>
      );

      const { data: completedOrders, error: completedError } = await repo.scope(
        client.from('orders').select('final_price').eq('status', 'completed') as unknown as ScopableQuery<{
          final_price: number;
        }>
      );

      const uniqueCustomers = new Set((monthlyOrders ?? []).map((order) => order.customer_id));
      const totalRevenue = (completedOrders ?? []).reduce((sum, order) => sum + order.final_price, 0);
      const avgOrderValue = completedOrders && completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      return {
        data: {
          totalCustomers: totalCustomers ?? 0,
          activeThisMonth: uniqueCustomers.size,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
        },
        error: totalError?.message ?? monthlyError?.message ?? completedError?.message ?? null,
      };
    },
  };
}
