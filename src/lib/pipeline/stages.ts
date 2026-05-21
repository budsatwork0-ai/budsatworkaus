import type { PipelineStageId } from './types';

export interface StageDefinition {
  id: PipelineStageId;
  name: string;
  owner: string;
  desc: string;
  signals: string[];
  inputs: string[];
  outputs: string[];
  criteria: string[];
}

export const STAGES: StageDefinition[] = [
  {
    id: 'detect',
    name: 'Detect',
    owner: 'Bud Observer',
    desc:
      'Continuously monitors UX, performance, conversions, logs, infrastructure health, and behaviour. Surfaces failures and quantifiable optimisation opportunities.',
    signals: ['LCP', 'CLS', 'JS errors', 'conversion Δ', 'infra health', 'session friction'],
    inputs: ['Vercel Speed Insights', 'Sentry events', 'GA4 funnels', 'server logs', 'infra metrics'],
    outputs: ['opportunity card with impact estimate', 'severity class', 'duplicate check'],
    criteria: [
      'Confidence ≥ 0.70 to forward',
      'Deduped against open runs',
      'Severity scored against revenue / a11y / stability',
    ],
  },
  {
    id: 'analyze',
    name: 'Analyse',
    owner: 'Bud Memory',
    desc:
      'Resolves root cause by searching historical memory: prior fixes, architecture decisions, and successful patterns across GitHub, logs, and Obsidian.',
    signals: ['ADR matches', 'commit blame', 'similar-issue cosine ≥ 0.82', 'pattern library hit'],
    inputs: ['signal payload', 'git history', 'ADR + Obsidian vault', 'prior-fix index'],
    outputs: ['root-cause hypothesis', 'reuse-candidate diffs', 'risk class'],
    criteria: [
      'At least one supporting precedent OR explicit no-precedent flag',
      'Hypothesis names file + cause',
    ],
  },
  {
    id: 'design',
    name: 'Design',
    owner: 'Bud Architect + Bud Taste',
    desc:
      'Architect drafts the safest minimal improvement strategy. Taste evaluates hierarchy, simplicity, responsiveness, accessibility, spacing, motion, and cognitive clarity — benchmarked against Base44, Linear, Stripe, Apple, and the Bud Design Constitution.',
    signals: ['blast radius', 'reversibility', 'constitution score', 'benchmark deltas'],
    inputs: ['root-cause hypothesis', 'design tokens', 'benchmark corpus', 'constitution rules'],
    outputs: ['strategy spec', 'taste scorecard', 'acceptance criteria'],
    criteria: [
      'Smallest possible diff that solves cause',
      'No constitution violations',
      'No motion/spacing regressions vs benchmarks',
    ],
  },
  {
    id: 'generate',
    name: 'Generate',
    owner: 'Claude API',
    desc:
      'Generates surgical code improvements bounded by the strategy spec — never broad rewrites. Outputs a patch with rationale and proposed tests.',
    signals: ['patch size LOC', 'files touched', 'public-API delta', 'test coverage Δ'],
    inputs: ['strategy spec', 'acceptance criteria', 'pinned context window'],
    outputs: ['unified diff', 'inline rationale', 'proposed tests'],
    criteria: [
      'Touches only files named in spec',
      'No new dependencies without justification',
      'Self-bounded ≤ change budget',
    ],
  },
  {
    id: 'sandbox',
    name: 'Sandbox',
    owner: 'Vercel Preview + Supabase Branch',
    desc:
      'Isolated sandbox and preview environment created automatically — Vercel preview per branch, Supabase branch DB if schema is touched.',
    signals: ['build time', 'preview URL', 'env hash'],
    inputs: ['diff', 'lockfiles', 'env template'],
    outputs: ['preview-N.budsatwork.dev', 'build artefacts', 'runtime probe'],
    criteria: [
      'Cold build succeeds',
      'No prod credentials in env',
      'Network egress limited to allowlist',
    ],
  },
  {
    id: 'validate',
    name: 'Validate',
    owner: 'CI · Visual · Browser-Sim',
    desc:
      'Automated builds, tests, dependency validation, visual regression, and real-world browser simulations across desktop and mobile.',
    signals: ['unit', 'integration', 'visual diff %', 'a11y axe', 'Lighthouse', 'bundle Δ'],
    inputs: ['preview build', 'baseline screenshots', 'test matrices'],
    outputs: ['pass/fail per check', 'visual diff report', 'perf delta'],
    criteria: [
      'All required checks green',
      'Visual diff ≤ threshold (or labelled intentional)',
      'No new a11y violations',
      'Bundle Δ ≤ +1%',
    ],
  },
  {
    id: 'reject',
    name: 'Auto-reject gate',
    owner: 'Safety Net',
    desc:
      'Unsafe code, dramatic UI shifts, performance degradation, accessibility regressions, inconsistent design patterns, or low-confidence decisions are rejected here. The change is closed with a learnable explanation.',
    signals: ['rule trips', 'confidence score', 'shift index'],
    inputs: ['validate report', 'taste scorecard', 'generator rationale'],
    outputs: ['REJECT verdict + reason', 'memory entry for failure mode'],
    criteria: [
      'Hard rules trip → reject',
      'Confidence < 0.65 → reject',
      'Shift index > τ → reject',
      'Pattern drift → reject',
    ],
  },
  {
    id: 'debate',
    name: 'Debate & score',
    owner: 'Bud agent quorum',
    desc:
      'Bud agents debate, score, and validate the change through confidence, trust, rollback, UX, and stability scoring. A weighted vote — including a mandatory skeptic — decides whether to ship.',
    signals: ['confidence', 'trust', 'rollback', 'UX', 'stability'],
    inputs: ['all upstream signals', 'historical agent calibration'],
    outputs: ['composite score', 'per-agent rationales', 'ship verdict'],
    criteria: [
      'Composite ≥ 0.80 to auto-ship',
      '0.65–0.80 → human review queue',
      '< 0.65 → reject',
      'Skeptic vote required',
    ],
  },
  {
    id: 'deploy',
    name: 'Deploy & roll out',
    owner: 'Release Bot',
    desc:
      'If safe, Bud autonomously commits, merges, deploys, and gradually rolls out through staged deployment with progressive traffic.',
    signals: ['canary %', 'cohort', 'stage gate'],
    inputs: ['ship verdict', 'release manifest'],
    outputs: ['commit', 'merged PR', 'staged production rollout 1% → 10% → 50% → 100%'],
    criteria: [
      'Each stage holds for guardrail window',
      'Gate metrics stay within SLO',
      'Halt-and-hold if any KPI degrades',
    ],
  },
  {
    id: 'observe',
    name: 'Observe & self-heal',
    owner: 'Production Sentinel',
    desc:
      'Live telemetry continuously watches for anomalies, friction, conversion drops, or instability. If issues are detected, automatic rollback and self-healing recovery is triggered. Successful improvements are written into Bud\'s evolving memory, design intelligence, and operational knowledge graph.',
    signals: ['error rate', 'conversion Δ', 'core-vitals Δ', 'session friction', 'anomaly score'],
    inputs: ['live RUM / logs / infra', 'pre-change baseline'],
    outputs: ['rollback if degraded', 'memory write on success', 'tuning of detector thresholds'],
    criteria: [
      'Any guardrail breach → instant rollback',
      'Stable for hold window → graduate',
      'Always write outcome to knowledge graph',
    ],
  },
];

export const STAGE_BY_ID: Record<PipelineStageId, StageDefinition> = STAGES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<PipelineStageId, StageDefinition>,
);
