/**
 * Quote Triage agent
 *
 * Fetches new quote requests that haven't been touched, classifies them
 * (service type, NDIS vs private, urgency), drafts a quote using your
 * pricing rules, and either auto-sends (under threshold) or queues for
 * review.
 *
 * Sandbox mode: if ctx.input contains a quote-like shape (has `service` or
 * `message` fields), it is treated as a synthetic injected quote so the agent
 * can produce real output without needing DB rows.
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

type QuoteRow = {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  service_address: string | null;
  service_type: string | null;
  notes: string | null;
  created_at: string;
};

/** Build a synthetic quote from ctx.input when running in sandbox mode. */
function buildSyntheticQuote(input: Record<string, unknown>): QuoteRow {
  return {
    id: 'sandbox-synthetic-quote',
    customer_email: (input.customer_email as string) ?? 'customer@sandbox.example.com',
    customer_name: (input.customer_name as string) ?? null,
    service_address: (input.suburb as string) ?? (input.address as string) ?? null,
    service_type: (input.service as string) ?? null,
    notes: (input.message as string) ?? null,
    created_at: new Date().toISOString(),
  };
}

export const quoteTriageAgent: AgentDefinition = {
  id: 'quote-triage',
  name: 'Quote Triage',
  description:
    'Classifies incoming quote requests and drafts a first-pass quote.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const rawInput = (ctx.input ?? {}) as Record<string, unknown>;

    // Operational surge/capacity signal: ctx.input carries demand metrics rather
    // than an individual quote. Propose flag_for_review immediately without
    // querying the DB or calling the LLM.
    const isSurgeSignal =
      typeof rawInput.quote_volume_7d === 'number' ||
      typeof rawInput.capacity_utilisation === 'number';

    if (isSurgeSignal) {
      const volume = rawInput.quote_volume_7d as number | undefined;
      const utilisation = rawInput.capacity_utilisation as number | undefined;
      const season = rawInput.season as string | undefined;

      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'quotes',
        target_id: 'sandbox-surge-signal',
        requiresApproval: true,
        confidence: 0.9,
        risk_level: 'medium',
        preview: `Demand surge${season ? ` (${season})` : ''} — ${volume ?? '?'} quotes/7d · utilisation ${utilisation !== undefined ? `${Math.round(utilisation * 100)}%` : '?'}`,
        payload: {
          reason: 'surge_demand',
          quote_volume_7d: volume,
          capacity_utilisation: utilisation,
          season,
          recommendation: 'Consider dynamic pricing or capacity-limited bookings.',
        },
      });

      return {
        summary: `Surge demand detected: ${volume ?? '?'} quotes in 7 days, ${utilisation !== undefined ? `${Math.round(utilisation * 100)}%` : '?'} utilisation${season ? ` (${season} season)` : ''}. Flagged for ops review.`,
        output: { surge: true, volume, capacity_utilisation: utilisation, season },
      };
    }

    // Sandbox mode detection: ctx.input has a quote-like shape when the arena
    // injects a scenario. Skip the DB query and process the injected data directly.
    const isSandboxInjection =
      typeof rawInput.service === 'string' || typeof rawInput.message === 'string';

    let pending: QuoteRow[];

    if (isSandboxInjection) {
      pending = [buildSyntheticQuote(rawInput)];
    } else {
      // Schema note: the live `quotes` table uses `service_address` + `service_type`
      // (there is no `suburb`/`service` column), and new requests land as
      // status='submitted' (there is no 'new' status).
      const { data, error } = await ctx.supabase
        .from('quotes')
        .select('id, customer_email, customer_name, service_address, service_type, notes, created_at')
        .eq('status', 'submitted')
        .is('agent_triaged_at', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) throw new Error(`fetch quotes: ${error.message}`);
      pending = data ?? [];
    }

    if (pending.length === 0) {
      return { summary: 'No new quote requests to triage.' };
    }

    const autoSendThreshold =
      Number((ctx.config?.auto_send_under_aud as number) ?? 250);

    let actions = 0;
    let autoEligibleCount = 0;
    let triaged = 0;
    let parseFailures = 0;
    const isSynthetic = (id: string) => id.startsWith('sandbox-');

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

        // Deterministic fallback: always propose a send_email to acknowledge
        // the request so the agent never silently produces zero actions.
        if (q.customer_email) {
          await ctx.proposeAction({
            action_type: 'send_email',
            target_table: 'quotes',
            target_id: q.id,
            requiresApproval: true,
            confidence: 0.5,
            risk_level: 'low',
            preview: `Quote acknowledgement (parse fallback) · ${q.service_type ?? 'service'} · quote ${q.id.slice(0, 6)}`,
            payload: {
              to: q.customer_email,
              subject: "Your quote from Buds At Work — we'll be in touch",
              html: "Hi, thanks for your quote request! Our team will review it and get back to you shortly with a price.",
              meta: { quote_id: q.id, fallback: true },
            },
          });
          actions += 1;
        }
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
        if (!isSynthetic(q.id)) {
          await ctx.supabase
            .from('quotes')
            .update({
              agent_triaged_at: new Date().toISOString(),
              agent_estimate_aud: parsed.estimated_aud,
              agent_service: parsed.service,
              agent_ndis: parsed.ndis,
            })
            .eq('id', q.id);
        }
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

      if (!isSynthetic(q.id)) {
        await ctx.supabase
          .from('quotes')
          .update({
            agent_triaged_at: new Date().toISOString(),
            agent_estimate_aud: parsed.estimated_aud,
            agent_service: parsed.service,
            agent_ndis: parsed.ndis,
          })
          .eq('id', q.id);
      }
      triaged += 1;
    }

    if (triaged === 0 && parseFailures === 0 && pending.length > 0) {
      throw new Error(`Quote Triage parsed 0/${pending.length} quote decision(s); no triage actions were produced.`);
    }

    return {
      summary: `Triaged ${triaged} quote(s) — ${autoEligibleCount} eligible for auto-send, ${actions - autoEligibleCount} requiring review.${parseFailures ? ` ${parseFailures} parse failure(s) with send_email fallback.` : ''}`,
      output: { triaged, auto_send_eligible: autoEligibleCount, actions_proposed: actions, parse_failures: parseFailures },
    };
  },
};
