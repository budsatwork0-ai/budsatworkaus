/**
 * Small workspace-aware repository primitive.
 *
 * This is deliberately NOT a generic CRUD framework. Customers, quotes,
 * orders and leads will each need different selections, joins, filters,
 * sorting, pagination, permissions, write validation and lifecycle actions
 * — modelling that generically here would force them into a shape that
 * doesn't fit all of them.
 *
 * Instead, `createWorkspaceRepository` guarantees only the cross-cutting
 * behaviour that must never be forgotten: a bound Supabase client, a bound
 * workspace, a `scope()` escape hatch for read filtering, and a `stamp()`
 * escape hatch for write stamping. A future entity repository composes
 * this rather than inheriting from it:
 *
 *   function createCustomerRepository(options?: WorkspaceRepositoryOptions) {
 *     const repo = createWorkspaceRepository('customers', options);
 *     return {
 *       async listBySuburb(suburb: string) {
 *         const query = repo.client.from('customers').select('*').eq('suburb', suburb);
 *         return repo.scope(query); // still has to opt in, but can't get the column name wrong
 *       },
 *       async create(input: NewCustomerInput) {
 *         return repo.client.from('customers').insert(repo.stamp(input)).select().single();
 *       },
 *     };
 *   }
 *
 * No entity repositories are built in this commit — this file only proves
 * the primitive works and gives future ones something to compose.
 */

import type { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { currentWorkspace } from './context';
import { scopeQuery, stampWorkspace, type WorkspaceScopable } from './query';
import { WORKSPACE_COLUMN, type Workspace } from './types';

type TableName = keyof Database['public']['Tables'];
type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

export interface WorkspaceRepositoryOptions {
  /** Inject a client (e.g. a test double). Defaults to `createServiceClientSafe()`. */
  client?: SupabaseClient<Database>;
  /** Bind to an explicit workspace instead of the ambient one. */
  workspace?: Workspace;
}

export interface WorkspaceRepository<T extends TableName> {
  readonly table: T;
  readonly client: SupabaseClient<Database>;
  /** The workspace this repository instance is bound to — resolved once at creation, not re-read per call. */
  readonly workspace: Workspace;
  /** Escape hatch: apply this repository's workspace scoping to any query built against `client`. */
  scope<Q extends WorkspaceScopable<Q>>(query: Q): Q;
  /** Escape hatch: stamp any insert payload with this repository's workspace, overriding any existing value. */
  stamp<R extends object>(record: R): ReturnType<typeof stampWorkspace<R>>;
  /** Convenience read for the common case of "one row by id, scoped to this workspace". Assumes an `id` primary key. */
  getById(id: string, columns?: string): Promise<PostgrestSingleResponse<Row<T>>>;
}

/**
 * Query shape needed for `getById`: id-filterable, workspace-scopable, and
 * awaitable to a single row. Supabase's generated `Database` type does not
 * yet model the `environment` column on any table (a pre-existing gap noted
 * in the workspace-context investigation, not introduced here), and a
 * runtime `columns` string also collapses Supabase's own result-type
 * inference. Rather than fight either of those with `any`, the real query
 * builder is bridged into this narrower, honest shape at the one spot this
 * module needs it — nothing else in this file loosens its typing.
 */
interface IdScopedQuery<R> {
  eq(column: typeof WORKSPACE_COLUMN, value: Workspace): IdScopedQuery<R>;
  eq(column: 'id', value: string): IdScopedQuery<R>;
  maybeSingle(): PromiseLike<PostgrestSingleResponse<R>>;
}

/**
 * Creates a workspace-bound repository handle for `table`.
 *
 * Call this fresh within the resolved workspace context (e.g. once per
 * request, after `withWorkspaceContext` has been entered) rather than
 * caching a single instance across requests — the workspace is bound at
 * creation time, not re-resolved on every call.
 */
export function createWorkspaceRepository<T extends TableName>(
  table: T,
  options: WorkspaceRepositoryOptions = {}
): WorkspaceRepository<T> {
  const client = options.client ?? createServiceClientSafe();
  if (!client) {
    throw new Error(
      `createWorkspaceRepository("${String(table)}"): Supabase service client is unavailable. ` +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, or pass an explicit client.'
    );
  }
  const workspace = options.workspace ?? currentWorkspace();

  return {
    table,
    client,
    workspace,
    scope(query) {
      return scopeQuery(query, workspace);
    },
    stamp(record) {
      return stampWorkspace(record, workspace);
    },
    async getById(id, columns = '*') {
      const query = client.from(table).select(columns) as unknown as IdScopedQuery<Row<T>>;
      return scopeQuery(query.eq('id', id), workspace).maybeSingle();
    },
  };
}
