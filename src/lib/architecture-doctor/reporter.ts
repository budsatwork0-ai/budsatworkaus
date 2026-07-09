import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ArchitectureHealthReport,
  ArchitectureInventory,
  AtlasSpec,
  DriftFinding,
  ReporterOptions,
  ArchitectureHealthCategory,
} from './types';
import { analyzeBusinessLoops } from './business-loop';
import { analyzeDependencyGraph } from './dependency-graph';
import { analyzeGovernance } from './governance-checks';
import { classifyFindings, findingKey, readBaseline } from './baseline';
import { analyzeRls } from './rls-checks';
import { diffReports } from './report-diff';
import { buildSourceIndex, findCapabilityForAsset, matchesPattern, normalizeAtlasRoutePattern } from './source-index';
import { annotateFindingRisk, calculateWeightedHealthScore } from './risk-model';
import { groupDependencyCycleReadiness, triageCriticalCandidates } from './critical-triage';
import { renderCiPlan } from './ci-plan';
import { DEFAULT_ENFORCEMENT_POLICY, evaluateEnforcementPolicy, evaluateThresholdDryRun } from './enforcement-policy';
import { runFinalSafetyCheck, renderFinalSafetyCheckMarkdown } from './final-safety-check';

export async function buildHealthReport(
  atlas: AtlasSpec,
  inventory: ArchitectureInventory,
  baselinePath?: string,
  previousReport?: ArchitectureHealthReport | null,
  previousReportPath?: string,
  enforcementConfig = DEFAULT_ENFORCEMENT_POLICY,
): Promise<ArchitectureHealthReport> {
  const phaseOneFindings = detectPhaseOneDrift(atlas, inventory);
  const [governance, dependencyGraph, businessLoops, rls, baseline] = await Promise.all([
    analyzeGovernance(atlas, inventory),
    analyzeDependencyGraph(inventory),
    Promise.resolve(analyzeBusinessLoops(atlas, inventory)),
    analyzeRls(atlas, inventory),
    readBaseline(baselinePath),
  ]);
  const dependencyFindings = dependencyGraphToFindings(dependencyGraph);
  const governanceFindings = governanceToFindings(governance);
  const businessLoopFindings = businessLoopsToFindings(businessLoops);
  const rlsFindings = rlsToFindings(rls, atlas);
  const findings = [...phaseOneFindings, ...dependencyFindings, ...governanceFindings, ...businessLoopFindings, ...rlsFindings].map((finding) => {
    const owner = finding.owner ?? atlas.capabilities.find((capability) => capability.id === finding.capabilityId)?.owner;
    return enrichFinding(
      annotateFindingRisk({
        ...finding,
        owner,
        key: finding.key ?? findingKey(finding),
      }),
      atlas,
    );
  });
  const classified = classifyFindings(findings, baseline, baselinePath);
  const criticalTriage = triageCriticalCandidates(classified.newFindings);
  const criticalBlockers = buildCriticalBlockers(criticalTriage);
  const dependencyCycleReadiness = groupDependencyCycleReadiness(dependencyGraph);
  const architectureHealth = calculateArchitectureHealth(
    [...classified.newFindings, ...baselineScoringFindings(classified.acceptedFindings)],
    dependencyCycleReadiness,
  );
  const healthScore = architectureHealth.overall;
  const subScores = {
    mappingConfidence: calculateMappingConfidence(phaseOneFindings),
    governanceCoverage: calculateGovernanceCoverage(governance),
    dependencyHealth: calculateDependencyHealth(dependencyGraph),
    businessLoopContinuity: calculateBusinessLoopContinuity(businessLoops),
    rlsCoverage: calculateRlsCoverage(rls),
  };
  const enforcementReadiness = buildEnforcementReadiness(
    criticalBlockers,
    dependencyCycleReadiness,
    classified.staleAcceptedFindings,
    enforcementConfig.releaseCycleObserved,
    enforcementConfig.scoreThresholdAgreed,
  );
  const enforcementPolicy = evaluateEnforcementPolicy(
    {
      healthScore,
      baseline: classified,
      enforcementReadiness,
    },
    enforcementConfig,
  );
  const report: ArchitectureHealthReport = {
    generatedAt: new Date().toISOString(),
    atlasPath: atlas.sourcePath,
    rootDir: inventory.rootDir,
    healthScore,
    architectureHealth,
    counts: {
      capabilities: atlas.capabilities.length,
      pages: inventory.pages.length,
      apiRoutes: inventory.apiRoutes.length,
      agents: inventory.agents.length,
      cronEntries: inventory.cronEntries.length,
      tables: [...new Set([...inventory.migrationTables, ...inventory.migrationViews, ...inventory.tableUsages])].length,
      storageBuckets: inventory.storageBuckets.length,
      envVars: inventory.envVars.length,
      findings: findings.length,
    },
    findings,
    baseline: classified,
    subScores,
    governance,
    dependencyGraph,
    businessLoops,
    rls,
    diff: {
      previousReportPath,
      hasPrevious: false,
      scoreMovement: null,
      subScoreMovement: {},
      newFindingKeys: [],
      resolvedFindingKeys: [],
      worsenedAreas: [],
      improvedAreas: [],
    },
    trend: {
      previousReportPath,
      hasPrevious: false,
      scoreDelta: null,
      criticalCountDelta: null,
      warningDelta: null,
      dependencyCycleDelta: null,
    },
    ciReadiness: buildCiReadiness(criticalTriage, classified.staleAcceptedFindings, dependencyGraph),
    advisoryGithub: {
      summaryMarkdown: '',
      annotations: [],
    },
    criticalTriage,
    criticalBlockers,
    dependencyCycleReadiness,
    enforcementReadiness,
    enforcementPolicy,
    thresholdDryRun: evaluateThresholdDryRun({ healthScore }, enforcementPolicy),
    finalSafetyCheck: runFinalSafetyCheck({ healthScore, baseline: classified }, enforcementConfig),
    releaseCycleEvidence: {
      observationCount: 0,
      cleanAdvisoryReleaseCycleObserved: false,
      evidenceStillMissing: ['one complete prior clean advisory release-cycle observation'],
    },
    inventory,
  };
  report.diff = diffReports(report, previousReport ?? null, previousReportPath);
  report.trend = buildTrendReport(report, previousReport ?? null, previousReportPath);
  report.advisoryGithub = buildAdvisoryGithubOutput(report);
  return report;
}

