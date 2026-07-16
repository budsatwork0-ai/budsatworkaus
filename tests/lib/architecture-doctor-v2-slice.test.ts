import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseAtlas } from '@/lib/architecture-doctor/atlas-parser';
import { scanRepository } from '@/lib/architecture-doctor/repo-scanner';
import { formC02RouteClaims } from '@/lib/architecture-doctor/v2/claims';
import { admitC02RouteEvidence } from '@/lib/architecture-doctor/v2/evidence';
import { buildC02RouteFindings } from '@/lib/architecture-doctor/v2/findings';
import { createSliceGovernanceEvent } from '@/lib/architecture-doctor/v2/governance';
import { extractC02ApiRouteIntent } from '@/lib/architecture-doctor/v2/intent';
import { publishSliceKnowledge } from '@/lib/architecture-doctor/v2/knowledge';
import { collectApiRouteObservations } from '@/lib/architecture-doctor/v2/observations';
import { renderSliceReport } from '@/lib/architecture-doctor/v2/report';
import { runC02RouteSlice } from '@/lib/architecture-doctor/v2';
import type { SliceVerificationRun } from '@/lib/architecture-doctor/v2';

const tempDirs: string[] = [];
const NOW = new Date('2026-07-10T00:00:00.000Z');
const TIMEPOINT = NOW.toISOString();

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Architecture Doctor v2 C02 route slice', () => {
  it('keeps observation, evidence, claim, and finding as distinct lifecycle stages', async () => {
    const root = await makeTempRepo({
      atlasRoutes: ['/api/quotes', '/api/checkout'],
      repoRoutes: ['/api/quotes'],
    });
    const atlasPath = path.join(root, 'atlas.md');
    const atlas = parseAtlas(await readFixture(root, 'atlas.md'), atlasPath);
    const inventory = await scanRepository(root);

    const intents = extractC02ApiRouteIntent(atlas, TIMEPOINT);
    const observations = collectApiRouteObservations(inventory, TIMEPOINT);
    const evidence = admitC02RouteEvidence(intents, observations, TIMEPOINT);
    const claims = formC02RouteClaims(intents, observations, evidence, TIMEPOINT);
    const { findings, recommendations } = buildC02RouteFindings(claims, evidence, 'Sales / CFO');

    expect(intents.map((intent) => intent.route)).toEqual(['/api/checkout', '/api/quotes']);
    expect(observations).toHaveLength(1);
    expect(observations[0]).not.toHaveProperty('confidence');
    expect(evidence.some((item) => item.kind === 'absence' && item.route === '/api/checkout')).toBe(true);
    expect(claims.some((claim) => claim.type === 'declared_api_route_not_observed' && claim.subject === '/api/checkout')).toBe(true);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: 'declared_route_missing_observation',
      capabilityId: 'C02',
      route: '/api/checkout',
      enforcementMode: 'advisory',
      recommendationId: recommendations[0].id,
    });
    expect(findings[0].evidenceIds.length).toBeGreaterThan(0);
  });

  it('runs the complete lifecycle and publishes graph-representable knowledge', async () => {
    const root = await makeTempRepo({
      atlasRoutes: ['/api/quotes'],
      repoRoutes: ['/api/quotes', '/api/quotes/internal'],
    });

    const result = await runC02RouteSlice({
      atlasPath: path.join(root, 'atlas.md'),
      rootDir: root,
      actor: 'Architecture Owner',
      rationale: 'Vertical slice acceptance test.',
      decision: 'needs_review',
      now: NOW,
    });

    expect(result.verificationRun.mode).toBe('advisory');
    expect(result.intents).toHaveLength(1);
    expect(result.observations.map((observation) => observation.route)).toContain('/api/quotes/internal');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      type: 'observed_route_unmapped_to_intent',
      route: '/api/quotes/internal',
      severity: 'low',
      confidence: 'High',
    });
    expect(result.recommendations).toHaveLength(1);
    expect(result.governanceEvent).toMatchObject({
      actor: 'Architecture Owner',
      rationale: 'Vertical slice acceptance test.',
      decision: 'needs_review',
      affectedFindingIds: [result.findings[0].id],
    });
    expect(result.knowledge.nodes.some((node) => node.kind === 'Finding' && node.entityId === result.findings[0].id)).toBe(true);
    expect(result.knowledge.edges.some((edge) => edge.kind === 'has_recommendation')).toBe(true);
    expect(result.report.markdown).toContain('## Traceability');
    expect(result.report.markdown).toContain(result.findings[0].evidenceIds[0]);
  });

  it('records attributable governance and refuses missing actor or rationale', () => {
    const run = makeRun();
    expect(() =>
      createSliceGovernanceEvent({
        verificationRun: run,
        findings: [],
        actor: '',
        rationale: 'Reviewed.',
        timepoint: TIMEPOINT,
      }),
    ).toThrow(/actor/);

    expect(() =>
      createSliceGovernanceEvent({
        verificationRun: run,
        findings: [],
        actor: 'Architecture Owner',
        rationale: '',
        timepoint: TIMEPOINT,
      }),
    ).toThrow(/rationale/);
  });

  it('renders reports from canonical entities without adding findings', async () => {
    const root = await makeTempRepo({
      atlasRoutes: ['/api/quotes'],
      repoRoutes: ['/api/quotes'],
    });
    const result = await runC02RouteSlice({
      atlasPath: path.join(root, 'atlas.md'),
      rootDir: root,
      actor: 'Architecture Owner',
      rationale: 'No drift review.',
      now: NOW,
    });

    const report = renderSliceReport(result.knowledge);

    expect(result.findings).toHaveLength(0);
    expect(report.markdown).toContain('- No advisory findings produced.');
    expect(result.knowledge.nodes.some((node) => node.kind === 'Report')).toBe(true);
    expect(result.knowledge.edges.some((edge) => edge.kind === 'renders_knowledge')).toBe(true);
  });

  it('enforces constitutional invariants for claims, findings, graph edges, and reports', async () => {
    const root = await makeTempRepo({
      atlasRoutes: ['/api/quotes', '/api/checkout'],
      repoRoutes: ['/api/quotes', '/api/quotes/internal'],
    });
    const result = await runC02RouteSlice({
      atlasPath: path.join(root, 'atlas.md'),
      rootDir: root,
      actor: 'Architecture Owner',
      rationale: 'Invariant review.',
      now: NOW,
    });

    for (const claim of result.claims) {
      expect(claim.evidenceIds.length).toBeGreaterThan(0);
    }

    const absenceEvidence = result.evidence.find((item) => item.kind === 'absence');
    expect(absenceEvidence).toBeDefined();
    const absenceEdges = result.knowledge.edges.filter((edge) => edge.from === `node-${absenceEvidence?.id}` && edge.to === `node-${absenceEvidence?.claimId}`);
    expect(absenceEdges.map((edge) => edge.kind)).toEqual(['supports_claim']);

    for (const finding of result.findings) {
      expect(finding.risk.statement).toBeTruthy();
      expect(finding.severity).toBeTruthy();
      expect(finding.confidence).toBeTruthy();
      expect(finding.recommendationId).toBeTruthy();
      expect(finding.capabilityId || finding.mappingContext.status === 'candidate_capability_unresolved').toBeTruthy();
    }

    const report = renderSliceReport(result.knowledge);
    expect(report.markdown).toContain('Report content is projected from `SliceKnowledgePublication` nodes and edges.');

    const brokenKnowledge = {
      ...result.knowledge,
      edges: result.knowledge.edges.filter((edge) => edge.kind !== 'has_recommendation'),
    };
    expect(() => renderSliceReport(brokenKnowledge)).toThrow(/traceability edges/);
  });

  it('runs against the real repository in advisory mode', async () => {
    const rootDir = process.cwd();
    const result = await runC02RouteSlice({
      atlasPath: path.join(rootDir, 'Buds At Work/01 Architecture/Bud OS Business Capability Atlas 2026-07-08.md'),
      rootDir,
      actor: 'Architecture Doctor v2 test',
      rationale: 'Real repository smoke test.',
      now: NOW,
    });

    expect(result.intents.length).toBeGreaterThan(0);
    expect(result.intents[0]).toMatchObject({ capabilityId: 'C02', capabilityName: 'Quote Pricing and Checkout' });
    expect(result.observations.some((observation) => observation.route === '/api/quotes')).toBe(true);
    expect(result.knowledge.nodes.length).toBeGreaterThan(result.findings.length);
    expect(result.report.markdown).toContain('Architecture Doctor v2 - C02 API Route Slice Report');
    expect(result.verificationRun.mode).toBe('advisory');
  }, 15000);
});

