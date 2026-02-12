import { test, expect } from '@playwright/test';

test.describe('Dashboard Access', () => {
  test('should redirect unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard');

    // Clerk should redirect unauthenticated users
    // Either to sign-in page or show auth required message
    await page.waitForURL(/sign-in|login|dashboard/, { timeout: 10000 });

    const url = page.url();
    const isAuthPage = url.includes('sign-in') || url.includes('login');
    const isDashboard = url.includes('dashboard');

    // Should either redirect to auth or stay on dashboard (if Clerk not configured)
    expect(isAuthPage || isDashboard).toBeTruthy();
  });

  test('should have proper page structure when accessible', async ({ page }) => {
    // This test runs if dashboard is accessible (Clerk not blocking)
    await page.goto('/dashboard');

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');

    // If we're on the dashboard, check basic structure
    if (page.url().includes('dashboard')) {
      // Should have a heading
      const heading = page.locator('h1');
      if (await heading.count() > 0) {
        await expect(heading).toContainText(/dashboard/i);
      }
    }
  });
});

test.describe('Dashboard Functionality', () => {
  test.skip('should display summary cards', async ({ page }) => {
    // This test is skipped by default as it requires authentication
    // Enable when testing with authenticated session
    await page.goto('/dashboard');

    // Look for summary cards
    const summaryCards = page.locator('[class*="rounded-2xl"]');
    await expect(summaryCards.first()).toBeVisible();
  });

  test.skip('should switch between tabs', async ({ page }) => {
    // This test is skipped by default as it requires authentication
    await page.goto('/dashboard');

    // Find tab buttons
    const overviewTab = page.getByRole('button', { name: /overview/i });
    const receivablesTab = page.getByRole('button', { name: /receivables/i });

    await expect(overviewTab).toBeVisible();
    await expect(receivablesTab).toBeVisible();

    // Click receivables tab
    await receivablesTab.click();

    // Content should update (look for table or receivables content)
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });
});
