import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { parseAtlas } from '@/lib/architecture-doctor/atlas-parser';
import { scanRepository } from '@/lib/architecture-doctor/repo-scanner';
import {
  buildCiReadiness,
  buildCriticalBlockers,
  buildEnforcementReadiness,
  buildHealthReport,
  buildTrendReport,
  buildAdvisoryGithubOutput,
  calculateArchitectureHealth,
  calculateHealthScore,
  detectPhaseOneDrift,
  writeReports,
} from '@/lib/architecture-doctor/reporter';
import { classifyFindings } from '@/lib/architecture-doctor/baseline';
import { generateProposedBaseline, promoteBaselineEntries, validateAcceptedBaseline } from '@/lib/architecture-doctor/baseline';
import { analyzeDependencyGraph, dedupeCycleGroups } from '@/lib/architecture-doctor/dependency-graph';
import { analyzeGovernance } from '@/lib/architecture-doctor/governance-checks';
import { analyzeBusinessLoops } from '@/lib/architecture-doctor/business-loop';
import { capabilityForRoute, capabilityForTable, isAllowedDependency } from '@/lib/architecture-doctor/capability-manifest';
import { analyzeRls } from '@/lib/architecture-doctor/rls-checks';
import { diffReports } from '@/lib/architecture-doctor/report-diff';
import { evaluateFailMode } from '@/lib/architecture-doctor/cli-fail-mode';
import { evaluateEnforcementPolicy, evaluateThresholdDryRun, renderThresholdDryRunMarkdown } from '@/lib/architecture-doctor/enforcement-policy';
import {
  appendReleaseCycleObservation,
  createReleaseCycleObservation,
  summarizeReleaseCycleEvidence,
} from '@/lib/architecture-doctor/release-cycle-evidence';
import { annotateFindingRisk, findingPenalty } from '@/lib/architecture-doctor/risk-model';
import { groupDependencyCycleReadiness, triageCriticalCandidates } from '@/lib/architecture-doctor/critical-triage';
import { runFinalSafetyCheck } from '@/lib/architecture-doctor/final-safety-check';
import type { ArchitectureHealthReport, ArchitectureInventory, AtlasSpec, DriftFinding } from '@/lib/architecture-doctor/types';
import { readFileSync } from 'node:fs';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Architecture Doctor atlas parser', () => {
  it('parses the current Business Capability Atlas', () => {
    const atlasPath = path.join(process.cwd(), 'Buds At Work/01 Architecture/Bud OS Business Capability Atlas 2026-07-08.md');
    const atlas = parseAtlas(readFileSync(atlasPath, 'utf8'), atlasPath);

    expect(atlas.capabilities).toHaveLength(24);
    expect(atlas.capabilities[0]).toMatchObject({
      id: 'C01',
      name: 'Lead Acquisition and Triage',
      criticality: 9,
      maturity: 3,
      priority: 18,
    });
    expect(atlas.capabilities[0].apiRoutes).toContain('/api/leads/contact');
    expect(atlas.capabilities[16].agents).toContain('bud');
    expect(atlas.capabilities[20].envVars).toContain('ALLOW_DEV_ROLE_SWITCH');
  });
});

describe('Architecture Doctor repo scanner', () => {
  it('discovers repo architecture assets in a smoke test', async () => {
    const inventory = await scanRepository(process.cwd());

    expect(inventory.pages).toContain('/dashboard');
    expect(inventory.apiRoutes).toContain('/api/quotes');
    expect(inventory.agents).toContain('quote-triage');
    expect(inventory.cronEntries.some((entry) => entry.routePath === '/api/cron/remind-quotes')).toBe(true);
    expect([...inventory.migrationTables, ...inventory.tableUsages]).toContain('quotes');
    expect(inventory.envVars).toContain('STRIPE_SECRET_KEY');
  }, 15000);
});

describe('Architecture Doctor Phase 1 drift detection', () => {
  it('detects missing and orphan API routes', () => {
    const findings = detectPhaseOneDrift(makeAtlas(), makeInventory({ apiRoutes: ['/api/orphan'] }));
    expect(findings.map((finding) => finding.type)).toContain('atlas_api_missing');
    expect(findings.map((finding) => finding.type)).toContain('repo_api_unmapped');
  });

  it('detects missing and orphan agents', () => {
    const findings = detectPhaseOneDrift(makeAtlas(), makeInventory({ agents: ['orphan-agent'] }));
    expect(findings.map((finding) => finding.type)).toContain('atlas_agent_missing');
    expect(findings.map((finding) => finding.type)).toContain('repo_agent_unmapped');
  });

  it('detects missing and orphan tables', () => {
    const findings = detectPhaseOneDrift(makeAtlas(), makeInventory({ migrationTables: ['orphan_table'] }));
    expect(findings.map((finding) => finding.type)).toContain('atlas_table_missing');
    expect(findings.map((finding) => finding.type)).toContain('repo_table_unmapped');
  });

  it('detects orphan cron routes and missing cron targets', () => {
    const findings = detectPhaseOneDrift(
      makeAtlas(),
      makeInventory({
        apiRoutes: ['/api/test'],
        cronRouteCandidates: ['/api/cron/unregistered'],
        cronEntries: [{ path: '/api/cron/missing', routePath: '/api/cron/missing', schedule: '* * * * *' }],
      }),
    );
    expect(findings.map((finding) => finding.type)).toContain('cron_route_unregistered');
    expect(findings.map((finding) => finding.type)).toContain('cron_target_missing');
  });

  it('scanner detects files in a synthetic repo', async () => {
    const root = await makeTempRepo();
    await writeText(root, 'src/app/(app)/dashboard/page.tsx', 'export default function Page() { return null; }');
    await writeText(root, 'src/app/api/test/route.ts', "process.env.TEST_ENV; supabase.from('test_table');");
    await writeText(root, 'src/lib/agents/agents/test-agent.ts', 'export const testAgent = {};');
    await writeText(root, 'supabase/migrations/001.sql', "create table if not exists public.test_table (id uuid);");
    await writeText(root, 'vercel.json', JSON.stringify({ crons: [{ path: '/api/test', schedule: '* * * * *' }] }));

    const inventory = await scanRepository(root);

    expect(inventory.pages).toContain('/dashboard');
    expect(inventory.apiRoutes).toContain('/api/test');
    expect(inventory.agents).toContain('test-agent');
    expect(inventory.migrationTables).toContain('test_table');
    expect(inventory.tableUsages).toContain('test_table');
    expect(inventory.envVars).toContain('TEST_ENV');
    expect(inventory.cronEntries[0].routePath).toBe('/api/test');
  });
});

