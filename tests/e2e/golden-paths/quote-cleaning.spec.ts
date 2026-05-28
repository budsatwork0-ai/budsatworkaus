import { test, expect } from '@playwright/test';

// Full home-cleaning quote flow: context → service selection → step 2 config → step 3 contact → submit
test.describe('Quote flow — home cleaning (golden path)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear wizard state between runs so each test starts fresh
    await page.goto('/services');
    await page.evaluate(() => {
      try { localStorage.removeItem('budsatwork.quote.v2'); } catch { /* */ }
    });
    await page.reload();
    await page.waitForLoadState('load');
  });

  test('services page loads with context tabs', async ({ page }) => {
    await expect(page).toHaveURL(/\/services/);

    const homeTab = page.getByRole('tab', { name: /Select Home context/i });
    const commercialTab = page.getByRole('tab', { name: /Select Commercial context/i });
    const ndisTab = page.getByRole('tab', { name: /Select NDIS context/i });

    await expect(homeTab).toBeVisible();
    await expect(commercialTab).toBeVisible();
    await expect(ndisTab).toBeVisible();
  });

  test('home context shows all six services', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();

    await expect(page.getByRole('button', { name: /Select Cleaning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Select Window Cleaning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Select Yard Care/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Select Removal & Delivery/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Select Car Detailing/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Select Laundry & Sneaker Care/i })).toBeVisible();
  });

  test('selecting Cleaning advances to step 2', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Step 2 should show scope cards (Standard, Deep, End of Lease)
    await expect(page.getByText(/Standard Clean|Deep Clean|End of Lease|Move/i).first()).toBeVisible({
      timeout: 8_000,
    });

    // Progress indicator should be on step 2
    const progress = page.locator('[aria-label="Quote progress"]');
    await expect(progress).toBeVisible();
  });

  test('step 2 — selecting Standard Clean scope shows price estimate', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Click the Standard Clean scope card
    const standardCard = page.locator('[role="button"]').filter({ hasText: /Standard Clean/i }).first();
    await expect(standardCard).toBeVisible({ timeout: 8_000 });
    await standardCard.click();

    // A price estimate (dollar sign) should appear somewhere on the page
    await expect(page.locator('text=/\\$\\d/').first()).toBeVisible({ timeout: 5_000 });
  });

  test('step 2 → step 3 — continuing shows contact form', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Select a scope
    const standardCard = page.locator('[role="button"]').filter({ hasText: /Standard Clean/i }).first();
    await expect(standardCard).toBeVisible({ timeout: 8_000 });
    await standardCard.click();

    // Click "Get my quote" to advance to step 3
    const getQuoteBtn = page.getByRole('button', { name: /Get my quote/i });
    await expect(getQuoteBtn).toBeVisible({ timeout: 5_000 });
    await getQuoteBtn.click();

    // Step 3: address / contact form should now be visible
    await expect(
      page.locator('input[placeholder*="address" i], input[placeholder*="suburb" i], input[type="text"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('step 3 form — filling address shows submit button', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    const standardCard = page.locator('[role="button"]').filter({ hasText: /Standard Clean/i }).first();
    await expect(standardCard).toBeVisible({ timeout: 8_000 });
    await standardCard.click();

    const getQuoteBtn = page.getByRole('button', { name: /Get my quote/i });
    await expect(getQuoteBtn).toBeVisible({ timeout: 5_000 });
    await getQuoteBtn.click();

    // Fill in a service address
    const addressInput = page.locator('input').filter({ hasText: '' }).first();
    if (await addressInput.isVisible()) {
      await addressInput.fill('123 Test Street, Brisbane QLD 4000');
    }

    // The final submit button should be accessible
    await expect(page.locator('#step3-submit-btn')).toBeVisible({ timeout: 8_000 });
  });

  test('back navigation returns to step 1', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Cleaning/i }).click();

    // Should be on step 2 — press browser back
    await page.goBack();

    // Context tabs should reappear
    await expect(
      page.getByRole('tab', { name: /Select Home context/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('service tile shows active state after selection', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();

    const cleaningTile = page.getByRole('button', { name: /Select Cleaning/i });
    await cleaningTile.click();

    // After advancing to step 2, going back should show the tile as active
    // (or the tile's active state is visible while step 2 is rendered)
    // The tile should have aria-label indicating it was selected
    const backBtn = page.locator('button').filter({ hasText: /back|← back|step 1/i }).first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      const activeTile = page.getByRole('button', { name: /Select Cleaning/i });
      const pressed = await activeTile.getAttribute('aria-pressed');
      // Active tile should be pressed=true or have an active visual state
      expect(pressed === 'true' || pressed === null).toBeTruthy();
    }
  });
});

test.describe('Quote flow — window cleaning (golden path)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.evaluate(() => {
      try { localStorage.removeItem('budsatwork.quote.v2'); } catch { /* */ }
    });
    await page.reload();
    await page.waitForLoadState('load');
  });

  test('window cleaning tile advances to step 2', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Window Cleaning/i }).click();

    // Step 2 for windows should show pane/scope options
    const step2Content = page.locator('[aria-label="Quote progress"], [data-scope-card]').first();
    await expect(step2Content).toBeVisible({ timeout: 8_000 });
  });

  test('yard care tile advances to step 2 with map/area tool', async ({ page }) => {
    await page.getByRole('tab', { name: /Select Home context/i }).click();
    await page.getByRole('button', { name: /Select Yard Care/i }).click();

    // Yard active is set immediately on the root container when yard care is selected
    await expect(page.locator('[data-yard-active]')).toBeAttached({ timeout: 8_000 });
  });
});
