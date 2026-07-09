export type ArchitectureAssetKind =
  | 'page'
  | 'apiRoute'
  | 'agent'
  | 'cron'
  | 'table'
  | 'view'
  | 'storageBucket'
  | 'envVar'
  | 'featureFlag'
  | 'externalIntegration'
  | 'worker';

export type DriftFindingType =
  | 'atlas_api_missing'
  | 'repo_api_unmapped'
  | 'atlas_page_missing'
  | 'repo_page_unmapped'
  | 'atlas_agent_missing'
  | 'repo_agent_unmapped'
  | 'atlas_table_missing'
  | 'repo_table_unmapped'
  | 'cron_route_unregistered'
  | 'cron_target_missing'
  | 'dependency_cycle'
  | 'dependency_cross_domain'
  | 'governance_unknown'
  | 'business_loop_unknown'
  | 'rls_missing_signal'
  | 'rls_unknown';

export type DriftSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type DriftConfidence = 'confirmed' | 'high' | 'medium' | 'low' | 'unknown';
export type ArchitectureHealthCategory =
  | 'Security'
  | 'Database'
  | 'Dependency Architecture'
  | 'Documentation'
  | 'Performance'
  | 'Maintainability';

export interface CapabilitySpec {
  id: string;
  name: string;
  owner?: string;
  criticality?: number;
  maturity?: number;
  priority?: number;
  uiPages: string[];
  apiRoutes: string[];
  agents: string[];
  cronWorkers: string[];
  tables: string[];
  buckets: string[];
  externalIntegrations: string[];
  envVars: string[];
  featureFlags: string[];
}

export interface AtlasSpec {
  sourcePath: string;
  capabilities: CapabilitySpec[];
}

export interface CronEntry {
  path: string;
  routePath: string;
  schedule: string;
}

export interface ArchitectureInventory {
  rootDir: string;
  sourceFiles: string[];
  pages: string[];
  apiRoutes: string[];
  agents: string[];
  cronEntries: CronEntry[];
  cronRouteCandidates: string[];
  migrationTables: string[];
  migrationViews: string[];
  tableUsages: string[];
  envVars: string[];
  storageBuckets: string[];
}

export interface SourceIndex {
  tables: string[];
  routes: string[];
  pages: string[];
  agents: string[];
  storageBuckets: string[];
  envVars: string[];
  cronRouteTargets: string[];
  atlasApiPatterns: string[];
  atlasPagePatterns: string[];
  atlasAgents: string[];
  atlasTables: string[];
}

export interface DriftFinding {
  type: DriftFindingType;
  severity: DriftSeverity;
  confidence: DriftConfidence;
  category?: ArchitectureHealthCategory;
  assetKind: ArchitectureAssetKind;
  asset: string;
  key?: string;
  capabilityId?: string;
  capabilityName?: string;
  owner?: string;
  riskArea?: string;
  riskWeight?: number;
  message: string;
  evidence?: string[];
  source?: string;
  remediation?: string;
  baselineDisposition?: SecurityFindingDisposition;
  baselineReason?: string;
  baselineOwner?: string;
  baselineReviewDate?: string;
  baselineExpiryDate?: string;
}

export type SecurityFindingDisposition =
  | 'true_positive_fix_now'
  | 'true_positive_defer'
  | 'acceptable_baseline'
  | 'detector_false_positive'
  | 'needs_manual_review';

export type CriticalTriageClassification =
  | 'confirmed real issue'
  | 'static-analysis unknown'
  | 'manifest/baseline gap'
  | 'duplicate/noisy finding';

export interface CriticalTriageItem {
  finding: DriftFinding;
  classification: CriticalTriageClassification;
  whyItMatters: string;
  smallestSafeFix: string;
  requiredChange: 'code' | 'migration' | 'manifest/baseline update' | 'none';
}

