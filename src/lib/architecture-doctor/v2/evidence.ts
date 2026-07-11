import { C02_CAPABILITY_ID, V2_SLICE_SCOPE, slug, type SliceEvidence, type SliceIntent, type SliceObservation } from './domain';

const C02_ROUTE_PREFIXES = ['/api/quotes', '/api/pay', '/api/checkout', '/api/paypal', '/api/rego-lookup', '/api/geo/mmm', '/api/analytics/quote-funnel'];

export function admitC02RouteEvidence(intents: SliceIntent[], observations: SliceObservation[], timepoint: string): SliceEvidence[] {
  const observedRoutes = new Set(observations.map((observation) => observation.route));
  const intentRoutes = new Set(intents.map((intent) => intent.route));
  const evidence: SliceEvidence[] = [];

  for (const intent of intents) {
    const observation = observations.find((item) => item.route === intent.route);
    const claimId = observation
      ? `claim-c02-declared-observed-${slug(intent.route)}`
      : `claim-c02-declared-not-observed-${slug(intent.route)}`;

    evidence.push({
      id: `evidence-${observation ? 'presence' : 'absence'}-${slug(intent.route)}`,
      claimId,
      route: intent.route,
      kind: observation ? 'presence' : 'absence',
      supports: true,
      observationIds: observation ? [observation.id] : [],
      intentIds: [intent.id],
      confidence: exactRouteConfidence(intent.route),
      provenance: {
        source: `${intent.provenance.source} + repository scan`,
        sourceType: 'slice_reasoning',
        method: observedRoutes.has(intent.route) ? 'exact declared route matched observed route' : 'declared route absent from observed route set',
        timepoint,
        limitation: 'Absence evidence is limited to static route-file discovery.',
      },
      limitation: observation ? undefined : 'A missing static route may mean the Atlas is stale rather than the repository is wrong.',
    });
  }

  for (const observation of observations) {
    if (intentRoutes.has(observation.route) || !isC02CandidateRoute(observation.route)) continue;
    evidence.push({
      id: `evidence-unmapped-${slug(observation.route)}`,
      claimId: `claim-c02-observed-unmapped-${slug(observation.route)}`,
      route: observation.route,
      kind: 'unmapped_presence',
      supports: true,
      observationIds: [observation.id],
      intentIds: [],
      confidence: 'High',
      provenance: {
        source: observation.provenance.source,
        sourceType: 'slice_reasoning',
        method: 'observed quote/checkout-like route not found in C02 Atlas API route intent',
        timepoint,
        limitation: `Candidate route matched C02 route prefixes for ${C02_CAPABILITY_ID}; ownership still requires human review.`,
      },
    });
  }

  return evidence.sort((a, b) => a.id.localeCompare(b.id));
}

function exactRouteConfidence(route: string): SliceEvidence['confidence'] {
  return route.includes('*') ? 'Medium' : 'Deterministic';
}

function isC02CandidateRoute(route: string): boolean {
  return C02_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}
