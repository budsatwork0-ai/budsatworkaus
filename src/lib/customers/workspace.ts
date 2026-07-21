/**
 * Authorization glue between this app's role system and the generic
 * workspace foundation (`@/lib/workspace/server`).
 *
 * Deliberately app-specific: `@/lib/workspace` stays decoupled from any
 * particular auth system, so the "who may request sandbox" rule lives here,
 * next to the Customers routes that need it, not inside the generic module.
 */

import { LIVE_WORKSPACE, resolveWorkspaceFromRequest, type Workspace } from '@/lib/workspace/server';
import type { UserRole } from '@/types/roles';

/**
 * Resolves the workspace a Customers request may operate in.
 *
 * A `workspace=sandbox` query parameter only takes effect for an admin —
 * anyone else is held to the live workspace, exactly like an invalid or
 * missing value already is. This reuses the admin-only gate already used
 * throughout the API (`role !== 'admin'`, e.g. src/app/api/quotes/[id]/route.ts)
 * rather than inventing a new authorization concept.
 */
export function resolveCustomerWorkspace(searchParams: URLSearchParams, role: UserRole): Workspace {
  const requested = resolveWorkspaceFromRequest(searchParams);
  if (requested === LIVE_WORKSPACE) return requested;
  return role === 'admin' ? requested : LIVE_WORKSPACE;
}
