/**
 * Shared workspace-aware query vocabulary: scoping reads, stamping writes,
 * and asserting that two records belong to the same workspace.
 *
 * These are the only functions allowed to know that "workspace scoping"
 * means `.eq('environment', workspace)` under the hood. Everything above
 * this file — repositories, routes, pages, agents — calls these instead of
 * writing that filter itself.
 *
 * This module transitively imports the server-only ambient context
 * (`./context`) for its default-parameter behaviour, so it is server-only
 * too. Do not import it from a client component.
 */

import { currentWorkspace } from './context';
import { assertValidWorkspace, WORKSPACE_COLUMN, type Workspace, type WorkspaceScoped } from './types';

/**
 * Structural contract for "a query builder that can be filtered down to a
 * single workspace". Deliberately independent of Supabase's generated
 * `Database` types (which do not yet model the `environment` column on any
 * table — a pre-existing gap, not something this module papers over) so
 * that `scopeQuery` has one precise, honest contract regardless of how
 * complete the generated types are for a given table.
 */
export interface WorkspaceScopable<Self> {
  eq(column: typeof WORKSPACE_COLUMN, value: Workspace): Self;
}

/**
 * Applies workspace scoping to a query builder. Defaults to the ambient
 * workspace so callers inside a `withWorkspaceContext` block never need to
 * pass one explicitly.
 */
export function scopeQuery<Q extends WorkspaceScopable<Q>>(
  query: Q,
  workspace: Workspace = currentWorkspace()
): Q {
  assertValidWorkspace(workspace);
  return query.eq(WORKSPACE_COLUMN, workspace);
}

/**
 * Stamps a record with its workspace ahead of an insert. Any `environment`
 * value already present on `record` is discarded first, so a caller cannot
 * accidentally (or maliciously) smuggle in a conflicting workspace by
 * setting the field themselves — the ambient/explicit workspace always
 * wins, unconditionally.
 *
 * Constrained to `object` rather than `Record<string, unknown>` deliberately:
 * a named interface (e.g. an entity repository's `CreateXInput`) has no
 * index signature and isn't assignable to `Record<string, unknown>`, even
 * though every property matches — only fresh object-literal types get that
 * leniency from TypeScript. `object` accepts both.
 */
export function stampWorkspace<R extends object>(
  record: R,
  workspace: Workspace = currentWorkspace()
): Omit<R, typeof WORKSPACE_COLUMN> & WorkspaceScoped {
  assertValidWorkspace(workspace);
  const { [WORKSPACE_COLUMN]: _discardedExistingWorkspace, ...rest } = record as Record<string, unknown>;
  return { ...rest, [WORKSPACE_COLUMN]: workspace } as Omit<R, typeof WORKSPACE_COLUMN> & WorkspaceScoped;
}

export class WorkspaceMismatchError extends Error {
  constructor(
    public readonly a: Workspace,
    public readonly b: Workspace
  ) {
    super(`Workspace mismatch: "${a}" is not compatible with "${b}".`);
    this.name = 'WorkspaceMismatchError';
  }
}

function extractWorkspace(value: Workspace | WorkspaceScoped): Workspace {
  return typeof value === 'string' ? value : value[WORKSPACE_COLUMN];
}

/**
 * Throws a `WorkspaceMismatchError` unless both inputs resolve to the same
 * workspace. Accepts either a raw `Workspace` value or anything shaped like
 * a workspace-scoped DB row, so it can compare two records directly
 * (e.g. a quote and the customer it's about to be linked to).
 */
export function assertWorkspaceCompatibility(
  a: Workspace | WorkspaceScoped,
  b: Workspace | WorkspaceScoped
): void {
  const workspaceA = extractWorkspace(a);
  const workspaceB = extractWorkspace(b);
  assertValidWorkspace(workspaceA);
  assertValidWorkspace(workspaceB);
  if (workspaceA !== workspaceB) {
    throw new WorkspaceMismatchError(workspaceA, workspaceB);
  }
}