async function makeTempRepo(input: { atlasRoutes: string[]; repoRoutes: string[] }): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ad-v2-slice-'));
  tempDirs.push(root);
  await writeText(root, 'atlas.md', makeAtlas(input.atlasRoutes));
  for (const route of input.repoRoutes) {
    await writeText(root, routeFile(route), 'export async function GET() { return Response.json({ ok: true }); }');
  }
  return root;
}

function makeAtlas(routes: string[]): string {
  return `# Test Atlas

### C02 - Quote Pricing and Checkout

| Field | Value |
| --- | --- |
| Owner | Sales / CFO |
| Criticality / Maturity / Priority | 10 / 4 / 12 |
| UI pages | none |
| API routes | ${routes.map((route) => `\`${route}\``).join(', ')} |
| Agents | none |
| Cron / workers | none |
| Tables | none |
| Buckets | none |
| External integrations | none |
| Env vars | none |
| Feature flags | none |
`;
}

function routeFile(route: string): string {
  const parts = route.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return path.join('src/app/api', ...parts, 'route.ts');
}

async function writeText(root: string, relativePath: string, text: string): Promise<void> {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, text, 'utf8');
}

async function readFixture(root: string, relativePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(path.join(root, relativePath), 'utf8');
}

function makeRun(): SliceVerificationRun {
  return {
    id: 'adv2-c02-test',
    scope: 'capability:C02 assetKind:apiRoute',
    capabilityId: 'C02',
    capabilityName: 'Quote Pricing and Checkout',
    assetKind: 'apiRoute',
    mode: 'advisory',
    startedAt: TIMEPOINT,
    limitations: ['test'],
  };
}
