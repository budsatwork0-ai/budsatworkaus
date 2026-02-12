import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads with key elements
    await expect(page).toHaveTitle(/Buds at Work/);

    // Check for main navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check for footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should navigate to services page', async ({ page }) => {
    await page.goto('/');

    // Find and click a link to services
    const servicesLink = page.getByRole('link', { name: /services|quote|get started/i });
    if (await servicesLink.count() > 0) {
      await servicesLink.first().click();
      await expect(page).toHaveURL(/services/);
    }
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');

    // Check navigation has proper aria label
    const mainNav = page.locator('nav[aria-label="Main"]');
    await expect(mainNav).toBeVisible();
  });
});
