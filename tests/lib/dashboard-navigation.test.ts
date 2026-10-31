import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_COMMANDS,
  DASHBOARD_NAV_GROUPS,
  DEFAULT_COLLAPSED_DASHBOARD_NAV_GROUP_IDS,
  DEV_DASHBOARD_NAV_GROUP,
  SHOW_DEV_DASHBOARD_NAV,
} from '@/lib/dashboard/navigation';

const visibleRoutes = DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
const commandRoutes = DASHBOARD_COMMANDS.map((command) => command.href);

describe('dashboard navigation metadata', () => {
  const primaryGroups = DASHBOARD_NAV_GROUPS.filter((group) => group.id !== DEV_DASHBOARD_NAV_GROUP.id);
  const primaryRoutes = primaryGroups.flatMap((group) => group.items.map((item) => item.href));

  it('keeps the approved section order', () => {
    expect(primaryGroups.map((group) => group.label)).toEqual(['Work', 'Settings']);
  });

  it('keeps the approved primary routes visible (8 items)', () => {
    expect(primaryRoutes).toEqual([
      '/dashboard/schedule', '/dashboard/leads', '/dashboard/customers', '/dashboard/invoices',
      '/dashboard/content',
      '/dashboard/settings', '/dashboard/price-list', '/dashboard/mission-control', '/dashboard/automations',
    ]);
  });

  it('keeps dev tools in a collapsed, non-production-only group', () => {
    expect(DEV_DASHBOARD_NAV_GROUP.collapsedByDefault).toBe(true);
    expect(DEV_DASHBOARD_NAV_GROUP.items.map((item) => item.href)).toEqual(['/dashboard/sandbox', '/dashboard/design']);
    expect(primaryRoutes).not.toContain('/dashboard/sandbox');
    expect(DASHBOARD_NAV_GROUPS.includes(DEV_DASHBOARD_NAV_GROUP)).toBe(SHOW_DEV_DASHBOARD_NAV);
  });

  it('preserves every badge key', () => {
    const badges = DASHBOARD_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.badgeKey).filter(Boolean).sort();
    expect(badges).toEqual(['invoices', 'quotes', 'schedule']);
  });

  it('prevents duplicate visible hrefs', () => {
    expect(new Set(visibleRoutes).size).toBe(visibleRoutes.length);
  });

  it('does not expose the non-existent exact NDIS matching route', () => {
    expect(visibleRoutes).not.toContain('/dashboard/ndis/match');
    expect(commandRoutes).not.toContain('/dashboard/ndis/match');
  });

  it('keeps every removed sidebar route reachable through the command palette', () => {
    const requiredCommandRoutes = [
      ...visibleRoutes,
      '/dashboard', '/dashboard/alerts', '/dashboard/messages', '/dashboard/orders', '/dashboard/subscriptions', '/dashboard/agents',
      '/dashboard/content', '/dashboard/growth-hq', '/dashboard/insights', '/dashboard/executive',
      '/dashboard/crew', '/dashboard/applicants', '/dashboard/ndis',
      '/dashboard/reports', '/dashboard/audit-log', '/dashboard/sandbox', '/dashboard/design',
      '/dashboard/fundraising', '/dashboard/onboarding', '/dashboard/inductions',
      '/dashboard/analytics/quote-funnel', '/dashboard/feedback',
    ];
    expect(commandRoutes).toEqual(expect.arrayContaining(requiredCommandRoutes));
    expect(new Set(commandRoutes).size).toBe(commandRoutes.length);
  });

  it('has no default-collapsed groups other than Developer', () => {
    expect(DEFAULT_COLLAPSED_DASHBOARD_NAV_GROUP_IDS.every((id) => id === 'developer')).toBe(true);
  });
});
