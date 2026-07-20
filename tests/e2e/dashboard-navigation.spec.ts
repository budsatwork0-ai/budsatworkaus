import { test, expect } from '@playwright/test';
import { DASHBOARD_COMMANDS, DASHBOARD_NAV_GROUPS } from '../../src/lib/dashboard/navigation';

const renderNav = (viewport: 'desktop' | 'mobile', pathname = '/dashboard') => {
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return `
    <nav data-testid="${viewport}-dashboard-nav" aria-label="${viewport} dashboard navigation">
      ${DASHBOARD_NAV_GROUPS.map((group) => `
        <section data-testid="${viewport}-group-${group.id}" data-collapsed="${group.collapsedByDefault ? 'true' : 'false'}">
          <button type="button">${group.label}</button>
          <div ${group.collapsedByDefault ? 'hidden' : ''}>
            ${group.items.map((item) => `
              <a href="${item.href}" data-href="${item.href}" data-active="${isActive(item.href) ? 'true' : 'false'}">
                ${item.label}
              </a>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </nav>
  `;
};

test.describe('Dashboard navigation metadata', () => {
  test('renders the approved desktop and mobile navigation structure', async ({ page }) => {
    await page.setContent(`
      <main data-testid="dashboard-navigation-fixture">
        ${renderNav('desktop', '/dashboard/quotes/example-quote')}
        ${renderNav('mobile', '/dashboard/quotes/example-quote')}
      </main>
    `);

    await expect(page.getByTestId('dashboard-navigation-fixture')).toBeVisible();

    const expectedGroups = [
      'Overview',
      'Work',
      'People',
      'Growth',
      'Money',
      'Bud OS',
      'Settings',
      'More / System',
    ];

    await expect(page.getByTestId('desktop-dashboard-nav').locator('section > button')).toHaveText(expectedGroups);
    await expect(page.getByTestId('mobile-dashboard-nav').locator('section > button')).toHaveText(expectedGroups);

    await expect(page.getByTestId('desktop-group-more-system')).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByTestId('desktop-group-more-system').locator('a')).toHaveCount(10);

    await page.getByTestId('desktop-group-more-system').locator('div').evaluate((node) => node.removeAttribute('hidden'));
    await expect(page.getByTestId('desktop-group-more-system').getByRole('link', { name: 'Reports' })).toBeVisible();
    await expect(page.getByTestId('desktop-group-more-system').getByRole('link', { name: 'Quote Funnel' })).toBeVisible();

    for (const label of ['Schedule', 'Quotes', 'Invoices', 'Applicants']) {
      await expect(page.getByTestId('desktop-dashboard-nav').getByRole('link', { name: label })).toBeVisible();
      await expect(page.getByTestId('mobile-dashboard-nav').getByRole('link', { name: label })).toHaveCount(1);
    }

    await expect(page.locator('[data-href="/dashboard/ndis/match"]')).toHaveCount(0);
    await expect(page.getByTestId('desktop-dashboard-nav').getByRole('link', { name: 'Quotes' })).toHaveAttribute('data-active', 'true');

    const desktopHrefs = await page.getByTestId('desktop-dashboard-nav').locator('a').evaluateAll((links) =>
      links.map((link) => link.getAttribute('data-href')),
    );
    const mobileHrefs = await page.getByTestId('mobile-dashboard-nav').locator('a').evaluateAll((links) =>
      links.map((link) => link.getAttribute('data-href')),
    );
    expect(mobileHrefs).toEqual(desktopHrefs);

    const commandHrefs = DASHBOARD_COMMANDS.map((command) => command.href);
    expect(commandHrefs).not.toContain('/dashboard/ndis/match');
    expect(new Set(desktopHrefs).size).toBe(desktopHrefs.length);
    expect(new Set(commandHrefs).size).toBe(commandHrefs.length);
  });
});
