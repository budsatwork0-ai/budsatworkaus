/**
 * Canonical, isomorphic Workspace exports — safe to import from server or
 * client code, since it re-exports only plain types/constants/guards with
 * no runtime dependency on Node or React.
 *
 * For anything runtime-specific, use the dedicated entry point instead of
 * reaching into a file directly:
 *
 *   '@/lib/workspace/server'  — ambient context, query scoping, repositories
 *   '@/lib/workspace/client'  — React provider + useWorkspace()
 *
 * A single barrel re-exporting both would risk a client component
 * transitively importing Node's `async_hooks` through this file; keeping
 * this surface isomorphic-only avoids that regardless of what gets added
 * to either runtime-specific entry point later.
 */

export {
  WORKSPACES,
  LIVE_WORKSPACE,
  WORKSPACE_COLUMN,
  isWorkspace,
  assertValidWorkspace,
  type Workspace,
  type WorkspaceScoped,
} from './types';
