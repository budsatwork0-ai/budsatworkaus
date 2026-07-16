export const C02_CAPABILITY_ID = 'C02';
export const C02_CAPABILITY_NAME = 'Quote Pricing and Checkout';
export const V2_SLICE_SCOPE = 'capability:C02 assetKind:apiRoute';

export type SliceAssetKind = 'apiRoute' | 'cron';
export type SliceConfidence = 'Unknown' | 'Low' | 'Medium' | 'High' | 'Very High' | 'Deterministic';
export type SliceClaimStatus = 'supported' | 'refuted' | 'contested' | 'unresolved';
export type SliceFindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type SliceFindingType =
  | 'declared_route_missing_observation'
  | 'observed_route_unmapped_to_intent'
  | 'cron_route_unregistered'
  | 'cron_target_missing';
export type SliceGovernanceDecision = 'acknowledged' | 'baseline_requested' | 'rejected' | 'needs_review';

export interface SliceProvenance {
  source: string;
  sourceType: 'atlas' | 'repository_scan' | 'slice_reasoning' | 'human_governance';
  method: string;
  timepoint: string;
  limitation?: string;
}

export interface SliceVerificationRun {
  id: string;
  scope: string;
  capabilityId: string;
  capabilityName: string;
  assetKind: SliceAssetKind;
  mode: 'advisory';
  startedAt: string;
  completedAt?: string;
  limitations: string[];
}

export interface SliceIntent {
  id: string;
  capabilityId: string;
  capabilityName: string;
  owner?: string;
  assetKind: SliceAssetKind;
  route: string;
  scope: string;
  provenance: SliceProvenance;
}

export interface SliceObservation {
  id: string;
  assetKind: SliceAssetKind;
  route: string;
  scope: string;
  provenance: SliceProvenance;
}

export interface SliceEvidence {
  id: string;
  claimId: string;
  route: string;
  kind: 'presence' | 'absence' | 'unmapped_presence' | 'cron_route_candidate_unregistered' | 'cron_target_missing_route';
  supports: boolean;
  observationIds: string[];
  intentIds: string[];
  confidence: SliceConfidence;
  provenance: SliceProvenance;
  limitation?: string;
  filePath?: string;
  location?: {
    precision: 'line' | 'unavailable';
    line?: number;
    description: string;
  };
  ruleId?: string;
  observedValue?: string;
  expectedValue?: string;
}

export type SliceClaimType =
  | 'declared_api_route_observed'
  | 'declared_api_route_not_observed'
  | 'observed_api_route_declared'
  | 'observed_api_route_unmapped'
  | 'cron_route_not_registered'
  | 'cron_target_not_observed';

export interface SliceClaim {
  id: string;
  type: SliceClaimType;
  status: SliceClaimStatus;
  subject: string;
  predicate: string;
  capabilityId?: string;
  capabilityName?: string;
  scope: string;
  evidenceIds: string[];
  confidence: SliceConfidence;
  uncertainty?: string;
  provenance: SliceProvenance;
}

export interface SliceRisk {
  dimension: 'architectural' | 'business' | 'ownership';
  statement: string;
}

export interface SliceMappingContext {
  status: 'declared_capability' | 'candidate_capability_unresolved';
  capabilityId?: string;
  capabilityName?: string;
  statement: string;
}

export interface SliceRecommendation {
  id: string;
  findingId: string;
  summary: string;
  requiredDecision: string;
  remediationPath: string;
  verificationCriteria: string;
  riskReduction: string;
  confidence: SliceConfidence;
  uncertainty?: string;
}

export interface SliceFinding {
  id: string;
  type: SliceFindingType;
  severity: SliceFindingSeverity;
  confidence: SliceConfidence;
  capabilityId?: string;
  capabilityName?: string;
  owner?: string;
  route: string;
  claimIds: string[];
  evidenceIds: string[];
  mappingContext: SliceMappingContext;
  risk: SliceRisk;
  recommendationId: string;
  technicalExplanation: string;
  businessImpact: string;
  enforcementMode: 'advisory';
}

export interface SliceGovernanceEvent {
  id: string;
  type: 'slice_advisory_review_recorded';
  actor: string;
  rationale: string;
  decision: SliceGovernanceDecision;
  scope: string;
  timepoint: string;
  affectedFindingIds: string[];
  verificationRunId: string;
  provenance: SliceProvenance;
}

export interface SliceKnowledgeNode {
  id: string;
  kind:
    | 'Capability'
    | 'Intent'
    | 'Observation'
    | 'Evidence'
    | 'Claim'
    | 'Finding'
    | 'Recommendation'
    | 'GovernanceEvent'
    | 'VerificationRun'
    | 'Report';
  label: string;
  entityId: string;
  data: Record<string, unknown>;
  provenance?: SliceProvenance;
}

export interface SliceKnowledgeEdge {
  id: string;
  kind:
    | 'declares_intent'
    | 'derives_evidence'
    | 'supports_claim'
    | 'refutes_claim'
    | 'produces_finding'
    | 'affects_capability'
    | 'has_recommendation'
    | 'reviews_finding'
    | 'renders_knowledge';
  from: string;
  to: string;
  provenance?: SliceProvenance;
}

export interface SliceKnowledgePublication {
  verificationRun: SliceVerificationRun;
  nodes: SliceKnowledgeNode[];
  edges: SliceKnowledgeEdge[];
}

export interface SliceReport {
  markdown: string;
  knowledgeNodeId: string;
}

export interface SliceResult {
  verificationRun: SliceVerificationRun;
  intents: SliceIntent[];
  observations: SliceObservation[];
  evidence: SliceEvidence[];
  claims: SliceClaim[];
  findings: SliceFinding[];
  recommendations: SliceRecommendation[];
  governanceEvent: SliceGovernanceEvent;
  knowledge: SliceKnowledgePublication;
  report: SliceReport;
}

export interface RunC02RouteSliceInput {
  atlasPath: string;
  rootDir: string;
  actor: string;
  rationale: string;
  decision?: SliceGovernanceDecision;
  now?: Date;
}

export function slug(value: string): string {
  return value
    .replace(/^\//, '')
    .replace(/\W+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'root';
}
