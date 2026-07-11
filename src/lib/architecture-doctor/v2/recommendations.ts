import type { SliceFinding, SliceRecommendation } from './domain';

export function buildRecommendations(findings: Array<Omit<SliceFinding, 'recommendationId'>>): SliceRecommendation[] {
  return findings.map((finding) => {
    const id = `recommendation-${finding.id}`;
    if (finding.type === 'declared_route_missing_observation') {
      return {
        id,
        findingId: finding.id,
        summary: `Review C02 Atlas intent for ${finding.route}.`,
        requiredDecision: 'Decide whether the Atlas route is stale or the repository route is missing.',
        remediationPath: 'If the route is still intended, restore or document the route file. If it was intentionally removed, update the Atlas through governance.',
        verificationCriteria: `A later C02 route slice either observes ${finding.route} in repository API routes or no longer finds it declared in C02 Atlas intent.`,
        riskReduction: 'Reduces quote/checkout architecture drift and removes ambiguity for revenue-critical route ownership.',
        confidence: finding.confidence,
        uncertainty: 'Static route absence does not prove broken runtime behaviour.',
      };
    }

    return {
      id,
      findingId: finding.id,
      summary: `Map observed route ${finding.route} to declared capability intent.`,
      requiredDecision: 'Decide whether this route belongs to C02 or another capability.',
      remediationPath: 'Add the route to the appropriate Atlas capability or document why it is intentionally outside declared C02 intent.',
      verificationCriteria: `A later C02 route slice either finds ${finding.route} declared in C02 intent or no longer treats it as a C02 candidate route.`,
      riskReduction: 'Reduces unknown ownership around quote and checkout routes.',
      confidence: finding.confidence,
      uncertainty: 'Prefix-based route candidacy is not full ownership proof.',
    };
  });
}