export async function writeReports(report: ArchitectureHealthReport, options: ReporterOptions): Promise<string[]> {
  await mkdir(options.outputDir, { recursive: true });
  const written: string[] = [];

  if (options.format === 'json' || options.format === 'all') {
    const jsonPath = path.join(options.outputDir, 'architecture-health.json');
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    written.push(jsonPath);
  }

  if (options.format === 'md' || options.format === 'all') {
    const mdPath = path.join(options.outputDir, 'architecture-drift-report.md');
    await writeFile(mdPath, renderDriftMarkdown(report), 'utf8');
    written.push(mdPath);

    const ciPlanPath = path.join(options.outputDir, 'architecture-doctor-ci-plan.md');
    await writeFile(ciPlanPath, renderCiPlan(report), 'utf8');
    written.push(ciPlanPath);

    const prSummaryPath = path.join(options.outputDir, 'architecture-doctor-pr-summary.md');
    await writeFile(prSummaryPath, report.advisoryGithub.summaryMarkdown, 'utf8');
    written.push(prSummaryPath);
  }

  return written;
}

export function detectPhaseOneDrift(atlas: AtlasSpec, inventory: ArchitectureInventory): DriftFinding[] {
  const index = buildSourceIndex(atlas, inventory);
  const findings: DriftFinding[] = [];
  const discoveredTables = new Set(index.tables);
  const registeredCronTargets = new Set(index.cronRouteTargets);
  const repoApiRoutes = new Set(inventory.apiRoutes);

  for (const capability of atlas.capabilities) {
    for (const apiRoute of capability.apiRoutes.map(normalizeAtlasRoutePattern)) {
      if (apiRoute.includes('*')) continue;
      if (!repoApiRoutes.has(apiRoute)) {
        findings.push({
          type: 'atlas_api_missing',
          severity: 'high',
          confidence: 'confirmed',
          assetKind: 'apiRoute',
          asset: apiRoute,
          capabilityId: capability.id,
          capabilityName: capability.name,
          message: `Atlas lists API route ${apiRoute}, but no matching route file was found.`,
        });
      }
    }

    for (const page of capability.uiPages.map(normalizeAtlasRoutePattern)) {
      if (page.includes('*') || isNarrativeReference(page)) continue;
      if (!inventory.pages.includes(page)) {
        findings.push({
          type: 'atlas_page_missing',
          severity: 'medium',
          confidence: 'confirmed',
          assetKind: 'page',
          asset: page,
          capabilityId: capability.id,
          capabilityName: capability.name,
          message: `Atlas lists page ${page}, but no matching page file was found.`,
        });
      }
    }

    for (const agent of capability.agents) {
      if (isNarrativeReference(agent)) continue;
      if (!inventory.agents.includes(agent)) {
        findings.push({
          type: 'atlas_agent_missing',
          severity: 'high',
          confidence: 'confirmed',
          assetKind: 'agent',
          asset: agent,
          capabilityId: capability.id,
          capabilityName: capability.name,
          message: `Atlas lists agent ${agent}, but no matching agent file was found.`,
        });
      }
    }

    for (const table of capability.tables) {
      if (table.includes('*')) continue;
      if (!discoveredTables.has(table)) {
        findings.push({
          type: 'atlas_table_missing',
          severity: 'medium',
          confidence: 'confirmed',
          assetKind: 'table',
          asset: table,
          capabilityId: capability.id,
          capabilityName: capability.name,
          message: `Atlas lists table/view ${table}, but it was not found in migrations or table usages.`,
        });
      }
    }
  }

  for (const apiRoute of inventory.apiRoutes) {
    const mapped =
      index.atlasApiPatterns.some((pattern) => matchesPattern(normalizeAtlasRoutePattern(pattern), apiRoute)) ||
      Boolean(findCapabilityForAsset(atlas, 'apiRoute', apiRoute));
    if (!mapped) {
      findings.push({
        type: 'repo_api_unmapped',
        severity: 'low',
        confidence: 'low',
        assetKind: 'apiRoute',
        asset: apiRoute,
        message: `Repository API route ${apiRoute} is not listed in the atlas. Mapping is unknown.`,
      });
    }
  }

  for (const page of inventory.pages) {
    const mapped =
      index.atlasPagePatterns.some((pattern) => matchesPattern(normalizeAtlasRoutePattern(pattern), page)) ||
      Boolean(findCapabilityForAsset(atlas, 'page', page));
    if (!mapped) {
      findings.push({
        type: 'repo_page_unmapped',
        severity: 'low',
        confidence: 'low',
        assetKind: 'page',
        asset: page,
        message: `Repository page ${page} is not listed in the atlas. Mapping is unknown.`,
      });
    }
  }

  for (const agent of inventory.agents) {
    if (!findCapabilityForAsset(atlas, 'agent', agent)) {
      findings.push({
        type: 'repo_agent_unmapped',
        severity: 'low',
        confidence: 'low',
        assetKind: 'agent',
        asset: agent,
        message: `Repository agent ${agent} is not listed in the atlas. Mapping is unknown.`,
      });
    }
  }

  for (const table of index.tables) {
    if (!findCapabilityForAsset(atlas, 'table', table)) {
      findings.push({
        type: 'repo_table_unmapped',
        severity: 'low',
        confidence: 'low',
        assetKind: 'table',
        asset: table,
        message: `Repository table/view usage ${table} is not listed in the atlas. Mapping is unknown.`,
      });
    }
  }

  for (const route of inventory.cronRouteCandidates) {
    if (!registeredCronTargets.has(route)) {
      findings.push({
        type: 'cron_route_unregistered',
        severity: 'medium',
        confidence: 'confirmed',
        assetKind: 'cron',
        asset: route,
        message: `Cron-capable route ${route} exists but is not registered in vercel.json.`,
      });
    }
  }

  for (const cron of inventory.cronEntries) {
    if (!repoApiRoutes.has(cron.routePath)) {
      findings.push({
        type: 'cron_target_missing',
        severity: 'high',
        confidence: 'confirmed',
        assetKind: 'cron',
        asset: cron.path,
        message: `vercel.json cron ${cron.path} points to ${cron.routePath}, but no matching API route file was found.`,
      });
    }
  }

  return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.asset.localeCompare(b.asset));
}

