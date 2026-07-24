/**
 * Authorization glue between this app's role system and the generic
 * workspace foundation, for the Orders slice. Shares its core logic with
 * `src/lib/customers/workspace.ts` and `src/lib/quotes/workspace.ts` via
 * `resolveGatedWorkspaceFromRequest` — see that function's doc comment for
 * why the shared piece lives in the generic `@/lib/workspace` module as a
 * boolean-gated primitive rather than importing the app's role type there.
 */

import { isWorkspace, LIVE_WORKSPACE, resolveGatedWorkspaceFromRequest, type Workspace } from '@/lib/workspace/server';
import type { UserRole } from '@/types/roles';

/**
 * Resolves the workspace an Orders collection request (GET/POST /api/orders)
 * may operate in. Order creation is always authenticated (admin/employee
 * only — the customer check happens separately in the POST route), but this
 * still treats a null role the same as any non-admin: sandbox is never
 * granted.
 */
export function resolveOrderWorkspace(searchParams: URLSearchParams, role: UserRole | null): Workspace {
  return resolveGatedWorkspaceFromRequest(searchParams, role === 'admin');
}

/**
 * Derives the workspace a specific, already-fetched record belongs to.
 *
 * Deliberately generic over any row carrying an `environment` column — not
 * order-specific — the same way `quoteWorkspace` is already reused for
 * `leads`/`orders` rows in the Quotes slice. This lets order creation reuse
 * it to discover the workspace of a related quote or customer row when
 * validating cross-entity compatibility, without duplicating the identical
 * "read environment, fall back to production" logic per entity.
 *
 * Anything not a recognised workspace value falls back to the live
 * workspace — the safe default is always production, never an ambiguous/
 * sandbox assumption.
 */
export function orderWorkspace(record: { environment?: unknown }): Workspace {
  return isWorkspace(record.environment) ? record.environment : LIVE_WORKSPACE;
}

/**
 * Whether `role` may access an order already known to be in `workspace` —
 * the id-first counterpart to the admin-only sandbox gate applied to list/
 * create requests. Production orders are unaffected; only sandbox access is
 * restricted.
 */
export function isAuthorizedForOrderWorkspace(workspace: Workspace, role: UserRole | null): boolean {
  return workspace === LIVE_WORKSPACE || role === 'admin';
}
