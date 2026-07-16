import { parseAtlasFile } from '../atlas-parser';
import { scanRepository } from '../repo-scanner';
import { admitC02RouteEvidence } from './evidence';
import { buildC02RouteFindings } from './findings';
import { createSliceGovernanceEvent } from './governance';
import { formC02RouteClaims } from './claims';
import { publishSliceKnowledge } from './knowledge';
import { collectApiRouteObservations } from './observations';
import { renderSliceReport } from './report';
import { extractC02ApiRouteIntent } from './intent';
import { C02_CAPABILITY_ID, C02_CAPABILITY_NAME, V2_SLICE_SCOPE, type RunC02RouteSliceInput, type SliceResult, type SliceVerificationRun } from './domain';

export async function runC02RouteSlice(input: RunC02RouteSliceInput): Promise<SliceResult> {
  const now = input.now ?? new Date();
  const startedAt = now.toISOString();
  const runId = `adv2-c02-api-routes-${stableDateId(now)}`;
  const verificationRun: SliceVerificationRun = {
    id: runId,
    scope: V2_SLICE_SCOPE,
    capabilityId: C02_CAPABILITY_ID,
    capabilityName: C02_CAPABILITY_NAME,
    assetKind: 'apiRoute',
    mode: 'advisory',
    startedAt,
    limitations: [
      'Static API-route verification only.',
      'No runtime behaviour, authentication, payment, database, RLS, or checkout correctness is verified.',
      'Atlas disagreement is treated as drift requiring review, not automatic proof of code fault.',
      'No baseline, exception, enforcement change, AI reasoning, plugin admission, or predictive capability is performed.',
    ],
  };

  const atlas = await parseAtlasFile(input.atlasPath);
  const inventory = await scanRepository(input.rootDir);
  const intents = extractC02ApiRouteIntent(atlas, startedAt);
  const observations = collectApiRouteObservations(inventory, startedAt);
  const evidence = admitC02RouteEvidence(intents, observations, startedAt);
  const claims = formC02RouteClaims(intents, observations, evidence, startedAt);
  const owner = intents[0]?.owner;
  const { findings, recommendations } = buildC02RouteFindings(claims, evidence, owner);
  const governanceEvent = createSliceGovernanceEvent({
    verificationRun,
    findings,
    actor: input.actor,
    rationale: input.rationale,
    decision: input.decision,
    timepoint: startedAt,
  });
  const completedRun = { ...verificationRun, completedAt: startedAt };
  const knowledge = publishSliceKnowledge({
    verificationRun: completedRun,
    intents,
    observations,
    evidence,
    claims,
    findings,
    recommendations,
    governanceEvent,
  });
  const report = renderSliceReport(knowledge);

  return {
    verificationRun: completedRun,
    intents,
    observations,
    evidence,
    claims,
    findings,
    recommendations,
    governanceEvent,
    knowledge,
    report,
  };
}

function stableDateId(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'z').replace(/\W+/g, '-').toLowerCase();
}
