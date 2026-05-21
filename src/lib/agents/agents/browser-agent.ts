import type { AgentDefinition, AgentContext } from '../types';
import { runBrowserTests, formatBrowserSummary } from '@/lib/bud/browser-executor';

export const browserAgent: AgentDefinition = {
  id: 'browser-agent',
  name: 'Browser Agent',
  description:
    'Runs Playwright golden-path tests against the live site and reports pass/fail. ' +
    'Triggered automatically after UI repairs; can also be run manually to verify a deploy.',
  category: 'ops',
  autonomy: 'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    // Allow callers to specify a subset of tests or a base URL override
    const grepPattern = ctx.input?.grep as string | undefined;
    const baseUrl = (ctx.input?.baseUrl as string | undefined) ?? process.env.PLAYWRIGHT_BASE_URL;
    const project = (ctx.input?.project as string | undefined) ?? 'chromium';
    const testDir = (ctx.input?.testDir as string | undefined) ?? 'tests/e2e/golden-paths';

    // Guard: BUD_OS_EXECUTION_ENABLED must be true (browser tests need a live server)
    if (process.env.BUD_OS_EXECUTION_ENABLED !== 'true') {
      return {
        status: 'blocked',
        summary: 'Browser tests are blocked — set BUD_OS_EXECUTION_ENABLED=true to enable.',
        findings: ['BUD_OS_EXECUTION_ENABLED is not set to true'],
        recommended_actions: ['Set BUD_OS_EXECUTION_ENABLED=true in your environment'],
        confidence: 1.0,
        risk_level: 'low',
        output: { blocked: true, reason: 'BUD_OS_EXECUTION_ENABLED not set' },
      };
    }

    ctx.log('info', `Starting browser tests — dir: ${testDir}, project: ${project}`);

    // Run the golden-path Playwright tests
    const result = await runBrowserTests(ctx.supabase, ctx.runId ?? 'manual', null, {
      testDir,
      grepPattern,
      baseUrl,
      project,
    });

    const summary = formatBrowserSummary(result);
    const allPassed = result.failed === 0 && result.total > 0;
    const noTests = result.total === 0;

    ctx.log(allPassed ? 'info' : 'warn', summary);

    // Use Claude to interpret failures and suggest next steps
    let diagnosis = '';
    if (result.failed > 0) {
      const failureText = result.failures
        .map((f) => `${f.file}: ${f.title}\n  ${f.error}`)
        .join('\n\n');

      diagnosis = await ctx.llm(
        `You are reviewing Playwright golden-path test failures for the Buds At Work platform.\n\n` +
        `Platform: Next.js 15, React 19, Supabase, Stripe, Clerk auth\n` +
        `Key pages: /, /services (quote wizard), /dashboard (admin), /crew (staff), /portal (clients)\n\n` +
        `FAILING TESTS (${result.failed} of ${result.total}):\n${failureText}\n\n` +
        `In 3–5 bullet points, explain what is likely broken and what should be fixed. ` +
        `Be specific about files or components. Plain text, no markdown.`,
      );
    }

    const findings: string[] = [];
    if (noTests) {
      findings.push('No tests were collected — check that the test directory exists and Playwright is configured.');
    } else {
      findings.push(`${result.passed}/${result.total} golden-path tests passed (${(result.durationMs / 1000).toFixed(1)}s)`);
      if (result.failed > 0) {
        findings.push(`${result.failed} test(s) failed`);
        for (const f of result.failures.slice(0, 5)) {
          findings.push(`❌ ${f.title}: ${f.error.slice(0, 120)}`);
        }
        if (diagnosis) findings.push(`\nDiagnosis:\n${diagnosis}`);
      }
      if (result.skipped > 0) findings.push(`${result.skipped} test(s) skipped`);
    }

    const recommended_actions: string[] = [];
    if (result.failed > 0) {
      recommended_actions.push('Review failing test output in the Bud OS browser runs table');
      recommended_actions.push('Run `npx playwright test tests/e2e/golden-paths/ --reporter=html` locally for a visual report');
      if (diagnosis) recommended_actions.push(diagnosis.split('\n')[0]?.trim() ?? 'Fix reported failures');
    } else if (noTests) {
      recommended_actions.push('Verify Playwright is installed: `npx playwright install`');
      recommended_actions.push('Start the dev server before running browser tests');
    } else {
      recommended_actions.push('All golden paths pass — no action required');
    }

    return {
      status: noTests ? 'needs_action' : allPassed ? 'success' : 'needs_repair',
      summary: noTests
        ? 'No browser tests were collected.'
        : `${result.passed}/${result.total} golden-path tests passed.`,
      findings,
      recommended_actions,
      confidence: noTests ? 0.5 : allPassed ? 0.95 : 0.9,
      risk_level: result.failed > 0 ? 'high' : 'low',
      output: {
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        total: result.total,
        durationMs: result.durationMs,
        failures: result.failures,
        diagnosis: diagnosis || null,
      },
    };
  },
};
