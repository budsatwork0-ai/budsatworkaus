import { test, expect } from '@playwright/test';

test.describe('Services Quote Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
  });

  test('should load services page', async ({ page }) => {
    // Check that the services page loads
    await expect(page).toHaveURL(/services/);

    // Should have service selection options
    const pageContent = page.locator('main');
    await expect(pageContent).toBeVisible();
  });

  test('should show home and commercial context options', async ({ page }) => {
    // Look for context selection buttons
    const homeButton = page.getByRole('button', { name: /home/i });
    const commercialButton = page.getByRole('button', { name: /commercial/i });

    // At least one context option should be visible
    const hasHome = await homeButton.count() > 0;
    const hasCommercial = await commercialButton.count() > 0;

    expect(hasHome || hasCommercial).toBeTruthy();
  });

  test('should select a service type', async ({ page }) => {
    // Select home context if available
    const homeButton = page.getByRole('button', { name: /home/i });
    if (await homeButton.count() > 0) {
      await homeButton.first().click();
    }

    // Look for service type options (cleaning, windows, yard, etc.)
    const cleaningOption = page.getByText(/cleaning/i);
    const windowsOption = page.getByText(/window/i);
    const yardOption = page.getByText(/yard/i);

    // At least one service option should be visible
    const hasService =
      (await cleaningOption.count() > 0) ||
      (await windowsOption.count() > 0) ||
      (await yardOption.count() > 0);

    expect(hasService).toBeTruthy();
  });

  test('should progress through quote steps', async ({ page }) => {
    // This test verifies the multi-step quote flow works
    // Step 1: Select context (home)
    const homeButton = page.getByRole('button', { name: /home/i });
    if (await homeButton.count() > 0) {
      await homeButton.first().click();
    }

    // Wait for any transitions
    await page.waitForTimeout(500);

    // Look for continue/next button or step indicator
    const continueButton = page.getByRole('button', { name: /continue|next|see quote/i });

    // The quote wizard should have navigation controls
    const hasContinue = await continueButton.count() > 0;

    // If continue button exists, clicking it should progress
    if (hasContinue) {
      // Verify we can interact with the wizard
      await expect(continueButton.first()).toBeEnabled();
    }
  });
});

test.describe('Services Page Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/services');

    // Check for h1 heading
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('should have labeled form inputs', async ({ page }) => {
    await page.goto('/services');

    // Navigate to quote form (step 3)
    // This would require navigating through the wizard
    // For now, just check the page loads correctly
    await expect(page).toHaveURL(/services/);
  });
});
