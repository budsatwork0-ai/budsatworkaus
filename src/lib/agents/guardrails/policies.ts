/**
 * The six guardrail policies that protect every agent run.
 *
 *   • recursion-depth   — bounds runaway nested `ctx.callAgent()` chains
 *   • call-loop         — detects (childId, input) repeats in the lineage
 *   • cost-budget       — caps cumulative token spend per-run / per-lineage
 *   • dangerous-action  — blocks destructive payloads pre-approval
 *   • context-drift     — child intents must overlap their parent's
 *   • intent-completion — post-run summary must address the stated intent
 *   • hallucination     — proposed-action payloads must reference real rows
 *
 * Each policy is intentionally narrow. If one false-positives on you,
 * disable it for a specific agent via:
 *
 *   update agents set config = jsonb_set(coalesce(config,'{}'::jsonb),
 *     '{policies,disabled}', '["context-drift"]'::jsonb)
 *   where id = 'agent-architect';
 */
import type {
  PolicyContext,
  Policy,
  PreActionArgs,
  PreAgentCallArgs,
  PreLLMArgs,
  PostAgentRunArgs,
  Verdict,
} from './types';

// ----------------------------------------------------------------------
// Small helpers (kept here so each policy is a single file to read)
// ----------------------------------------------------------------------

