/**
 * Bud Observer
 *
 * Continuously watches the platform for improvement opportunities across six
 * signal categories and feeds them into the autonomous improvement pipeline
 * via triggerImprovement().
 *
 * Signal categories:
 *   1. UX friction      — unacted admin_ux_proposals (high/critical, > 3 days old)
 *   2. Design debt      — design_insights not yet shipped
 *   3. Agent quality    — agents with declining quality scores or parse failures
 *   4. Performance      — slow agent runs, expensive LLM calls, timeout patterns
 *   5. Conversion hints — conversion_funnel agent findings, lapsed-win-back signals
 *   6. Error spikes     — rising failure rates across the fleet
 *
 * The observer ranks signals by: severity × recency × recurrence.
 * Top signals that haven't been acted on recently are passed to triggerImprovement().
 * It does NOT generate code itself — that's the improvement-executor's job.
 */

import type { AgentDefinition, AgentContext } from '../types';
import { triggerImprovement } from '@/lib/bud/orchestrator';
import { isStalledAgent } from '@/lib/bud/health';
import { classifyRootCause } from '@/lib/bud/root-cause';

const DEFAULT_OBSERVER_BUDGET_MS = 210_000;
const LLM_TIMEOUT_MS = 75_000;
const IMPROVEMENT_TIMEOUT_MS = 45_000;
const MIN_EXIT_WINDOW_MS = 25_000;

const SYSTEM = `You are the Bud Observer for Buds At Work. Your role is to analyse
cross-system signals and identify the top improvement opportunities.

Given a data snapshot (UX proposals, agent health, performance metrics, conversion signals),
return a prioritised JSON list of improvement opportunities:

{
  "signals": [
    {
      "signal_type": "ux_friction" | "design_debt" | "agent_quality" | "performance" | "conversion_drop" | "error_spike",
      "severity": "low" | "medium" | "high" | "critical",
      "title": "Concise, actionable title (max 80 chars)",
      "description": "What is wrong, why it matters, evidence from the data",
      "affected_area": "page path / agent id / service area",
      "proposed_approach": "Specific suggestion for what to change",
      "reference_files": ["src/..."],
      "confidence": 0.0–1.0
    }
  ],
  "summary": "One paragraph overview of fleet health"
}

Rules:
- Return at most 5 signals. Prioritise high-impact, low-risk, actionable items.
- Do NOT surface signals that already have an open PR or executing improvement.
- Be specific: "Add skeleton loaders to the quotes table" > "Improve loading states".
- Reference the actual file paths when you know them.`;