function renderDriftMarkdown(report: ArchitectureHealthReport): string {
  const bySeverity = groupBy(report.baseline.newFindings, (finding) => finding.severity);
  const sections = ['critical', 'high', 'medium', 'low', 'info']
    .map((severity) => {
      const findings = bySeverity.get(severity) ?? [];
      if (findings.length === 0) return `### ${title(severity)}\n\nNo findings.\n`;
      const rows = findings
        .map(
          (finding) =>
            `| ${finding.type} | ${finding.assetKind} | ${escapePipe(finding.asset)} | ${finding.capabilityId ?? 'unknown'} | ${finding.confidence} | ${escapePipe(finding.category ?? 'Maintainability')} | ${escapePipe(finding.source ?? 'unknown')} | ${escapePipe((finding.evidence ?? []).slice(0, 2).join('<br>') || 'none')} | ${escapePipe(finding.remediation ?? 'Review manually.')} | ${escapePipe(finding.message)} |`,
        )
        .join('\n');
      return `### ${title(severity)}\n\n| Type | Asset kind | Asset | Capability | Confidence | Category | Source | Evidence | Remediation | Message |\n|---|---|---|---|---|---|---|---|---|---|\n${rows}\n`;
    })
    .join('\n');

  return `# Architecture Drift Report

Generated: ${report.generatedAt}

Atlas: \`${report.atlasPath}\`

Root: \`${report.rootDir}\`

## Executive Summary

Architecture Health Score: **${report.healthScore}/100**

The score reflects new, non-accepted findings. Accepted baseline items are still shown below, but they do not swamp the main score.

## Weighted Health Categories

${renderArchitectureHealth(report)}

## Trend

${renderTrend(report)}

| Sub-score | Score |
|---|---:|
| Mapping confidence | ${report.subScores.mappingConfidence}/100 |
| Governance coverage | ${report.subScores.governanceCoverage}/100 |
| Dependency health | ${report.subScores.dependencyHealth}/100 |
| Business-loop continuity | ${report.subScores.businessLoopContinuity}/100 |
| RLS coverage | ${report.subScores.rlsCoverage}/100 |

| Metric | Count |
|---|---:|
| Capabilities | ${report.counts.capabilities} |
| Pages discovered | ${report.counts.pages} |
| API routes discovered | ${report.counts.apiRoutes} |
| Agents discovered | ${report.counts.agents} |
| Cron entries discovered | ${report.counts.cronEntries} |
| Tables/views/usages discovered | ${report.counts.tables} |
| Storage buckets discovered | ${report.counts.storageBuckets} |
| Env vars discovered | ${report.counts.envVars} |
| Findings | ${report.counts.findings} |

## What is safe?

- Accepted baseline findings are separated from new findings and do not automatically lower the score.
- Unknown mappings are marked as unknown instead of confirmed failures.
- This is repo-local tooling only. It does not add CI, routes, cron, migrations, database writes, runtime behavior, or external service calls.

## What is risky?

${renderRiskSummary(report)}

## Critical findings triage

${renderCriticalTriage(report)}

## Critical enforcement blockers

${renderCriticalBlockers(report)}

## What changed?

| Category | Count |
|---|---:|
| New findings | ${report.baseline.newFindings.length} |
| Existing accepted findings | ${report.baseline.acceptedFindings.length} |
| Resolved baseline findings | ${report.baseline.resolvedFindings.length} |
| Unknown unmapped assets | ${report.baseline.unknownUnmappedAssets.length} |
| Stale accepted findings needing review | ${report.baseline.staleAcceptedFindings.length} |

${renderDiff(report)}

${renderHighestPriority(report)}

## Is this ready for CI?

${report.ciReadiness.ready ? 'Yes for advisory-only CI. Do not use this as a blocking gate yet.' : 'No. Keep this repo-local until the blockers below are handled.'}

${report.ciReadiness.blockers.length > 0 ? report.ciReadiness.blockers.map((blocker) => `- ${blocker}`).join('\n') : '- No CI readiness blockers detected.'}

## Enforcement-readiness checklist

${renderEnforcementReadiness(report)}

## Enforcement Policy

${renderEnforcementPolicy(report)}

## Final Safety Check

${renderFinalSafetyCheck(report)}

## Advisory Release-Cycle Evidence

${renderReleaseCycleEvidence(report)}

## Warn-Only Threshold Dry Run

${renderThresholdDryRun(report)}

## New Findings

${sections}

## Existing Accepted Findings

${renderFindingTable(report.baseline.acceptedFindings)}

## Resolved Findings From Baseline

${renderResolvedTable(report.baseline.resolvedFindings)}

## Stale Accepted Findings Needing Review

${renderFindingTable(report.baseline.staleAcceptedFindings)}

## Unknown Unmapped Assets

These are intentionally not treated as confirmed failures. They need mapping, baseline acceptance, or atlas updates.

${renderFindingTable(report.baseline.unknownUnmappedAssets.slice(0, 100))}

## Governance Coverage

${renderGovernanceTable(report)}

## Dependency Health

- Files scanned: ${report.dependencyGraph.filesScanned}
- Import edges: ${report.dependencyGraph.importEdges}
- Circular dependency groups: ${report.dependencyGraph.cycles.length}
- Suspicious cross-domain imports: ${report.dependencyGraph.crossDomainImports.length}

${renderDependencyEvidence(report)}

### Dependency Cycle Readiness

${renderDependencyCycleReadiness(report)}

## Business-Loop Continuity

${renderBusinessLoopTable(report)}

## Table-Level RLS Coverage

${renderRlsTable(report)}

## Scope Notes

- Unknown mappings are reported conservatively and are not treated as confirmed failures.
- Wildcard atlas entries such as \`/api/bud/*\` are matched by prefix pattern.
- Phase 2 does not infer new business capabilities.
- Governance, dependency, and business-loop checks use conservative static analysis only.
- Unknown means the doctor could not prove coverage from source text; it does not prove absence.
`;
}

export function calculateHealthScore(findings: DriftFinding[]): number {
  return calculateWeightedHealthScore(findings);
}

function dependencyGraphToFindings(report: ArchitectureHealthReport['dependencyGraph']): DriftFinding[] {
  const cycleFindings = report.cycles.map((cycle) => ({
    type: 'dependency_cycle' as const,
    severity: 'medium' as const,
    confidence: 'confirmed' as const,
    assetKind: 'worker' as const,
    asset: cycle.files[0] ?? 'unknown',
    capabilityId: cycle.capabilityId,
    message: `Circular import dependency detected across ${cycle.files.length} files in ${cycle.domain ?? 'unknown'} domain.`,
    evidence: cycle.files,
  }));

  const crossDomainFindings = report.crossDomainImports.map((edge) => ({
    type: 'dependency_cross_domain' as const,
    severity: 'low' as const,
    confidence: 'medium' as const,
    assetKind: 'worker' as const,
    asset: edge.from,
    message: `Possible cross-domain import from ${edge.fromDomain} to ${edge.toDomain}.`,
    evidence: [edge.from, edge.to],
  }));

  return [...cycleFindings, ...crossDomainFindings];
}