export interface BaselineAcceptedFinding {
  id?: string;
  key?: string;
  type?: DriftFindingType;
  file?: string;
  asset?: string;
  capabilityId?: string;
  capability?: string;
  owner?: string;
  severity?: DriftSeverity;
  accepted_by?: string;
  accepted_reason?: string;
  reason?: string;
  accepted_at?: string;
  acceptedAt?: string;
  review_after?: string;
  reviewAfter?: string;
  review_date?: string;
  reviewDate?: string;
  expiry_date?: string;
  expiryDate?: string;
  disposition?: SecurityFindingDisposition;
  risk?: string;
  smallest_safe_remediation?: string;
  code_or_migration_required?: 'code' | 'migration' | 'detector' | 'manifest/baseline' | 'none' | 'manual review';
  score_impact?: 'none' | 'light' | 'normal';
}

export interface ArchitectureDoctorBaseline {
  version: 1;
  acceptedFindings: BaselineAcceptedFinding[];
}

export interface BaselineClassification {
  baselinePath?: string;
  newFindings: DriftFinding[];
  acceptedFindings: DriftFinding[];
  resolvedFindings: BaselineAcceptedFinding[];
  unknownUnmappedAssets: DriftFinding[];
  staleAcceptedFindings: DriftFinding[];
}

export type GovernanceSignalName = 'rls' | 'audit' | 'retry' | 'monitoring' | 'fallback';
export type CheckStatus = 'present' | 'unknown';

export interface GovernanceCheck {
  capabilityId: string;
  capabilityName: string;
  signals: Record<GovernanceSignalName, { status: CheckStatus; evidence: string[] }>;
}

export interface DependencyGraphReport {
  filesScanned: number;
  importEdges: number;
  cycles: Array<{
    files: string[];
    canonicalKey?: string;
    domain?: string;
    capabilityId?: string;
    recommendedFix?: string;
  }>;
  crossDomainImports: Array<{ from: string; to: string; fromDomain: string; toDomain: string }>;
}

export type DependencyCycleClassification =
  | 'production architecture issue'
  | 'test/tooling noise'
  | 'acceptable shared-layer cycle'
  | 'needs manual review';

export interface DependencyCycleReadinessGroup {
  domain: string;
  capabilityId?: string;
  classification: DependencyCycleClassification;
  cycles: DependencyGraphReport['cycles'];
  recommendation: string;
}

export interface CriticalBlocker {
  id: string;
  asset: string;
  assetKind: ArchitectureAssetKind;
  capabilityId?: string;
  owner?: string;
  evidence: string[];
  whyCritical: string;
  smallestSafeFix: string;
  requiredChange: CriticalTriageItem['requiredChange'];
}

export interface EnforcementReadinessChecklist {
  ready: boolean;
  items: Array<{
    id: string;
    label: string;
    passed: boolean;
    details: string;
  }>;
  futureModeRecommendation: string;
}

export interface FinalSafetyCheckItem {
  id: string;
  label: string;
  passed: boolean;
  value: string | number;
  details: string;
}

export interface FinalSafetyCheckResult {
  passed: boolean;
  items: FinalSafetyCheckItem[];
  summary: string;
}

export interface CiReadinessSummary {
  ready: boolean;
  summary: string;
  blockers: string[];
}

export type EnforcementMode = 'advisory' | 'warn_only' | 'block_on_critical' | 'block_on_threshold';

export interface EnforcementPolicyConfig {
  enforcementMode: EnforcementMode;
  minimumHealthScore: number;
  failOnCritical: boolean;
  failOnExpiredBaseline: boolean;
  releaseCycleObserved: boolean;
  scoreThresholdAgreed: boolean;
}

export interface EnforcementPolicyEvaluation {
  config: EnforcementPolicyConfig;
  shouldFail: boolean;
  blockingWouldOccur: boolean;
  failureReasons: string[];
  blockingDisabledReasons: string[];
  missingChecklistItems: string[];
}

export interface ThresholdDryRunResult {
  currentHealthScore: number;
  proposedMinimumHealthScore: number;
  wouldPass: boolean;
  wouldFail: boolean;
  nonBlockingReasons: string[];
}

export interface ReleaseCycleObservation {
  id: string;
  runDate: string;
  gitCommit: string;
  healthScore: number;
  criticalCount: number;
  securityScore: number;
  dependencyCycleCount: number;
  baselinedFindings: number;
  expiredBaselines: number;
  enforcementMode: EnforcementMode;
  blockingWouldOccur: boolean;
  clean: boolean;
}

