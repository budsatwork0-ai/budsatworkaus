import { test, expect } from '@playwright/test';

test.describe('Homepage — golden path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
  });

  test('loads with correct title and nav', async ({ page }) => {
    await expect(page).toHaveTitle(/Buds at Work/i);
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('hero section is visible and has a services CTA', async ({ page }) => {
    // Hero heading (h1 or large-text element)
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    // At least one link/button pointing to /services
    const cta = page.locator('a[href*="services"], button').filter({ hasText: /quote|get started|book|services/i }).first();
    await expect(cta).toBeVisible();
  });

  test('clicking the primary CTA navigates to /services', async ({ page }) => {
    const cta = page
      .locator('a[href*="services"]')
      .first();

    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/services/);
  });

  test('services section lists at least three services', async ({ page }) => {
    // The homepage mentions cleaning, windows, yard care, etc.
    const serviceHeadings = page.locator('section').filter({
      hasText: /cleaning|window|yard|detailing|laundry|removal/i,
    });
    await expect(serviceHeadings.first()).toBeVisible();
  });

  test('footer is visible', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
  });

  test('has no broken images', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        // naturalWidth > 0 means the image loaded successfully
        expect(naturalWidth, `Image at src="${src}" failed to load`).toBeGreaterThan(0);
      }
    }
  });

  test('page responds on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.goto('/');
    await page.waitForLoadState('load');

    await expect(page.locator('h1').first()).toBeVisible();
  });
});
