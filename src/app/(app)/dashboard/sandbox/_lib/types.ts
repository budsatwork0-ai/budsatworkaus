import type { ScenarioCategory, SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';

export type SandboxData = {
  mode: 'sandbox';
  status: {
    activeCustomers: number;
    activeLeads: number;
    activeJobs: number;
    activeInitiatives: number;
    activeApprovals: number;
  };
  metrics: {
    leadsGenerated: number;
    quotesGenerated: number;
    jobsCompleted: number;
    reviewsGenerated: number;
    initiativesCreated: number;
    agentActionsCreated: number;
  };
};

export type OperationsTab = 'overview' | 'run' | 'agents' | 'learning' | 'infrastructure' | 'doctor';

export type AgentIntegrityStatus =
  | 'ready_to_promote'
  | 'ready_to_test'
  | 'missing_data'
  | 'missing_integration'
  | 'unsafe_to_promote';

export type RequirementStatus = 'present' | 'missing' | 'partial';

export type IntegrityRequirement = {
  label: string;
  status: RequirementStatus;
  notes?: string;
};

export type AgentIntegrityReport = {
  agentId: string;
  agentName: string;
  category: string;
  intendedCapability: string;
  integrityScore: number;
  integrityStatus: AgentIntegrityStatus;
  dataSources: IntegrityRequirement[];
  integrations: IntegrityRequirement[];
  missingConnections: string[];
  sandboxFixtures: IntegrityRequirement[];
  scenarioCoverage: IntegrityRequirement[];
  scenarioCount: number;
  recommendation: string;
  riskIfPromoted: string;
  generateFixPrompt: string;
};

export type Batch = {
  id: string;
  agent_id: string;
  trigger: string;
  status: string;
  scenario_count: number;
  pass_count: number;
  avg_f1: number | null;
  total_cost_cents: number;
  started_at: string;
  finished_at: string | null;
};

export type HealthRow = {
  agent_id: string;
  runs: number;
  pass_rate: number | null;
  avg_f1: number | null;
  baseline_f1: number | null;
  delta_f1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  computed_at: string;
};

export type FailingScenario = {
  scenarioId: string;
  title: string;
  category: string;
  agentId: string;
  f1: number;
  scoredAt: string;
};

export type Lesson = {
  id: string;
  agentId: string;
  title: string;
  observation: string;
  recommendation: string | null;
  severity: string;
  source: string;
  createdAt: string;
};

export type ReviewItem = {
  id: string;
  agent_id: string;
  title: string;
  observation: string;
  recommendation: string | null;
  severity: string;
  created_at: string;
};

export type RootCause = {
  key: string;
  title: string;
  severity: 'critical' | 'warning';
  agentId: string;
  failureType: 'zero_action' | 'wrong_actions';
  rootCauseSummary: string;
  lessonCount: number;
  latestAt: string;
  exampleObservations: string[];
  recommendedFix: string;
  lessonIds: string[];
};

export type ImprovementProposal = {
  id: string;
  title: string;
  affectedAgent: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  likelyRootCause: string;
  suggestedFix: string;
  expectedF1Impact: string;
  suggestedFiles: string[];
  suggestedTests: string[];
  rollbackPlan: string;
  sourceRootCauseKey: string;
  lessonCount: number;
  createdAt: string;
};

export type PromotionStatus = 'promote' | 'healthy' | 'monitor' | 'investigate' | 'blocked';

export type PromotionRecommendation = {
  agentId: string;
  status: PromotionStatus;
  currentF1: number | null;
  baselineF1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  hasRegression: boolean;
  hasActiveRootCauses: boolean;
  lessonCount: number;
  rootCauseCount: number;
  rationale: string;
};

export type HealthData = {
  lastCronRun: Batch | null;
  batches: Batch[];
  health: HealthRow[];
  regressions: HealthRow[];
  failingScenarios: FailingScenario[];
  needsReview: ReviewItem[];
  rootCauses: RootCause[];
  activeRootCauses?: RootCause[];
  resolvedRootCauses?: RootCause[];
  proposals?: ImprovementProposal[];
  recommendations?: PromotionRecommendation[];
};

export type ReadinessData = {
  overallReadiness: number;
  byCategory: Record<string, { ready: number; total: number }>;
  totalScenarios: number;
  readyScenarios: number;
};

export type RunResult = {
  trainingRunId: string;
  agentRunId?: string | null;
  status: 'complete' | 'completed' | 'failed';
  summary: string;
  proposedActions: Array<{ action_type: string; preview?: string }>;
  llmCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  costCents: number;
  durationMs: number;
  score: { precisionScore: number; recallScore: number; f1Score: number; hit: boolean };
};

export type PackResult = {
  scenarioSlug: string;
  scenarioTitle: string;
  category: ScenarioCategory;
  agentId: string;
  expectedActionTypes: string[];
  result: RunResult;
};

export type HistoryRow = {
  id: string;
  batchId: string | null;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  costCents: number;
  scenario: {
    id: string;
    slug: string | null;
    title: string;
    category: string;
    agentId: string;
    expectedActionTypes: string[];
  };
  response: {
    summary: string;
    proposedActions: Array<{ action_type?: string; preview?: string }>;
    llmCalls: number;
  } | null;
  score: {
    precisionScore: number;
    recallScore: number;
    f1Score: number;
    hit: boolean;
    scoredAt: string;
  } | null;
  lessonCount: number;
};

export type RunStatus = {
  kind: 'scenario' | 'pack';
  label: string;
  status: 'running' | 'complete' | 'failed' | 'cancelled';
  startedAt: number;
  currentIndex: number;
  total: number;
  currentScenario?: string;
  message: string;
  /** DB batch ID — present for SSE-driven pack runs; used by the cancel button. */
  batchId?: string;
  /** Live pass/fail counters streamed from SSE events. */
  passCount?: number;
  failCount?: number;
};

export type AgentRow = {
  agentId: string;
  f1: number | null;
  baselineF1: number | null;
  passRate: number | null;
  rootCauseCount: number;
  lessonCount: number;
  status: OperatorPromotionStatus;
  recommendation: string;
  trend: 'improving' | 'stable' | 'degrading';
  blockers: string[];
};

export type OperatorPromotionStatus = 'Promote' | 'Monitor' | 'Investigate' | 'Blocked';
export type FleetBucket = 'promote' | 'investigate' | 'blocked' | 'monitor';
export type TrendDirection = 'improving' | 'worsening' | 'unchanged';
export type PackKind = ScenarioCategory | 'stress' | 'all';

export type OperatorIntelligence = {
  fleetScore: number;
  fleetScoreTrend: TrendDirection;
  passingScenariosTrend: TrendDirection;
  readyToPromoteTrend: TrendDirection;
  rootCausesTrend: TrendDirection;
  lessonsTrend: TrendDirection;
  executiveSummary: string;
  recentChanges: string[];
  healthyDays: number;
  lessonsThisWeek: number;
  openLessons: number;
  resolvedLessons: number;
};

export type TabTarget = 'learning' | 'agents' | 'run';

export type SandboxScenario = SandboxScenarioTemplate;