function governanceToFindings(governance: ArchitectureHealthReport['governance']): DriftFinding[] {
  return governance.flatMap((capability) =>
    Object.entries(capability.signals)
      .filter(([, signal]) => signal.status === 'unknown')
      .map(([signal]) => ({
        type: 'governance_unknown' as const,
        severity: 'low' as const,
        confidence: 'low' as const,
        assetKind: 'worker' as const,
        asset: signal,
        capabilityId: capability.capabilityId,
        capabilityName: capability.capabilityName,
        message: `${capability.capabilityName} has no static ${signal} signal in mapped files.`,
      })),
  );
}

function businessLoopsToFindings(businessLoops: ArchitectureHealthReport['businessLoops']): DriftFinding[] {
  return businessLoops.flatMap((capability) =>
    Object.entries(capability.stages)
      .filter(([, stage]) => stage.status === 'unknown')
      .map(([stage]) => ({
        type: 'business_loop_unknown' as const,
        severity: 'low' as const,
        confidence: 'low' as const,
        assetKind: 'worker' as const,
        asset: stage,
        capabilityId: capability.capabilityId,
        capabilityName: capability.capabilityName,
        message: `${capability.capabilityName} has no static evidence for business-loop stage ${stage}.`,
      })),
  );
}

function rlsToFindings(rls: ArchitectureHealthReport['rls'], atlas: AtlasSpec): DriftFinding[] {
  return rls.tables
    .filter((table) => table.status === 'missing_signal' || table.status === 'unknown')
    .map((table) => {
      const capabilityId = table.capabilityIds[0];
      const capabilityName = atlas.capabilities.find((capability) => capability.id === capabilityId)?.name;
      return {
        type: table.status === 'missing_signal' ? ('rls_missing_signal' as const) : ('rls_unknown' as const),
        severity: table.status === 'missing_signal' ? ('medium' as const) : ('low' as const),
        confidence: table.status === 'missing_signal' ? ('confirmed' as const) : ('medium' as const),
        assetKind: 'table' as const,
        asset: table.table,
        capabilityId,
        capabilityName,
        message:
          table.status === 'missing_signal'
            ? `Table ${table.table} is mapped to the atlas but has no static RLS or policy signal in migrations.`
            : `Table ${table.table} is mapped to the atlas, but RLS coverage could not be determined from static files.`,
        evidence: table.evidence,
      };
    });
}

function calculateMappingConfidence(findings: DriftFinding[]): number {
  const unknown = findings.filter((finding) => finding.confidence === 'unknown').length;
  const total = Math.max(1, findings.length);
  return Math.max(0, Math.round(100 - (unknown / total) * 100));
}

function calculateGovernanceCoverage(governance: ArchitectureHealthReport['governance']): number {
  const signals = governance.flatMap((capability) => Object.values(capability.signals));
  const present = signals.filter((signal) => signal.status === 'present').length;
  return Math.round((present / Math.max(1, signals.length)) * 100);
}

function calculateDependencyHealth(report: ArchitectureHealthReport['dependencyGraph']): number {
  return Math.max(0, 100 - report.cycles.length * 5);
}

function calculateBusinessLoopContinuity(businessLoops: ArchitectureHealthReport['businessLoops']): number {
  const stages = businessLoops.flatMap((capability) => Object.values(capability.stages));
  const present = stages.filter((stage) => stage.status === 'present').length;
  return Math.round((present / Math.max(1, stages.length)) * 100);
}

function calculateRlsCoverage(rls: ArchitectureHealthReport['rls']): number {
  const covered = rls.confirmedEnabled + rls.confirmedPolicies;
  return Math.round((covered / Math.max(1, rls.tablesChecked)) * 100);
}

const CATEGORY_WEIGHTS: Record<ArchitectureHealthCategory, number> = {
  Security: 25,
  Database: 20,
  'Dependency Architecture': 20,
  Documentation: 15,
  Performance: 10,
  Maintainability: 10,
};

export function calculateArchitectureHealth(
  findings: DriftFinding[],
  dependencyCycleReadiness: ArchitectureHealthReport['dependencyCycleReadiness'] = [],
): ArchitectureHealthReport['architectureHealth'] {
  const categories = {} as ArchitectureHealthReport['architectureHealth']['categories'];
  for (const category of Object.keys(CATEGORY_WEIGHTS) as ArchitectureHealthCategory[]) {
    const categoryFindings = findings.filter((finding) => (finding.category ?? categoryForFinding(finding)) === category);
    const unresolvedProductionCycles =
      category === 'Dependency Architecture'
        ? dependencyCycleReadiness.filter((group) => group.classification === 'production architecture issue' || group.classification === 'needs manual review').length
        : 0;
    const findingPenaltyTotal = categoryFindings.reduce((total, finding) => total + categoryPenalty(finding), 0);
    const cyclePenalty = unresolvedProductionCycles * 4;
    const score = categoryScoreFromPenalty(findingPenaltyTotal + cyclePenalty);
    categories[category] = {
      category,
      weight: CATEGORY_WEIGHTS[category],
      score,
      findings: categoryFindings.length + unresolvedProductionCycles,
      summary: categorySummary(category, score, categoryFindings.length, unresolvedProductionCycles),
    };
  }
  const overall = Math.round(
    (Object.values(categories).reduce((total, item) => total + item.score * item.weight, 0) /
      Object.values(CATEGORY_WEIGHTS).reduce((total, weight) => total + weight, 0)),
  );
  return { overall, categories };
}

function categoryPenalty(finding: DriftFinding): number {
  const severity = { critical: 18, high: 10, medium: 4, low: 1, info: 0 }[finding.severity] ?? 0;
  const confidence = { confirmed: 1, high: 0.85, medium: 0.6, low: 0.35, unknown: 0.35 }[finding.confidence] ?? 0.35;
  const weight = Math.sqrt(finding.riskWeight ?? 1);
  return severity * confidence * weight;
}

function categoryScoreFromPenalty(penalty: number): number {
  const calibratedPenalty = 100 * (1 - Math.exp(-Math.max(0, penalty) / 90));
  return Math.round(Math.max(0, Math.min(100, 100 - calibratedPenalty)));
}

function categoryForFinding(finding: DriftFinding): ArchitectureHealthCategory {
  if (finding.type.startsWith('dependency_')) return 'Dependency Architecture';
  if (finding.type.startsWith('rls_')) return 'Security';
  if (/\b(auth|session|user|payment|stripe|ndis|client|webhook)\b/.test(`${finding.riskArea ?? ''} ${finding.asset}`.toLowerCase())) return 'Security';
  if (finding.assetKind === 'table' || finding.type.includes('table')) return 'Database';
  if (finding.type.startsWith('atlas_') || finding.type.startsWith('repo_')) return 'Documentation';
  if (finding.type === 'business_loop_unknown') return 'Performance';
  return 'Maintainability';
}

