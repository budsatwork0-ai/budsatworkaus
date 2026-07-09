#!/usr/bin/env tsx
import path from 'node:path';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseAtlasFile } from '../src/lib/architecture-doctor/atlas-parser';
import { scanRepository } from '../src/lib/architecture-doctor/repo-scanner';
import { buildEnforcementReadiness, buildHealthReport, writeReports } from '../src/lib/architecture-doctor/reporter';
import { generateProposedBaseline, promoteBaselineEntries, reviewBaselineEntries } from '../src/lib/architecture-doctor/baseline';
import { readPreviousReport } from '../src/lib/architecture-doctor/report-diff';
import { evaluateFailMode } from '../src/lib/architecture-doctor/cli-fail-mode';
import {
  DEFAULT_ENFORCEMENT_POLICY,
  evaluateEnforcementPolicy,
  evaluateThresholdDryRun,
  readEnforcementPolicyConfig,
  renderThresholdDryRunMarkdown,
} from '../src/lib/architecture-doctor/enforcement-policy';
import {
  appendReleaseCycleObservation,
  createReleaseCycleObservation,
  readReleaseCycleHistory,
  summarizeReleaseCycleEvidence,
  writeReleaseCycleEvidenceReport,
  writeReleaseCycleHistory,
} from '../src/lib/architecture-doctor/release-cycle-evidence';
import type { ReporterOptions } from '../src/lib/architecture-doctor/types';

