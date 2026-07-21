/**
 * Authorization glue between this app's role system and the generic
 * workspace foundation, for the Quotes slice. Shares its core logic with
 * `src/lib/customers/workspace.ts` via `resolveGatedWorkspaceFromRequest` —
 * see that function's doc comment for why the shared piece lives in the
 * generic `@/lib/workspace` module as a boolean-gated primitive rather than
 * importing the app's role type there.
 */

import { isWorkspace, LIVE_WORKSPACE, resolveGatedWorkspaceFromRequest, type Workspace } from '@/lib/workspace/server';
import type { UserRole } from '@/types/roles';

/**
 * Resolves the workspace a Quotes request may operate in.
 *
 * Unlike Customers, quote creation can be fully anonymous (public quote
 * submissions have no `authUser` at all) — `role` is `null` in that case,
 * which this treats the same as any non-admin: sandbox is never granted,
 * regardless of what the request asks for.
 */
export function resolveQuoteWorkspace(searchParams: URLSearchParams, role: UserRole | null): Workspace {
  return resolveGatedWorkspaceFromRequest(searchParams, role === 'admin');
}

/**
 * Derives the workspace a specific, already-fetched quote belongs to.
 *
 * Quote detail/action routes ([id], checkout, remind) are id-first — the
 * UUID functions like a bearer token, and there's no `?workspace=` request
 * param to resolve for them. The workspace is a property *of* the record,
 * discovered after the fact, not selected in advance. Anything not a
 * recognised workspace value (e.g. a row that predates the `environment`
 * column) falls back to the live workspace — the safe default is always
 * production, never an ambiguous/sandbox assumption.
 */
export function quoteWorkspace(quote: { environment?: unknown }): Workspace {
  return isWorkspace(quote.environment) ? quote.environment : LIVE_WORKSPACE;
}

/**
 * Whether `role` may access a quote already known to be in `workspace` —
 * the id-first counterpart to the admin-only sandbox gate applied to list/
 * create requests. Production quotes are unaffected; only sandbox access is
 * restricted.
 */
export function isAuthorizedForQuoteWorkspace(workspace: Workspace, role: UserRole | null): boolean {
  return workspace === LIVE_WORKSPACE || role === 'admin';
}
