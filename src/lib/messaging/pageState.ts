// src/lib/messaging/pageState.ts
// Pure state-decision helpers for the full-page /dashboard/messages route.
//
// These exist to make the "why doesn't Opening messages… ever go away" bug
// class impossible by construction: the loading view is derived from ONE
// signal (whether the conversation list request has settled) and nothing
// else. Selecting/deselecting a conversation, opening a thread, or any
// future async addition (e.g. realtime) cannot re-enter or extend the
// "opening" view once the list request has resolved.

export type ConversationsListStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type MessagesPageView = 'opening' | 'error' | 'ready';

/**
 * The full-page view is "opening" only while the conversation list request
 * is in flight (or hasn't started yet). Once it settles — success or
 * failure — the view moves on permanently. Whether a conversation is
 * selected, whether the list is empty, or how a thread request is doing
 * never factors in: those are rendered *within* the "ready" view as an
 * empty state / thread / thread-error, not as a reason to keep loading.
 */
export function resolveMessagesPageView(listStatus: ConversationsListStatus): MessagesPageView {
  if (listStatus === 'error') return 'error';
  if (listStatus === 'loaded') return 'ready';
  return 'opening';
}

/**
 * The global MessagingHub drawer must never render on top of the dedicated
 * full-page /dashboard/messages route — that's what produced the duplicate
 * "Messages" heading and the mixed drawer/page controls. This is evaluated
 * from the route alone, independent of *why* `messagingOpen` became true
 * (mount-time dispatch, TopBar bell click, an entity page's stale event) so
 * every trigger path is covered by one guard.
 */
export function shouldRenderGlobalMessagingDrawer(pathname: string, messagingOpen: boolean): boolean {
  if (pathname === '/dashboard/messages') return false;
  return messagingOpen;
}

/**
 * Tailwind visibility classes for the master/detail panes on the full-page
 * route. Desktop (`md:` and up) always shows both panes side by side.
 * Below `md`, only one pane is visible at a time based on selection — the
 * same CSS-only responsive convention already used elsewhere in the
 * dashboard (no JS viewport/matchMedia hook).
 */
export function getMasterDetailVisibilityClasses(hasSelection: boolean): { list: string; detail: string } {
  return {
    list: hasSelection ? 'hidden md:flex' : 'flex',
    detail: hasSelection ? 'flex' : 'hidden md:flex',
  };
}
