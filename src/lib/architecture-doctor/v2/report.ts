import type { SliceClaim, SliceEvidence, SliceFinding, SliceIntent, SliceKnowledgeNode, SliceKnowledgePublication, SliceObservation, SliceRecommendation, SliceReport, SliceGovernanceEvent } from './domain';

export function renderSliceReport(knowledge: SliceKnowledgePublication): SliceReport {
  const intents = nodeData<SliceIntent>(knowledge, 'Intent');
  const observations = nodeData<SliceObservation>(knowledge, 'Observation');
  const evidence = nodeData<SliceEvidence>(knowledge, 'Evidence');
  const claims = nodeData<SliceClaim>(knowledge, 'Claim');
  const findings = nodeData<SliceFinding>(knowledge, 'Finding');
  const recommendations = nodeData<SliceRecommendation>(knowledge, 'Recommendation');
  const governanceEvents = nodeData<SliceGovernanceEvent>(knowledge, 'GovernanceEvent');
  const governanceEvent = governanceEvents[0];
  const reportNode = knowledge.nodes.find((node) => node.kind === 'Report');
  validateKnowledgeProjection({ knowledge, intents, observations, evidence, claims, findings, recommendations, governanceEvent });

  const lines = [
    `# ${reportNode?.label ?? 'Architecture Doctor v2 - C02 API Route Slice Report'}`,
    '',
    `Generated: ${knowledge.verificationRun.completedAt ?? knowledge.verificationRun.startedAt}`,
    `Mode: ${knowledge.verificationRun.mode}`,
    `Scope: ${knowledge.verificationRun.scope}`,
    '',
    '## Capability Intent',
    '',
    `- Capability: ${knowledge.verificationRun.capabilityId} - ${knowledge.verificationRun.capabilityName}`,
    `- Declared intents: ${intents.length}`,
    '',
    '## Observations',
    '',
    `- Repository observations: ${observations.length}`,
    '- Limitation: static route-file presence only; no runtime behaviour verified.',
    '',
    '## Evidence',
    '',
    ...evidence.map((item) => `- ${item.id}: ${item.kind} for ${item.route} (${item.confidence})`),
    '',
    '## Claims',
    '',
    ...claims.map((claim) => `- ${claim.id}: ${claim.status} - ${claim.predicate} (${claim.confidence})`),
    '',
    '## Findings',
    '',
    ...(findings.length > 0
      ? findings.map((finding) => `- ${finding.id}: ${finding.severity}/${finding.confidence} - ${finding.technicalExplanation}`)
      : ['- No advisory findings produced.']),
    '',
    '## Recommendations',
    '',
    ...(recommendations.length > 0
      ? recommendations.map((recommendation) => `- ${recommendation.id}: ${recommendation.summary} Verification: ${recommendation.verificationCriteria}`)
      : ['- No recommendations required.']),
    '',
    '## Governance Event',
    '',
    governanceEvent ? `- ${governanceEvent.id}: ${governanceEvent.decision} by ${governanceEvent.actor}` : '- No governance event found.',
    governanceEvent ? `- Rationale: ${governanceEvent.rationale}` : '',
    '',
    '## Traceability',
    '',
    '| Finding | Claims | Evidence | Recommendation |',
    '| --- | --- | --- | --- |',
    ...(findings.length > 0
      ? findings.map((finding) => `| ${finding.id} | ${finding.claimIds.join(', ')} | ${finding.evidenceIds.join(', ')} | ${finding.recommendationId} |`)
      : ['| none | none | none | none |']),
    '',
    '## Knowledge Trace',
    '',
    '- Report content is projected from `SliceKnowledgePublication` nodes and edges.',
    '- Every rendered finding must have `produces_finding`, `has_recommendation`, and `affects_capability` edges.',
    '- Every rendered claim must have at least one `supports_claim` or `refutes_claim` edge from evidence.',
    '',
    '## Knowledge Publication',
    '',
    `- Knowledge nodes: ${knowledge.nodes.length}`,
    `- Knowledge edges: ${knowledge.edges.length}`,
    '',
    '## Limitations',
    '',
    ...knowledge.verificationRun.limitations.map((limitation) => `- ${limitation}`),
    '',
  ];

  return {
    markdown: `${lines.join('\n')}\n`,
    knowledgeNodeId: `node-report-${knowledge.verificationRun.id}`,
  };
}

function nodeData<T>(knowledge: SliceKnowledgePublication, kind: SliceKnowledgeNode['kind']): T[] {
  return knowledge.nodes.filter((node) => node.kind === kind).map((node) => node.data as T);
}

function validateKnowledgeProjection(input: {
  knowledge: SliceKnowledgePublication;
  intents: SliceIntent[];
  observations: SliceObservation[];
  evidence: SliceEvidence[];
  claims: SliceClaim[];
  findings: SliceFinding[];
  recommendations: SliceRecommendation[];
  governanceEvent?: SliceGovernanceEvent;
}): void {
  const nodeIds = new Set(input.knowledge.nodes.map((node) => node.id));
  for (const claim of input.claims) {
    const hasEvidenceEdge = input.knowledge.edges.some((edge) => edge.to === `node-${claim.id}` && (edge.kind === 'supports_claim' || edge.kind === 'refutes_claim'));
    if (!hasEvidenceEdge) throw new Error(`Cannot render claim ${claim.id}; no evidence edge exists in knowledge publication.`);
  }
  for (const finding of input.findings) {
    for (const requiredNode of [`node-${finding.id}`, `node-${finding.recommendationId}`, ...finding.claimIds.map((id) => `node-${id}`), ...finding.evidenceIds.map((id) => `node-${id}`)]) {
      if (!nodeIds.has(requiredNode)) throw new Error(`Cannot render finding ${finding.id}; missing knowledge node ${requiredNode}.`);
    }
    const hasFindingEdge = input.knowledge.edges.some((edge) => edge.to === `node-${finding.id}` && edge.kind === 'produces_finding');
    const hasRecommendationEdge = input.knowledge.edges.some((edge) => edge.from === `node-${finding.id}` && edge.to === `node-${finding.recommendationId}` && edge.kind === 'has_recommendation');
    const hasCapabilityEdge = input.knowledge.edges.some((edge) => edge.from === `node-${finding.id}` && edge.kind === 'affects_capability');
    if (!hasFindingEdge || !hasRecommendationEdge || !hasCapabilityEdge) {
      throw new Error(`Cannot render finding ${finding.id}; traceability edges are incomplete.`);
    }
  }
  if (input.recommendations.some((recommendation) => !nodeIds.has(`node-${recommendation.id}`))) {
    throw new Error('Cannot render recommendations; at least one recommendation is missing from knowledge nodes.');
  }
  if (input.governanceEvent && !nodeIds.has(`node-${input.governanceEvent.id}`)) {
    throw new Error(`Cannot render governance event ${input.governanceEvent.id}; missing knowledge node.`);
  }
}