describe('Architecture Doctor Phase 2 checks', () => {
  it('classifies accepted, new, and resolved baseline findings', () => {
    const current = [makeFinding('atlas_api_missing', '/api/test'), makeFinding('repo_api_unmapped', '/api/new')];
    const classified = classifyFindings(
      current,
      {
        version: 1,
        acceptedFindings: [
          { type: 'atlas_api_missing', asset: '/api/test', reason: 'known fixture' },
          { type: 'repo_agent_unmapped', asset: 'resolved-agent', reason: 'old finding' },
        ],
      },
      '<baseline>',
    );

    expect(classified.acceptedFindings).toHaveLength(1);
    expect(classified.newFindings).toHaveLength(1);
    expect(classified.resolvedFindings).toHaveLength(1);
  });

  it('generates proposed baseline entries with review metadata', () => {
    const proposed = generateProposedBaseline([makeFinding('repo_api_unmapped', '/api/new')], new Date('2026-07-08T00:00:00.000Z'));

    expect(proposed.acceptedFindings[0]).toMatchObject({
      id: 'ADB-0001',
      type: 'repo_api_unmapped',
      asset: '/api/new',
      accepted_by: '<required>',
      accepted_reason: '<required>',
      accepted_at: '2026-07-08T00:00:00.000Z',
      review_after: '2026-10-06',
    });
  });

  it('promotes only selected baseline entries with required metadata', async () => {
    const root = await makeTempRepo();
    const baselinePath = path.join(root, 'baseline.json');
    await writeText(root, 'baseline.json', JSON.stringify({ version: 1, acceptedFindings: [] }));

    const result = await promoteBaselineEntries(
      baselinePath,
      [makeFinding('repo_api_unmapped', '/api/one'), makeFinding('repo_api_unmapped', '/api/two')],
      {
        selected: ['ADB-0002'],
        acceptedBy: 'Architecture Doctor',
        acceptedReason: 'Known unmapped fixture under review.',
        reviewAfter: '2026-10-06',
        generatedAt: new Date('2026-07-08T00:00:00.000Z'),
      },
    );

    const written = JSON.parse(readFileSync(baselinePath, 'utf8')) as { acceptedFindings: Array<{ asset: string; accepted_by: string }> };
    expect(result.promoted).toHaveLength(1);
    expect(written.acceptedFindings).toHaveLength(1);
    expect(written.acceptedFindings[0]).toMatchObject({ asset: '/api/two', accepted_by: 'Architecture Doctor' });
  });

  it('validates required baseline metadata', () => {
    expect(() =>
      validateAcceptedBaseline({
        version: 1,
        acceptedFindings: [{ id: 'ADB-0001', type: 'repo_api_unmapped', asset: '/api/test', review_after: '2026-10-06' }],
      }),
    ).toThrow(/accepted_by/);
  });

  it('requires explicit owner metadata for critical baseline entries', () => {
    expect(() =>
      validateAcceptedBaseline({
        version: 1,
        acceptedFindings: [
          {
            id: 'ADB-CRIT',
            type: 'rls_missing_signal',
            asset: 'payments',
            severity: 'critical',
            accepted_by: 'Architecture Owner',
            accepted_reason: 'Reviewed exception.',
            review_after: '2026-10-06',
          },
        ],
      }),
    ).toThrow(/owner/);
  });

  it('classifies stale accepted baseline findings', () => {
    const classified = classifyFindings(
      [makeFinding('repo_api_unmapped', '/api/new')],
      {
        version: 1,
        acceptedFindings: [{ type: 'repo_api_unmapped', asset: '/api/new', review_after: '2020-01-01' }],
      },
    );

    expect(classified.staleAcceptedFindings).toHaveLength(1);
  });

  it('matches capability ownership manifest routes', () => {
    expect(capabilityForRoute('/api/quotes/[id]')).toBe('C02');
    expect(capabilityForRoute('/api/ndis/jobs/pending-match')).toBe('C08');
    expect(capabilityForRoute('/api/auth/register')).toBe('C21');
    expect(capabilityForRoute('/api/webhooks/stripe')).toBe('C03');
    expect(capabilityForTable('job_participant_matches')).toBe('C08');
    expect(capabilityForTable('fundraising_items')).toBe('C15');
  });

  it('honours dependency allowlist behaviour', () => {
    expect(isAllowedDependency('src/app/(app)/dashboard/page.tsx', 'src/components/EmptyState.tsx')).toBe(true);
    expect(isAllowedDependency('src/app/api/quotes/route.ts', 'src/app/api/ndis/organisations/route.ts')).toBe(false);
  });

  it('detects circular dependencies from static imports', async () => {
    const root = await makeTempRepo();
    await writeText(root, 'src/lib/a.ts', "import { b } from './b'; export const a = b;");
    await writeText(root, 'src/lib/b.ts', "import { a } from './a'; export const b = a;");

    const report = await analyzeDependencyGraph({ ...makeInventory(), rootDir: root, sourceFiles: [path.join(root, 'src/lib/a.ts'), path.join(root, 'src/lib/b.ts')] });

    expect(report.cycles.length).toBeGreaterThan(0);
    expect(report.cycles[0].recommendedFix).toContain('Move the shared type/helper');
  });

  it('deduplicates dependency cycles by canonical group', () => {
    const cycles = dedupeCycleGroups([
      ['/repo/src/lib/a.ts', '/repo/src/lib/b.ts', '/repo/src/lib/a.ts'],
      ['/repo/src/lib/b.ts', '/repo/src/lib/a.ts', '/repo/src/lib/b.ts'],
    ], '/repo');

    expect(cycles).toHaveLength(1);
    expect(cycles[0].canonicalKey).toContain('/repo/src/lib/a.ts');
  });

  it('filters allowlisted dependency edges', async () => {
    const root = await makeTempRepo();
    await writeText(root, 'src/app/(app)/dashboard/page.tsx', "import { Empty } from '@/components/EmptyState'; export const Page = Empty;");
    await writeText(root, 'src/components/EmptyState.tsx', 'export const Empty = null;');

    const report = await analyzeDependencyGraph({
      ...makeInventory(),
      rootDir: root,
      sourceFiles: [path.join(root, 'src/app/(app)/dashboard/page.tsx'), path.join(root, 'src/components/EmptyState.tsx')],
    });

    expect(report.crossDomainImports).toHaveLength(0);
  });

  it('detects governance signals conservatively', async () => {
    const root = await makeTempRepo();
    const route = path.join(root, 'src/app/api/test/route.ts');
    const migration = path.join(root, 'supabase/migrations/001.sql');
    await writeText(root, 'src/app/api/test/route.ts', "const attempt_count = 1; try { auditLog(); } catch (error) { console.error(error); } const value = input ?? 'fallback';");
    await writeText(root, 'supabase/migrations/001.sql', 'alter table test_table enable row level security; create policy test_policy on test_table for select using (true);');

    const checks = await analyzeGovernance(makeAtlas(), {
      ...makeInventory(),
      rootDir: root,
      sourceFiles: [route, migration],
    });

    const signals = checks[0].signals;
    expect(signals.rls.status).toBe('present');
    expect(signals.audit.status).toBe('present');
    expect(signals.retry.status).toBe('present');
    expect(signals.monitoring.status).toBe('present');
    expect(signals.fallback.status).toBe('present');
  });

  it('classifies business-loop continuity stages', () => {
    const [loop] = analyzeBusinessLoops(makeAtlas(), makeInventory());

    expect(loop.stages.realityEvent.status).toBe('present');
    expect(loop.stages.capturedData.status).toBe('present');
    expect(loop.stages.decisionAction.status).toBe('present');
  });

  it('classifies table-level RLS coverage', async () => {
    const root = await makeTempRepo();
    const migration = path.join(root, 'supabase/migrations/001.sql');
    await writeText(root, 'supabase/migrations/001.sql', 'alter table test_table enable row level security; create policy p on test_table for select using (true);');

    const report = await analyzeRls(makeAtlas(), {
      ...makeInventory(),
      rootDir: root,
      sourceFiles: [migration],
    });

    expect(report.tables.find((table) => table.table === 'test_table')?.status).toBe('confirmed_policy');
  });

  it('detects dynamic RLS policies for ndis_plan_matches and stripe_disputes', async () => {
    const root = await makeTempRepo();
    const migration = path.join(root, 'supabase/migrations/001_dynamic.sql');
    await writeText(
      root,
      'supabase/migrations/001_dynamic.sql',
      `
do $$
declare t text;
begin
  for t in select unnest(array['stripe_disputes','ndis_plan_matches'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy if not exists "%1$s_admin_read" on public.%1$I for select using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'))$f$, t);
    execute format($f$create policy if not exists "%1$s_service" on public.%1$I for all using (auth.role() = 'service_role')$f$, t);
  end loop;
end $$;
`,
    );

    const report = await analyzeRls(makeRlsBlockerAtlas(), {
      ...makeInventory(),
      rootDir: root,
      migrationTables: ['stripe_disputes', 'ndis_plan_matches'],
      sourceFiles: [migration],
    });

    expect(report.tables.find((table) => table.table === 'ndis_plan_matches')?.status).toBe('confirmed_policy');
    expect(report.tables.find((table) => table.table === 'stripe_disputes')?.status).toBe('confirmed_policy');
  });

  it('has zero critical findings when blocker table policies are present', async () => {
    const root = await makeTempRepo();
    const migration = path.join(root, 'supabase/migrations/001_dynamic.sql');
    await writeText(
      root,
      'supabase/migrations/001_dynamic.sql',
      `
create table if not exists public.stripe_disputes (id text primary key);
create table if not exists public.ndis_plan_matches (id uuid primary key);
do $$
declare t text;
begin
  for t in select unnest(array['stripe_disputes','ndis_plan_matches'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy if not exists "%1$s_admin_read" on public.%1$I for select using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'))$f$, t);
    execute format($f$create policy if not exists "%1$s_service" on public.%1$I for all using (auth.role() = 'service_role')$f$, t);
  end loop;
end $$;
`,
    );

    const report = await buildHealthReport(makeRlsBlockerAtlas(), {
      ...makeInventory({
        pages: [],
        apiRoutes: [],
        agents: [],
        migrationTables: ['stripe_disputes', 'ndis_plan_matches'],
      }),
      rootDir: root,
      sourceFiles: [migration],
    });

    expect(report.criticalBlockers).toHaveLength(0);
    expect(report.baseline.newFindings.filter((finding) => finding.severity === 'critical')).toHaveLength(0);
  });

  it('diffs current and previous reports', async () => {
    const current = await buildHealthReport(makeAtlas(), makeInventory({ apiRoutes: [] }));
    const previous = await buildHealthReport(makeAtlas(), makeInventory({ apiRoutes: [] }));
    previous.healthScore = current.healthScore - 5;

    const diff = diffReports(current, previous, '<previous>');

    expect(diff.hasPrevious).toBe(true);
    expect(diff.scoreMovement).toBe(5);
  });

  it('does not let accepted baseline items swamp the main score', async () => {
    const root = await makeTempRepo();
    const baselinePath = path.join(root, 'baseline.json');
    await writeText(
      root,
      'baseline.json',
      JSON.stringify({ version: 1, acceptedFindings: [{ type: 'atlas_api_missing', asset: '/api/test', capabilityId: 'C99' }] }),
    );

    const report = await buildHealthReport(makeAtlas(), makeInventory({ apiRoutes: [] }), baselinePath);

    expect(report.baseline.acceptedFindings.some((finding) => finding.type === 'atlas_api_missing')).toBe(true);
    expect(report.healthScore).toBeGreaterThan(0);
  });

  it('weights high-risk unknown findings more than low-risk unknowns', () => {
    const lowRisk = makeFinding('repo_page_unmapped', '/yard-debug');
    const highRisk = annotateFindingRisk({ ...makeFinding('repo_api_unmapped', '/api/webhooks/stripe'), assetKind: 'apiRoute' });

    expect(highRisk.riskArea).toBe('webhook route');
    expect(findingPenalty(highRisk)).toBeGreaterThan(findingPenalty(lowRisk));
  });

  it('calibrates sensitive confirmed RLS gaps to critical severity', () => {
    const finding = annotateFindingRisk({
      ...makeFinding('rls_missing_signal', 'payments'),
      assetKind: 'table',
      confidence: 'confirmed',
      severity: 'medium',
    });

    expect(finding.severity).toBe('critical');
    expect(finding.riskArea).toBe('finance/payment table');
  });

  it('does not escalate manifest gaps to enforcement-ready critical issues', () => {
    const finding = annotateFindingRisk({
      ...makeFinding('repo_table_unmapped', 'payments'),
      assetKind: 'table',
      confidence: 'unknown',
      severity: 'low',
    });

    expect(finding.severity).toBe('low');
    expect(finding.riskArea).toBe('finance/payment table');
  });

  it('de-stacks duplicate findings for health score penalties', () => {
    const duplicateA = annotateFindingRisk({
      ...makeFinding('rls_missing_signal', 'payments'),
      assetKind: 'table',
      confidence: 'confirmed',
      severity: 'medium',
      capabilityId: 'C03',
    });
    const duplicateB = {
      ...duplicateA,
      type: 'atlas_table_missing' as const,
      message: 'duplicate symptom',
    };

    expect(calculateHealthScore([duplicateA, duplicateB])).toBe(calculateHealthScore([duplicateA]));
  });

  it('classifies high-risk finance, auth, NDIS, and customer assets', () => {
    expect(annotateFindingRisk({ ...makeFinding('repo_table_unmapped', 'payments'), assetKind: 'table' }).riskArea).toBe('finance/payment table');
    expect(annotateFindingRisk({ ...makeFinding('repo_table_unmapped', 'profiles'), assetKind: 'table' }).riskArea).toBe('auth/session/user data');
    expect(annotateFindingRisk({ ...makeFinding('repo_table_unmapped', 'ndis_documents'), assetKind: 'table' }).riskArea).toBe('NDIS/client data');
    expect(annotateFindingRisk({ ...makeFinding('repo_api_unmapped', '/api/customers'), assetKind: 'apiRoute' }).riskArea).toBe('quote/job/customer API');
  });

  it('evaluates CLI dry-run fail mode', async () => {
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));

    expect(evaluateFailMode(report, ['critical']).shouldFail).toBe(true);
    expect(evaluateFailMode(report, ['score-below=101']).shouldFail).toBe(true);
    expect(evaluateFailMode(report, ['score-below=1']).shouldFail).toBe(false);
  });

  it('never fails on findings in advisory mode', async () => {
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));
    const result = evaluateFailMode(report, ['critical', 'new', 'score-below=101'], { advisory: true });

    expect(result.shouldFail).toBe(false);
    expect(result.reasons.join(' ')).toContain('advisory-only');
  });

  it('triages critical candidates without making manifest gaps enforcement-ready', () => {
    const confirmed = annotateFindingRisk({
      ...makeFinding('rls_missing_signal', 'payments'),
      assetKind: 'table',
      confidence: 'confirmed',
      severity: 'medium',
      capabilityId: 'C03',
    });
    const unknown = annotateFindingRisk({
      ...makeFinding('rls_unknown', 'sessions'),
      assetKind: 'table',
      confidence: 'unknown',
      severity: 'low',
      capabilityId: 'C21',
    });
    const manifestGap = annotateFindingRisk({
      ...makeFinding('repo_table_unmapped', 'ndis_documents'),
      assetKind: 'table',
      confidence: 'unknown',
      severity: 'low',
      capabilityId: 'C08',
    });

    const triage = triageCriticalCandidates([confirmed, unknown, manifestGap, { ...manifestGap, message: 'duplicate' }]);

    expect(triage.map((item) => item.classification)).toEqual([
      'confirmed real issue',
      'static-analysis unknown',
      'manifest/baseline gap',
      'duplicate/noisy finding',
    ]);
    expect(triage.find((item) => item.classification === 'manifest/baseline gap')?.requiredChange).toBe('manifest/baseline update');
  });

  it('builds a critical blocker report with enforcement details', () => {
    const triage = triageCriticalCandidates([
      annotateFindingRisk({
        ...makeFinding('rls_missing_signal', 'payments'),
        assetKind: 'table',
        confidence: 'confirmed',
        severity: 'medium',
        capabilityId: 'C03',
        owner: 'CFO',
        evidence: ['supabase/migrations/001.sql'],
      }),
    ]);

    const blockers = buildCriticalBlockers(triage);

    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({
      asset: 'payments',
      requiredChange: 'migration',
      owner: 'CFO',
    });
    expect(blockers[0].whyCritical).toContain('Sensitive');
    expect(blockers[0].smallestSafeFix).toContain('RLS');
  });

  it('summarises CI readiness conservatively', () => {
    const triage = triageCriticalCandidates([
      annotateFindingRisk({
        ...makeFinding('rls_missing_signal', 'payments'),
        assetKind: 'table',
        confidence: 'confirmed',
        severity: 'medium',
      }),
    ]);
    const summary = buildCiReadiness(
      triage,
      [],
      { filesScanned: 1, importEdges: 1, cycles: [{ files: ['a.ts', 'b.ts'], canonicalKey: 'a|b' }], crossDomainImports: [] },
    );

    expect(summary.ready).toBe(true);
    expect(summary.summary).toContain('advisory-only');
    expect(summary.blockers.join(' ')).toContain('critical');
    expect(summary.blockers.join(' ')).toContain('dependency cycle');
  });

  it('writes the advisory CI plan with report output', async () => {
    const root = await makeTempRepo();
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));
    const written = await writeReports(report, { outputDir: root, format: 'all' });

    expect(written.map((file) => path.basename(file))).toContain('architecture-doctor-ci-plan.md');
    expect(written.map((file) => path.basename(file))).toContain('architecture-doctor-pr-summary.md');
    expect(readFileSync(path.join(root, 'architecture-doctor-ci-plan.md'), 'utf8')).toContain('--ci-advisory');
    expect(readFileSync(path.join(root, 'architecture-doctor-pr-summary.md'), 'utf8')).toContain('Architecture Doctor Advisory Summary');
  });

  it('includes critical triage in JSON and markdown reports', async () => {
    const root = await makeTempRepo();
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));

    expect(report.criticalTriage.length).toBeGreaterThan(0);

    await writeReports(report, { outputDir: root, format: 'all' });
    const json = JSON.parse(readFileSync(path.join(root, 'architecture-health.json'), 'utf8')) as { criticalTriage: unknown[] };
    const markdown = readFileSync(path.join(root, 'architecture-drift-report.md'), 'utf8');

    expect(json.criticalTriage.length).toBeGreaterThan(0);
    expect(markdown).toContain('## Critical findings triage');
    expect(markdown).toContain('confirmed real issue');
  });

  it('adds weighted architecture health categories to the report', async () => {
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));

    expect(report.architectureHealth.overall).toBe(report.healthScore);
    expect(report.architectureHealth.categories.Security.weight).toBe(25);
    expect(report.architectureHealth.categories.Database.weight).toBe(20);
    expect(Object.keys(report.architectureHealth.categories)).toEqual([
      'Security',
      'Database',
      'Dependency Architecture',
      'Documentation',
      'Performance',
      'Maintainability',
    ]);
  });

  it('enriches every finding with category, source, evidence, and remediation', async () => {
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));

    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(['confirmed', 'high', 'medium', 'low']).toContain(finding.confidence);
      expect(finding.category).toBeTruthy();
      expect(Array.isArray(finding.evidence)).toBe(true);
      expect(finding.remediation).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(finding, 'source')).toBe(true);
    }
  });

  it('reports trend deltas between repeated runs', async () => {
    const current = await buildHealthReport(makeAtlas(), makeInventory({ apiRoutes: [] }));
    const previous = await buildHealthReport(makeAtlas(), makeInventory({ apiRoutes: [] }));
    previous.healthScore = current.healthScore - 3;
    previous.baseline.newFindings = previous.baseline.newFindings.slice(1);
    previous.dependencyGraph.cycles = [{ files: ['a.ts', 'b.ts'] }];

    const trend = buildTrendReport(current, previous, '<previous>');

    expect(trend.hasPrevious).toBe(true);
    expect(trend.scoreDelta).toBe(3);
    expect(typeof trend.criticalCountDelta).toBe('number');
    expect(trend.dependencyCycleDelta).toBe(current.dependencyGraph.cycles.length - 1);
  });

  it('builds advisory GitHub output without enforcement semantics', async () => {
    const report = await buildHealthReport(makeSensitiveAtlas(), makeInventory({ migrationTables: ['payments'] }));
    const output = buildAdvisoryGithubOutput(report);

    expect(output.summaryMarkdown).toContain('advisory-only');
    expect(output.summaryMarkdown).toContain('Health score');
    expect(output.annotations.length).toBeGreaterThan(0);
    expect(output.annotations.every((annotation) => annotation.level === 'notice' || annotation.level === 'warning')).toBe(true);
  });

  it('calculates category health from weighted findings', () => {
    const health = calculateArchitectureHealth([
      {
        ...makeFinding('rls_missing_signal', 'payments'),
        assetKind: 'table',
        severity: 'critical',
        confidence: 'confirmed',
        category: 'Security',
      },
      {
        ...makeFinding('dependency_cycle', 'src/lib/a.ts'),
        assetKind: 'worker',
        severity: 'medium',
        confidence: 'confirmed',
        category: 'Dependency Architecture',
      },
    ]);

    expect(health.overall).toBeLessThan(100);
    expect(health.categories.Security.score).toBeLessThan(health.categories.Documentation.score);
  });

  it('calibrates security scoring without collapsing non-critical findings to zero', () => {
    const health = calculateArchitectureHealth([
      {
        ...makeFinding('atlas_table_missing', 'users'),
        assetKind: 'table',
        severity: 'high',
        confidence: 'confirmed',
        riskWeight: 3,
        riskArea: 'auth/session/user data',
      },
      {
        ...makeFinding('rls_unknown', 'users'),
        assetKind: 'table',
        severity: 'medium',
        confidence: 'medium',
        riskWeight: 3,
        riskArea: 'auth/session/user data',
      },
      {
        ...makeFinding('dependency_cycle', 'src/app/(app)/dashboard/design/DesignDashboardClient.tsx'),
        assetKind: 'worker',
        severity: 'medium',
        confidence: 'confirmed',
      },
    ]);

    expect(health.categories.Security.score).toBeGreaterThan(0);
    expect(health.categories.Security.score).toBeLessThan(100);
    expect(health.categories['Dependency Architecture'].score).toBeLessThan(100);
  });

  it('classifies dependency cycle readiness for enforcement preparation', () => {
    const groups = groupDependencyCycleReadiness({
      filesScanned: 8,
      importEdges: 8,
      cycles: [
        { files: ['src/lib/payments/a.ts', 'src/lib/payments/b.ts'], domain: 'payments', capabilityId: 'C03' },
        { files: ['tests/lib/a.test.ts', 'tests/lib/helper.ts'], domain: 'lib' },
        { files: ['src/lib/design-system/themes/index.ts', 'src/lib/design-system/themes/dashboard.ts'], domain: 'design-system', capabilityId: 'C22' },
        { files: ['unknown/a.ts', 'unknown/b.ts'], domain: 'unknown' },
      ],
      crossDomainImports: [],
    });

    expect(groups).toHaveLength(4);
    expect(groups.find((group) => group.domain === 'payments')?.classification).toBe('production architecture issue');
    expect(groups.find((group) => group.classification === 'test/tooling noise')?.recommendation).toContain('advisory-only');
    expect(groups.find((group) => group.classification === 'acceptable shared-layer cycle')?.recommendation).toContain('do not block CI');
    expect(groups.find((group) => group.classification === 'needs manual review')?.recommendation).toContain('Review manually');
  });

  it('builds enforcement-readiness checklist without enabling enforcement', () => {
    const checklist = buildEnforcementReadiness(
      [
        {
          id: 'rls_missing_signal|table|payments|C03',
          asset: 'payments',
          assetKind: 'table',
          capabilityId: 'C03',
          owner: 'CFO',
          evidence: [],
          whyCritical: 'Sensitive finance table missing RLS.',
          smallestSafeFix: 'Add RLS migration.',
          requiredChange: 'migration',
        },
      ],
      [
        {
          domain: 'payments',
          capabilityId: 'C03',
          classification: 'production architecture issue',
          cycles: [{ files: ['src/lib/payments/a.ts', 'src/lib/payments/b.ts'], domain: 'payments', capabilityId: 'C03' }],
          recommendation: 'Extract shared payments types/helpers into a leaf module.',
        },
      ],
      [],
      false,
      false,
    );

    expect(checklist.ready).toBe(false);
    expect(checklist.items.map((item) => item.label)).toContain('critical findings = 0');
    expect(checklist.items.find((item) => item.id === 'critical-findings-zero')?.passed).toBe(false);
    expect(checklist.futureModeRecommendation).toContain('Future only');
  });

  it('keeps enforcement readiness gated after critical blockers are cleared', () => {
    const checklist = buildEnforcementReadiness(
      [],
      [
        {
          domain: 'mission-control',
          capabilityId: 'C17',
          classification: 'production architecture issue',
          cycles: [{ files: ['src/app/a.tsx', 'src/app/b.tsx'], domain: 'mission-control', capabilityId: 'C17' }],
          recommendation: 'Extract shared mission-control types/helpers into a leaf module.',
        },
      ],
      [],
      false,
      false,
    );

    expect(checklist.items.find((item) => item.id === 'critical-findings-zero')?.passed).toBe(true);
    expect(checklist.items.find((item) => item.id === 'dependency-cycles-reviewed')?.passed).toBe(false);
    expect(checklist.items.find((item) => item.id === 'advisory-release-cycle')?.passed).toBe(false);
    expect(checklist.ready).toBe(false);
  });

  it('marks enforcement readiness complete when release cycle and threshold are agreed', () => {
    const checklist = buildEnforcementReadiness([], [
      {
        domain: 'design-system',
        capabilityId: 'C22',
        classification: 'acceptable shared-layer cycle',
        cycles: [{ files: ['src/lib/design-system/themes/index.ts', 'src/lib/design-system/themes/dashboard.ts'], domain: 'design-system', capabilityId: 'C22' }],
        recommendation: 'Document as acceptable.',
      },
    ], [], true, true);

    expect(checklist.items.find((item) => item.id === 'advisory-release-cycle')?.passed).toBe(true);
    expect(checklist.items.find((item) => item.id === 'score-threshold-agreed')?.passed).toBe(true);
    expect(checklist.ready).toBe(true);
  });

  it('keeps advisory workflow non-blocking for architecture findings', () => {
    const workflow = readFileSync(path.join(process.cwd(), '.github/workflows/architecture-doctor-advisory.yml'), 'utf8');

    expect(workflow).toContain('--ci-advisory');
    expect(workflow).toContain('GITHUB_STEP_SUMMARY');
    expect(workflow).toContain('::${level}');
    expect(workflow).not.toContain('--fail-on critical');
    expect(workflow).not.toContain('--fail-on new');
    expect(workflow).not.toContain('score-below');
  });

  it('keeps advisory enforcement mode non-failing even when gates would trigger', () => {
    const result = evaluateEnforcementPolicy(makePolicyReport({
      healthScore: 40,
      newFindings: [makeCriticalFinding('payments')],
    }), {
      enforcementMode: 'advisory',
      minimumHealthScore: 80,
      failOnCritical: true,
      failOnExpiredBaseline: true,
      releaseCycleObserved: true,
      scoreThresholdAgreed: true,
    });

    expect(result.blockingWouldOccur).toBe(true);
    expect(result.shouldFail).toBe(false);
    expect(result.blockingDisabledReasons).toContain('enforcementMode is advisory');
  });

  it('keeps warn_only enforcement mode non-failing while reporting would-block state', () => {
    const result = evaluateEnforcementPolicy(makePolicyReport({
      healthScore: 40,
      newFindings: [makeCriticalFinding('payments')],
    }), {
      enforcementMode: 'warn_only',
      minimumHealthScore: 80,
      failOnCritical: true,
      failOnExpiredBaseline: false,
      releaseCycleObserved: true,
      scoreThresholdAgreed: true,
    });

    expect(result.blockingWouldOccur).toBe(true);
    expect(result.shouldFail).toBe(false);
    expect(result.blockingDisabledReasons).toContain('enforcementMode is warn_only');
  });

  it('fails block_on_critical only for unresolved critical findings', () => {
    const config = {
      enforcementMode: 'block_on_critical' as const,
      minimumHealthScore: 80,
      failOnCritical: false,
      failOnExpiredBaseline: false,
      releaseCycleObserved: true,
      scoreThresholdAgreed: true,
    };

    expect(evaluateEnforcementPolicy(makePolicyReport({ newFindings: [] }), config).shouldFail).toBe(false);
    expect(evaluateEnforcementPolicy(makePolicyReport({ newFindings: [makeCriticalFinding('payments')] }), config).shouldFail).toBe(true);
  });

  it('fails block_on_threshold only below the configured score', () => {
    const config = {
      enforcementMode: 'block_on_threshold' as const,
      minimumHealthScore: 80,
      failOnCritical: false,
      failOnExpiredBaseline: false,
      releaseCycleObserved: true,
      scoreThresholdAgreed: true,
    };

    expect(evaluateEnforcementPolicy(makePolicyReport({ healthScore: 80 }), config).shouldFail).toBe(false);
    expect(evaluateEnforcementPolicy(makePolicyReport({ healthScore: 79 }), config).shouldFail).toBe(true);
  });

  it('fails for expired baseline only when explicitly enabled', () => {
    const baseConfig = {
      enforcementMode: 'block_on_critical' as const,
      minimumHealthScore: 80,
      failOnCritical: false,
      releaseCycleObserved: true,
      scoreThresholdAgreed: true,
    };
    const report = makePolicyReport({
      acceptedFindings: [{ ...makeFinding('repo_api_unmapped', '/api/old'), baselineExpiryDate: '2020-01-01' }],
    });

    expect(evaluateEnforcementPolicy(report, { ...baseConfig, failOnExpiredBaseline: false }).shouldFail).toBe(false);
    expect(evaluateEnforcementPolicy(report, { ...baseConfig, failOnExpiredBaseline: true }).shouldFail).toBe(true);
  });

  it('renders threshold dry-run output for a passing score without blocking', () => {
    const policy = evaluateEnforcementPolicy(makePolicyReport({ healthScore: 80 }), {
      enforcementMode: 'advisory',
      minimumHealthScore: 80,
      failOnCritical: false,
      failOnExpiredBaseline: false,
      releaseCycleObserved: false,
      scoreThresholdAgreed: false,
    });
    const dryRun = evaluateThresholdDryRun({ healthScore: 80 }, policy);
    const markdown = renderThresholdDryRunMarkdown(dryRun);

    expect(dryRun.wouldPass).toBe(true);
    expect(dryRun.wouldFail).toBe(false);
    expect(dryRun.nonBlockingReasons).toContain('enforcementMode is advisory');
    expect(markdown).toContain('Current health score | 80/100');
    expect(markdown).toContain('Proposed minimum threshold | 80/100');
    expect(markdown).toContain('Dry-run result | would pass');
  });

  it('renders threshold dry-run output for a failing score as warn-only evidence', () => {
    const policy = evaluateEnforcementPolicy(makePolicyReport({ healthScore: 79 }), {
      enforcementMode: 'warn_only',
      minimumHealthScore: 80,
      failOnCritical: false,
      failOnExpiredBaseline: false,
      releaseCycleObserved: false,
      scoreThresholdAgreed: false,
    });
    const dryRun = evaluateThresholdDryRun({ healthScore: 79 }, policy);
    const markdown = renderThresholdDryRunMarkdown(dryRun);

    expect(dryRun.wouldPass).toBe(false);
    expect(dryRun.wouldFail).toBe(true);
    expect(dryRun.nonBlockingReasons).toContain('enforcementMode is warn_only');
    expect(markdown).toContain('Dry-run result | would fail');
    expect(markdown).toContain('Exact reasons it would not block today');
  });

  it('creates advisory release-cycle observations from report metrics', () => {
    const report = makeReleaseCycleReport();
    const observation = createReleaseCycleObservation(report, 'abc123', '2026-07-09T01:02:03.000Z');

    expect(observation).toMatchObject({
      id: 'advisory-2026-07-09-01-02-03-000',
      runDate: '2026-07-09T01:02:03.000Z',
      gitCommit: 'abc123',
      healthScore: 80,
      criticalCount: 0,
      securityScore: 99,
      dependencyCycleCount: 2,
      baselinedFindings: 1,
      expiredBaselines: 0,
      enforcementMode: 'advisory',
      blockingWouldOccur: false,
      clean: true,
    });
  });

  it('does not count the current advisory observation as an already observed release cycle', () => {
    const observation = createReleaseCycleObservation(makeReleaseCycleReport(), 'abc123', '2026-07-09T01:02:03.000Z');
    const prior = { version: 1 as const, observations: [] };
    const history = appendReleaseCycleObservation(prior, observation);
    const summary = summarizeReleaseCycleEvidence(history, prior, { currentObservation: observation });

    expect(summary.observationCount).toBe(1);
    expect(summary.cleanAdvisoryReleaseCycleObserved).toBe(false);
    expect(summary.evidenceStillMissing).toContain('two complete clean advisory/warn-only release-cycle observations');
  });

  it('recognizes a clean advisory release cycle only from prior history', () => {
    const priorObservation = createReleaseCycleObservation(makeReleaseCycleReport(), 'abc123', '2026-07-01T01:02:03.000Z');
    const currentObservation = createReleaseCycleObservation(makeReleaseCycleReport(), 'def456', '2026-07-09T01:02:03.000Z');
    const prior = { version: 1 as const, observations: [priorObservation] };
    const history = appendReleaseCycleObservation(prior, currentObservation);
    const summary = summarizeReleaseCycleEvidence(history, prior, { currentObservation });

    expect(summary.observationCount).toBe(2);
    expect(summary.cleanAdvisoryReleaseCycleObserved).toBe(true);
    expect(summary.evidenceStillMissing).toHaveLength(0);
  });

  it('treats warn_only observations as clean when score and threshold evidence pass', () => {
    const report = makeReleaseCycleReport({ enforcementMode: 'warn_only' });
    const observation = createReleaseCycleObservation(report, 'abc123', '2026-07-09T01:02:03.000Z');

    expect(observation.enforcementMode).toBe('warn_only');
    expect(observation.clean).toBe(true);
  });
});

