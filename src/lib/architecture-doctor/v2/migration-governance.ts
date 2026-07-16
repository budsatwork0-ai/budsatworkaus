import type { CronRouteParityReport } from './cron-route-parity';

export type DetectorMigrationDecisionStatus =
  | 'needs_review'
  | 'parity_verified'
  | 'approved_for_shadow_execution'
  | 'approved_for_replacement'
  | 'replacement_rejected'
  | 'rolled_back';

export interface RepositoryStateIdentity {
  commitSha: string;
  dirty?: boolean;
  worktreeFingerprint?: string;
  fallbackIdentity?: string;
  identity?: string;
  /**
   * Identifies which fingerprint algorithm produced `worktreeFingerprint`/`identity`.
   * Version 1 (absent/undefined, legacy records) hashed the full `git status --porcelain`
   * dirty-path membership set for the whole repository. Version 2 hashes the content of
   * only architecture-relevant paths (see RELEVANT_REPOSITORY_PATHSPECS in
   * phase12-shadow-runner.ts). Records from different versions measure different things and
   * must not be treated as directly comparable evidence.
   */
  identityAlgorithmVersion?: number;
}

export interface DetectorMigrationGovernanceDecision {
  id: string;
  decision: DetectorMigrationDecisionStatus;
  actor: string;
  rationale: string;
  timestamp: string;
  detectorScope: string;
  repositoryState: RepositoryStateIdentity;
  parityResultRef: string;
  previousDecisionRef?: string;
}

export interface DetectorReplacementReadiness {
  detectorScope: string;
  repositoryState: RepositoryStateIdentity;
  parityResultRef: string;
  ready: boolean;
  blockers: ReplacementReadinessBlocker[];
}

export interface ReplacementReadinessBlocker {
  requirement: ReplacementReadinessRequirement;
  reason: string;
}

export type ReplacementReadinessRequirement =
  | 'real_repository_parity_has_no_unexplained_differences'
  | 'repeated_identical_execution_is_deterministic'
  | 'v2_output_satisfies_constitutional_invariants'
  | 'downstream_report_and_consumer_compatibility_documented'
  | 'shadow_execution_completed_successfully'
  | 'rollback_behaviour_defined'
  | 'explicit_governance_decision_approves_replacement';

export interface ReplacementReadinessInput {
  detectorScope: string;
  repositoryState: RepositoryStateIdentity;
  parityResultRef: string;
  parity: Pick<CronRouteParityReport, 'unexplainedDifferences'>;
  deterministic: boolean;
  constitutionalInvariantsSatisfied: boolean;
  downstreamCompatibilityDocumented: boolean;
  shadowExecutionCompleted: boolean;
  rollbackDefined: boolean;
  governanceDecision?: DetectorMigrationGovernanceDecision;
}

export function createDetectorMigrationGovernanceDecision(input: DetectorMigrationGovernanceDecision): DetectorMigrationGovernanceDecision {
  const missing = [
    ['actor', input.actor],
    ['rationale', input.rationale],
    ['timestamp', input.timestamp],
    ['detectorScope', input.detectorScope],
    ['repositoryState.commitSha', input.repositoryState?.commitSha],
    ['parityResultRef', input.parityResultRef],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Governance decision is missing required field(s): ${missing.map(([field]) => field).join(', ')}`);
  }

  if (!isDetectorMigrationDecisionStatus(input.decision)) {
    throw new Error(`Unsupported governance decision ${input.decision}.`);
  }

  return input;
}

export function evaluateReplacementReadiness(input: ReplacementReadinessInput): DetectorReplacementReadiness {
  const blockers: ReplacementReadinessBlocker[] = [];

  if (input.parity.unexplainedDifferences.length > 0) {
    blockers.push({
      requirement: 'real_repository_parity_has_no_unexplained_differences',
      reason: `Real repository parity has ${input.parity.unexplainedDifferences.length} unexplained difference(s).`,
    });
  }
  if (!input.deterministic) {
    blockers.push({
      requirement: 'repeated_identical_execution_is_deterministic',
      reason: 'Repeated execution against stable inventory has not been proven deterministic.',
    });
  }
  if (!input.constitutionalInvariantsSatisfied) {
    blockers.push({
      requirement: 'v2_output_satisfies_constitutional_invariants',
      reason: 'The v2 analyzer output has not satisfied all constitutional invariants.',
    });
  }
  if (!input.downstreamCompatibilityDocumented) {
    blockers.push({
      requirement: 'downstream_report_and_consumer_compatibility_documented',
      reason: 'Downstream report and consumer compatibility has not been documented.',
    });
  }
  if (!input.shadowExecutionCompleted) {
    blockers.push({
      requirement: 'shadow_execution_completed_successfully',
      reason: 'Shadow execution has not completed successfully.',
    });
  }
  if (!input.rollbackDefined) {
    blockers.push({
      requirement: 'rollback_behaviour_defined',
      reason: 'Rollback behaviour has not been defined.',
    });
  }
  if (input.governanceDecision?.decision !== 'approved_for_replacement') {
    blockers.push({
      requirement: 'explicit_governance_decision_approves_replacement',
      reason: 'No explicit governance decision approves replacement.',
    });
  }

  return {
    detectorScope: input.detectorScope,
    repositoryState: input.repositoryState,
    parityResultRef: input.parityResultRef,
    ready: blockers.length === 0,
    blockers,
  };
}

function isDetectorMigrationDecisionStatus(value: string): value is DetectorMigrationDecisionStatus {
  return [
    'needs_review',
    'parity_verified',
    'approved_for_shadow_execution',
    'approved_for_replacement',
    'replacement_rejected',
    'rolled_back',
  ].includes(value);
}