const DEFAULT_ATLAS = 'Buds At Work/01 Architecture/Bud OS Business Capability Atlas 2026-07-08.md';
const DEFAULT_OUTPUT = 'Buds At Work/01 Architecture/Architecture Doctor';
const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const atlasPath = path.resolve(rootDir, args.atlas ?? DEFAULT_ATLAS);
  const outputDir = path.resolve(rootDir, args.output ?? DEFAULT_OUTPUT);
  const baselinePath = path.resolve(rootDir, args.baseline ?? path.join(outputDir, 'architecture-doctor-baseline.json'));
  const enforcementConfigPath = path.resolve(rootDir, args['enforcement-config'] ?? path.join(outputDir, 'architecture-doctor-enforcement.json'));
  const releaseHistoryPath = path.resolve(rootDir, args['release-history'] ?? path.join(outputDir, 'architecture-doctor-release-cycle-history.json'));
  const releaseEvidencePath = path.resolve(rootDir, args['release-evidence'] ?? path.join(outputDir, 'architecture-doctor-release-cycle-evidence.md'));
  const thresholdDryRunPath = path.resolve(rootDir, args['threshold-dry-run'] ?? path.join(outputDir, 'architecture-doctor-threshold-dry-run.md'));
  const previousReportPath = path.join(outputDir, 'architecture-health.json');
  const format = (args.format ?? 'all') as ReporterOptions['format'];

  if (!['json', 'md', 'all'].includes(format)) {
    throw new Error(`Unsupported --format "${format}". Use json, md, or all.`);
  }

  await ensureBaselineFile(baselinePath);
  await ensureEnforcementConfigFile(enforcementConfigPath);
  const enforcementConfig = await readEnforcementPolicyConfig(enforcementConfigPath);
  const previousReport = await readPreviousReport(previousReportPath);
  const atlas = await parseAtlasFile(atlasPath);
  const inventory = await scanRepository(rootDir);
  const report = await buildHealthReport(atlas, inventory, baselinePath, previousReport, previousReportPath, enforcementConfig);
  const priorReleaseHistory = await readReleaseCycleHistory(releaseHistoryPath);
  const releaseObservation = createReleaseCycleObservation(report, await gitCommit(rootDir));
  const releaseHistory = appendReleaseCycleObservation(priorReleaseHistory, releaseObservation);
  report.releaseCycleEvidence = summarizeReleaseCycleEvidence(releaseHistory, priorReleaseHistory, {
    historyPath: path.relative(rootDir, releaseHistoryPath),
    evidencePath: path.relative(rootDir, releaseEvidencePath),
    currentObservation: releaseObservation,
  });
  if (report.releaseCycleEvidence.cleanAdvisoryReleaseCycleObserved && !enforcementConfig.releaseCycleObserved) {
    enforcementConfig.releaseCycleObserved = true;
    await writeFile(enforcementConfigPath, `${JSON.stringify(enforcementConfig, null, 2)}\n`, 'utf8');
    report.enforcementReadiness = buildEnforcementReadiness(
      report.criticalBlockers,
      report.dependencyCycleReadiness,
      report.baseline.staleAcceptedFindings,
      enforcementConfig.releaseCycleObserved,
      enforcementConfig.scoreThresholdAgreed,
    );
    report.enforcementPolicy = evaluateEnforcementPolicy(
      {
        healthScore: report.healthScore,
        baseline: report.baseline,
        enforcementReadiness: report.enforcementReadiness,
      },
      enforcementConfig,
    );
    report.thresholdDryRun = evaluateThresholdDryRun({ healthScore: report.healthScore }, report.enforcementPolicy);
  }
  await writeReleaseCycleHistory(releaseHistoryPath, releaseHistory);
  await writeReleaseCycleEvidenceReport(releaseEvidencePath, releaseObservation);
  await writeFile(thresholdDryRunPath, renderThresholdDryRunMarkdown(report.thresholdDryRun), 'utf8');
  const written = await writeReports(report, { outputDir, format, baselinePath });
  written.push(releaseHistoryPath, releaseEvidencePath, thresholdDryRunPath);

  if (args['propose-baseline'] === 'true') {
    const proposedPath = path.join(outputDir, 'architecture-doctor-proposed-baseline.json');
    await writeFile(proposedPath, `${JSON.stringify(generateProposedBaseline(report.baseline.newFindings), null, 2)}\n`, 'utf8');
    written.push(proposedPath);
  }

  if (args['review-baseline'] === 'true') {
    const proposed = reviewBaselineEntries(report.baseline.newFindings);
    const proposedPath = path.join(outputDir, 'architecture-doctor-proposed-baseline.json');
    await writeFile(proposedPath, `${JSON.stringify({ version: 1, acceptedFindings: proposed }, null, 2)}\n`, 'utf8');
    written.push(proposedPath);
    console.log(`Proposed baseline entries: ${proposed.length}`);
    for (const entry of proposed.slice(0, 50)) {
      console.log(`${entry.id} ${entry.severity ?? 'unknown'} ${entry.type ?? 'finding'} ${entry.asset ?? entry.key ?? 'unknown'} ${entry.capabilityId ?? 'unknown'}`);
    }
    if (proposed.length > 50) console.log(`...${proposed.length - 50} more entries omitted from console; see ${path.relative(rootDir, proposedPath)}`);
  }

  if (args['promote-baseline']) {
    const result = await promoteBaselineEntries(baselinePath, report.baseline.newFindings, {
      selected: splitList(args['promote-baseline']),
      acceptedBy: args['accepted-by'] ?? '',
      acceptedReason: args['accepted-reason'] ?? '',
      reviewAfter: args['review-after'] ?? '',
      owner: args.owner,
    });
    console.log(`Promoted ${result.promoted.length} selected baseline entr${result.promoted.length === 1 ? 'y' : 'ies'}.`);
    if (result.skipped.length > 0) console.log(`Skipped unknown selectors: ${result.skipped.join(', ')}`);
  }

  console.log(`Architecture Doctor complete. Health score: ${report.healthScore}/100`);
  for (const file of written) {
    console.log(`Wrote ${path.relative(rootDir, file)}`);
  }

  const failMode = evaluateFailMode(report, splitList(args['fail-on']), { advisory: args['ci-advisory'] === 'true' });
  if (failMode.shouldFail) {
    console.error(`Architecture Doctor fail mode triggered: ${failMode.reasons.join('; ')}`);
    process.exitCode = 2;
  } else if (args['ci-advisory'] !== 'true' && report.enforcementPolicy.shouldFail) {
    console.error(`Architecture Doctor enforcement policy triggered: ${report.enforcementPolicy.failureReasons.join('; ')}`);
    process.exitCode = 2;
  } else if (args['ci-advisory'] === 'true' && failMode.reasons.length > 0) {
    console.log(`Architecture Doctor advisory mode: ${failMode.reasons.join('; ')}`);
  } else if (args['ci-advisory'] === 'true' && report.enforcementPolicy.blockingWouldOccur) {
    console.log(`Architecture Doctor advisory mode: enforcement would block on ${report.enforcementPolicy.failureReasons.join('; ')}.`);
  }
}

async function ensureBaselineFile(baselinePath: string): Promise<void> {
  try {
    await access(baselinePath);
  } catch {
    await mkdir(path.dirname(baselinePath), { recursive: true });
    await writeFile(
      baselinePath,
      `${JSON.stringify({ version: 1, acceptedFindings: [] }, null, 2)}\n`,
      'utf8',
    );
  }
}

async function ensureEnforcementConfigFile(configPath: string): Promise<void> {
  try {
    await access(configPath);
  } catch {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, `${JSON.stringify(DEFAULT_ENFORCEMENT_POLICY, null, 2)}\n`, 'utf8');
  }
}

async function gitCommit(rootDir: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootDir });
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const raw = arg.slice(2);
    const equalsIndex = raw.indexOf('=');
    const key = equalsIndex >= 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex >= 0 ? raw.slice(equalsIndex + 1) : undefined;
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      parsed[key] = appendArg(parsed[key], inlineValue);
    } else if (!next || next.startsWith('--')) {
      parsed[key] = appendArg(parsed[key], 'true');
    } else {
      parsed[key] = appendArg(parsed[key], next);
      index += 1;
    }
  }
  return parsed;
}

function splitList(value?: string): string[] {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function appendArg(current: string | undefined, next: string): string {
  if (!current || current === 'true') return next;
  return `${current},${next}`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