describe('Architecture Doctor final safety check', () => {
  const passingConfig = {
    enforcementMode: 'block_on_critical' as const,
    minimumHealthScore: 80,
    failOnCritical: false,
    failOnExpiredBaseline: false,
    releaseCycleObserved: true,
    scoreThresholdAgreed: true,
  };

  it('passes when all conditions are met', () => {
    const result = runFinalSafetyCheck(makePolicyReport({ healthScore: 80 }), passingConfig);

    expect(result.passed).toBe(true);
    expect(result.items.every((item) => item.passed)).toBe(true);
    expect(result.summary).toContain('All safety checks passed');
  });

  it('fails and names the blocker when critical findings exist', () => {
    const result = runFinalSafetyCheck(
      makePolicyReport({ healthScore: 80, newFindings: [makeCriticalFinding('payments')] }),
      passingConfig,
    );

    expect(result.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'critical-count-zero')?.passed).toBe(false);
    expect(result.summary).toContain('critical count = 0');
  });

  it('fails when health score is below minimum', () => {
    const result = runFinalSafetyCheck(makePolicyReport({ healthScore: 79 }), passingConfig);

    expect(result.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'health-score-minimum')?.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'health-score-minimum')?.value).toBe(79);
  });

  it('passes at exactly the minimum health score', () => {
    const result = runFinalSafetyCheck(makePolicyReport({ healthScore: 80 }), passingConfig);

    expect(result.items.find((item) => item.id === 'health-score-minimum')?.passed).toBe(true);
  });

  it('fails when stale baseline entries exist', () => {
    const report = {
      healthScore: 80,
      baseline: { ...makePolicyReport().baseline, staleAcceptedFindings: [makeFinding('repo_api_unmapped', '/api/old')] },
    };
    const result = runFinalSafetyCheck(report, passingConfig);

    expect(result.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'baselines-not-expired')?.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'baselines-not-expired')?.value).toBe(1);
  });

  it('fails when releaseCycleObserved is false', () => {
    const result = runFinalSafetyCheck(
      makePolicyReport({ healthScore: 80 }),
      { ...passingConfig, releaseCycleObserved: false },
    );

    expect(result.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'release-cycle-observed')?.passed).toBe(false);
  });

  it('fails when scoreThresholdAgreed is false', () => {
    const result = runFinalSafetyCheck(
      makePolicyReport({ healthScore: 80 }),
      { ...passingConfig, scoreThresholdAgreed: false },
    );

    expect(result.passed).toBe(false);
    expect(result.items.find((item) => item.id === 'score-threshold-agreed')?.passed).toBe(false);
  });

  it('counts all failing checks in the summary', () => {
    const result = runFinalSafetyCheck(
      makePolicyReport({ healthScore: 79, newFindings: [makeCriticalFinding('payments')] }),
      { ...passingConfig, releaseCycleObserved: false, scoreThresholdAgreed: false },
    );

    expect(result.passed).toBe(false);
    expect(result.items.filter((item) => !item.passed)).toHaveLength(4);
    expect(result.summary).toContain('4 safety checks failed');
  });

  it('verifies blocking dry-run workflow exists and does not use --ci-advisory', () => {
    const workflow = readFileSync(path.join(process.cwd(), '.github/workflows/architecture-doctor-blocking-dry-run.yml'), 'utf8');

    expect(workflow).toContain('architecture:doctor:blocking-dry-run');
    expect(workflow).not.toContain('--ci-advisory');
    expect(workflow).toContain('non-required');
    expect(workflow).toContain('GITHUB_STEP_SUMMARY');
  });
});

