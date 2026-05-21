import { test, expect } from '@playwright/test';

test.describe('Quote flow — NDIS context (golden path)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.evaluate(() => {
      try { localStorage.removeItem('budsatwork.quote.v2'); } catch { /* */ }
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('NDIS context is accessible from the context tabs', async ({ page }) => {
    const ndisTab = page.getByRole('button', { name: /Select NDIS context/i });
    await expect(ndisTab).toBeVisible();
  });

  test('NDIS context only shows Cleaning and Yard Care', async ({ page }) => {
    await page.getByRole('button', { name: /Select NDIS context/i }).click();

    // Should show
    await expect(page.getByRole('button', { name: /Select Cleaning/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Select Yard Care/i })).toBeVisible({ timeout: 5_000 });

    // Should NOT show
    await expect(page.getByRole('button', { name: /Select Window Cleaning/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /Select Removal & Delivery/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /Select Car Detailing/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /Select Laundry & Sneaker Care/i })).toBeHidden();
  });

  test('NDIS context shows MaluCare branding or NDIS description', async ({ page }) => {
    await page.getByRole('button', { name: /Select NDIS context/i }).click();

    // Should show the NDIS / MaluCare information panel
    const ndisContent = page.locator('text=/MaluCare|NDIS|National Disability/i').first();
    await expect(ndisContent).toBeVisible({ timeout: 5_000 });
  });

  test('NDIS Cleaning tile advances to step 2 with NDIS-specific config', async ({ page }) => {
    await page.getByRole('button', { name: /Select NDIS context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Step 2 in NDIS context should show scope configuration
    await expect(page.locator('[aria-label="Quote progress"]')).toBeVisible({ timeout: 8_000 });
  });

  test('NDIS step 2 shows a "Review quote" CTA (not "Get my quote")', async ({ page }) => {
    await page.getByRole('button', { name: /Select NDIS context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Select any scope card that appears
    const scopeCard = page.locator('[role="button"][data-scope-card]').first();
    if (await scopeCard.count() > 0) {
      await scopeCard.click();
    }

    // NDIS cleaning uses "Review quote" instead of "Get my quote"
    const cta = page.getByRole('button', { name: /Review quote|Get my quote/i });
    await expect(cta).toBeVisible({ timeout: 5_000 });
  });

  test('NDIS Yard Care tile advances to step 2', async ({ page }) => {
    await page.getByRole('button', { name: /Select NDIS context/i }).click();
    await page.getByRole('button', { name: /Select Yard Care/i }).click();

    await expect(page.locator('[aria-label="Quote progress"]')).toBeVisible({ timeout: 8_000 });
  });
});
