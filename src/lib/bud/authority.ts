/**
 * Bud Authority Engine
 *
 * Computes Bud's current authority level on a dynamic scale L0-L4.
 * Authority scales with verified performance: trust score, repair
 * verification success, rollback reliability, deployment confidence.
 *
 * Higher authority unlocks more autonomous behaviour. Authority is never
 * faked - it reflects what Bud has actually earned.
 */
import type { MissionControlHealth } from './health';

export const BUD_AUTHORITY_COOKIE = 'buds-os-authority';

export type BudAuthorityLevel =
  | 'L0_OBSERVER'
  | 'L1_ASSISTANT'
  | 'L2_OPERATOR'
  | 'L3_AUTONOMOUS_OPERATOR'
  | 'L4_SELF_EVOLVING_SYSTEM';

export const AUTHORITY_LABELS: Record<BudAuthorityLevel, string> = {
  L0_OBSERVER: 'Observer',
  L1_ASSISTANT: 'Assistant',
  L2_OPERATOR: 'Operator',
  L3_AUTONOMOUS_OPERATOR: 'Autonomous Operator',
  L4_SELF_EVOLVING_SYSTEM: 'Self-Evolving System',
};

export const AUTHORITY_DESCRIPTIONS: Record<BudAuthorityLevel, string> = {
  L0_OBSERVER: 'Bud monitors, summarizes, and detects. Never acts.',
  L1_ASSISTANT: 'Bud can diagnose, investigate, recommend, and create issues. Humans execute.',
  L2_OPERATOR: 'Bud drafts fixes, opens branches, generates PRs, and redesigns workflows. Approval required before deployment.',
  L3_AUTONOMOUS_OPERATOR: 'Bud can autonomously fix low-risk issues, deploy safe repairs, optimize layouts, and improve workflows within guardrails.',
  L4_SELF_EVOLVING_SYSTEM: 'Bud can redesign Buds OS itself, evolve workflows, refactor agents, and restructure operational systems.',
};

export const AUTHORITY_CAPABILITY_MATRIX: Record<BudAuthorityLevel, {
  monitor: boolean;
  diagnose: boolean;
  draft_patch: boolean;
  redesign: boolean;
  create_issue: boolean;
  create_branch: boolean;
  commit: boolean;
  open_pr: boolean;
  deploy: boolean;
  verify: boolean;
  rollback: boolean;
  learn: boolean;
  self_evolve: boolean;
}> = {
  L0_OBSERVER: {
    monitor: true, diagnose: false, draft_patch: false, redesign: false,
    create_issue: false, create_branch: false, commit: false, open_pr: false,
    deploy: false, verify: false, rollback: false, learn: true, self_evolve: false,
  },
  L1_ASSISTANT: {
    monitor: true, diagnose: true, draft_patch: false, redesign: false,
    create_issue: true, create_branch: false, commit: false, open_pr: false,
    deploy: false, verify: false, rollback: false, learn: true, self_evolve: false,
  },
  L2_OPERATOR: {
    monitor: true, diagnose: true, draft_patch: true, redesign: true,
    create_issue: true, create_branch: true, commit: true, open_pr: true,
    deploy: false, verify: true, rollback: true, learn: true, self_evolve: false,
  },
  L3_AUTONOMOUS_OPERATOR: {
    monitor: true, diagnose: true, draft_patch: true, redesign: true,
    create_issue: true, create_branch: true, commit: true, open_pr: true,
    deploy: true, verify: true, rollback: true, learn: true, self_evolve: false,
  },
  L4_SELF_EVOLVING_SYSTEM: {
    monitor: true, diagnose: true, draft_patch: true, redesign: true,
    create_issue: true, create_branch: true, commit: true, open_pr: true,
    deploy: true, verify: true, rollback: true, learn: true, self_evolve: true,
  },
};

export type BudAuthority = {
  level: BudAuthorityLevel;
  label: string;
  description: string;
  trust_score: number;
  verified_repairs: number;
  rolled_back_repairs: number;
  rollback_reliability: number;
  deployment_confidence: number;
  blocked_by: string[];
  ceiling: BudAuthorityLevel;
  configured_ceiling: BudAuthorityLevel;
  can: typeof AUTHORITY_CAPABILITY_MATRIX[BudAuthorityLevel];
};

export type ComputeAuthorityArgs = {
  commandState: MissionControlHealth;
  learnings: Array<{ id: string; outcome: string; created_at: string }>;
  configuredCeiling?: BudAuthorityLevel;
};

