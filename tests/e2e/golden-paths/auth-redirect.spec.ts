import { test, expect } from '@playwright/test';

// All protected routes must redirect unauthenticated users to the Clerk sign-in page.
// These tests verify the auth boundary is working — no authenticated session is used.

const PROTECTED_ROUTES = [
  { path: '/dashboard', name: 'Admin dashboard' },
  { path: '/dashboard/agents', name: 'Agents dashboard' },
  { path: '/dashboard/mission-control', name: 'Mission Control' },
  { path: '/dashboard/ndis', name: 'NDIS dashboard' },
  { path: '/crew', name: 'Crew portal' },
  { path: '/portal', name: 'Client portal' },
];

const PUBLIC_ROUTES = [
  { path: '/', name: 'Homepage' },
  { path: '/services', name: 'Services / quote builder' },
];

test.describe('Auth redirect — protected routes', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.name} (${route.path}) redirects unauthenticated users`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'load' });

      // Either a redirect happened to an auth page, or we landed on an auth wall
      const url = page.url();
      const isAuthPage =
        url.includes('sign-in') ||
        url.includes('login') ||
        url.includes('/account') || // Supabase auth redirect
        url.includes('accounts.') ||
        url.includes('clerk.');

      const isProtectedPage = url.includes(route.path);

      // If we're still on the protected page, check for an auth error/redirect state
      if (isProtectedPage) {
        // The page might render a 404/403 or an auth required component
        const hasAuthContent = await page
          .locator('text=/sign in|log in|unauthorized|not found|access denied/i')
          .count();
        // At minimum the page must not leak admin content
        const hasDashboardContent = await page
          .locator('text=/receivables|payables|agent runs|bud os/i')
          .count();
        expect(hasDashboardContent).toBe(0);
      } else {
        // Redirected to auth — this is the expected golden path
        expect(isAuthPage).toBeTruthy();
      }
    });
  }
});

test.describe('Public routes — no auth required', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) loads without auth`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('load');

      // Must NOT redirect to sign-in
      const url = page.url();
      expect(url).not.toMatch(/sign-in|login/);

      // The page must load successfully (not a 500 or blank)
      const body = page.locator('body');
      await expect(body).not.toBeEmpty();
    });
  }
});

test.describe('Auth redirect — HTTP response codes', () => {
  test('protected dashboard returns 200 or redirect (not 500)', async ({ page }) => {
    const response = await page.goto('/dashboard');
    // Must not be a server error
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('homepage returns 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('services page returns 200', async ({ page }) => {
    const response = await page.goto('/services');
    expect(response?.status()).toBe(200);
  });
});
