#!/usr/bin/env tsx
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { runC02RouteSlice } from '../src/lib/architecture-doctor/v2';

const DEFAULT_ATLAS = 'Buds At Work/01 Architecture/Bud OS Business Capability Atlas 2026-07-08.md';
const DEFAULT_OUTPUT = 'Buds At Work/01 Architecture/Architecture Doctor';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const outputDir = path.resolve(rootDir, args.output ?? DEFAULT_OUTPUT);
  const actor = args.actor ?? 'Architecture Doctor v2 Slice Runner';
  const rationale = args.rationale ?? 'Advisory execution of the first Architecture Doctor v2 vertical slice.';

  const result = await runC02RouteSlice({
    atlasPath: path.resolve(rootDir, args.atlas ?? DEFAULT_ATLAS),
    rootDir,
    actor,
    rationale,
    decision: args.decision === 'acknowledged' || args.decision === 'baseline_requested' || args.decision === 'rejected' || args.decision === 'needs_review'
      ? args.decision
      : 'needs_review',
  });

  await mkdir(outputDir, { recursive: true });
  const knowledgePath = path.join(outputDir, 'architecture-doctor-v2-slice-knowledge.json');
  const reportPath = path.join(outputDir, 'architecture-doctor-v2-slice-report.md');
  await writeFile(knowledgePath, `${JSON.stringify(result.knowledge, null, 2)}\n`, 'utf8');
  await writeFile(reportPath, result.report.markdown, 'utf8');

  console.log(`Architecture Doctor v2 C02 route slice complete. Findings: ${result.findings.length}`);
  console.log(`Wrote ${path.relative(rootDir, knowledgePath)}`);
  console.log(`Wrote ${path.relative(rootDir, reportPath)}`);
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
