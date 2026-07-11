import type { SliceClaim, SliceEvidence, SliceFinding } from './domain';
import { C02_CAPABILITY_ID, C02_CAPABILITY_NAME } from './domain';
import { buildRecommendations } from './recommendations';

export function buildC02RouteFindings(claims: SliceClaim[], evidence: SliceEvidence[], owner?: string): { findings: SliceFinding[]; recommendations: ReturnType<typeof buildRecommendations> } {
  const findingDrafts: Array<Omit<SliceFinding, 'recommendationId'>> = [];

  for (const claim of claims) {
    if (claim.type === 'declared_api_route_not_observed' && claim.status === 'refuted') {
      findingDrafts.push({
        id: `finding-missing-c02-route-${routeId(claim.subject)}`,
        type: 'declared_route_missing_observation',
        severity: 'high',
        confidence: claim.confidence,
        capabilityId: C02_CAPABILITY_ID,
        capabilityName: C02_CAPABILITY_NAME,
        owner,
        route: claim.subject,
        claimIds: [claim.id],
        evidenceIds: claim.evidenceIds,
        mappingContext: {
          status: 'declared_capability',
          capabilityId: C02_CAPABILITY_ID,
          capabilityName: C02_CAPABILITY_NAME,
          statement: 'This finding affects declared C02 API-route intent.',
        },
        risk: {
          dimension: 'business',
          statement: `C02 declares ${claim.subject}, but static API-route evidence did not observe it. Quote or checkout intent may be stale or missing.`,
        },
        technicalExplanation: `The Atlas declares ${claim.subject} for C02, but no matching route file was found by the static repository scanner.`,
        businessImpact: 'Quote Pricing and Checkout is revenue-critical; unclear route coverage makes checkout ownership and change impact harder to verify.',
        enforcementMode: 'advisory',
      });
    }

    if (claim.type === 'observed_api_route_unmapped' && claim.status === 'supported') {
      const claimEvidence = evidence.filter((item) => claim.evidenceIds.includes(item.id));
      findingDrafts.push({
        id: `finding-unmapped-c02-route-${routeId(claim.subject)}`,
        type: 'observed_route_unmapped_to_intent',
        severity: 'low',
        confidence: claim.confidence,
        route: claim.subject,
        claimIds: [claim.id],
        evidenceIds: claimEvidence.map((item) => item.id),
        mappingContext: {
          status: 'candidate_capability_unresolved',
          capabilityId: C02_CAPABILITY_ID,
          capabilityName: C02_CAPABILITY_NAME,
          statement: 'This observed route is a C02 candidate by static route prefix, but capability ownership remains unresolved.',
        },
        risk: {
          dimension: 'ownership',
          statement: `Observed route ${claim.subject} appears quote/checkout-related but is not declared in C02 intent.`,
        },
        technicalExplanation: `The repository exposes ${claim.subject}, and the slice matched it as quote/checkout-like by static route prefix, but C02 does not declare it.`,
        businessImpact: 'Unknown route ownership can hide quote or checkout drift from capability owners.',
        enforcementMode: 'advisory',
      });
    }
  }

  const recommendations = buildRecommendations(findingDrafts);
  const findings = findingDrafts.map((finding) => ({
    ...finding,
    recommendationId: recommendations.find((recommendation) => recommendation.findingId === finding.id)?.id ?? '',
  }));

  for (const finding of findings) {
    if (finding.evidenceIds.length === 0 || !finding.recommendationId) {
      throw new Error(`Invalid v2 slice finding ${finding.id}: findings require evidence and recommendation.`);
    }
  }

  return { findings, recommendations };
}

function routeId(route: string): string {
  return route.replace(/^\//, '').replace(/\W+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
}
