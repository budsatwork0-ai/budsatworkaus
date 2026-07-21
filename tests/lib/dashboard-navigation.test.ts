import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_COMMANDS,
  DASHBOARD_NAV_GROUPS,
  DEFAULT_COLLAPSED_DASHBOARD_NAV_GROUP_IDS,
} from '@/lib/dashboard/navigation';

const visibleRoutes = DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
const commandRoutes = DASHBOARD_COMMANDS.map((command) => command.href);

describe('dashboard navigation metadata', () => {
  it('keeps the approved group order and labels', () => {
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.label)).toEqual([
      'Overview',
      'Work',
      'People',
      'Growth',
      'Money',
      'Bud OS',
      'Settings',
      'More / System',
    ]);
  });

  it('keeps the approved primary routes visible', () => {
    const primaryRoutes = DASHBOARD_NAV_GROUPS
      .filter((group) => group.id !== 'more-system')
      .flatMap((group) => group.items.map((item) => item.href));

    expect(primaryRoutes).toEqual([
      '/dashboard',
      '/dashboard/alerts',
      '/dashboard/messages',
      '/dashboard/schedule',
      '/dashboard/orders',
      '/dashboard/quotes',
      '/dashboard/customers',
      '/dashboard/crew',
      '/dashboard/applicants',
      '/dashboard/ndis',
      '/dashboard/leads',
      '/dashboard/growth-hq',
      '/dashboard/content',
      '/dashboard/invoices',
      '/dashboard/subscriptions',
      '/dashboard/mission-control',
      '/dashboard/agents',
      '/dashboard/executive',
      '/dashboard/settings',
      '/dashboard/automations',
    ]);
  });

  it('keeps More / System collapsed by default with the approved secondary routes', () => {
    const moreSystem = DASHBOARD_NAV_GROUPS.find((group) => group.id === 'more-system');

    expect(moreSystem?.collapsedByDefault).toBe(true);
    expect(DEFAULT_COLLAPSED_DASHBOARD_NAV_GROUP_IDS).toEqual(['more-system']);
    expect(moreSystem?.items.map((item) => item.href)).toEqual([
      '/dashboard/reports',
      '/dashboard/insights',
      '/dashboard/audit-log',
      '/dashboard/sandbox',
      '/dashboard/design',
      '/dashboard/fundraising',
      '/dashboard/onboarding',
      '/dashboard/inductions',
      '/dashboard/analytics/quote-funnel',
      '/dashboard/feedback',
    ]);
  });

  it('preserves badge keys and badge-bearing routes', () => {
    const badgeRoutes = Object.fromEntries(
      visibleRoutes.map((href) => {
        const item = DASHBOARD_NAV_GROUPS
          .flatMap((group) => group.items)
          .find((entry) => entry.href === href);
        return [href, item?.badgeKey ?? null];
      }),
    );

    expect(badgeRoutes).toMatchObject({
      '/dashboard': 'dashboard',
      '/dashboard/schedule': 'schedule',
      '/dashboard/quotes': 'quotes',
      '/dashboard/invoices': 'invoices',
      '/dashboard/applicants': 'applicants',
    });
    expect(Object.values(badgeRoutes).filter(Boolean).sort()).toEqual([
      'applicants',
      'dashboard',
      'invoices',
      'quotes',
      'schedule',
    ]);
  });

  it('keeps admin-only metadata on groups that contain admin-only destinations', () => {
    expect(
      DASHBOARD_NAV_GROUPS
        .filter((group) => group.adminOnly)
        .map((group) => group.id),
    ).toEqual(['people', 'growth', 'money', 'bud-os', 'settings', 'more-system']);
  });

  it('prevents duplicate visible hrefs', () => {
    expect(new Set(visibleRoutes).size).toBe(visibleRoutes.length);
  });

  it('does not expose the non-existent exact NDIS matching route', () => {
    expect(visibleRoutes).not.toContain('/dashboard/ndis/match');
    expect(commandRoutes).not.toContain('/dashboard/ndis/match');
  });

  it('keeps command palette coverage for primary and required secondary routes', () => {
    const requiredCommandRoutes = [
      ...DASHBOARD_NAV_GROUPS
        .filter((group) => group.id !== 'more-system')
        .flatMap((group) => group.items.map((item) => item.href)),
      '/dashboard/reports',
      '/dashboard/insights',
      '/dashboard/audit-log',
      '/dashboard/sandbox',
      '/dashboard/design',
      '/dashboard/fundraising',
      '/dashboard/onboarding',
      '/dashboard/inductions',
      '/dashboard/analytics/quote-funnel',
      '/dashboard/feedback',
    ];

    expect(commandRoutes).toEqual(expect.arrayContaining(requiredCommandRoutes));
    expect(new Set(commandRoutes).size).toBe(commandRoutes.length);
  });

  it('reduces visible sidebar destinations from 37 to 30', () => {
    expect(visibleRoutes).toHaveLength(30);
  });
});
