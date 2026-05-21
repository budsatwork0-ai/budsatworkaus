import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);

const REPO_ROOT = process.cwd();
const GOLDEN_PATHS_DIR = 'tests/e2e/golden-paths';
const BROWSER_TIMEOUT_MS = 180_000; // 3 min — Playwright needs a live dev server

// ── Types ──────────────────────────────────────────────────────────────────────

export type BrowserTestResult = {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
  failures: Array<{ title: string; file: string; error: string }>;
  runUrl: string | null; // CI run URL if triggered via GitHub Actions
};

type PlaywrightJsonReport = {
  stats?: {
    expected?: number;
    unexpected?: number;
    skipped?: number;
    duration?: number;
  };
  suites?: PlaywrightSuite[];
};

type PlaywrightSuite = {
  title?: string;
  file?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
};

type PlaywrightSpec = {
  title?: string;
  ok?: boolean;
  tests?: Array<{ status?: string; results?: Array<{ error?: { message?: string } }> }>;
};

// ── Main export ────────────────────────────────────────────────────────────────

export async function runBrowserTests(
  supabase: SupabaseClient,
  executionId: string,
  stepId: string | null,
  options: {
    testDir?: string;       // defaults to GOLDEN_PATHS_DIR
    grepPattern?: string;   // --grep filter for specific tests
    baseUrl?: string;       // overrides PLAYWRIGHT_BASE_URL
    project?: string;       // e.g. 'chromium' — defaults to chromium for speed
    timeout?: number;
  } = {},
): Promise<BrowserTestResult> {
  const testDir = options.testDir ?? GOLDEN_PATHS_DIR;
  const project = options.project ?? 'chromium';
  const timeoutMs = options.timeout ?? BROWSER_TIMEOUT_MS;

  const args = [
    'playwright',
    'test',
    testDir,
    '--reporter=json',
    `--project=${project}`,
    '--timeout=30000',
  ];

  if (options.grepPattern) args.push(`--grep=${options.grepPattern}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(options.baseUrl ? { PLAYWRIGHT_BASE_URL: options.baseUrl } : {}),
    // Suppress interactive output — we only want the JSON
    CI: 'true',
  };

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const result = await execFileAsync('npx', args, {
      cwd: REPO_ROOT,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 16,
      env,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    stdout = e.stdout ?? '';
    stderr = e.stderr ?? '';
    exitCode = typeof e.code === 'number' ? e.code : 1;
  }

  const parsed = parsePlaywrightJson(stdout);

  // Persist result
  await storeBrowserTestRun(supabase, {
    execution_id: executionId,
    step_id: stepId,
    test_dir: testDir,
    project,
    exit_code: exitCode,
    passed: parsed.passed,
    failed: parsed.failed,
    skipped: parsed.skipped,
    total: parsed.total,
    duration_ms: parsed.durationMs,
    failures: parsed.failures,
    raw_output: stdout.slice(0, 50_000),
    stderr_output: stderr.slice(0, 10_000),
  });

  return parsed;
}

// ── JSON reporter parser ───────────────────────────────────────────────────────

function parsePlaywrightJson(raw: string): BrowserTestResult {
  const empty: BrowserTestResult = {
    passed: 0, failed: 0, skipped: 0, total: 0, durationMs: 0,
    failures: [], runUrl: null,
  };

  if (!raw.trim()) return empty;

  // Playwright's JSON reporter may emit non-JSON lines before the object
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return empty;

  let report: PlaywrightJsonReport;
  try {
    report = JSON.parse(raw.slice(jsonStart)) as PlaywrightJsonReport;
  } catch {
    return empty;
  }

  const stats = report.stats ?? {};
  const failures: BrowserTestResult['failures'] = [];

  collectFailures(report.suites ?? [], failures);

  return {
    passed: stats.expected ?? 0,
    failed: stats.unexpected ?? 0,
    skipped: stats.skipped ?? 0,
    total: (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.skipped ?? 0),
    durationMs: stats.duration ?? 0,
    failures,
    runUrl: null,
  };
}

function collectFailures(
  suites: PlaywrightSuite[],
  out: BrowserTestResult['failures'],
  file = '',
): void {
  for (const suite of suites) {
    const thisFile = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      const allFailed = (spec.tests ?? []).some((t) => t.status === 'unexpected' || t.status === 'failed');
      if (!allFailed) continue;

      const error = (spec.tests ?? [])
        .flatMap((t) => t.results ?? [])
        .map((r) => r.error?.message ?? '')
        .filter(Boolean)[0] ?? 'Unknown failure';

      out.push({
        title: spec.title ?? 'Unnamed test',
        file: thisFile,
        error: error.slice(0, 400),
      });
    }
    if (suite.suites) collectFailures(suite.suites, out, thisFile);
  }
}

// ── Supabase persistence ───────────────────────────────────────────────────────

type BrowserRunRow = {
  execution_id: string;
  step_id: string | null;
  test_dir: string;
  project: string;
  exit_code: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration_ms: number;
  failures: BrowserTestResult['failures'];
  raw_output: string;
  stderr_output: string;
};

async function storeBrowserTestRun(
  supabase: SupabaseClient,
  row: BrowserRunRow,
): Promise<void> {
  try {
    await supabase.from('bud_browser_test_runs').insert({
      execution_id: row.execution_id,
      step_id: row.step_id,
      test_dir: row.test_dir,
      project: row.project,
      exit_code: row.exit_code,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      total: row.total,
      duration_ms: row.duration_ms,
      failures: JSON.stringify(row.failures),
      raw_output: row.raw_output,
      stderr_output: row.stderr_output,
    });
  } catch {
    // Non-fatal: DB write failure must not block the repair pipeline
  }
}

// ── Formatted summary for activity log ────────────────────────────────────────

export function formatBrowserSummary(result: BrowserTestResult): string {
  const { passed, failed, skipped, total, durationMs } = result;
  const durationSec = (durationMs / 1000).toFixed(1);
  const statusEmoji = failed === 0 ? '✅' : '❌';

  const lines = [
    `${statusEmoji} Browser tests: ${passed}/${total} passed (${durationSec}s)`,
  ];

  if (skipped > 0) lines.push(`  ${skipped} skipped`);

  for (const f of result.failures.slice(0, 5)) {
    lines.push(`  ❌ ${f.title}: ${f.error.slice(0, 120)}`);
  }

  if (result.failures.length > 5) {
    lines.push(`  … and ${result.failures.length - 5} more failures`);
  }

  return lines.join('\n');
}
