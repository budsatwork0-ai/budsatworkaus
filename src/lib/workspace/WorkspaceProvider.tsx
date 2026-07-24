'use client';

/**
 * Client-side workspace propagation.
 *
 * This is the browser-runtime counterpart to `./context`'s server-side
 * AsyncLocalStorage — the two exist separately because ALS cannot cross the
 * server/client boundary; a React Context is the client equivalent of the
 * same "ambient value" idea.
 *
 * This file imports nothing beyond `./types` and React. It must stay that
 * way: no `./context`, `./query`, or `./repository` import, ever, since
 * those pull in Node's `async_hooks` and a Supabase server client.
 */

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { LIVE_WORKSPACE, type Workspace } from './types';

export interface WorkspaceContextValue {
  workspace: Workspace;
  isLive: boolean;
}

const WorkspaceReactContext = createContext<WorkspaceContextValue | null>(null);

export interface WorkspaceProviderProps {
  /**
   * The active workspace. Must be resolved server-side (see
   * `resolveWorkspaceFromRequest` in `@/lib/workspace/server`) and passed in
   * as a prop — this component never reads URL parameters, cookies, or
   * fetches workspace state itself. It only propagates a value it's given.
   */
  workspace: Workspace;
  children: ReactNode;
}

// Written with createElement rather than JSX: this module must stay parseable
// as-is by any consumer (including the plain-`.ts` vitest pipeline this repo
// uses, which has no JSX transform configured for tooling other than Next.js
// itself), and a two-line wrapper component doesn't need JSX sugar to stay readable.
export function WorkspaceProvider({ workspace, children }: WorkspaceProviderProps) {
  const value: WorkspaceContextValue = { workspace, isLive: workspace === LIVE_WORKSPACE };
  return createElement(WorkspaceReactContext.Provider, { value }, children);
}

/**
 * Reads the active workspace in a client component. Throws when called
 * outside a `<WorkspaceProvider>` rather than silently defaulting — for a
 * value that gates live-vs-sandbox behaviour, a missing provider is a bug
 * that should fail loudly in development, not fall back quietly. (The only
 * existing context in this codebase, `MotionContext`, defaults instead of
 * throwing, but it gates a cosmetic preference; that precedent doesn't
 * extend to a value this safety-sensitive.)
 */
export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceReactContext);
  if (!value) {
    throw new Error('useWorkspace() must be called within a <WorkspaceProvider>.');
  }
  return value;
}
