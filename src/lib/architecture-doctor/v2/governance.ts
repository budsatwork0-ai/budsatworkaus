import type { SliceFinding, SliceGovernanceDecision, SliceGovernanceEvent, SliceVerificationRun } from './domain';

export function createSliceGovernanceEvent(input: {
  verificationRun: SliceVerificationRun;
  findings: SliceFinding[];
  actor: string;
  rationale: string;
  decision?: SliceGovernanceDecision;
  timepoint: string;
}): SliceGovernanceEvent {
  if (!input.actor.trim()) throw new Error('Architecture Doctor v2 slice governance event requires an actor.');
  if (!input.rationale.trim()) throw new Error('Architecture Doctor v2 slice governance event requires a rationale.');

  return {
    id: `governance-${input.verificationRun.id}`,
    type: 'slice_advisory_review_recorded',
    actor: input.actor,
    rationale: input.rationale,
    decision: input.decision ?? 'needs_review',
    scope: input.verificationRun.scope,
    timepoint: input.timepoint,
    affectedFindingIds: input.findings.map((finding) => finding.id),
    verificationRunId: input.verificationRun.id,
    provenance: {
      source: input.actor,
      sourceType: 'human_governance',
      method: 'advisory slice review record',
      timepoint: input.timepoint,
      limitation: 'This event records review state only; it does not accept a baseline, grant an exception, or change enforcement mode.',
    },
  };
}
