/**
 * Client-safe workspace entry point.
 *
 * Import from here in client components ('use client'). This never pulls
 * in Node's `async_hooks` or a Supabase server client — only the provider,
 * the hook, and the plain-data workspace vocabulary from `./types`.
 */

export { WorkspaceProvider, useWorkspace, type WorkspaceContextValue, type WorkspaceProviderProps } from './WorkspaceProvider';
export { WORKSPACES, LIVE_WORKSPACE, WORKSPACE_COLUMN, isWorkspace, type Workspace } from './types';
