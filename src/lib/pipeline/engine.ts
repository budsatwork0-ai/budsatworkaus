/**
 * Pipeline Engine
 *
 * Shared helpers for writing stage events / artifacts / scores to the
 * pipeline tables, plus the real debate-scoring stage that runs 5
 * Claude personas and produces a weighted composite score.
 *
 * Imported by improvement-executor.ts and orchestrator.ts so the
 * Mission Control autonomy dashboard lights up for real runs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineSurface } from './types';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const DEBATE_MODEL = 'claude-haiku-4-5-20251001';

// ── Stage event / artifact helpers ────────────────────────────────────────────

export async function emitStage(
  supabase: SupabaseClient,
  runId: string | undefined,
  stage: string,
  status: 'active' | 'passed' | 'rejected' | 'skipped',
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!runId) return;
  try {
    await supabase
      .from('pipeline_stage_events')
      .insert({ run_id: runId, stage, status, payload });
  } catch { /* non-fatal */ }
}

export async function emitArtifact(
  supabase: SupabaseClient,
  runId: string | undefined,
  stage: string,
  kind: string,
  label: string,
  opts: { url?: string; body?: Record<string, unknown> } = {},
): Promise<void> {
  if (!runId) return;
  try {
    await supabase
      .from('pipeline_artifacts')
      .insert({
        run_id: runId,
        stage,
        kind,
        label,
        url: opts.url ?? null,
        body: opts.body ?? null,
      });
  } catch { /* non-fatal */ }
}

// ── Debate & scoring ──────────────────────────────────────────────────────────

export interface DebateResult {
  composite: number;
  verdict: 'ship' | 'human_review' | 'reject';
}

export async function runDebate(
  supabase: SupabaseClient,
  runId: string | undefined,
  params: {
    signalType: string;
    title: string;
    approach: string;
    confidence: number;
    diffSummary: string;
    ciPassed: boolean;
    tastePassed: boolean;
    browserPassed: boolean;
  },
): Promise<DebateResult> {
  await emitStage(supabase, runId, 'debate', 'active', {});

  // Fallback composite if LLM is unavailable: penalise failed checks
  let composite =
    params.confidence * 0.85 *
    (params.ciPassed ? 1 : 0.9) *
    (params.tastePassed ? 1 : 0.85) *
    (params.browserPassed ? 1 : 0.9);

  if (ANTHROPIC_API_KEY && runId) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: DEBATE_MODEL,
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `You are a 5-person panel evaluating an autonomous code change for Buds At Work (local services platform, Next.js 15/Supabase).

CHANGE:
  Signal: ${params.signalType} — ${params.title}
  Approach: ${params.approach.slice(0, 400)}
  Files: ${params.diffSummary.slice(0, 200)}
  Initial confidence: ${(params.confidence * 100).toFixed(0)}%
  CI: ${params.ciPassed ? 'passed' : 'skipped/failed'} | Design: ${params.tastePassed ? 'passed' : 'failed'} | Browser: ${params.browserPassed ? 'passed' : 'skipped/failed'}

Return ONLY valid JSON, no extra text:
{
  "architect":  { "score": 0.85, "dimension": "confidence", "rationale": "one sentence" },
  "taste":      { "score": 0.82, "dimension": "UX",         "rationale": "one sentence" },
  "sentinel":   { "score": 0.88, "dimension": "stability",  "rationale": "one sentence" },
  "releasebot": { "score": 0.90, "dimension": "rollback",   "rationale": "one sentence" },
  "skeptic":    { "score": 0.75, "dimension": "trust",      "rationale": "one adversarial sentence" }
}`,
          }],
        }),
      });

      if (res.ok) {
        const json = await res.json() as { content: Array<{ type: string; text?: string }> };
        const raw = json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          type ScoreEntry = { score: number; dimension: string; rationale: string };
          const scores = JSON.parse(match[0]) as Record<string, ScoreEntry>;
          const weights: Record<string, number> = {
            architect: 0.30, taste: 0.20, sentinel: 0.20, releasebot: 0.15, skeptic: 0.15,
          };
          composite = 0;
          for (const [agent, weight] of Object.entries(weights)) {
            composite += (scores[agent]?.score ?? params.confidence) * weight;
          }
          if (runId) {
            for (const [agent, data] of Object.entries(scores)) {
              try {
                await supabase.from('pipeline_agent_scores').insert({
                  run_id: runId,
                  agent,
                  dimension: data.dimension,
                  value: Math.min(1, Math.max(0, data.score)),
                  rationale: data.rationale,
                  is_skeptic: agent === 'skeptic',
                });
              } catch { /* non-fatal */ }
            }
          }
        }
      }
    } catch { /* fallback composite already set */ }
  }

  const verdict: DebateResult['verdict'] =
    composite >= 0.80 ? 'ship' : composite >= 0.65 ? 'human_review' : 'reject';

  await emitStage(supabase, runId, 'debate',
    verdict === 'reject' ? 'rejected' : 'passed',
    { composite: +composite.toFixed(3), verdict });

  return { composite, verdict };
}

// ── Pipeline run finalisation ─────────────────────────────────────────────────

export async function finalizePipelineRun(
  supabase: SupabaseClient,
  runId: string | undefined,
  params: {
    verdict: 'auto_merge' | 'human_review' | 'rejected' | 'rolled_back';
    compositeScore?: number;
    prUrl?: string | null;
    previewUrl?: string | null;
  },
): Promise<void> {
  if (!runId) return;
  try {
    await supabase.from('pipeline_runs').update({
      status: params.verdict === 'auto_merge' ? 'succeeded'
        : params.verdict === 'rejected' ? 'rejected'
        : params.verdict === 'rolled_back' ? 'rolled_back'
        : 'in_progress',
      verdict: params.verdict,
      composite_score: params.compositeScore != null ? +params.compositeScore.toFixed(3) : null,
      pr_url: params.prUrl ?? null,
      preview_url: params.previewUrl ?? null,
      ended_at: ['auto_merge', 'rejected', 'rolled_back'].includes(params.verdict)
        ? new Date().toISOString() : null,
    }).eq('id', runId);
  } catch { /* non-fatal */ }
}

// ── Surface mapping ───────────────────────────────────────────────────────────

export function signalToSurface(affectedArea?: string): PipelineSurface {
  const area = (affectedArea ?? '').toLowerCase();
  if (area.includes('/crew') || area.includes('crew')) return 'crew';
  if (area.includes('/portal') || area.includes('portal') || area.includes('customer')) return 'customer';
  if (area.startsWith('/') && !area.includes('dashboard') && !area.includes('admin')) return 'public';
  return 'admin';
}