function categorySummary(category: ArchitectureHealthCategory, score: number, findings: number, unresolvedCycles: number): string {
  const extras = unresolvedCycles > 0 ? ` and ${unresolvedCycles} unresolved production cycle${unresolvedCycles === 1 ? '' : 's'}` : '';
  return `${category} score ${score}/100 from ${findings} finding${findings === 1 ? '' : 's'}${extras}.`;
}

function enrichFinding(finding: DriftFinding, atlas: AtlasSpec): DriftFinding {
  const evidence = finding.evidence ?? [];
  const source = finding.source ?? evidence[0] ?? (finding.type.startsWith('atlas_') ? atlas.sourcePath : 'unknown');
  return {
    ...finding,
    confidence: normalizeConfidence(finding),
    category: finding.category ?? categoryForFinding(finding),
    evidence,
    source,
    remediation: finding.remediation ?? remediationForFinding(finding),
  };
}

function normalizeConfidence(finding: DriftFinding): DriftFinding['confidence'] {
  if (finding.confidence === 'unknown') return 'low';
  if (finding.confidence === 'confirmed') return 'confirmed';
  return finding.confidence;
}

function remediationForFinding(finding: DriftFinding): string {
  if (finding.type === 'rls_missing_signal') return 'Add or verify RLS and policy coverage in a reviewed migration.';
  if (finding.type === 'rls_unknown') return 'Improve static RLS detection or add reviewed evidence metadata.';
  if (finding.type === 'dependency_cycle') return 'Extract shared types/helpers into a leaf module or document an accepted shared-layer cycle.';
  if (finding.type === 'dependency_cross_domain') return 'Review the ownership boundary and add an allowlist only after architecture-owner approval.';
  if (finding.type.startsWith('atlas_')) return 'Update the atlas or restore the missing repo asset.';
  if (finding.type.startsWith('repo_')) return 'Map the repo asset to a capability or baseline it with owner/review metadata.';
  if (finding.type === 'cron_route_unregistered') return 'Register the cron route, remove it, or document why it is manually invoked.';
  if (finding.type === 'cron_target_missing') return 'Restore the target API route or remove the stale cron entry.';
  if (finding.type === 'governance_unknown') return 'Add static governance evidence or document the reviewed exception.';
  if (finding.type === 'business_loop_unknown') return 'Add static evidence for the business-loop stage or document why it is out of scope.';
  return 'Review manually and assign an owner before enforcement.';
}

function renderDiff(report: ArchitectureHealthReport): string {
  if (!report.diff.hasPrevious) {
    return '## Report Diff\n\nNo previous report was available for comparison.\n';
  }
  return `## Report Diff\n\n| Metric | Movement |\n|---|---:|\n| Health score | ${formatMovement(report.diff.scoreMovement)} |\n| New findings | ${report.diff.newFindingKeys.length} |\n| Resolved findings | ${report.diff.resolvedFindingKeys.length} |\n\nImproved areas: ${report.diff.improvedAreas.join(', ') || 'none'}.\n\nWorsened areas: ${report.diff.worsenedAreas.join(', ') || 'none'}.\n`;
}

function renderArchitectureHealth(report: ArchitectureHealthReport): string {
  const rows = Object.values(report.architectureHealth.categories)
    .map((item) => `| ${item.category} | ${item.weight}% | ${item.score}/100 | ${item.findings} | ${escapePipe(item.summary)} |`)
    .join('\n');
  return `Overall weighted score: **${report.architectureHealth.overall}/100**\n\n| Category | Weight | Score | Findings | Summary |\n|---|---:|---:|---:|---|\n${rows}\n`;
}

function renderTrend(report: ArchitectureHealthReport): string {
  if (!report.trend.hasPrevious) return 'No previous report was available for trend comparison.\n';
  return `| Metric | Delta |\n|---|---:|\n| Score | ${formatMovement(report.trend.scoreDelta)} |\n| Critical count | ${formatMovement(report.trend.criticalCountDelta)} |\n| Warning count | ${formatMovement(report.trend.warningDelta)} |\n| Dependency cycles | ${formatMovement(report.trend.dependencyCycleDelta)} |\n`;
}

function renderHighestPriority(report: ArchitectureHealthReport): string {
  const findings = report.baseline.newFindings
    .filter((finding) => finding.confidence === 'confirmed')
    .slice(0, 8);

  if (findings.length === 0) {
    return '## What to fix first?\n\nNo confirmed new findings. Focus next on reducing unknown mappings and improving baseline clarity.\n';
  }

  return `## What to fix first?\n\n${findings
    .map((finding, index) => `${index + 1}. ${finding.message}`)
    .join('\n')}\n`;
}

function renderFindingTable(findings: DriftFinding[]): string {
  if (findings.length === 0) return 'No findings.\n';
  const rows = findings
    .map(
      (finding) =>
        `| ${finding.type} | ${finding.assetKind} | ${escapePipe(finding.asset)} | ${finding.capabilityId ?? 'unknown'} | ${finding.severity} | ${finding.confidence} | ${escapePipe(finding.category ?? 'Maintainability')} | ${escapePipe(finding.baselineDisposition ?? 'new')} | ${escapePipe(finding.baselineOwner ?? 'unassigned')} | ${escapePipe(finding.baselineReviewDate ?? 'n/a')} | ${escapePipe(finding.source ?? 'unknown')} | ${escapePipe((finding.evidence ?? []).slice(0, 2).join('<br>') || 'none')} | ${escapePipe(finding.remediation ?? 'Review manually.')} | ${escapePipe(finding.message)} |`,
    )
    .join('\n');
  return `| Type | Asset kind | Asset | Capability | Severity | Confidence | Category | Baseline disposition | Owner | Review date | Source | Evidence | Remediation | Message |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows}\n`;
}

function renderResolvedTable(findings: ArchitectureHealthReport['baseline']['resolvedFindings']): string {
  if (findings.length === 0) return 'No resolved baseline findings.\n';
  const rows = findings
    .map(
      (finding) =>
        `| ${finding.type ?? 'any'} | ${escapePipe(finding.asset ?? finding.key ?? 'unknown')} | ${finding.capabilityId ?? 'unknown'} | ${escapePipe(finding.reason ?? '')} |`,
    )
    .join('\n');
  return `| Type | Asset | Capability | Baseline reason |\n|---|---|---|---|\n${rows}\n`;
}