function makeAtlas(): AtlasSpec {
  return {
    sourcePath: '<test>',
    capabilities: [
      {
        id: 'C99',
        name: 'Test Capability',
        criticality: 5,
        maturity: 3,
        priority: 10,
        uiPages: ['/test'],
        apiRoutes: ['/api/test'],
        agents: ['test-agent'],
        cronWorkers: [],
        tables: ['test_table'],
        buckets: [],
        externalIntegrations: [],
        envVars: [],
        featureFlags: [],
      },
    ],
  };
}

function makeSensitiveAtlas(): AtlasSpec {
  return {
    sourcePath: '<test>',
    capabilities: [
      {
        id: 'C03',
        name: 'Payments',
        criticality: 9,
        maturity: 3,
        priority: 18,
        uiPages: ['/test'],
        apiRoutes: ['/api/test'],
        agents: ['test-agent'],
        cronWorkers: [],
        tables: ['payments'],
        buckets: [],
        externalIntegrations: [],
        envVars: [],
        featureFlags: [],
      },
    ],
  };
}

function makeRlsBlockerAtlas(): AtlasSpec {
  return {
    sourcePath: '<test>',
    capabilities: [
      {
        id: 'C07',
        name: 'Dispute Evidence',
        owner: 'CFO',
        criticality: 9,
        maturity: 3,
        priority: 18,
        uiPages: [],
        apiRoutes: [],
        agents: [],
        cronWorkers: [],
        tables: ['stripe_disputes'],
        buckets: [],
        externalIntegrations: [],
        envVars: [],
        featureFlags: [],
      },
      {
        id: 'C08',
        name: 'NDIS Matching',
        owner: 'NDIS / Operations',
        criticality: 9,
        maturity: 3,
        priority: 18,
        uiPages: [],
        apiRoutes: [],
        agents: [],
        cronWorkers: [],
        tables: ['ndis_plan_matches'],
        buckets: [],
        externalIntegrations: [],
        envVars: [],
        featureFlags: [],
      },
    ],
  };
}

