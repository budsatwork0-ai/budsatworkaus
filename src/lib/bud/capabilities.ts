/**
 * Honest Capability System
 *
 * Reports what Bud can ACTUALLY do right now, based on the current
 * authority level and whether the supporting infrastructure is wired up.
 * Do NOT fake capabilities - if GitHub isn't connected, "open_pr" is
 * blocked even if the authority level would otherwise allow it.
 */
import type { MissionControlHealth } from './health';
import type { BudAuthority } from './authority';

export type BudCapabilityKey =
  | 'detect'
  | 'diagnose'
  | 'draft_patch'
  | 'redesign'
  | 'create_issue'
  | 'create_branch'
  | 'commit'
  | 'open_pr'
  | 'deploy'
  | 'verify'
  | 'rollback'
  | 'learn';

export type BudCapability = {
  key: BudCapabilityKey;
  label: string;
  status: 'online' | 'partial' | 'blocked';
  reason: string;
  authority_allows: boolean;
  infrastructure_ready: boolean;
};

const LABELS: Record<BudCapabilityKey, string> = {
  detect: 'Detect',
  diagnose: 'Diagnose',
  draft_patch: 'Draft patch',
  redesign: 'Redesign',
  create_issue: 'Create issue',
  create_branch: 'Create branch',
  commit: 'Commit',
  open_pr: 'Open PR',
  deploy: 'Deploy',
  verify: 'Verify',
  rollback: 'Rollback',
  learn: 'Learn',
};

export function getBudCapabilities({
  commandState,
  authority,
  githubConnected,
  deploymentConnected,
  memoryConnected,
}: {
  commandState: MissionControlHealth;
  authority: BudAuthority;
  githubConnected: boolean;
  deploymentConnected: boolean;
  memoryConnected: boolean;
}): BudCapability[] {
  const has = authority.can;

  function build(key: BudCapabilityKey, args: {
    allows: boolean;
    infra: boolean;
    blockedReason: string;
    partialReason?: string;
    onlineReason: string;
  }): BudCapability {
    if (!args.allows) {
      return {
        key, label: LABELS[key],
        status: 'blocked',
        reason: `Authority level ${authority.label} does not permit this.`,
        authority_allows: false, infrastructure_ready: args.infra,
      };
    }
    if (!args.infra) {
      return {
        key, label: LABELS[key],
        status: 'blocked',
        reason: args.blockedReason,
        authority_allows: true, infrastructure_ready: false,
      };
    }
    return {
      key, label: LABELS[key],
      status: args.partialReason ? 'partial' : 'online',
      reason: args.partialReason ?? args.onlineReason,
      authority_allows: true, infrastructure_ready: true,
    };
  }

  return [
    build('detect', {
      allows: has.monitor,
      infra: commandState.agents.length > 0,
      blockedReason: 'No agents are registered.',
      onlineReason: `${commandState.agents.length} agents under observation.`,
    }),
    build('diagnose', {
      allows: has.diagnose,
      infra: true,
      blockedReason: 'Diagnosis is gated.',
      onlineReason: `${commandState.repair_sessions.length} active diagnostic threads.`,
    }),
    build('draft_patch', {
      allows: has.draft_patch,
      infra: githubConnected,
      blockedReason: 'GitHub integration is required to draft patches.',
      onlineReason: 'Bud can draft repairs into branches.',
    }),
    build('redesign', {
      allows: has.redesign,
      infra: true,
      blockedReason: 'Redesign permission is gated.',
      onlineReason: 'Bud can propose layout and workflow redesigns.',
    }),
    build('create_issue', {
      allows: has.create_issue,
      infra: githubConnected,
      blockedReason: 'GitHub is not connected.',
      onlineReason: 'Bud can open GitHub issues from detected problems.',
    }),
    build('create_branch', {
      allows: has.create_branch,
      infra: githubConnected,
      blockedReason: 'GitHub is not connected.',
      onlineReason: 'Bud can branch from main for an isolated fix.',
    }),
    build('commit', {
      allows: has.commit,
      infra: githubConnected,
      blockedReason: 'GitHub is not connected.',
      onlineReason: 'Bud can commit drafted patches to a working branch.',
    }),
    build('open_pr', {
      allows: has.open_pr,
      infra: githubConnected,
      blockedReason: 'GitHub is not connected.',
      partialReason: commandState.repair_sessions.some((s) => s.linked_pr) ? undefined : 'No PRs opened yet - Bud can but has nothing pending.',
      onlineReason: 'Bud has open PRs from prior repairs.',
    }),
    build('deploy', {
      allows: has.deploy,
      infra: deploymentConnected,
      blockedReason: 'Deployment webhook is not connected.',
      partialReason: commandState.deployment.status === 'failed' ? 'Deployment is currently failing - autonomous deploy paused.' : undefined,
      onlineReason: commandState.deployment.summary,
    }),
    build('verify', {
      allows: has.verify,
      infra: deploymentConnected,
      blockedReason: 'Verification needs deployment telemetry.',
      onlineReason: commandState.deployment.last_success_at ? 'Verification webhook active.' : 'Verification ready; no successful verifications yet.',
    }),
    build('rollback', {
      allows: has.rollback,
      infra: githubConnected && deploymentConnected,
      blockedReason: 'Rollback needs both GitHub and deployment telemetry.',
      partialReason: authority.rolled_back_repairs > 0 ? `${authority.rolled_back_repairs} rollback(s) on record - exercise caution.` : undefined,
      onlineReason: 'Bud can revert a deployment that fails verification.',
    }),
    build('learn', {
      allows: has.learn,
      infra: memoryConnected,
      blockedReason: 'Memory vault is not connected.',
      partialReason: commandState.memory.recent_count === 0 ? 'Memory is empty - Bud has nothing to learn from yet.' : undefined,
      onlineReason: `${commandState.memory.recent_count} recent memory entries available.`,
    }),
  ];
}
