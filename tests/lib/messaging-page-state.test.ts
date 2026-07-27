import { describe, expect, it } from 'vitest';
import {
  getMasterDetailVisibilityClasses,
  resolveMessagesPageView,
  shouldRenderGlobalMessagingDrawer,
} from '@/lib/messaging/pageState';

describe('resolveMessagesPageView', () => {
  it('is "opening" before the list request has started', () => {
    expect(resolveMessagesPageView('idle')).toBe('opening');
  });

  it('is "opening" while the list request is in flight', () => {
    expect(resolveMessagesPageView('loading')).toBe('opening');
  });

  it('is "ready" once the list request settles successfully — even with zero conversations', () => {
    // This is the exact condition that used to hang forever: "no data" was
    // being conflated with "still loading". It must not be.
    expect(resolveMessagesPageView('loaded')).toBe('ready');
  });

  it('is "error" when the list request fails, not stuck opening', () => {
    expect(resolveMessagesPageView('error')).toBe('error');
  });

  it('only has four possible inputs and each maps deterministically — no hidden fifth "still waiting on something else" state', () => {
    const statuses: Array<Parameters<typeof resolveMessagesPageView>[0]> = ['idle', 'loading', 'loaded', 'error'];
    const views = statuses.map(resolveMessagesPageView);
    expect(views).toEqual(['opening', 'opening', 'ready', 'error']);
    // A hypothetical unresolved secondary signal (e.g. a realtime connection)
    // has no parameter here to plug into — the view is a pure function of
    // the single list-request status, so it structurally cannot keep the
    // page in "opening" once that one request settles.
  });
});

describe('shouldRenderGlobalMessagingDrawer', () => {
  it('opens on other dashboard pages when requested', () => {
    expect(shouldRenderGlobalMessagingDrawer('/dashboard/customers', true)).toBe(true);
  });

  it('stays closed on other pages when not requested', () => {
    expect(shouldRenderGlobalMessagingDrawer('/dashboard/customers', false)).toBe(false);
  });

  it('never opens on the dedicated full-page messages route, even if requested', () => {
    expect(shouldRenderGlobalMessagingDrawer('/dashboard/messages', true)).toBe(false);
  });

  it('stays closed on the messages route when not requested', () => {
    expect(shouldRenderGlobalMessagingDrawer('/dashboard/messages', false)).toBe(false);
  });
});

describe('getMasterDetailVisibilityClasses', () => {
  it('shows only the list pane (full width) on mobile when nothing is selected', () => {
    const { list, detail } = getMasterDetailVisibilityClasses(false);
    expect(list).not.toContain('hidden');
    expect(detail).toContain('hidden');
  });

  it('shows only the detail pane on mobile once a conversation is selected', () => {
    const { list, detail } = getMasterDetailVisibilityClasses(true);
    expect(list).toContain('hidden');
    expect(detail).not.toContain('hidden');
  });

  it('always keeps both panes reachable at the md breakpoint regardless of selection', () => {
    const unselected = getMasterDetailVisibilityClasses(false);
    const selected = getMasterDetailVisibilityClasses(true);
    expect(unselected.detail).toContain('md:flex');
    expect(selected.list).toContain('md:flex');
  });
});