function makeInventory(overrides: Partial<ArchitectureInventory> = {}): ArchitectureInventory {
  return {
    rootDir: '<test>',
    sourceFiles: [],
    pages: ['/test'],
    apiRoutes: ['/api/test'],
    agents: ['test-agent'],
    cronEntries: [],
    cronRouteCandidates: [],
    migrationTables: ['test_table'],
    migrationViews: [],
    tableUsages: [],
    envVars: [],
    storageBuckets: [],
    ...overrides,
  };
}

function makeFinding(type: DriftFinding['type'], asset: string): DriftFinding {
  return {
    type,
    severity: 'low',
    confidence: type.startsWith('repo_') ? 'unknown' : 'confirmed',
    assetKind: 'apiRoute',
    asset,
    message: asset,
  };
}

function makeCriticalFinding(asset: string): DriftFinding {
  return {
    ...makeFinding('rls_missing_signal', asset),
    assetKind: 'table',
    severity: 'critical',
    confidence: 'confirmed',
  };
}

function makePolicyReport(options: {
  healthScore?: number;
  newFindings?: DriftFinding[];
  acceptedFindings?: DriftFinding[];
} = {}) {
  return {
    healthScore: options.healthScore ?? 100,
    baseline: {
      newFindings: options.newFindings ?? [],
      acceptedFindings: options.acceptedFindings ?? [],
      resolvedFindings: [],
      unknownUnmappedAssets: [],
      staleAcceptedFindings: [],
    },
    enforcementReadiness: {
      ready: true,
      items: [
        { id: 'critical-findings-zero', label: 'critical findings = 0', passed: true, details: '0 confirmed critical blockers remain.' },
        { id: 'dependency-cycles-reviewed', label: 'dependency cycles reviewed', passed: true, details: 'All cycles reviewed.' },
        { id: 'baseline-stale-zero', label: 'baseline stale items = 0', passed: true, details: '0 stale accepted baseline findings need review.' },
        { id: 'advisory-release-cycle', label: 'advisory CI has run for one release cycle', passed: true, details: 'Observed.' },
        { id: 'score-threshold-agreed', label: 'score threshold agreed', passed: true, details: 'Configured.' },
        { id: 'high-risk-owners-assigned', label: 'owners assigned for high-risk domains', passed: true, details: 'All assigned.' },
      ],
      futureModeRecommendation: 'Ready for local trial.',
    },
  };
}

