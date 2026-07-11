import type {
  SliceClaim,
  SliceEvidence,
  SliceFinding,
  SliceGovernanceEvent,
  SliceIntent,
  SliceKnowledgeEdge,
  SliceKnowledgeNode,
  SliceKnowledgePublication,
  SliceObservation,
  SliceRecommendation,
  SliceVerificationRun,
} from './domain';
import { C02_CAPABILITY_ID, C02_CAPABILITY_NAME } from './domain';

export function publishSliceKnowledge(input: {
  verificationRun: SliceVerificationRun;
  intents: SliceIntent[];
  observations: SliceObservation[];
  evidence: SliceEvidence[];
  claims: SliceClaim[];
  findings: SliceFinding[];
  recommendations: SliceRecommendation[];
  governanceEvent: SliceGovernanceEvent;
}): SliceKnowledgePublication {
  const nodes: SliceKnowledgeNode[] = [
    {
      id: `node-capability-${C02_CAPABILITY_ID}`,
      kind: 'Capability',
      label: C02_CAPABILITY_NAME,
      entityId: C02_CAPABILITY_ID,
      data: { capabilityId: C02_CAPABILITY_ID, capabilityName: C02_CAPABILITY_NAME },
    },
    {
      id: `node-run-${input.verificationRun.id}`,
      kind: 'VerificationRun',
      label: input.verificationRun.id,
      entityId: input.verificationRun.id,
      data: input.verificationRun as unknown as Record<string, unknown>,
    },
    ...input.intents.map((intent): SliceKnowledgeNode => ({
      id: `node-${intent.id}`,
      kind: 'Intent',
      label: intent.route,
      entityId: intent.id,
      data: intent as unknown as Record<string, unknown>,
      provenance: intent.provenance,
    })),
    ...input.observations.map((observation): SliceKnowledgeNode => ({
      id: `node-${observation.id}`,
      kind: 'Observation',
      label: observation.route,
      entityId: observation.id,
      data: observation as unknown as Record<string, unknown>,
      provenance: observation.provenance,
    })),
    ...input.evidence.map((evidence): SliceKnowledgeNode => ({
      id: `node-${evidence.id}`,
      kind: 'Evidence',
      label: evidence.route,
      entityId: evidence.id,
      data: evidence as unknown as Record<string, unknown>,
      provenance: evidence.provenance,
    })),
    ...input.claims.map((claim): SliceKnowledgeNode => ({
      id: `node-${claim.id}`,
      kind: 'Claim',
      label: claim.subject,
      entityId: claim.id,
      data: claim as unknown as Record<string, unknown>,
      provenance: claim.provenance,
    })),
    ...input.findings.map((finding): SliceKnowledgeNode => ({
      id: `node-${finding.id}`,
      kind: 'Finding',
      label: finding.route,
      entityId: finding.id,
      data: finding as unknown as Record<string, unknown>,
    })),
    ...input.recommendations.map((recommendation): SliceKnowledgeNode => ({
      id: `node-${recommendation.id}`,
      kind: 'Recommendation',
      label: recommendation.summary,
      entityId: recommendation.id,
      data: recommendation as unknown as Record<string, unknown>,
    })),
    {
      id: `node-${input.governanceEvent.id}`,
      kind: 'GovernanceEvent',
      label: input.governanceEvent.decision,
      entityId: input.governanceEvent.id,
      data: input.governanceEvent as unknown as Record<string, unknown>,
      provenance: input.governanceEvent.provenance,
    },
    {
      id: `node-report-${input.verificationRun.id}`,
      kind: 'Report',
      label: 'Architecture Doctor v2 - C02 API Route Slice Report',
      entityId: `report-${input.verificationRun.id}`,
      data: {
        reportType: 'markdown',
        scope: input.verificationRun.scope,
        renderedFromKnowledge: true,
      },
    },
  ];

  const edges: SliceKnowledgeEdge[] = [];
  for (const intent of input.intents) {
    edges.push(edge('declares_intent', `node-capability-${C02_CAPABILITY_ID}`, `node-${intent.id}`, intent.id, intent.provenance));
  }
  for (const evidence of input.evidence) {
    for (const observationId of evidence.observationIds) {
      edges.push(edge('derives_evidence', `node-${observationId}`, `node-${evidence.id}`, evidence.id, evidence.provenance));
    }
    for (const intentId of evidence.intentIds) {
      edges.push(edge(evidence.supports ? 'supports_claim' : 'refutes_claim', `node-${evidence.id}`, `node-${evidence.claimId}`, `${evidence.id}-${intentId}`, evidence.provenance));
    }
    if (evidence.intentIds.length === 0) {
      edges.push(edge(evidence.supports ? 'supports_claim' : 'refutes_claim', `node-${evidence.id}`, `node-${evidence.claimId}`, evidence.id, evidence.provenance));
    }
  }
  for (const finding of input.findings) {
    edges.push(edge('affects_capability', `node-${finding.id}`, `node-capability-${C02_CAPABILITY_ID}`, finding.id));
    for (const claimId of finding.claimIds) {
      edges.push(edge('produces_finding', `node-${claimId}`, `node-${finding.id}`, `${claimId}-${finding.id}`));
    }
    edges.push(edge('has_recommendation', `node-${finding.id}`, `node-${finding.recommendationId}`, finding.recommendationId));
    edges.push(edge('reviews_finding', `node-${input.governanceEvent.id}`, `node-${finding.id}`, `${input.governanceEvent.id}-${finding.id}`, input.governanceEvent.provenance));
  }
  edges.push(edge('renders_knowledge', `node-report-${input.verificationRun.id}`, `node-run-${input.verificationRun.id}`, input.verificationRun.id));

  return { verificationRun: input.verificationRun, nodes, edges };
}

function edge(kind: SliceKnowledgeEdge['kind'], from: string, to: string, suffix: string, provenance?: SliceKnowledgeEdge['provenance']): SliceKnowledgeEdge {
  return {
    id: `edge-${kind}-${suffix}`.replace(/\W+/g, '-').toLowerCase(),
    kind,
    from,
    to,
    provenance,
  };
}
