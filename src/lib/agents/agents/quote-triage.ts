/**
 * Quote Triage agent
 *
 * Fetches new quote requests that haven't been touched, classifies them
 * (service type, NDIS vs private, urgency), drafts a quote using your
 * pricing rules, and either auto-sends (under threshold) or queues for
 * review.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Quote Triage agent for Buds At Work, a local
home services business in Logan & South Brisbane offering cleaning, window
cleaning, yard care, dump runs, auto detailing, and laundry. You read incoming
quote requests and produce a structured triage decision.

Output strict JSON only, matching this shape:
{
  "service": "windows" | "cleaning" | "yard" | "dump" | "auto" | "laundry_sneakers" | "unknown",
  "ndis": boolean,
  "urgency": "low" | "normal" | "high",
  "estimated_aud": number,
  "confidence": number,           // 0-1
  "draft_message": string,        // friendly Australian English, ≤ 120 words
  "reason": string                // 1-2 sentences explaining the estimate
}`;

/** How many days without a new submitted quote triggers a staleness warning. */
const DEFAULT_STALE_DAYS = 3;

interface StatusCount {
  status: string;
  count: number;
}

interface DiagnosticPayload {
  status_counts: StatusCount[];
  submitted_total: number;
  submitted_already_triaged: number;
  submitted_awaiting_triage: number;
  newest_submitted_at: string | null;
  stale_warning: string | null;
}