export interface ReleaseCycleHistory {
  version: 1;
  observations: ReleaseCycleObservation[];
}

export interface ReleaseCycleEvidenceSummary {
  historyPath?: string;
  evidencePath?: string;
  observationCount: number;
  cleanAdvisoryReleaseCycleObserved: boolean;
  evidenceStillMissing: string[];
  currentObservation?: ReleaseCycleObservation;
}

export type BusinessLoopStage = 'realityEvent' | 'capturedData' | 'decisionAction' | 'outcomeClosure' | 'learningEvidence';

export interface BusinessLoopCheck {
  capabilityId: string;
  capabilityName: string;
  stages: Record<BusinessLoopStage, { status: CheckStatus; evidence: string[] }>;
}

export interface ArchitectureSubScores {
  mappingConfidence: number;
  governanceCoverage: number;
  dependencyHealth: number;
  businessLoopContinuity: number;
  rlsCoverage: number;
}

export type RlsStatus = 'confirmed_enabled' | 'confirmed_policy' | 'confirmed_view' | 'missing_signal' | 'unknown';

export interface RlsTableCheck {
  table: string;
  capabilityIds: string[];
  status: RlsStatus;
  evidence: string[];
}

export interface RlsReport {
  tablesChecked: number;
  confirmedEnabled: number;
  confirmedPolicies: number;
  missingSignals: number;
  unknown: number;
  tables: RlsTableCheck[];
}

export interface ReportDiff {
  previousReportPath?: string;
  hasPrevious: boolean;
  scoreMovement: number | null;
  subScoreMovement: Partial<Record<keyof ArchitectureSubScores, number>>;
  newFindingKeys: string[];
  resolvedFindingKeys: string[];
  worsenedAreas: string[];
  improvedAreas: string[];
}

export interface ArchitectureCategoryScore {
  category: ArchitectureHealthCategory;
  weight: number;
  score: number;
  findings: number;
  summary: string;
}

export interface ArchitectureHealthScore {
  overall: number;
  categories: Record<ArchitectureHealthCategory, ArchitectureCategoryScore>;
}

export interface ArchitectureTrendReport {
  hasPrevious: boolean;
  previousReportPath?: string;
  scoreDelta: number | null;
  criticalCountDelta: number | null;
  warningDelta: number | null;
  dependencyCycleDelta: number | null;
}

export interface AdvisoryGithubOutput {
  summaryMarkdown: string;
  annotations: Array<{
    level: 'notice' | 'warning';
    title: string;
    message: string;
    file?: string;
  }>;
}

export interface ArchitectureHealthReport {
  generatedAt: string;
  atlasPath: string;
  rootDir: string;
  healthScore: number;
  architectureHealth: ArchitectureHealthScore;
  counts: {
    capabilities: number;
    pages: number;
    apiRoutes: number;
    agents: number;
    cronEntries: number;
    tables: number;
    storageBuckets: number;
    envVars: number;
    findings: number;
  };
  findings: DriftFinding[];
  baseline: BaselineClassification;
  subScores: ArchitectureSubScores;
  governance: GovernanceCheck[];
  dependencyGraph: DependencyGraphReport;
  businessLoops: BusinessLoopCheck[];
  rls: RlsReport;
  diff: ReportDiff;
  trend: ArchitectureTrendReport;
  ciReadiness: CiReadinessSummary;
  advisoryGithub: AdvisoryGithubOutput;
  criticalTriage: CriticalTriageItem[];
  criticalBlockers: CriticalBlocker[];
  dependencyCycleReadiness: DependencyCycleReadinessGroup[];
  enforcementReadiness: EnforcementReadinessChecklist;
  enforcementPolicy: EnforcementPolicyEvaluation;
  thresholdDryRun: ThresholdDryRunResult;
  finalSafetyCheck: FinalSafetyCheckResult;
  releaseCycleEvidence: ReleaseCycleEvidenceSummary;
  inventory: ArchitectureInventory;
}

export interface ReporterOptions {
  outputDir: string;
  format: 'json' | 'md' | 'all';
  baselinePath?: string;
}
