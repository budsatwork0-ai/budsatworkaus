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

/**
 * Classification of a repository identity record's `identityAlgorithmVersion` relative to
 * `currentVersion`:
 *
 * - `current`: finite integer exactly equal to `currentVersion`. Comparable to other
 *   `current` records.
 * - `legacy`: the field is absent/`undefined` (records written before this field existed).
 * - `unsupported_future`: finite integer greater than `currentVersion` (written by code
 *   newer than this build understands).
 * - `malformed`: anything else — non-number, `NaN`, non-finite, non-integer, zero,
 *   negative, or a finite integer lower than `currentVersion` that isn't explicitly listed
 *   in a future backward-compatibility table (none exists yet, so all older integers are
 *   `malformed` today).
 *
 * Only `current` records are comparable to each other. Two records are never comparable
 * across different classes, even when their fingerprint/identity strings are byte-identical.
 */
export type RepositoryIdentityVersionClass = 'current' | 'legacy' | 'unsupported_future' | 'malformed';

/**
 * Exhaustively classifies a raw `identityAlgorithmVersion` value. Pure and total — never
 * throws, so callers can safely classify untrusted/historical history-file data.
 */
export function classifyRepositoryIdentityVersion(
  value: unknown,
  currentVersion: number,
): RepositoryIdentityVersionClass {
  if (value === undefined) return 'legacy';
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || !Number.isInteger(value)) {
    return 'malformed';
  }
  if (value <= 0) return 'malformed';
  if (value === currentVersion) return 'current';
  if (value > currentVersion) return 'unsupported_future';
  return 'malformed';
}

/**
 * Convenience wrapper over {@link classifyRepositoryIdentityVersion} for a full
 * `RepositoryStateIdentity`, so callers don't need to reach into `identityAlgorithmVersion`
 * themselves.
 */
export function classifyRepositoryStateIdentityVersion(
  repositoryState: RepositoryStateIdentity | undefined,
  currentVersion: number,
): RepositoryIdentityVersionClass {
  return classifyRepositoryIdentityVersion(repositoryState?.identityAlgorithmVersion, currentVersion);
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
