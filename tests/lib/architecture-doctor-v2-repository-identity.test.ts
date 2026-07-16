import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluatePhase13StatisticalGovernance,
  evaluatePhase14EvidenceQuality,
  readRepositoryStateIdentity,
  runPhase12CronRouteShadowExecution,
  REPOSITORY_IDENTITY_ALGORITHM_VERSION,
  type Phase12ShadowHistory,
} from '@/lib/architecture-doctor/v2';
import type { ArchitectureInventory, AtlasSpec } from '@/lib/architecture-doctor/types';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Architecture Doctor v2 repository identity — content-aware fingerprint', () => {
  it('is deterministic across repeated calculation of the same state', async () => {
    const rootDir = await makeGitRepo();
    await writeRelevantFile(rootDir, 'src/app/page.tsx', 'export default function Page() { return null; }\n');

    const first = await readRepositoryStateIdentity(rootDir);
    const second = await readRepositoryStateIdentity(rootDir);

    expect(first.worktreeFingerprint).toBeDefined();
    expect(first.worktreeFingerprint).toBe(second.worktreeFingerprint);
    expect(first.identity).toBe(second.identity);
  });

  it('changes fingerprint when an unregistered cron route is added, and restores it on removal', async () => {
    const rootDir = await makeGitRepo();
    const baseline = await readRepositoryStateIdentity(rootDir);
    expect(baseline.dirty).toBe(false);
    expect(baseline.worktreeFingerprint).toBeUndefined();

    const routeDir = path.join(rootDir, 'src/app/api/cron/architecture-doctor-test');
    await mkdir(routeDir, { recursive: true });
    await writeFile(path.join(routeDir, 'route.ts'), 'export async function GET() { return new Response("ok"); }\n');
    const injected = await readRepositoryStateIdentity(rootDir);
    expect(injected.dirty).toBe(true);
    expect(injected.identity).not.toBe(baseline.identity);

    await rm(routeDir, { recursive: true, force: true });
    const restored = await readRepositoryStateIdentity(rootDir);
    expect(restored.dirty).toBe(false);
    expect(restored.identity).toBe(baseline.identity);
    expect(restored.worktreeFingerprint).toBe(baseline.worktreeFingerprint);
  });

  it('produces different fingerprints for two different content edits to the same already-dirty relevant file', async () => {
    const rootDir = await makeGitRepo();
    await writeRelevantFile(rootDir, 'src/lib/pricing/engine.ts', 'export const RATE = 1;\n');

    await writeFile(path.join(rootDir, 'src/lib/pricing/engine.ts'), 'export const RATE = 2;\n');
    const editOne = await readRepositoryStateIdentity(rootDir);

    await writeFile(path.join(rootDir, 'src/lib/pricing/engine.ts'), 'export const RATE = 3;\n');
    const editTwo = await readRepositoryStateIdentity(rootDir);

    expect(editOne.worktreeFingerprint).toBeDefined();
    expect(editTwo.worktreeFingerprint).toBeDefined();
    expect(editOne.worktreeFingerprint).not.toBe(editTwo.worktreeFingerprint);
  });

  it('does not change when Dev Log content is edited', async () => {
    const rootDir = await makeGitRepo();
    await writeRelevantFile(rootDir, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
    await commitPath(rootDir, 'Buds At Work/Dev/Dev Log 2026-07-16.md', '# Dev Log\n');

    const before = await readRepositoryStateIdentity(rootDir);
    await writeFile(path.join(rootDir, 'Buds At Work/Dev/Dev Log 2026-07-16.md'), '# Dev Log\n\nEdited entry.\n');
    const after = await readRepositoryStateIdentity(rootDir);

    expect(after.dirty).toBe(before.dirty);
    expect(after.identity).toBe(before.identity);
  });

  it('does not change when graphify-out/** is edited', async () => {
    const rootDir = await makeGitRepo();
    await writeRelevantFile(rootDir, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
    await commitPath(rootDir, 'graphify-out/GRAPH_REPORT.md', '# Graph Report\n');

    const before = await readRepositoryStateIdentity(rootDir);
    await writeFile(path.join(rootDir, 'graphify-out/GRAPH_REPORT.md'), '# Graph Report\n\nRebuilt.\n');
    const after = await readRepositoryStateIdentity(rootDir);

    expect(after.dirty).toBe(before.dirty);
    expect(after.identity).toBe(before.identity);
  });

  it('does not change when Architecture Doctor generated evidence is edited', async () => {
    const rootDir = await makeGitRepo();
    await writeRelevantFile(rootDir, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
    await commitPath(
      rootDir,
      'Buds At Work/01 Architecture/Architecture Doctor/architecture-doctor-phase12-cron-route-shadow-history.json',
      '{"version":1,"records":[]}\n',
    );

    const before = await readRepositoryStateIdentity(rootDir);
    await writeFile(
      path.join(rootDir, 'Buds At Work/01 Architecture/Architecture Doctor/architecture-doctor-phase12-cron-route-shadow-history.json'),
      `{"version":1,"records":[{"runId":"run-${Date.now()}"}]}\n`,
    );
    const after = await readRepositoryStateIdentity(rootDir);

    expect(after.dirty).toBe(before.dirty);
    expect(after.identity).toBe(before.identity);
  });

  it('changes when vercel.json is edited', async () => {
    const rootDir = await makeGitRepo();
    await commitPath(rootDir, 'vercel.json', '{"crons":[]}\n');

    const before = await readRepositoryStateIdentity(rootDir);
    await writeFile(path.join(rootDir, 'vercel.json'), '{"crons":[{"path":"/api/cron/example","schedule":"0 * * * *"}]}\n');
    const after = await readRepositoryStateIdentity(rootDir);

    expect(after.dirty).toBe(true);
    expect(after.identity).not.toBe(before.identity);
  });

  it('changes when an untracked relevant source file is added', async () => {
    const rootDir = await makeGitRepo();
    const before = await readRepositoryStateIdentity(rootDir);

    await mkdir(path.join(rootDir, 'src/lib'), { recursive: true });
    await writeFile(path.join(rootDir, 'src/lib/new-helper.ts'), 'export const NEW = true;\n');
    const after = await readRepositoryStateIdentity(rootDir);

    expect(before.dirty).toBe(false);
    expect(after.dirty).toBe(true);
    expect(after.identity).not.toBe(before.identity);
  });

  it('changes when a relevant tracked file is deleted', async () => {
    const rootDir = await makeGitRepo();
    await commitPath(rootDir, 'src/lib/to-delete.ts', 'export const GONE = false;\n');

    const before = await readRepositoryStateIdentity(rootDir);
    await unlink(path.join(rootDir, 'src/lib/to-delete.ts'));
    const after = await readRepositoryStateIdentity(rootDir);

    expect(after.dirty).toBe(true);
    expect(after.identity).not.toBe(before.identity);
  });

  it('is unaffected by file discovery/creation order', async () => {
    const repoA = await makeGitRepo();
    await writeRelevantFile(repoA, 'src/a.ts', 'export const A = 1;\n');
    await writeRelevantFile(repoA, 'src/z.ts', 'export const Z = 1;\n');
    const identityA = await readRepositoryStateIdentity(repoA);

    const repoB = await makeGitRepo();
    await writeRelevantFile(repoB, 'src/z.ts', 'export const Z = 1;\n');
    await writeRelevantFile(repoB, 'src/a.ts', 'export const A = 1;\n');
    const identityB = await readRepositoryStateIdentity(repoB);

    expect(identityA.worktreeFingerprint).toBe(identityB.worktreeFingerprint);
  });

  it('encodes path and content without concatenation ambiguity', async () => {
    // Naive `sha256(path + content)` would collide here: "src/abc" + "d" and
    // "src/ab" + "cd" both concatenate to the literal string "src/abcd".
    const repoA = await makeGitRepo();
    await mkdir(path.join(repoA, 'src'), { recursive: true });
    await writeFile(path.join(repoA, 'src/abc'), 'd');
    const identityA = await readRepositoryStateIdentity(repoA);

    const repoB = await makeGitRepo();
    await mkdir(path.join(repoB, 'src'), { recursive: true });
    await writeFile(path.join(repoB, 'src/ab'), 'cd');
    const identityB = await readRepositoryStateIdentity(repoB);

    expect(identityA.worktreeFingerprint).toBeDefined();
    expect(identityB.worktreeFingerprint).toBeDefined();
    expect(identityA.worktreeFingerprint).not.toBe(identityB.worktreeFingerprint);
  });

  it('changes when the supplied Atlas file content changes, and is stable when unrelated files change', async () => {
    const rootDir = await makeGitRepo();
    await commitPath(rootDir, 'Buds At Work/01 Architecture/Atlas.md', '### C01 - Example\n');

    const atlasPath = path.join(rootDir, 'Buds At Work/01 Architecture/Atlas.md');
    const before = await readRepositoryStateIdentity(rootDir, { atlasPath });
    await writeFile(atlasPath, '### C01 - Example\n### C02 - Another\n');
    const after = await readRepositoryStateIdentity(rootDir, { atlasPath });

    expect(after.dirty).toBe(true);
    expect(after.identity).not.toBe(before.identity);

    // Without the atlasPath option, an edit to a file outside the fixed relevant
    // pathspecs must not be observed.
    const untracked = await readRepositoryStateIdentity(rootDir);
    expect(untracked.dirty).toBe(false);
  });

  it('stamps the current identity algorithm version', async () => {
    const rootDir = await makeGitRepo();
    await writeRelevantFile(rootDir, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
    const identity = await readRepositoryStateIdentity(rootDir);
    expect(identity.identityAlgorithmVersion).toBe(REPOSITORY_IDENTITY_ALGORITHM_VERSION);
    expect(REPOSITORY_IDENTITY_ALGORITHM_VERSION).toBeGreaterThan(1);
  });
});

describe('Architecture Doctor v2 Phase 12-14 governance regression — corrected repository identity', () => {
  it('collapses baseline/restored/churn states to one identity, keeps the injected change distinct, and never approves replacement', async () => {
    const rootDir = await makeGitRepo();
    const outputDir = await makeTempDir('phase12-identity-gov-');
    const atlas = makeGovAtlas();
    const timepoints = [
      '2026-07-16T00:00:00.000Z',
      '2026-07-16T00:01:00.000Z',
      '2026-07-16T00:02:00.000Z',
      '2026-07-16T00:03:00.000Z',
    ];

    await writeRelevantFile(rootDir, 'src/app/page.tsx', 'export default function Page() { return null; }\n');

    // Run 1: baseline.
    const baseline = await runPhase12CronRouteShadowExecution({
      rootDir,
      outputDir,
      atlas,
      inventory: makeGovInventory([]),
      now: new Date(timepoints[0]),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    // Unrelated churn: Dev Log + Graphify output edits. Must not affect identity.
    await writeRelevantFile(rootDir, 'Buds At Work/Dev/Dev Log 2026-07-16.md', '# Dev Log\n\nSomething happened.\n');
    await writeRelevantFile(rootDir, 'graphify-out/GRAPH_REPORT.md', '# Graph Report\n\nRebuilt once.\n');

    // Run 2: injected architecture change (new unregistered cron route).
    await writeRelevantFile(
      rootDir,
      'src/app/api/cron/architecture-doctor-test/route.ts',
      'export async function GET() { return new Response("ok"); }\n',
    );
    const injected = await runPhase12CronRouteShadowExecution({
      rootDir,
      outputDir,
      atlas,
      inventory: makeGovInventory(['/api/cron/architecture-doctor-test']),
      now: new Date(timepoints[1]),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    // Remove the injected route.
    await rm(path.join(rootDir, 'src/app/api/cron/architecture-doctor-test'), { recursive: true, force: true });

    // Run 3: restored.
    const restored = await runPhase12CronRouteShadowExecution({
      rootDir,
      outputDir,
      atlas,
      inventory: makeGovInventory([]),
      now: new Date(timepoints[2]),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    // More unrelated churn only, no architecture change.
    await writeRelevantFile(rootDir, 'Buds At Work/Dev/Dev Log 2026-07-16.md', '# Dev Log\n\nMore churn.\n');
    await writeRelevantFile(rootDir, 'graphify-out/GRAPH_REPORT.md', '# Graph Report\n\nRebuilt again.\n');

    // Run 4: churn-only repeat of the restored state.
    const churnAgain = await runPhase12CronRouteShadowExecution({
      rootDir,
      outputDir,
      atlas,
      inventory: makeGovInventory([]),
      now: new Date(timepoints[3]),
      config: { executionMode: 'shadow_advisory', artifactOutputEnabled: true },
    });

    // Identity assertions: baseline == restored == churnAgain; injected is distinct.
    expect(injected.record.repositoryState.identity).not.toBe(baseline.record.repositoryState.identity);
    expect(restored.record.repositoryState.identity).toBe(baseline.record.repositoryState.identity);
    expect(churnAgain.record.repositoryState.identity).toBe(baseline.record.repositoryState.identity);

    // v1 stays authoritative; v2 stays shadow-only for every run.
    for (const result of [baseline, injected, restored, churnAgain]) {
      expect(result.record.authoritativeSource).toBe('v1');
      expect(result.authoritativeHealthChanged).toBe(false);
    }
    expect(baseline.record.v1FindingCount).toBe(0);
    expect(injected.record.v1FindingCount).toBe(1);
    expect(injected.record.v2FindingCount).toBe(1);
    expect(restored.record.v1FindingCount).toBe(0);

    const history: Phase12ShadowHistory = {
      version: 1,
      records: [baseline.record, injected.record, restored.record, churnAgain.record],
    };

    const phase13 = evaluatePhase13StatisticalGovernance({
      history,
      generatedAt: '2026-07-16T00:04:00.000Z',
      config: { minimumComparableRuns: 4, minimumRepositoryIdentities: 2 },
    });
    // Two genuinely distinct architectural states were observed (baseline/restored/churn
    // collapse to one, injected is the other) — not four, as the old path-membership
    // fingerprint would have reported.
    expect(phase13.repositoryDiversity.uniqueRepositoryIdentities).toBe(2);
    expect(phase13.governanceRecommendation.replacementApproved).toBe(false);

    const phase14 = evaluatePhase14EvidenceQuality({
      history,
      phase13,
      generatedAt: '2026-07-16T00:04:00.000Z',
      currentIdentityAlgorithmVersion: REPOSITORY_IDENTITY_ALGORITHM_VERSION,
      config: { minimumIndependentRuns: 2, minimumUniqueCommits: 1, minimumUniqueRepositoryFingerprints: 2 },
    });
    // Duplicate-state detection recognises the restored and churn-again runs as repeats
    // of the baseline's architectural state rather than independent evidence.
    expect(phase14.independentRuns).toBe(2);
    expect(phase14.duplicateStateRuns).toBe(2);
    expect(phase14.readinessDecision.replacementApproved).toBe(false);
  });
});

function makeGovAtlas(): AtlasSpec {
  return { sourcePath: 'test-atlas.md', capabilities: [] };
}

function makeGovInventory(cronRouteCandidates: string[]): ArchitectureInventory {
  return {
    rootDir: '/repo',
    sourceFiles: [],
    pages: [],
    apiRoutes: [],
    agents: [],
    cronEntries: [],
    cronRouteCandidates,
    migrationTables: [],
    migrationViews: [],
    tableUsages: [],
    envVars: [],
    storageBuckets: [],
  };
}

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function makeGitRepo(): Promise<string> {
  const rootDir = await makeTempDir('repo-identity-');
  await execFileAsync('git', ['init'], { cwd: rootDir });
  await writeFile(path.join(rootDir, 'README.md'), 'seed\n');
  await execFileAsync('git', ['add', '.'], { cwd: rootDir });
  await execFileAsync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=Test User', 'commit', '-m', 'initial'], { cwd: rootDir });
  return rootDir;
}

async function writeRelevantFile(rootDir: string, relPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(rootDir, relPath)), { recursive: true });
  await writeFile(path.join(rootDir, relPath), content);
}

async function commitPath(rootDir: string, relPath: string, content: string): Promise<void> {
  await writeRelevantFile(rootDir, relPath, content);
  await execFileAsync('git', ['add', relPath], { cwd: rootDir });
  await execFileAsync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=Test User', 'commit', '-m', `add ${relPath}`], { cwd: rootDir });
}