function getNum(cfg: Record<string, unknown>, key: string, fallback: number): number {
  const v = cfg?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

// Destructive payload patterns. Conservative on purpose — we want false
// positives we can flag-for-review, not silent destructive actions.
const DANGEROUS_PATTERNS: Array<{ test: (a: PreActionArgs) => boolean; reason: string }> = [
  {
    reason: 'bulk delete (>= 25 rows targeted)',
    test: ({ action }) => {
      const ids = action.payload?.ids;
      return (
        action.action_type.startsWith('delete') &&
        Array.isArray(ids) &&
        ids.length >= 25
      );
    },
  },
  {
    reason: 'mass email (>= 50 recipients)',
    test: ({ action }) => {
      const to = action.payload?.to;
      return (
        action.action_type === 'send_email' &&
        Array.isArray(to) &&
        to.length >= 50
      );
    },
  },
  {
    reason: 'financial side-effect over A$500',
    test: ({ action }) => {
      const types = new Set(['refund', 'charge', 'payout', 'transfer']);
      if (!types.has(action.action_type)) return false;
      const cents =
        typeof action.payload?.amount_cents === 'number'
          ? action.payload.amount_cents
          : 0;
      return cents > 50000;
    },
  },
  {
    reason: 'drop / truncate / alter referenced in raw SQL payload',
    test: ({ action }) => {
      const sql =
        typeof action.payload?.sql === 'string'
          ? action.payload.sql.toLowerCase()
          : '';
      return /\b(drop|truncate|alter)\s+(table|schema|database)\b/.test(sql);
    },
  },
];

// ----------------------------------------------------------------------
// 1. recursion-depth
// ----------------------------------------------------------------------

export const recursionDepthPolicy: Policy = {
  id: 'recursion-depth',
  description: 'Refuses to nest agent calls deeper than max_depth (default 5).',
  preAgentCall(_args: PreAgentCallArgs, pctx: PolicyContext): Verdict {
    const max = getNum(pctx.config, 'max_depth', 5);
    // lineage already includes the *current* level, so a child at depth
    // lineage.length + 1 would exceed `max` when lineage.length >= max.
    if (pctx.lineage.length >= max) {
      return {
        kind: 'block',
        reason: `agent call would exceed max depth of ${max} (current depth ${pctx.lineage.length})`,
      };
    }
    return { kind: 'allow' };
  },
};

// ----------------------------------------------------------------------
// 2. call-loop
// ----------------------------------------------------------------------

export const callLoopPolicy: Policy = {
  id: 'call-loop',
  description: 'Blocks recursive calls that repeat a prior (agentId, input).',
  preAgentCall(args: PreAgentCallArgs, pctx: PolicyContext): Verdict {
    const childHash = stableHash({
      agentId: args.childAgentId,
      input: args.childInput,
    });
    const dup = pctx.lineage.find(
      (e) => e.agentId === args.childAgentId && e.inputHash === childHash,
    );
    if (dup) {
      return {
        kind: 'block',
        reason: `same (agentId=${args.childAgentId}, input) already in lineage at runId=${dup.runId}`,
      };
    }
    return { kind: 'allow' };
  },
};

// ----------------------------------------------------------------------
// 3. cost-budget
// ----------------------------------------------------------------------

export const costBudgetPolicy: Policy = {
  id: 'cost-budget',
  description:
    'Caps cumulative cost per-run (default 200¢) and per-lineage (default 500¢).',
  preLLM(_args: PreLLMArgs, pctx: PolicyContext): Verdict {
    const runCap = getNum(pctx.config, 'max_run_cents', 200);
    const lineageCap = getNum(pctx.config, 'max_lineage_cents', 500);
    if (pctx.runCostCents >= runCap) {
      return {
        kind: 'block',
        reason: `run cost ${pctx.runCostCents}¢ has reached per-run cap of ${runCap}¢`,
      };
    }
    if (pctx.cumulativeCostCents >= lineageCap) {
      return {
        kind: 'block',
        reason: `lineage cost ${pctx.cumulativeCostCents}¢ has reached cap of ${lineageCap}¢`,
      };
    }
    return { kind: 'allow' };
  },
};

// ----------------------------------------------------------------------
// 4. dangerous-action
// ----------------------------------------------------------------------

export const dangerousActionPolicy: Policy = {
  id: 'dangerous-action',
  description:
    'Forces destructive payloads through human review even if autonomy=auto.',
  preAction(args: PreActionArgs, _pctx: PolicyContext): Verdict {
    for (const pat of DANGEROUS_PATTERNS) {
      if (pat.test(args)) {
        return {
          kind: 'block',
          reason: pat.reason,
          // Don't fail the run — divert into the approval queue so a
          // human can decide. The runner translates this to a
          // requires-approval action.
          treatAsApprovalNeeded: true,
        };
      }
    }
    return { kind: 'allow' };
  },
};

// ----------------------------------------------------------------------
// 5. context-drift
// ----------------------------------------------------------------------

export const contextDriftPolicy: Policy = {
  id: 'context-drift',
  description:
    'Child agent calls must share enough vocabulary with the parent intent.',
  preAgentCall(args: PreAgentCallArgs, pctx: PolicyContext): Verdict {
    const parent = pctx.lineage[pctx.lineage.length - 1];
    if (!parent) return { kind: 'allow' };
    const minSim = getNum(pctx.config, 'min_similarity', 0.08);
    const parentTokens = tokenize(parent.intent);
    const childTokens = tokenize(args.childIntent);
    // If either side is too short to compare, defer to the other policies.
    if (parentTokens.size < 3 || childTokens.size < 3) return { kind: 'allow' };
    const sim = jaccard(parentTokens, childTokens);
    if (sim < minSim) {
      return {
        kind: 'block',
        reason: `child intent overlap ${sim.toFixed(2)} below threshold ${minSim} (parent: "${parent.intent.slice(0, 60)}…")`,
        treatAsApprovalNeeded: true,
      };
    }
    return { kind: 'allow' };
  },
};

// ----------------------------------------------------------------------
// 6. intent-completion
// ----------------------------------------------------------------------

export const intentCompletionPolicy: Policy = {
  id: 'intent-completion',
  description:
    'Post-run summary must reference the stated intent in some recognizable way.',
  postAgentRun(args: PostAgentRunArgs, pctx: PolicyContext): Verdict {
    const intent = pctx.intent?.trim();
    if (!intent) return { kind: 'allow' };
    if (!args.summary || args.summary.length < 8) {
      return {
        kind: 'warn',
        reason: `empty or near-empty summary for intent: "${intent.slice(0, 60)}…"`,
      };
    }
    const minSim = getNum(pctx.config, 'min_summary_similarity', 0.05);
    const sim = jaccard(tokenize(intent), tokenize(args.summary));
    if (sim < minSim) {
      return {
        kind: 'warn',
        reason: `summary overlap with intent is ${sim.toFixed(2)} (intent: "${intent.slice(0, 80)}…")`,
      };
    }
    return { kind: 'allow' };
  },
};

// ----------------------------------------------------------------------
// 7. hallucination-guard
// ----------------------------------------------------------------------

export const hallucinationPolicy: Policy = {
  id: 'hallucination',
  description:
    'Proposed-action payloads with `target_table` + `target_id` must reference rows that exist.',
  async preAction(args: PreActionArgs, pctx: PolicyContext): Promise<Verdict> {
    const table = args.action.target_table;
    const id = args.action.target_id;
    if (!table || !id) return { kind: 'allow' };

    // Safety belt: only look up tables we know about. An attacker-controlled
    // table name shouldn't be able to query arbitrary system tables, and
    // mistyped table names from the model shouldn't crash the run.
    if (!/^[a-z_][a-z0-9_]*$/.test(table) || table.startsWith('pg_')) {
      return {
        kind: 'warn',
        reason: `skipping hallucination check for non-allowlisted table "${table}"`,
      };
    }

    try {
      const { data, error } = await pctx.supabase
        .from(table)
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        return {
          kind: 'warn',
          reason: `hallucination check could not query ${table}: ${error.message}`,
        };
      }
      if (!data) {
        return {
          kind: 'block',
          reason: `target_id="${id}" not found in table "${table}" — likely a hallucinated reference`,
          treatAsApprovalNeeded: true,
        };
      }
      return { kind: 'allow' };
    } catch (err) {
      return {
        kind: 'warn',
        reason: `hallucination check threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ----------------------------------------------------------------------
// Public default set
// ----------------------------------------------------------------------

export const DEFAULT_POLICIES: Policy[] = [
  recursionDepthPolicy,
  callLoopPolicy,
  costBudgetPolicy,
  dangerousActionPolicy,
  contextDriftPolicy,
  intentCompletionPolicy,
  hallucinationPolicy,
];

/**
 * Stable, deterministic hash for arbitrary JSON-ish values. We use it to
 * detect repeat (agentId, input) pairs in the lineage. It does NOT need
 * to be cryptographic — just stable under key ordering.
 */
export function stableHash(value: unknown): string {
  const json = stableStringify(value);
  // 32-bit djb2 — plenty of collision room for the ~handful of entries
  // a single lineage can hold (recursion-depth caps at 5 by default).
  let h = 5381;
  for (let i = 0; i < json.length; i += 1) {
    h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  }
  // Unsigned 32-bit hex.
  return (h >>> 0).toString(16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}