export const quoteTriageAgent: AgentDefinition = {
  id: 'quote-triage',
  name: 'Quote Triage',
  description:
    'Classifies incoming quote requests and drafts a first-pass quote.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    // Schema note: the live `quotes` table uses `service_address` + `service_type`
    // (there is no `suburb`/`service` column), and new requests land as
    // status='submitted' (there is no 'new' status).
    const { data: pending, error } = await ctx.supabase
      .from('quotes')
      .select('id, customer_email, customer_name, service_address, service_type, notes, created_at')
      .eq('status', 'submitted')
      .is('agent_triaged_at', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw new Error(`fetch quotes: ${error.message}`);

    // ── Diagnostic query ────────────────────────────────────────────────────
    // Always run this so operators can distinguish 'nothing to do' from
    // 'data pipeline broken' even after hundreds of successful runs.
    const diagnostic = await buildDiagnostic(ctx);

    if (!pending || pending.length === 0) {
      return {
        summary: buildNoWorkSummary(diagnostic),
        output: { triaged: 0, auto_send_eligible: 0, actions_proposed: 0, parse_failures: 0, diagnostic },
      };
    }

    const autoSendThreshold =
      Number((ctx.config?.auto_send_under_aud as number) ?? 250);

    let actions = 0;
    let autoEligibleCount = 0;
    let triaged = 0;
    let parseFailures = 0;

    for (const q of pending) {
      const prompt = `Quote request:
- Customer: ${q.customer_name ?? '(unknown)'}
- Address: ${q.service_address ?? '(unknown)'}
- Service hint: ${q.service_type ?? '(none)'}
- Notes: ${q.notes ?? '(none)'}
Return triage JSON.`;
      const raw = await ctx.llm(prompt, { system: SYSTEM });

      let parsed: {
        service: string;
        ndis: boolean;
        urgency: string;
        estimated_aud: number;
        confidence: number;
        draft_message: string;
        reason: string;
      };
      try {
        const jsonText = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw;
        parsed = JSON.parse(jsonText);
      } catch {
        parseFailures += 1;
        ctx.log('failed to parse model output', { id: q.id });
        continue;
      }

      const autoEligible =
        parsed.confidence >= 0.75 &&
        parsed.estimated_aud <= autoSendThreshold &&
        !parsed.ndis &&
        Boolean(q.customer_email);

      if (!q.customer_email) {
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'quotes',
          target_id: q.id,
          requiresApproval: true,
          confidence: parsed.confidence,
          risk_level: 'medium',
          preview: `Quote ${q.id} has no customer email; cannot send drafted ${parsed.service} quote`,
          payload: {
            quote_id: q.id,
            reason: 'missing_customer_email',
            estimate: parsed.estimated_aud,
            service: parsed.service,
          },
        });
        actions += 1;
        await ctx.supabase
          .from('quotes')
          .update({
            agent_triaged_at: new Date().toISOString(),
            agent_estimate_aud: parsed.estimated_aud,
            agent_service: parsed.service,
            agent_ndis: parsed.ndis,
          })
          .eq('id', q.id);
        triaged += 1;
        continue;
      }

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'quotes',
        target_id: q.id,
        requiresApproval: !autoEligible,
        confidence: parsed.confidence,
        risk_level: parsed.ndis || parsed.estimated_aud > autoSendThreshold ? 'medium' : 'low',
        preview: [
          'Quote email',
          parsed.service,
          parsed.estimated_aud ? `$${parsed.estimated_aud}` : null,
          q.service_address ? q.service_address.split(',')[0]?.trim().slice(0, 30) : null,
          `quote ${q.id.slice(0, 6)}`,
        ].filter(Boolean).join(' · '),
        payload: {
          to: q.customer_email,
          subject: `Your quote from Buds At Work`,
          html: parsed.draft_message,
          confidence: parsed.confidence,
          risk_level: parsed.ndis || parsed.estimated_aud > autoSendThreshold ? 'medium' : 'low',
          meta: { quote_id: q.id, estimate: parsed.estimated_aud, ndis: parsed.ndis },
        },
      });
      actions += 1;
      if (autoEligible) autoEligibleCount += 1;

      await ctx.supabase
        .from('quotes')
        .update({
          agent_triaged_at: new Date().toISOString(),
          agent_estimate_aud: parsed.estimated_aud,
          agent_service: parsed.service,
          agent_ndis: parsed.ndis,
        })
        .eq('id', q.id);
      triaged += 1;
    }

    if (triaged === 0 && pending.length > 0) {
      throw new Error(`Quote Triage parsed 0/${pending.length} quote decision(s); no triage actions were produced.`);
    }

    return {
      summary: `Triaged ${triaged} quote(s) — ${autoEligibleCount} eligible for auto-send, ${actions - autoEligibleCount} requiring review.${parseFailures ? ` ${parseFailures} parse failure(s).` : ''}${diagnostic.stale_warning ? ` ⚠️ ${diagnostic.stale_warning}` : ''}`,
      output: { triaged, auto_send_eligible: autoEligibleCount, actions_proposed: actions, parse_failures: parseFailures, diagnostic },
    };
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildDiagnostic(ctx: AgentContext): Promise<DiagnosticPayload> {
  // Count all quotes grouped by status
  const { data: allRows } = await ctx.supabase
    .from('quotes')
    .select('status, agent_triaged_at, created_at');

  const statusMap: Record<string, number> = {};
  let submittedTotal = 0;
  let submittedAlreadyTriaged = 0;
  let newestSubmittedAt: string | null = null;

  for (const row of allRows ?? []) {
    const s = (row.status as string) ?? 'unknown';
    statusMap[s] = (statusMap[s] ?? 0) + 1;

    if (s === 'submitted') {
      submittedTotal += 1;
      if (row.agent_triaged_at) submittedAlreadyTriaged += 1;
      const ca = row.created_at as string | null;
      if (ca && (!newestSubmittedAt || ca > newestSubmittedAt)) {
        newestSubmittedAt = ca;
      }
    }
  }

  const status_counts: StatusCount[] = Object.entries(statusMap).map(
    ([status, count]) => ({ status, count }),
  );

  const staleDays = Number((ctx.config?.stale_warning_days as number) ?? DEFAULT_STALE_DAYS);
  let stale_warning: string | null = null;
  if (newestSubmittedAt) {
    const ageMs = Date.now() - new Date(newestSubmittedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays >= staleDays) {
      stale_warning = `No new submitted quotes in ${ageDays.toFixed(1)} days (threshold: ${staleDays}d) — check data pipeline.`;
    }
  } else if (submittedTotal === 0) {
    stale_warning = `No submitted quotes found in the table at all — check data pipeline or lead sources.`;
  }

  return {
    status_counts,
    submitted_total: submittedTotal,
    submitted_already_triaged: submittedAlreadyTriaged,
    submitted_awaiting_triage: submittedTotal - submittedAlreadyTriaged,
    newest_submitted_at: newestSubmittedAt,
    stale_warning,
  };
}

function buildNoWorkSummary(diagnostic: DiagnosticPayload): string {
  const parts: string[] = [];

  if (diagnostic.submitted_total === 0) {
    const others = diagnostic.status_counts
      .filter((s) => s.status !== 'submitted')
      .map((s) => `${s.count} ${s.status}`)
      .join(', ');
    parts.push(
      others
        ? `No submitted quotes found (table contains: ${others}).`
        : 'Quotes table appears empty — no rows found in any status.',
    );
  } else if (diagnostic.submitted_awaiting_triage === 0) {
    parts.push(
      `All ${diagnostic.submitted_total} submitted quote(s) are already triaged (agent_triaged_at set).`,
    );
  } else {
    // Shouldn't normally reach here, but be explicit.
    parts.push(
      `${diagnostic.submitted_awaiting_triage} submitted quote(s) awaiting triage but none were fetched.`,
    );
  }

  if (diagnostic.stale_warning) {
    parts.push(`⚠️ ${diagnostic.stale_warning}`);
  }

  const statusSummary = diagnostic.status_counts
    .map((s) => `${s.status}:${s.count}`)
    .join(', ');
  if (statusSummary) {
    parts.push(`Status breakdown — ${statusSummary}.`);
  }

  return parts.join(' ');
}