function renderGovernanceTable(report: ArchitectureHealthReport): string {
  const rows = report.governance
    .map((capability) => {
      const signals = Object.entries(capability.signals)
        .map(([name, signal]) => `${name}:${signal.status}`)
        .join(', ');
      return `| ${capability.capabilityId} | ${escapePipe(capability.capabilityName)} | ${signals} |`;
    })
    .join('\n');
  return `| Capability | Name | Static signals |\n|---|---|---|\n${rows}\n`;
}

function renderDependencyEvidence(report: ArchitectureHealthReport): string {
  const cycles = report.dependencyGraph.cycles
    .slice(0, 10)
    .map(
      (cycle, index) =>
        `${index + 1}. ${cycle.domain ?? 'unknown'} / ${cycle.capabilityId ?? 'unknown'}: ${cycle.files.join(' -> ')}\n   Recommended fix: ${cycle.recommendedFix ?? 'Extract shared code into a leaf module.'}`,
    )
    .join('\n');
  const crossDomain = report.dependencyGraph.crossDomainImports
    .slice(0, 10)
    .map((edge, index) => `${index + 1}. ${edge.fromDomain} -> ${edge.toDomain}: \`${edge.from}\` imports \`${edge.to}\``)
    .join('\n');
  return `### Circular Dependencies\n\n${cycles || 'None detected.'}\n\n### Cross-Domain Imports\n\n${crossDomain || 'None detected.'}\n`;
}

function renderBusinessLoopTable(report: ArchitectureHealthReport): string {
  const rows = report.businessLoops
    .map((capability) => {
      const stages = Object.entries(capability.stages)
        .map(([name, stage]) => `${name}:${stage.status}`)
        .join(', ');
      return `| ${capability.capabilityId} | ${escapePipe(capability.capabilityName)} | ${stages} |`;
    })
    .join('\n');
  return `| Capability | Name | Static stage evidence |\n|---|---|---|\n${rows}\n`;
}

function renderRlsTable(report: ArchitectureHealthReport): string {
  const rows = report.rls.tables
    .map((table) => `| ${table.table} | ${table.capabilityIds.join(', ')} | ${table.status} | ${table.evidence.slice(0, 2).map(escapePipe).join('<br>')} |`)
    .join('\n');
  return `| Table | Capabilities | Status | Evidence |\n|---|---|---|---|\n${rows}\n`;
}

function renderRiskSummary(report: ArchitectureHealthReport): string {
  const highRisk = report.baseline.newFindings.filter((finding) => finding.riskArea);
  if (highRisk.length === 0) {
    return '- No high-risk finance, auth, NDIS, quote/job/customer, public API, or webhook findings are currently new.';
  }

  const grouped = groupBy(highRisk, (finding) => finding.riskArea ?? 'standard');
  return [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([area, findings]) => `- ${area}: ${findings.length} new finding${findings.length === 1 ? '' : 's'}`)
    .join('\n');
}

function baselineScoringFindings(findings: DriftFinding[]): DriftFinding[] {
  return findings.flatMap((finding) => {
    if (finding.baselineDisposition === 'detector_false_positive') return [];
    if (finding.baselineDisposition === 'acceptable_baseline') return [];
    if (!finding.baselineDisposition) return [];

    return [
      {
        ...finding,
        severity: 'low' as const,
        confidence: 'low' as const,
        riskWeight: Math.min(finding.riskWeight ?? 1, 1),
      },
    ];
  });
}

function renderCriticalTriage(report: ArchitectureHealthReport): string {
  if (report.criticalTriage.length === 0) {
    return 'No critical or high-risk critical-candidate findings require triage.\n';
  }

  const rows = report.criticalTriage
    .map(
      (item) =>
        `| ${item.classification} | ${item.finding.type} | ${escapePipe(item.finding.asset)} | ${item.finding.severity} | ${escapePipe(item.finding.riskArea ?? 'standard')} | ${item.requiredChange} | ${escapePipe(item.whyItMatters)} | ${escapePipe(item.smallestSafeFix)} |`,
    )
    .join('\n');

  return `| Classification | Type | Asset | Severity | Risk area | Required change | Why it matters | Smallest safe fix |\n|---|---|---|---|---|---|---|---|\n${rows}\n`;
}

function renderCriticalBlockers(report: ArchitectureHealthReport): string {
  if (report.criticalBlockers.length === 0) {
    return 'No confirmed critical blockers. Future enforcement still requires the readiness checklist below.\n';
  }

  const rows = report.criticalBlockers
    .map(
      (blocker) =>
        `| ${blocker.id} | ${blocker.assetKind} | ${escapePipe(blocker.asset)} | ${blocker.capabilityId ?? 'unknown'} | ${escapePipe(blocker.owner ?? 'unassigned')} | ${escapePipe(blocker.evidence.join('<br>') || 'No static evidence found.')} | ${escapePipe(blocker.whyCritical)} | ${escapePipe(blocker.smallestSafeFix)} | ${blocker.requiredChange} |`,
    )
    .join('\n');

  return `| ID | Asset kind | Asset/file/table | Capability | Owner | Evidence | Why critical | Smallest safe fix | Required change |\n|---|---|---|---|---|---|---|---|---|\n${rows}\n`;
}

function renderDependencyCycleReadiness(report: ArchitectureHealthReport): string {
  if (report.dependencyCycleReadiness.length === 0) {
    return 'No dependency cycle readiness groups detected.\n';
  }

  const rows = report.dependencyCycleReadiness
    .map(
      (group) =>
        `| ${escapePipe(group.domain)} | ${group.capabilityId ?? 'unknown'} | ${group.classification} | ${group.cycles.length} | ${escapePipe(group.cycles[0]?.files.join(' -> ') ?? 'unknown')} | ${escapePipe(group.recommendation)} |`,
    )
    .join('\n');

  return `| Domain | Capability | Classification | Cycles | Files | Recommendation |\n|---|---|---|---:|---|---|\n${rows}\n`;
}

function renderEnforcementReadiness(report: ArchitectureHealthReport): string {
  const rows = report.enforcementReadiness.items
    .map((item) => `| ${item.passed ? 'Yes' : 'No'} | ${escapePipe(item.label)} | ${escapePipe(item.details)} |`)
    .join('\n');

  return `Overall: **${report.enforcementReadiness.ready ? 'Ready for future enforcement planning' : 'Not ready for blocking CI'}**\n\n| Passed | Check | Details |\n|---|---|---|\n${rows}\n\nFuture enforcement mode recommendation: ${report.enforcementReadiness.futureModeRecommendation}\n`;
}

