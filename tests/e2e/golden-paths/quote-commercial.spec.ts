import { test, expect } from '@playwright/test';

test.describe('Quote flow — commercial context (golden path)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.evaluate(() => {
      try { localStorage.removeItem('budsatwork.quote.v2'); } catch { /* */ }
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('commercial context is accessible from context tabs', async ({ page }) => {
    const commercialTab = page.getByRole('button', { name: /Select Commercial context/i });
    await expect(commercialTab).toBeVisible();
  });

  test('commercial context shows Cleaning, Window Cleaning, and Yard Care', async ({ page }) => {
    await page.getByRole('button', { name: /Select Commercial context/i }).click();

    // Should show commercial-eligible services
    await expect(page.getByRole('button', { name: /Select Cleaning/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Select Window Cleaning/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Select Yard Care/i })).toBeVisible({ timeout: 5_000 });

    // Residential-only services should not show
    await expect(page.getByRole('button', { name: /Select Removal & Delivery/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /Select Car Detailing/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /Select Laundry & Sneaker Care/i })).toBeHidden();
  });

  test('commercial cleaning advances to step 2 with commercial scope options', async ({ page }) => {
    await page.getByRole('button', { name: /Select Commercial context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Step 2 progress indicator should appear
    await expect(page.locator('[aria-label="Quote progress"]')).toBeVisible({ timeout: 8_000 });
  });

  test('commercial window cleaning advances to step 2', async ({ page }) => {
    await page.getByRole('button', { name: /Select Commercial context/i }).click();
    await page.getByRole('button', { name: /Select Window Cleaning/i }).click();

    await expect(page.locator('[aria-label="Quote progress"]')).toBeVisible({ timeout: 8_000 });
  });

  test('commercial yard care advances to step 2', async ({ page }) => {
    await page.getByRole('button', { name: /Select Commercial context/i }).click();
    await page.getByRole('button', { name: /Select Yard Care/i }).click();

    await expect(page.locator('[aria-label="Quote progress"]')).toBeVisible({ timeout: 8_000 });
  });

  test('switching from commercial back to home restores all services', async ({ page }) => {
    // Select commercial context
    await page.getByRole('button', { name: /Select Commercial context/i }).click();

    // Confirm commercial service list is restricted
    await expect(page.getByRole('button', { name: /Select Removal & Delivery/i })).toBeHidden();

    // Switch back to home
    await page.getByRole('button', { name: /Select Home context/i }).click();

    // All six services should be visible again
    await expect(page.getByRole('button', { name: /Select Removal & Delivery/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Select Car Detailing/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Select Laundry & Sneaker Care/i })).toBeVisible({ timeout: 5_000 });
  });
});