export const budObserverAgent: AgentDefinition = {
  id: 'bud-observer',
  name: 'Bud Observer',
  description: 'Continuously monitors UX, performance, conversions, agent quality, and design signals to feed the autonomous improvement pipeline.',
  category: 'ops',
  autonomy: 'auto',
  schedule: '0 */6 * * *',  // every 6 hours

  schema_dependencies: ['agent_runs', 'design_insights', 'admin_ux_proposals'],
  async run(ctx: AgentContext) {
    const startedAt = Date.now();
    const configuredBudgetMs = Number(process.env.BUD_OBSERVER_BUDGET_MS ?? DEFAULT_OBSERVER_BUDGET_MS);
    const budgetMs = Number.isFinite(configuredBudgetMs) && configuredBudgetMs > 60_000
      ? configuredBudgetMs
      : DEFAULT_OBSERVER_BUDGET_MS;
    const checkpoints: string[] = [];
    const remainingMs = () => Math.max(0, budgetMs - (Date.now() - startedAt));
    const shouldStop = (phase: string) => {
      const remaining = remainingMs();
      checkpoints.push(`${phase}:${remaining}ms_remaining`);
      if (remaining < MIN_EXIT_WINDOW_MS) {
        ctx.log(`bud-observer: stopping before ${phase}; runtime budget nearly exhausted`, { remainingMs: remaining });
        return true;
      }
      return false;
    };
    const withTimeout = async <T,>(label: string, promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          promise,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              ctx.log(`bud-observer: ${label} timed out`, { timeoutMs, remainingMs: remainingMs() });
              resolve(null);
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const since3d = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

    // ── 1. UX Friction: unacted high/critical admin UX proposals ──────────────
    const { data: uxProposals } = await ctx.supabase
      .from('admin_ux_proposals')
      .select('id, page_path, audience, severity, title, body, proposed_change, created_at')
      .in('severity', ['high', 'critical'])
      .is('status', null)
      .lt('created_at', since3d)
      .order('created_at', { ascending: false })
      .limit(10);

    // ── 2. Design Debt: design insights not yet shipped ────────────────────────
    let designInsights: Array<{ id: string; page_path: string | null; insight_type: string | null; severity: string | null; title: string; body: string | null; proposed_change: unknown; created_at: string }> | null = null;
    try {
      const { data } = await ctx.supabase
        .from('design_insights')
        .select('id, page_path, insight_type, severity, title, body, proposed_change, created_at')
        .in('severity', ['high', 'critical'])
        .not('status', 'eq', 'shipped')
        .lt('created_at', since3d)
        .order('severity', { ascending: false })
        .limit(5);
      designInsights = data;
    } catch { /* table may not exist yet */ }

    // ── 3. Agent Quality: agents with quality score < 0.5 or rising parse failures
    const { data: agentQuality } = await ctx.supabase
      .from('agent_runs')
      .select('agent_id, status, summary, cost_cents, started_at')
      .in('status', ['failed', 'needs_repair'])
      .gte('started_at', since7d)
      .order('started_at', { ascending: false })
      .limit(50);

    // Group failures by agent
    const failuresByAgent: Record<string, number> = {};
    for (const run of agentQuality ?? []) {
      const id = run.agent_id as string;
      failuresByAgent[id] = (failuresByAgent[id] ?? 0) + 1;
    }
    const problematicAgents = Object.entries(failuresByAgent)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // ── 4. Performance: expensive LLM runs (>100 cost_cents) or slow runs ─────
    const { data: expensiveRuns } = await ctx.supabase
      .from('agent_runs')
      .select('agent_id, cost_cents, duration_ms, started_at')
      .eq('status', 'succeeded')
      .gt('cost_cents', 100)
      .gte('started_at', since7d)
      .order('cost_cents', { ascending: false })
      .limit(10);

    // ── 5. Conversion signals from conversion_funnel agent findings ────────────
    const { data: conversionFindings } = await ctx.supabase
      .from('agent_runs')
      .select('output, started_at')
      .eq('agent_id', 'conversion-funnel')
      .eq('status', 'succeeded')
      .gte('started_at', since30d)
      .order('started_at', { ascending: false })
      .limit(3);

    const conversionSignals: string[] = [];
    for (const run of conversionFindings ?? []) {
      const output = run.output as Record<string, unknown> | null;
      const findings = Array.isArray(output?.findings) ? (output!.findings as string[]) : [];
      conversionSignals.push(...findings.slice(0, 3));
    }

    // ── 6. Error spikes: check for rising failure rates vs prior week ──────────
    const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data: allRecentRuns } = await ctx.supabase
      .from('agent_runs')
      .select('agent_id, status, started_at')
      .gte('started_at', since14d)
      .order('started_at', { ascending: false })
      .limit(500);

    const now = Date.now();
    const week1Start = now - 7 * 86_400_000;
    const week2Start = now - 14 * 86_400_000;

    const ratesByAgent: Record<string, { thisWeek: number; lastWeek: number; total: number }> = {};
    for (const run of allRecentRuns ?? []) {
      const id = run.agent_id as string;
      const ts = new Date(run.started_at as string).getTime();
      if (!ratesByAgent[id]) ratesByAgent[id] = { thisWeek: 0, lastWeek: 0, total: 0 };
      ratesByAgent[id].total += 1;
      if (run.status === 'failed' || run.status === 'needs_repair') {
        if (ts >= week1Start) ratesByAgent[id].thisWeek += 1;
        else if (ts >= week2Start) ratesByAgent[id].lastWeek += 1;
      }
    }
    const spikeAgents = Object.entries(ratesByAgent)
      .filter(([, r]) => r.thisWeek > r.lastWeek * 1.5 && r.thisWeek >= 2)
      .map(([id, r]) => ({ id, ...r }))
      .slice(0, 3);

    // ── 7. Stalled agents: succeeded runs with no useful output ───────────────
    // Deterministic check — no LLM required. triggerImprovement handles dedup.
    const { data: recentSucceededRuns } = await ctx.supabase
      .from('agent_runs')
      .select('agent_id, status, summary, started_at')
      .eq('status', 'succeeded')
      .gte('started_at', since7d)
      .order('started_at', { ascending: false })
      .limit(500);

    const runsByAgentId: Record<string, Array<{ status: string; summary: string | null }>> = {};
    for (const run of recentSucceededRuns ?? []) {
      const id = run.agent_id as string;
      if (!runsByAgentId[id]) runsByAgentId[id] = [];
      runsByAgentId[id].push({ status: run.status as string, summary: run.summary as string | null });
    }

    const stalledAgents = Object.entries(runsByAgentId)
      .filter(([, agentRuns]) => isStalledAgent(agentRuns))
      .map(([agentId, agentRuns]) => ({ agentId, runCount: agentRuns.length }));

    // ── Build data snapshot for LLM ───────────────────────────────────────────
    const snapshot = {
      ux_proposals: (uxProposals ?? []).map((p) => ({
        id: p.id,
        path: p.page_path,
        severity: p.severity,
        title: p.title,
        body: (p.body as string | null)?.slice(0, 200),
        proposed_change: p.proposed_change,
        age_days: Math.floor((Date.now() - new Date(p.created_at as string).getTime()) / 86_400_000),
      })),
      design_insights: (designInsights ?? []).slice(0, 5),
      problematic_agents: problematicAgents.map(([id, count]) => ({ id, failure_count: count })),
      expensive_runs: (expensiveRuns ?? []).slice(0, 5).map((r) => ({
        agent: r.agent_id,
        cost_cents: r.cost_cents,
        duration_ms: r.duration_ms,
      })),
      conversion_signals: conversionSignals.slice(0, 5),
      error_spikes: spikeAgents,
      stalled_agents: stalledAgents.map(({ agentId, runCount }) => ({
        id: agentId,
        succeeded_no_output: runCount,
      })),
    };

    const prompt = `Analyse this Buds At Work platform health snapshot and identify the top improvement opportunities.

DATA SNAPSHOT:
${JSON.stringify(snapshot, null, 2)}

Focus on items that are:
- Actionable with a ≤3 file code change
- Have not been addressed in the last 3 days
- Would measurably improve: UX, conversion, agent reliability, or operating cost

Return the JSON as described in your system instructions.`;

    if (shouldStop('llm')) {
      return {
        summary: 'Bud Observer collected signals but stopped before LLM analysis to avoid runtime reaping.',
        output: {
          status: 'partial',
          summary: 'Observer exited at timeout-safe checkpoint before LLM analysis.',
          findings: [],
          recommended_actions: ['Re-run Bud Observer after reducing signal volume or increasing BUD_OBSERVER_BUDGET_MS'],
          confidence: 0.4,
          risk_level: 'low',
          raw_output: { checkpoints, remaining_ms: remainingMs() },
        },
      };
    }

    const raw = await withTimeout('llm_analysis', ctx.llm(prompt, { system: SYSTEM }), Math.min(LLM_TIMEOUT_MS, Math.max(10_000, remainingMs() - MIN_EXIT_WINDOW_MS)));
    if (!raw) {
      return {
        summary: 'Bud Observer timed out during LLM analysis and exited safely before runtime reaping.',
        output: {
          status: 'partial',
          summary: 'LLM analysis timed out; no improvements were triggered.',
          findings: [],
          recommended_actions: ['Inspect signal volume and LLM latency for bud-observer'],
          confidence: 0.35,
          risk_level: 'low',
          raw_output: { checkpoints, remaining_ms: remainingMs(), phase: 'llm_timeout' },
        },
      };
    }

    let signals: Array<{
      signal_type: string;
      severity: string;
      title: string;
      description: string;
      affected_area: string;
      proposed_approach: string;
      reference_files?: string[];
      confidence: number;
    }> = [];
    let observerSummary = '';

    try {
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(jsonStr) as typeof signals extends never ? never : {
        signals?: typeof signals;
        summary?: string;
      };
      signals = (parsed.signals ?? []).slice(0, 5).map((signal) => {
        const root = classifyRootCause({
          signalType: signal.signal_type,
          title: signal.title,
          description: signal.description,
          affectedArea: signal.affected_area,
          referenceFiles: signal.reference_files,
          metadata: { confidence: signal.confidence },
        });
        return {
          ...signal,
          root_cause_id: root.rootCauseId,
          root_cause_key: root.rootCauseKey,
          initiative_title: root.initiativeTitle,
        } as typeof signal & {
          root_cause_id: string;
          root_cause_key: string;
          initiative_title: string;
        };
      });
      observerSummary = parsed.summary ?? '';
    } catch {
      ctx.log('bud-observer: failed to parse LLM response', { raw: raw.slice(0, 500) });
    }

    // ── Trigger improvements for high-confidence signals ──────────────────────
    const triggered: string[] = [];
    const skippedForTimeout: string[] = [];
    const MIN_CONFIDENCE = 0.65;

    for (const signal of signals) {
      if (signal.confidence < MIN_CONFIDENCE) continue;
      if (shouldStop(`trigger:${signal.title}`)) {
        skippedForTimeout.push(signal.title);
        continue;
      }

      try {
        const result = await withTimeout(`trigger_improvement:${signal.title}`, triggerImprovement(ctx.supabase, {
          source: 'observer',
          signalType: signal.signal_type,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          affectedArea: signal.affected_area,
          proposedApproach: signal.proposed_approach,
          referenceFiles: signal.reference_files,
          metadata: { observer_run_id: ctx.runId, confidence: signal.confidence },
          requestedBy: 'bud-observer',
        }), Math.min(IMPROVEMENT_TIMEOUT_MS, Math.max(5_000, remainingMs() - MIN_EXIT_WINDOW_MS)));

        if (!result) {
          skippedForTimeout.push(signal.title);
          continue;
        }

        if (result.status !== 'deduplicated') {
          triggered.push(`[${signal.severity}] ${signal.title} → ${result.status}`);
          ctx.log(`bud-observer: triggered improvement for: ${signal.title}`, result);
        }
      } catch (err) {
        ctx.log(`bud-observer: failed to trigger improvement for ${signal.title}`, { err: String(err) });
      }
    }

    // ── Trigger stalled-agent signals (deterministic, fingerprinted) ─────────
    // These bypass the LLM — the stall is observable from run data alone.
    // triggerImprovement deduplicates on fingerprint(stalled_agent:agentId:title)
    // so repeated observer runs cannot spam the improvement queue.
    for (const { agentId, runCount } of stalledAgents) {
      if (shouldStop(`stalled:${agentId}`)) break;
      try {
        const result = await withTimeout(
          `trigger_stall:${agentId}`,
          triggerImprovement(ctx.supabase, {
            source: 'observer',
            signalType: 'stalled_agent',
            severity: 'medium',
            title: `Agent stalled — ${agentId}`,
            description: `${agentId} completed ${runCount} recent runs successfully but produced 0 actions, approvals, outbound messages, or tasks. The agent is executing but delivering no customer value.`,
            affectedArea: agentId,
            proposedApproach: `Audit ${agentId} input data, filter conditions, and reply_channel routing. Verify expected source data exists and passes all guards.`,
            referenceFiles: [`src/lib/agents/agents/${agentId}.ts`],
            metadata: { observer_run_id: ctx.runId, run_count: runCount, confidence: 0.9 },
            requestedBy: 'bud-observer',
          }),
          Math.min(IMPROVEMENT_TIMEOUT_MS, Math.max(5_000, remainingMs() - MIN_EXIT_WINDOW_MS)),
        );
        if (result && result.status !== 'deduplicated') {
          triggered.push(`[medium/stalled] ${agentId} → ${result.status}`);
          ctx.log(`bud-observer: stalled signal triggered for ${agentId}`, result);
        }
      } catch (err) {
        ctx.log(`bud-observer: stall trigger failed for ${agentId}`, { err: String(err) });
      }
    }

    // ── Propose action for signals that need human review ─────────────────────
    const reviewNeeded = [
      ...signals.filter((s) => s.confidence < MIN_CONFIDENCE || s.severity === 'critical'),
      ...signals.filter((s) => skippedForTimeout.includes(s.title)),
    ];
    const reviewByRoot = new Map<string, typeof reviewNeeded>();
    for (const signal of reviewNeeded) {
      const key = (signal as typeof signal & { root_cause_key?: string }).root_cause_key
        ?? classifyRootCause({
          signalType: signal.signal_type,
          title: signal.title,
          description: signal.description,
          affectedArea: signal.affected_area,
          referenceFiles: signal.reference_files,
        }).rootCauseKey;
      const list = reviewByRoot.get(key) ?? [];
      list.push(signal);
      reviewByRoot.set(key, list);
    }
    if (reviewNeeded.length > 0 && !shouldStop('propose_review')) {
      for (const [rootCauseKey, rootSignals] of reviewByRoot) {
        const first = rootSignals[0];
        const root = classifyRootCause({
          signalType: first.signal_type,
          title: first.title,
          description: first.description,
          affectedArea: first.affected_area,
          referenceFiles: first.reference_files,
        });
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          payload: {
            signals: rootSignals,
            source: 'bud-observer',
            run_id: ctx.runId,
            root_cause_id: root.rootCauseId,
            root_cause_key: rootCauseKey,
            initiative_title: root.initiativeTitle,
          },
          preview: `Observer found ${rootSignals.length} ${root.initiativeTitle} signal(s): ${rootSignals.map((s) => s.title).join(', ')}`,
          requiresApproval: true,
          confidence: 0.5,
          risk_level: 'low',
        });
      }
    }

    const total = signals.length;
    const autoTriggered = triggered.length;

    return {
      summary: `Bud Observer found ${total} signal(s)${stalledAgents.length > 0 ? `, ${stalledAgents.length} stalled agent(s)` : ''}. Auto-triggered ${autoTriggered} improvement(s). ${skippedForTimeout.length} skipped for runtime safety. ${observerSummary.slice(0, 200)}`,
      output: {
        status: total > 0 ? 'success' : 'partial',
        summary: `Found ${total} improvement opportunities, triggered ${autoTriggered} autonomously.`,
        findings: signals.map((s) => `[${s.severity}] ${s.title}`),
        recommended_actions: reviewNeeded.length > 0
          ? [`Review ${reviewNeeded.length} signal(s) in Mission Control → Improvement Queue`]
          : ['No manual review needed — all signals handled autonomously'],
        confidence: 0.80,
        risk_level: 'low',
        raw_output: {
          signals_found: total,
          auto_triggered: autoTriggered,
          triggered_titles: triggered,
          skipped_for_timeout: skippedForTimeout,
          checkpoints,
          remaining_ms: remainingMs(),
          snapshot_summary: {
            ux_proposals: (uxProposals ?? []).length,
            problematic_agents: problematicAgents.length,
            error_spikes: spikeAgents.length,
          },
        },
      },
    };
  },
};
