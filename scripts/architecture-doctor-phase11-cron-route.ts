#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runPhase11CronRouteMigrationGate } from '../src/lib/architecture-doctor/v2';

const DEFAULT_ATLAS = 'Buds At Work/01 Architecture/Bud OS Business Capability Atlas 2026-07-08.md';
const DEFAULT_OUTPUT = 'Buds At Work/01 Architecture/Architecture Doctor';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const outputDir = path.resolve(rootDir, args.output ?? DEFAULT_OUTPUT);
  const result = await runPhase11CronRouteMigrationGate({
    rootDir,
    atlasPath: path.resolve(rootDir, args.atlas ?? DEFAULT_ATLAS),
    actor: args.actor ?? 'Architecture Doctor Phase 11 Runner',
    rationale: args.rationale ?? 'Real-repository parity evidence is required before cron detector migration can proceed.',
  });

  await mkdir(outputDir, { recursive: true });
  const parityPath = path.join(outputDir, 'architecture-doctor-phase11-cron-route-parity.json');
  const knowledgePath = path.join(outputDir, 'architecture-doctor-phase11-cron-route-knowledge.json');
  const reportPath = path.join(outputDir, 'architecture-doctor-phase11-cron-route-report.md');
  const readinessPath = path.join(outputDir, 'architecture-doctor-phase11-cron-route-readiness.json');
  const governancePath = path.join(outputDir, 'architecture-doctor-phase11-cron-route-governance.json');

  await writeFile(parityPath, `${JSON.stringify(result.parity, null, 2)}\n`, 'utf8');
  await writeFile(knowledgePath, `${JSON.stringify(result.v2Knowledge, null, 2)}\n`, 'utf8');
  await writeFile(reportPath, result.v2Report.markdown, 'utf8');
  await writeFile(readinessPath, `${JSON.stringify(result.readiness, null, 2)}\n`, 'utf8');
  await writeFile(governancePath, `${JSON.stringify(result.governanceDecision, null, 2)}\n`, 'utf8');

  console.log('Architecture Doctor Phase 11 cron route migration gate complete.');
  console.log('Mode: advisory only; v1 remains authoritative; no detector replacement occurred.');
  console.log(`Repository state: ${result.repositoryState.commitSha}${result.repositoryState.dirty ? ' (dirty)' : ''}`);
  console.log(`v1 cron detections: ${result.v1CronFindings.length}`);
  console.log(`v2 cron detections: ${result.v2Analyses.flatMap((analysis) => analysis.findings).length}`);
  console.log(`Parity decision: ${result.parity.overallDecision}`);
  console.log(`Unexplained differences: ${result.parity.unexplainedDifferences.length}`);
  console.log(`Governance decision: ${result.governanceDecision.decision}`);
  console.log(`Readiness blockers: ${result.readiness.blockers.length}`);
  for (const file of [parityPath, knowledgePath, reportPath, readinessPath, governancePath]) {
    console.log(`Wrote ${path.relative(rootDir, file)}`);
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
      parsed[key] = inlineValue;
    } else if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
