import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { signInAsAdmin } from './helpers/admin-auth';

const SCREENSHOT_DIR = resolve(process.cwd(), 'tmp/screenshots');

async function capture(page: import('@playwright/test').Page, name: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, `sandbox-${name}.png`), fullPage: true });
}

async function waitForSandboxData(page: import('@playwright/test').Page) {
  const commandStrip = page.locator('section').filter({ hasText: 'Safety: sandbox rows stay' }).first();
  await expect(commandStrip.getByText(/\d+%/).first()).toBeVisible({ timeout: 60_000 });
}

async function mockUnhealthySandbox(page: import('@playwright/test').Page) {
  const now = new Date().toISOString();
  await page.route('**/api/sandbox/health', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        lastCronRun: {
          id: 'batch-failed',
          agent_id: 'sandbox-runner',
          trigger: 'cron',
          status: 'failed',
          scenario_count: 3,
          pass_count: 0,
          avg_f1: 0.12,
          total_cost_cents: 2,
          started_at: now,
          finished_at: now,
        },
        batches: [],
        health: [{
          agent_id: 'quote-triage',
          runs: 3,
          pass_rate: 0,
          avg_f1: 0.12,
          baseline_f1: 0.82,
          delta_f1: -0.7,
          trend: 'degrading',
          computed_at: now,
        }],
        regressions: [{
          agent_id: 'quote-triage',
          runs: 3,
          pass_rate: 0,
          avg_f1: 0.12,
          baseline_f1: 0.82,
          delta_f1: -0.7,
          trend: 'degrading',
          computed_at: now,
        }],
        failingScenarios: [{
          scenarioId: 'scenario-failed',
          title: 'Mock failed quote scenario',
          category: 'customer',
          agentId: 'quote-triage',
          f1: 0.12,
          scoredAt: now,
        }],
        needsReview: [],
        rootCauses: [],
        activeRootCauses: [{
          key: 'mock-root-cause',
          title: 'Mock root cause requiring operator review',
          severity: 'critical',
          agentId: 'quote-triage',
          failureType: 'zero_action',
          rootCauseSummary: 'The agent produced no usable sandbox action.',
          lessonCount: 1,
          latestAt: now,
          exampleObservations: ['No proposed action captured.'],
          recommendedFix: 'Review the quote triage prompt and rerun the scenario.',
          lessonIds: ['lesson-1'],
        }],
        resolvedRootCauses: [],
        proposals: [],
        recommendations: [{
          agentId: 'quote-triage',
          status: 'blocked',
          currentF1: 0.12,
          baselineF1: 0.82,
          trend: 'degrading',
          hasRegression: true,
          hasActiveRootCauses: true,
          lessonCount: 1,
          rootCauseCount: 1,
          rationale: 'Blocked by mocked regression and root cause.',
        }],
      }),
    });
  });
  await page.route('**/api/sandbox/readiness', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        overallReadiness: 0,
        byCategory: { customer: { ready: 0, total: 3 } },
        totalScenarios: 3,
        readyScenarios: 0,
      }),
    });
  });
}

test.describe.serial('Sandbox Operations Centre visual QA', () => {
  test('captures authenticated desktop screenshots and verifies operator controls', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await signInAsAdmin(page);
    await waitForSandboxData(page);

    await expect(page.getByText('Fleet score')).toBeVisible();
    await expect(page.getByText('Executive summary')).toBeVisible();
    await expect(page.getByText(/improving|worsening|unchanged/i).first()).toBeVisible();
    await capture(page, 'overview');

    const moreButton = page.getByRole('button', { name: /^\+\d+ more$/ }).first();
    if (await moreButton.count()) {
      await moreButton.click();
      await expect(page.getByPlaceholder(/search agents or reasons/i)).toBeVisible();
      await capture(page, 'fleet-drawer');
      await page.getByRole('button', { name: /^close$/i }).click();
    }

    await page.getByRole('button', { name: /^Run$/ }).click();
    await expect(page.getByText('Scenario Execution')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run All Scenarios/ }).last()).toBeVisible();
    await expect(page.getByText('Scenario Catalogue')).toBeVisible();
    await capture(page, 'run');

    await page.getByRole('button', { name: /^Run All Scenarios$/ }).click();
    await expect(page.getByRole('dialog', { name: /Run all scenarios now/i })).toBeVisible();
    await capture(page, 'run-confirmation-modal');
    await page.getByRole('button', { name: /^Cancel$/ }).click();
    await expect(page.getByRole('dialog', { name: /Run all scenarios now/i })).toHaveCount(0);
    await expect(page.getByText(/Pack started/i)).toHaveCount(0);

    await page.getByRole('button', { name: /^Agents$/ }).click();
    await expect(page.getByText('Why not promotable')).toBeVisible();
    await capture(page, 'agents');

    const firstAgent = page.locator('tbody tr button').first();
    if (await firstAgent.count()) {
      await firstAgent.click();
      await expect(page.getByText(/Agent detail/i)).toBeVisible();
      await capture(page, 'agent-detail-drawer');
      await page.getByRole('button', { name: /^close$/i }).click();
    }

    await page.getByRole('button', { name: /^Learning$/ }).click();
    await expect(page.getByText('Learning Velocity')).toBeVisible();
    await capture(page, 'learning');

    await page.getByRole('button', { name: /^Infrastructure$/ }).click();
    await expect(page.getByText('Sandbox Environment')).toBeVisible();
    await capture(page, 'infrastructure');
  });

  test('captures authenticated mobile overview for responsive sanity check', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 900 });
    await signInAsAdmin(page);
    await waitForSandboxData(page);
    await expect(page.getByText('Fleet score')).toBeVisible();
    await expect(page.getByText('Executive summary')).toBeVisible();
    await capture(page, 'overview-mobile');
  });

  test('captures authenticated mocked unhealthy state', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await mockUnhealthySandbox(page);
    await signInAsAdmin(page);
    await waitForSandboxData(page);
    await expect(page.getByText(/Attention required/i)).toBeVisible();
    await expect(page.getByText(/Mock root cause requiring operator review/i).first()).toBeVisible();
    await capture(page, 'unhealthy-failure-state');
  });
});
