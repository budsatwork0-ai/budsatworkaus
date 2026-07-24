/**
 * Canonical Workspace vocabulary.
 *
 * The database column backing this concept is still named `environment`
 * (see supabase/migrations 128-135) and its CHECK constraint currently only
 * accepts 'production' | 'sandbox'. This file is the single seam between
 * that column and the rest of the application: everywhere else speaks
 * `Workspace`, never the raw column name.
 *
 * Adding a new workspace (e.g. 'demo') is intentionally a two-step,
 * type-visible change: extend `WORKSPACES` here *and* extend the database
 * CHECK constraint in a migration. Nothing here pre-declares unsupported
 * values — the architecture stays extensible because the mapping and
 * validation are centralized, not because the type union is padded ahead
 * of runtime/schema support.
 */

/** Runtime-supported workspace identifiers, in sync with the DB CHECK constraint. */
export const WORKSPACES = ['production', 'sandbox'] as const;

export type Workspace = (typeof WORKSPACES)[number];

/** The one workspace the rest of the app treats as "real". Never compare against the string literal directly. */
export const LIVE_WORKSPACE: Workspace = 'production';

/** The database column every workspace-scoped table stores this value in. */
export const WORKSPACE_COLUMN = 'environment' as const;

/** Type guard — use this instead of re-deriving the supported-values check elsewhere. */
export function isWorkspace(value: unknown): value is Workspace {
  return typeof value === 'string' && (WORKSPACES as readonly string[]).includes(value);
}

/** Throws if `value` is not a supported workspace. Narrows to `Workspace` on return. */
export function assertValidWorkspace(value: unknown): asserts value is Workspace {
  if (!isWorkspace(value)) {
    throw new Error(
      `Invalid workspace: ${JSON.stringify(value)}. Supported workspaces: ${WORKSPACES.join(', ')}.`
    );
  }
}

/** Structural shape of any record/row that carries a workspace value under the DB column name. */
export interface WorkspaceScoped {
  readonly [WORKSPACE_COLUMN]: Workspace;
}