function renderEnforcementPolicy(report: ArchitectureHealthReport): string {
  const policy = report.enforcementPolicy;
  const config = policy.config;
  return `Current enforcement mode: **${config.enforcementMode}**

Blocking would occur: **${policy.blockingWouldOccur ? 'yes' : 'no'}**

Actual report failure: **${policy.shouldFail ? 'yes' : 'no'}**

| Config | Value |
|---|---|
| minimumHealthScore | ${config.minimumHealthScore} |
| failOnCritical | ${config.failOnCritical ? 'true' : 'false'} |
| failOnExpiredBaseline | ${config.failOnExpiredBaseline ? 'true' : 'false'} |
| releaseCycleObserved | ${config.releaseCycleObserved ? 'true' : 'false'} |
| scoreThresholdAgreed | ${config.scoreThresholdAgreed ? 'true' : 'false'} |

Blocking disabled reasons:

${policy.blockingDisabledReasons.map((reason) => `- ${escapePipe(reason)}`).join('\n') || '- None.'}

Policy failure reasons:

${policy.failureReasons.map((reason) => `- ${escapePipe(reason)}`).join('\n') || '- None.'}

Checklist items still missing:

${policy.missingChecklistItems.map((item) => `- ${escapePipe(item)}`).join('\n') || '- None.'}
`;
}

function renderFinalSafetyCheck(report: ArchitectureHealthReport): string {
  return renderFinalSafetyCheckMarkdown(report.finalSafetyCheck);
}

function renderReleaseCycleEvidence(report: ArchitectureHealthReport): string {
  const evidence = report.releaseCycleEvidence;
  const observation = evidence.currentObservation;
  return `Current observation count: **${evidence.observationCount}**

One clean advisory release cycle observed: **${evidence.cleanAdvisoryReleaseCycleObserved ? 'yes' : 'no'}**

History file: \`${evidence.historyPath ?? 'not configured'}\`

Evidence report: \`${evidence.evidencePath ?? 'not configured'}\`

Current observation:

| Field | Value |
|---|---|
| Run date | ${observation?.runDate ?? 'n/a'} |
| Git commit | ${observation?.gitCommit ?? 'n/a'} |
| Health score | ${observation ? `${observation.healthScore}/100` : 'n/a'} |
| Critical count | ${observation?.criticalCount ?? 'n/a'} |
| Security score | ${observation ? `${observation.securityScore}/100` : 'n/a'} |
| Dependency cycle count | ${observation?.dependencyCycleCount ?? 'n/a'} |
| Baselined findings | ${observation?.baselinedFindings ?? 'n/a'} |
| Expired baselines | ${observation?.expiredBaselines ?? 'n/a'} |
| Enforcement mode | ${observation?.enforcementMode ?? 'n/a'} |
| Would-block status | ${observation ? (observation.blockingWouldOccur ? 'would block' : 'would not block') : 'n/a'} |

Evidence still missing:

${evidence.evidenceStillMissing.map((item) => `- ${escapePipe(item)}`).join('\n') || '- None.'}
`;
}

function renderThresholdDryRun(report: ArchitectureHealthReport): string {
  const dryRun = report.thresholdDryRun;
  return `Current health score: **${dryRun.currentHealthScore}/100**

Proposed minimum threshold: **${dryRun.proposedMinimumHealthScore}/100**

Dry-run result: **${dryRun.wouldPass ? 'would pass' : 'would fail'}**

Exact reasons it would not block today:

${dryRun.nonBlockingReasons.map((reason) => `- ${escapePipe(reason)}`).join('\n') || '- None.'}
`;
}

export function buildCiReadiness(
  criticalTriage: ArchitectureHealthReport['criticalTriage'],
  staleAcceptedFindings: DriftFinding[],
  dependencyGraph: ArchitectureHealthReport['dependencyGraph'],
): ArchitectureHealthReport['ciReadiness'] {
  const blockers: string[] = [];
  const confirmedCritical = criticalTriage.filter((item) => item.classification === 'confirmed real issue').length;
  if (confirmedCritical > 0) blockers.push(`${confirmedCritical} confirmed critical finding${confirmedCritical === 1 ? '' : 's'} should block enforcement later, but not advisory CI now.`);
  if (staleAcceptedFindings.length > 0) blockers.push(`${staleAcceptedFindings.length} accepted baseline finding${staleAcceptedFindings.length === 1 ? '' : 's'} need review.`);
  if (dependencyGraph.cycles.length > 0) blockers.push(`${dependencyGraph.cycles.length} dependency cycle group${dependencyGraph.cycles.length === 1 ? '' : 's'} remain advisory-only.`);
  return {
    ready: true,
    summary: blockers.length === 0 ? 'Ready for advisory-only CI.' : 'Ready for advisory-only CI, not blocking enforcement.',
    blockers,
  };
}

export function buildCriticalBlockers(
  criticalTriage: ArchitectureHealthReport['criticalTriage'],
): ArchitectureHealthReport['criticalBlockers'] {
  return criticalTriage
    .filter((item) => item.classification === 'confirmed real issue')
    .map((item, index) => ({
      id: item.finding.key ?? `critical-${String(index + 1).padStart(2, '0')}`,
      asset: item.finding.asset,
      assetKind: item.finding.assetKind,
      capabilityId: item.finding.capabilityId,
      owner: item.finding.owner,
      evidence: item.finding.evidence ?? [],
      whyCritical: item.whyItMatters,
      smallestSafeFix: item.smallestSafeFix,
      requiredChange: item.requiredChange,
    }));
}