function makeReleaseCycleReport(options: { enforcementMode?: 'advisory' | 'warn_only'; thresholdPasses?: boolean } = {}) {
  const enforcementMode = options.enforcementMode ?? 'advisory';
  const thresholdPasses = options.thresholdPasses ?? true;
  return {
    generatedAt: '2026-07-09T01:02:03.000Z',
    healthScore: 80,
    architectureHealth: {
      overall: 80,
      categories: {
        Security: { category: 'Security' as const, weight: 25, score: 99, findings: 2, summary: '' },
        Database: { category: 'Database' as const, weight: 20, score: 85, findings: 40, summary: '' },
        'Dependency Architecture': { category: 'Dependency Architecture' as const, weight: 20, score: 41, findings: 105, summary: '' },
        Documentation: { category: 'Documentation' as const, weight: 15, score: 73, findings: 27, summary: '' },
        Performance: { category: 'Performance' as const, weight: 10, score: 97, findings: 7, summary: '' },
        Maintainability: { category: 'Maintainability' as const, weight: 10, score: 94, findings: 5, summary: '' },
      },
    },
    baseline: {
      newFindings: [],
      acceptedFindings: [makeFinding('rls_unknown', 'ndis_roles')],
      resolvedFindings: [],
      unknownUnmappedAssets: [],
      staleAcceptedFindings: [],
    },
    dependencyGraph: {
      filesScanned: 3,
      importEdges: 3,
      cycles: [{ files: ['a.ts', 'b.ts'] }, { files: ['c.ts', 'd.ts'] }],
      crossDomainImports: [],
    },
    enforcementPolicy: {
      config: {
        enforcementMode,
        minimumHealthScore: 80,
        failOnCritical: false,
        failOnExpiredBaseline: false,
        releaseCycleObserved: false,
        scoreThresholdAgreed: false,
      },
      shouldFail: false,
      blockingWouldOccur: false,
      failureReasons: [],
      blockingDisabledReasons: [`enforcementMode is ${enforcementMode}`],
      missingChecklistItems: [],
    },
    thresholdDryRun: {
      currentHealthScore: thresholdPasses ? 80 : 79,
      proposedMinimumHealthScore: 80,
      wouldPass: thresholdPasses,
      wouldFail: !thresholdPasses,
      nonBlockingReasons: [],
    },
  } as ArchitectureHealthReport;
}

async function makeTempRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'architecture-doctor-'));
  tempDirs.push(dir);
  return dir;
}

async function writeText(root: string, file: string, text: string): Promise<void> {
  const fullPath = path.join(root, file);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, text, 'utf8');
}