const LEVEL_ORDER: BudAuthorityLevel[] = [
  'L0_OBSERVER',
  'L1_ASSISTANT',
  'L2_OPERATOR',
  'L3_AUTONOMOUS_OPERATOR',
  'L4_SELF_EVOLVING_SYSTEM',
];

function clamp(value: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, value));
}

function min(a: BudAuthorityLevel, b: BudAuthorityLevel): BudAuthorityLevel {
  return LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;
}

export function computeBudAuthority({
  commandState,
  learnings,
  configuredCeiling = 'L3_AUTONOMOUS_OPERATOR',
}: ComputeAuthorityArgs): BudAuthority {
  const verifiedSessions = commandState.repair_sessions.filter((s) => ['recovered', 'learned'].includes(s.phase));
  const rolledBack = commandState.repair_sessions.filter((s) => s.phase === 'rolled_back');
  const verifiedRepairs = verifiedSessions.length;
  const rolledBackRepairs = rolledBack.length;
  const totalAttempted = verifiedRepairs + rolledBackRepairs;

  const rollbackReliability = totalAttempted === 0
    ? 1
    : clamp(1 - (rolledBackRepairs / totalAttempted));

  const deploymentConfidence = commandState.deployment.status === 'healthy'
    ? 1
    : commandState.deployment.status === 'deploying'
      ? 0.7
      : commandState.deployment.status === 'failed'
        ? 0.3
        : 0.5;

  const learningMomentum = clamp(learnings.length / 10);

  const verifiedHealth = commandState.is_nominal ? 1 : clamp(1 - commandState.counts.broken_agents * 0.2);

  const trustScore = clamp(
    0.30 * rollbackReliability +
    0.25 * deploymentConfidence +
    0.20 * verifiedHealth +
    0.15 * clamp(verifiedRepairs / 5) +
    0.10 * learningMomentum,
  );

  // Earned ceiling - what Bud has demonstrated
  let earned: BudAuthorityLevel;
  if (trustScore >= 0.92 && verifiedRepairs >= 5 && rolledBackRepairs === 0 && commandState.is_nominal) {
    earned = 'L4_SELF_EVOLVING_SYSTEM';
  } else if (trustScore >= 0.80 && verifiedRepairs >= 3 && deploymentConfidence >= 0.9) {
    earned = 'L3_AUTONOMOUS_OPERATOR';
  } else if (trustScore >= 0.60 && commandState.capabilities.find((c) => c.key === 'repair')?.status !== 'blocked') {
    earned = 'L2_OPERATOR';
  } else if (commandState.agents.length > 0 && trustScore >= 0.30) {
    earned = 'L1_ASSISTANT';
  } else {
    earned = 'L0_OBSERVER';
  }

  const blockedBy: string[] = [];
  if (commandState.deployment.status === 'failed') blockedBy.push('Deployment telemetry is failing - verification cannot complete.');
  if (commandState.counts.broken_agents > 0) blockedBy.push(`${commandState.counts.broken_agents} broken agent${commandState.counts.broken_agents === 1 ? '' : 's'} are reducing trust.`);
  if (rolledBackRepairs > 0) blockedBy.push(`${rolledBackRepairs} recent rollback${rolledBackRepairs === 1 ? '' : 's'} are lowering autonomy.`);
  if (!commandState.memory.connected) blockedBy.push('Memory layer is offline - Bud cannot learn from outcomes.');

  // Block earned level from exceeding ceiling
  const ceiling = configuredCeiling;
  const final = min(earned, ceiling);

  return {
    level: final,
    label: AUTHORITY_LABELS[final],
    description: AUTHORITY_DESCRIPTIONS[final],
    trust_score: trustScore,
    verified_repairs: verifiedRepairs,
    rolled_back_repairs: rolledBackRepairs,
    rollback_reliability: rollbackReliability,
    deployment_confidence: deploymentConfidence,
    blocked_by: blockedBy,
    ceiling: earned,
    configured_ceiling: ceiling,
    can: AUTHORITY_CAPABILITY_MATRIX[final],
  };
}

export function nextLevel(level: BudAuthorityLevel): BudAuthorityLevel | null {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

export function previousLevel(level: BudAuthorityLevel): BudAuthorityLevel | null {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx <= 0) return null;
  return LEVEL_ORDER[idx - 1];
}