export function buildEnforcementReadiness(
  criticalBlockers: ArchitectureHealthReport['criticalBlockers'],
  dependencyCycleReadiness: ArchitectureHealthReport['dependencyCycleReadiness'],
  staleAcceptedFindings: DriftFinding[],
  releaseCycleObserved = false,
  scoreThresholdAgreed = false,
): ArchitectureHealthReport['enforcementReadiness'] {
  const unresolvedCycles = dependencyCycleReadiness.filter((group) => group.classification !== 'acceptable shared-layer cycle' && group.classification !== 'test/tooling noise');
  const highRiskOwnersAssigned = criticalBlockers.every((blocker) => Boolean(blocker.owner?.trim()));
  const items = [
    {
      id: 'critical-findings-zero',
      label: 'critical findings = 0',
      passed: criticalBlockers.length === 0,
      details: `${criticalBlockers.length} confirmed critical blocker${criticalBlockers.length === 1 ? '' : 's'} remain.`,
    },
    {
      id: 'dependency-cycles-reviewed',
      label: 'dependency cycles reviewed',
      passed: dependencyCycleReadiness.length > 0 && unresolvedCycles.length === 0,
      details:
        dependencyCycleReadiness.length === 0
          ? 'No dependency cycles detected.'
          : `${unresolvedCycles.length} of ${dependencyCycleReadiness.length} cycle group${dependencyCycleReadiness.length === 1 ? '' : 's'} still require production/manual review.`,
    },
    {
      id: 'baseline-stale-zero',
      label: 'baseline stale items = 0',
      passed: staleAcceptedFindings.length === 0,
      details: `${staleAcceptedFindings.length} stale accepted baseline finding${staleAcceptedFindings.length === 1 ? '' : 's'} need review.`,
    },
    {
      id: 'advisory-release-cycle',
      label: 'advisory CI has run for one release cycle',
      passed: releaseCycleObserved,
      details: releaseCycleObserved
        ? 'Release-cycle evidence history contains the required clean advisory/warn-only observations.'
        : 'Manual release evidence required; Architecture Doctor cannot infer this from the repository.',
    },
    {
      id: 'score-threshold-agreed',
      label: 'score threshold agreed',
      passed: scoreThresholdAgreed,
      details: scoreThresholdAgreed
        ? 'Minimum health score threshold is formally agreed at 80.'
        : 'No blocking score threshold is encoded yet; agree it before warn-only or blocking mode.',
    },
    {
      id: 'high-risk-owners-assigned',
      label: 'owners assigned for high-risk domains',
      passed: highRiskOwnersAssigned,
      details: highRiskOwnersAssigned ? 'All current critical blockers have owners.' : 'One or more critical blockers lack an owner.',
    },
  ];

  return {
    ready: items.every((item) => item.passed),
    items,
    futureModeRecommendation:
      'Future only: after this checklist passes, trial warn-only --fail-on critical locally before adding any blocking GitHub Actions gate.',
  };
}

export function buildTrendReport(
  report: ArchitectureHealthReport,
  previous: ArchitectureHealthReport | null,
  previousReportPath?: string,
): ArchitectureHealthReport['trend'] {
  if (!previous) {
    return {
      previousReportPath,
      hasPrevious: false,
      scoreDelta: null,
      criticalCountDelta: null,
      warningDelta: null,
      dependencyCycleDelta: null,
    };
  }
  return {
    previousReportPath,
    hasPrevious: true,
    scoreDelta: report.healthScore - (previous.healthScore ?? report.healthScore),
    criticalCountDelta: countCritical(report) - countCritical(previous),
    warningDelta: countWarnings(report) - countWarnings(previous),
    dependencyCycleDelta: report.dependencyGraph.cycles.length - (previous.dependencyGraph?.cycles?.length ?? 0),
  };
}

export function buildAdvisoryGithubOutput(report: ArchitectureHealthReport): ArchitectureHealthReport['advisoryGithub'] {
  const critical = countCritical(report);
  const warnings = countWarnings(report);
  const unresolvedCycles = report.dependencyCycleReadiness.filter((group) => group.classification === 'production architecture issue' || group.classification === 'needs manual review').length;
  const summaryMarkdown = `# Architecture Doctor Advisory Summary

Architecture findings are advisory-only. This output must not fail CI.

| Metric | Value |
|---|---:|
| Health score | ${report.healthScore}/100 |
| Critical findings | ${critical} |
| Warnings | ${warnings} |
| Dependency cycles | ${report.dependencyGraph.cycles.length} |
| Unresolved production/manual cycles | ${unresolvedCycles} |
| Enforcement ready | ${report.enforcementReadiness.ready ? 'yes' : 'no'} |
| Enforcement mode | ${report.enforcementPolicy.config.enforcementMode} |
| Blocking would occur | ${report.enforcementPolicy.blockingWouldOccur ? 'yes' : 'no'} |
| Actual report failure | ${report.enforcementPolicy.shouldFail ? 'yes' : 'no'} |
| Advisory observations | ${report.releaseCycleEvidence.observationCount} |
| Clean advisory cycle observed | ${report.releaseCycleEvidence.cleanAdvisoryReleaseCycleObserved ? 'yes' : 'no'} |
| Proposed threshold | ${report.thresholdDryRun.proposedMinimumHealthScore}/100 |
| Threshold dry run | ${report.thresholdDryRun.wouldPass ? 'would pass' : 'would fail'} |
| Final safety check | ${report.finalSafetyCheck.passed ? 'passed' : 'failed'} |

## Trend

${renderTrend(report)}

## Top advisory findings

${topAdvisoryFindings(report)
    .map((finding) => `- **${finding.severity}** ${finding.type} on \`${finding.asset}\`: ${finding.remediation ?? finding.message}`)
    .join('\n') || '- No advisory findings.'}
`;

  const annotations = topAdvisoryFindings(report).map((finding) => ({
    level: finding.severity === 'critical' || finding.severity === 'high' ? ('warning' as const) : ('notice' as const),
    title: `${finding.severity}: ${finding.type}`,
    message: `${finding.message} Remediation: ${finding.remediation ?? 'Review manually.'}`,
    file: finding.source,
  }));

  return { summaryMarkdown, annotations };
}

function topAdvisoryFindings(report: ArchitectureHealthReport): DriftFinding[] {
  return [...report.baseline.newFindings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || confidenceRank(b.confidence) - confidenceRank(a.confidence))
    .slice(0, 10);
}

function countCritical(report: Pick<ArchitectureHealthReport, 'baseline'>): number {
  return (report.baseline?.newFindings ?? []).filter((finding) => finding.severity === 'critical').length;
}

function countWarnings(report: Pick<ArchitectureHealthReport, 'baseline'>): number {
  return (report.baseline?.newFindings ?? []).filter((finding) => ['high', 'medium'].includes(finding.severity)).length;
}

function confidenceRank(confidence: DriftFinding['confidence']): number {
  return { unknown: 0, low: 1, medium: 2, high: 3, confirmed: 4 }[confidence] ?? 0;
}

function formatMovement(value: number | null): string {
  if (value === null) return 'n/a';
  return value > 0 ? `+${value}` : `${value}`;
}

function isNarrativeReference(value: string): boolean {
  return (
    value.includes(' ') ||
    value.includes('where ') ||
    value.includes('where present') ||
    value.includes('Mission Control') ||
    value.includes('dashboard')
  );
}

function groupBy<T>(values: T[], getKey: (value: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  }
  return map;
}

function severityRank(severity: string): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[severity] ?? 0;
}

function title(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, '\\|');
}
