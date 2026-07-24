/**
 * Server-only workspace context.
 *
 * This is the "central place responsible for determining current workspace"
 * for server-side code: an AsyncLocalStorage-backed ambient context so a
 * repository deep inside a call stack can read the active workspace without
 * every intermediate function threading it through as a parameter.
 *
 * Do not import this file (or anything that re-exports it) from a client
 * component. Client components must import from '@/lib/workspace/client'
 * instead, which never pulls in Node's `async_hooks`.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    '@/lib/workspace/context was loaded in a browser bundle. This module is server-only ' +
      '(it uses node:async_hooks); client components must import from "@/lib/workspace/client" instead.'
  );
}

import { AsyncLocalStorage } from 'node:async_hooks';
import { LIVE_WORKSPACE, assertValidWorkspace, isWorkspace, type Workspace } from './types';

const workspaceStorage = new AsyncLocalStorage<Workspace>();

/**
 * Runs `fn` with `workspace` as the ambient workspace for the duration of the
 * call, including across any awaited async work started inside it. Nested
 * calls to `currentWorkspace()` anywhere in that call tree see this value.
 */
export function withWorkspaceContext<T>(workspace: Workspace, fn: () => T): T {
  assertValidWorkspace(workspace);
  return workspaceStorage.run(workspace, fn);
}

/**
 * Reads the ambient workspace. Outside of any `withWorkspaceContext` call
 * (or once execution has left it), this safely defaults to the live
 * workspace — it is never implicitly sandbox.
 */
export function currentWorkspace(): Workspace {
  return workspaceStorage.getStore() ?? LIVE_WORKSPACE;
}

export function isLiveWorkspace(workspace: Workspace = currentWorkspace()): boolean {
  return workspace === LIVE_WORKSPACE;
}

/**
 * Resolves a workspace from an incoming request's query parameters.
 *
 * This validates the *shape* of the value only — it maps an untrusted,
 * possibly-missing string to a known-good `Workspace`, defaulting to the
 * live workspace for anything invalid or absent. It deliberately does not
 * decide whether the caller is *allowed* to view sandbox data; that is a
 * separate, not-yet-built authorization concern that must wrap this
 * function's result before sandbox is ever actually granted.
 */
export function resolveWorkspaceFromRequest(
  searchParams: URLSearchParams,
  paramName = 'workspace'
): Workspace {
  const raw = searchParams.get(paramName);
  return isWorkspace(raw) ? raw : LIVE_WORKSPACE;
}

/**
 * Resolves a workspace from request parameters *and* applies the one
 * authorization rule every entity slice needs: a non-live workspace only
 * takes effect when `isAuthorizedForSandbox` is true. Anyone else — like an
 * invalid/missing value — is held to the live workspace.
 *
 * Deliberately takes a plain boolean rather than an app-specific role type:
 * this module stays decoupled from any particular auth system. Callers
 * (e.g. `src/lib/customers/workspace.ts`, `src/lib/quotes/workspace.ts`)
 * compute that boolean from their own role check (typically `role === 'admin'`)
 * and pass it in — this function only encodes "selection vs. authorization
 * are separate, and authorization wins."
 */
export function resolveGatedWorkspaceFromRequest(
  searchParams: URLSearchParams,
  isAuthorizedForSandbox: boolean,
  paramName = 'workspace'
): Workspace {
  const requested = resolveWorkspaceFromRequest(searchParams, paramName);
  if (requested === LIVE_WORKSPACE) return requested;
  return isAuthorizedForSandbox ? requested : LIVE_WORKSPACE;
}
