/**
 * Adaptation Validator — scores unvalidated research trends against
 * active Buds At Work story arcs.
 *
 * Reads research_trends WHERE adaptation_score IS NULL.
 * Writes adaptation_score (0-100), adaptation_reason, adapted_at.
 *
 * Does NOT:
 *   - Auto-approve trends for content use.
 *   - Create content ideas.
 *   - Modify story arcs, characters, Story Bible, or chapter records.
 *   - Auto-publish anything.
 *
 * Jackson still decides whether a scored trend moves to Content Studio.
 *
 * autonomy: review — scores are informational only until Jackson acts.
 * Run daily at 4:30am, after Trend Scout (4:00am).
 */
import type { AgentDefinition, AgentContext } from '../types';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are a content strategist evaluating whether a social media trend
fits the active story arcs of Buds At Work, a local home services business in Logan &
South Brisbane (cleaning, yard care, window cleaning, dump runs, car detailing, NDIS
support work).

Score the trend's fit against the provided story arcs from 0 to 100:
  0–19  : No genuine connection — forced or irrelevant
  20–39 : Weak connection — possible but a stretch
  40–59 : Moderate — some overlap, would need significant adaptation
  60–79 : Good — clear story angle exists, minimal forcing
  80–100: Strong — this trend maps directly to an active arc moment

Return ONLY valid JSON — no markdown fences, no other text:
{
  "adaptation_score": <integer 0-100>,
  "adaptation_reason": "One paragraph. Name the arc(s) it fits. Explain why the score is what it is. If no fit, say so plainly."
}`;

// ─── Agent definition ─────────────────────────────────────────────────────────

export const adaptationValidatorAgent: AgentDefinition = {
  id:          'adaptation-validator',
  name:        'Adaptation Validator',
  description: 'Scores unvalidated research trends against active story arcs (0–100). Does not approve trends.',
  category:    'sales',
  autonomy:    'review',
  preferredModel: 'claude-haiku-4-5-20251001',

  async run(ctx: AgentContext) {
    // ── Load active arcs ────────────────────────────────────────────────────────
    const { data: arcs, error: arcsErr } = await ctx.supabase
      .from('story_arcs')
      .select('id, title, description, status, progress_notes')
      .eq('status', 'active');

    if (arcsErr) {
      return { summary: `Adaptation Validator: failed to load story arcs — ${arcsErr.message}` };
    }

    if (!arcs || arcs.length === 0) {
      return { summary: 'Adaptation Validator: no active story arcs found — skipping.' };
    }

    const arcBlock = arcs
      .map((a: { title: string; description: string; progress_notes: string | null }) =>
        `Arc: ${a.title}\nDescription: ${a.description ?? ''}\nProgress: ${a.progress_notes ?? '—'}`,
      )
      .join('\n\n');

    // ── Load unvalidated trends ─────────────────────────────────────────────────
    const { data: trends, error: trendsErr } = await ctx.supabase
      .from('research_trends')
      .select('id, platform, title, description, trend_type, urgency, adaptation_angle, status')
      .is('adaptation_score', null)
      .neq('status', 'expired')
      .order('created_at', { ascending: true })
      .limit(20);

    if (trendsErr) {
      return { summary: `Adaptation Validator: failed to load trends — ${trendsErr.message}` };
    }

    if (!trends || trends.length === 0) {
      return { summary: 'Adaptation Validator: no unvalidated trends found — nothing to score.' };
    }

    ctx.log(`adaptation_validator unvalidated_trends=${trends.length} active_arcs=${arcs.length}`);

    let scored = 0;
    let failed = 0;

    for (const trend of trends) {
      const prompt = `=== ACTIVE STORY ARCS ===
${arcBlock}

=== TREND TO EVALUATE ===
Platform: ${trend.platform}
Title: ${trend.title}
Type: ${trend.trend_type}
Urgency: ${trend.urgency}
Description: ${trend.description}
Adaptation angle (preliminary): ${trend.adaptation_angle || 'None provided'}

Score the fit of this trend against the active story arcs.`;

      let parsed: { adaptation_score: number; adaptation_reason: string };
      try {
        const raw = await ctx.llm(prompt, { system: SYSTEM });
        parsed = parseJsonResponse(raw) as typeof parsed;

        if (
          typeof parsed?.adaptation_score !== 'number' ||
          parsed.adaptation_score < 0 ||
          parsed.adaptation_score > 100
        ) {
          throw new Error('adaptation_score out of range or missing');
        }
      } catch (err) {
        ctx.log(`adaptation_validator score_error trend_id=${trend.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        failed += 1;
        continue;
      }

      if (!ctx.dryRun) {
        const { error: updateErr } = await ctx.supabase
          .from('research_trends')
          .update({
            adaptation_score:  Math.round(parsed.adaptation_score),
            adaptation_reason: (parsed.adaptation_reason ?? '').slice(0, 1000),
            adapted_at:        new Date().toISOString(),
          })
          .eq('id', trend.id);

        if (updateErr) {
          ctx.log(`adaptation_validator update_error trend_id=${trend.id}`, { error: updateErr.message });
          failed += 1;
          continue;
        }

        await logPipelineEvent(ctx.supabase as any, {
          event_type:  'trend_adapted',
          source_type: 'opportunity',
          source_id:   trend.id,
          result_type: 'story_opportunity',
          result_id:   trend.id,
          metadata:    {
            platform:         trend.platform,
            title:            trend.title,
            adaptation_score: Math.round(parsed.adaptation_score),
          },
        });
      } else {
        ctx.log(`adaptation_validator dry_run trend_id=${trend.id} score=${parsed.adaptation_score}`);
      }

      scored += 1;
      ctx.log(`adaptation_validator scored trend_id=${trend.id} score=${Math.round(parsed.adaptation_score)}`);
    }

    if (scored > 0) {
      await ctx.proposeAction({
        action_type:  'flag_for_review',
        target_table: 'research_trends',
        preview:      `${scored} trend(s) scored. ${failed} failure(s). Review Research Lab for adaptation scores.`,
        payload:      { scored, failed, arc_count: arcs.length },
      });
    }

    return {
      summary:     `Adaptation Validator: ${scored} trend(s) scored, ${failed} failed. ${arcs.length} active arc(s) used.`,
      output:      { scored, failed, arcs_used: arcs.length },
      confidenceScore: scored > 0 ? 0.8 : 0.4,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  if (!cleaned.startsWith('{')) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) cleaned = m[0];
  }
  return JSON.parse(cleaned);
}
