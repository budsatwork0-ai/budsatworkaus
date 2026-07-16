import type {
  SliceKnowledgeEdge,
  SliceKnowledgeNode,
  SliceKnowledgePublication,
  SliceVerificationRun,
} from './domain';
import type { ModuleAnalysisResult, ModuleCapability } from './module-analyzer';

export function publishModuleKnowledge(input: {
  verificationRun: SliceVerificationRun;
  analyses: ModuleAnalysisResult[];
  reportLabel?: string;
}): SliceKnowledgePublication {
  const nodes: SliceKnowledgeNode[] = [
    {
      id: `node-run-${input.verificationRun.id}`,
      kind: 'VerificationRun',
      label: input.verificationRun.id,
      entityId: input.verificationRun.id,
      data: input.verificationRun as unknown as Record<string, unknown>,
    },
    {
      id: `node-report-${input.verificationRun.id}`,
      kind: 'Report',
      label: input.reportLabel ?? 'Architecture Doctor v2 Module Report',
      entityId: `report-${input.verificationRun.id}`,
      data: {
        reportType: 'markdown',
        scope: input.verificationRun.scope,
        renderedFromKnowledge: true,
      },
    },
  ];
  const edges: SliceKnowledgeEdge[] = [
    edge('renders_knowledge', `node-report-${input.verificationRun.id}`, `node-run-${input.verificationRun.id}`, input.verificationRun.id),
  ];

  for (const analysis of input.analyses) {
    for (const capability of analysis.capabilities) {
      nodes.push(capabilityNode(capability));
    }
    for (const intent of analysis.intents) {
      nodes.push({
        id: `node-${intent.id}`,
        kind: 'Intent',
        label: intent.route,
        entityId: intent.id,
        data: intent as unknown as Record<string, unknown>,
        provenance: intent.provenance,
      });
      edges.push(edge('declares_intent', `node-capability-${intent.capabilityId}`, `node-${intent.id}`, intent.id, intent.provenance));
    }
    for (const observation of analysis.observations) {
      nodes.push({
        id: `node-${observation.id}`,
        kind: 'Observation',
        label: observation.route,
        entityId: observation.id,
        data: observation as unknown as Record<string, unknown>,
        provenance: observation.provenance,
      });
    }
    for (const evidence of analysis.evidence) {
      nodes.push({
        id: `node-${evidence.id}`,
        kind: 'Evidence',
        label: evidence.route,
        entityId: evidence.id,
        data: evidence as unknown as Record<string, unknown>,
        provenance: evidence.provenance,
      });
      for (const observationId of evidence.observationIds) {
        edges.push(edge('derives_evidence', `node-${observationId}`, `node-${evidence.id}`, evidence.id, evidence.provenance));
      }
      edges.push(edge(evidence.supports ? 'supports_claim' : 'refutes_claim', `node-${evidence.id}`, `node-${evidence.claimId}`, evidence.id, evidence.provenance));
    }
    for (const claim of analysis.claims) {
      nodes.push({
        id: `node-${claim.id}`,
        kind: 'Claim',
        label: claim.subject,
        entityId: claim.id,
        data: claim as unknown as Record<string, unknown>,
        provenance: claim.provenance,
      });
    }
    for (const finding of analysis.findings) {
      nodes.push({
        id: `node-${finding.id}`,
        kind: 'Finding',
        label: finding.route,
        entityId: finding.id,
        data: finding as unknown as Record<string, unknown>,
      });
      for (const claimId of finding.claimIds) {
        edges.push(edge('produces_finding', `node-${claimId}`, `node-${finding.id}`, `${claimId}-${finding.id}`));
      }
      edges.push(edge('has_recommendation', `node-${finding.id}`, `node-${finding.recommendationId}`, finding.recommendationId));
      const capabilityNodeId = finding.capabilityId ? `node-capability-${finding.capabilityId}` : `node-capability-${finding.mappingContext.capabilityId ?? 'unresolved'}`;
      edges.push(edge('affects_capability', `node-${finding.id}`, capabilityNodeId, finding.id));
    }
    for (const recommendation of analysis.recommendations) {
      nodes.push({
        id: `node-${recommendation.id}`,
        kind: 'Recommendation',
        label: recommendation.summary,
        entityId: recommendation.id,
        data: recommendation as unknown as Record<string, unknown>,
      });
    }
  }

  return {
    verificationRun: input.verificationRun,
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

function capabilityNode(capability: ModuleCapability): SliceKnowledgeNode {
  return {
    id: `node-capability-${capability.id}`,
    kind: 'Capability',
    label: capability.name,
    entityId: capability.id,
    data: { capabilityId: capability.id, capabilityName: capability.name },
  };
}

function dedupeNodes(nodes: SliceKnowledgeNode[]): SliceKnowledgeNode[] {
  const byId = new Map<string, SliceKnowledgeNode>();
  for (const node of nodes) {
    const existing = byId.get(node.id);
    if (!existing) {
      byId.set(node.id, node);
      continue;
    }
    if (JSON.stringify(existing) !== JSON.stringify(node)) {
      throw new Error(`Conflicting knowledge node id ${node.id}; analyzer outputs must use distinct ids for distinct knowledge.`);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function dedupeEdges(edges: SliceKnowledgeEdge[]): SliceKnowledgeEdge[] {
  const bySignature = new Map<string, SliceKnowledgeEdge>();
  for (const item of edges) {
    const signature = `${item.kind}:${item.from}->${item.to}`;
    if (!bySignature.has(signature)) bySignature.set(signature, item);
  }
  return [...bySignature.values()].sort((a, b) => a.id.localeCompare(b.id));
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
