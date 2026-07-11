import type { SliceClaim, SliceEvidence, SliceIntent, SliceObservation } from './domain';
import { C02_CAPABILITY_ID, C02_CAPABILITY_NAME, V2_SLICE_SCOPE } from './domain';

export function formC02RouteClaims(intents: SliceIntent[], observations: SliceObservation[], evidence: SliceEvidence[], timepoint: string): SliceClaim[] {
  const observationsByRoute = new Set(observations.map((observation) => observation.route));
  const claims: SliceClaim[] = [];

  for (const intent of intents) {
    const observed = observationsByRoute.has(intent.route);
    const id = observed
      ? `claim-c02-declared-observed-${routeId(intent.route)}`
      : `claim-c02-declared-not-observed-${routeId(intent.route)}`;
    const matchingEvidence = evidence.filter((item) => item.claimId === id);
    if (matchingEvidence.length === 0) {
      throw new Error(`Architecture Doctor v2 claim ${id} has no evidence.`);
    }
    claims.push({
      id,
      type: observed ? 'declared_api_route_observed' : 'declared_api_route_not_observed',
      status: observed ? 'supported' : 'refuted',
      subject: intent.route,
      predicate: observed ? 'declared C02 API route is observed in repository' : 'declared C02 API route is not observed in repository',
      capabilityId: C02_CAPABILITY_ID,
      capabilityName: C02_CAPABILITY_NAME,
      scope: V2_SLICE_SCOPE,
      evidenceIds: matchingEvidence.map((item) => item.id),
      confidence: matchingEvidence[0]?.confidence ?? 'Unknown',
      uncertainty: observed ? undefined : 'This may indicate stale Atlas intent or missing repository route; governance review is required.',
      provenance: {
        source: 'Architecture Doctor v2 C02 route slice',
        sourceType: 'slice_reasoning',
        method: 'route coverage claim formation',
        timepoint,
      },
    });
  }

  for (const item of evidence.filter((entry) => entry.kind === 'unmapped_presence')) {
    claims.push({
      id: item.claimId,
      type: 'observed_api_route_unmapped',
      status: 'supported',
      subject: item.route,
      predicate: 'observed quote/checkout-like API route is not declared in C02 Atlas intent',
      scope: V2_SLICE_SCOPE,
      evidenceIds: [item.id],
      confidence: item.confidence,
      uncertainty: 'Route appears related to C02 by static prefix only; capability ownership requires review.',
      provenance: {
        source: 'Architecture Doctor v2 C02 route slice',
        sourceType: 'slice_reasoning',
        method: 'unmapped observed route claim formation',
        timepoint,
      },
    });
  }

  return claims.sort((a, b) => a.id.localeCompare(b.id));
}

function routeId(route: string): string {
  return route.replace(/^\//, '').replace(/\W+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
}
