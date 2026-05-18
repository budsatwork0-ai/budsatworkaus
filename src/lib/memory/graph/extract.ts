/**
 * LLM-based knowledge graph extraction.
 *
 * Two operations:
 *   1. extractDocument  — for a single document, extract systems, rationale,
 *                          dependencies, keywords, importance.
 *   2. detectContradiction — compare two semantically similar documents and
 *                            determine if they conflict.
 *
 * Both are expensive (LLM calls) — run selectively:
 *   - extractDocument: on first index, or when body changes significantly
 *   - detectContradiction: only for pairs with cosine similarity > 0.80
 *
 * Results are cached in memory_graph_extractions + memory_contradiction_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractionResult, GraphEdge, RelationshipType } from './types';

const ANTHROPIC_API_KEY = () => process.env.ANTHROPIC_API_KEY!;
const MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-haiku-4-5-20251001';

// ── LLM call ──────────────────────────────────────────────────────────────────

async function callLLM(prompt: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key':    ANTHROPIC_API_KEY(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
}

// ── Document extraction ───────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a knowledge graph analyst for an operations platform called Buds At Work.
Given a knowledge note, extract structured metadata for graph indexing.
The platform serves home services (cleaning, yard care, detailing) in Brisbane, Australia.
Key systems: quote-builder, stripe, supabase, vercel, email (resend), AI agents, crew portal, admin dashboard, NDIS.

Output ONLY valid JSON (no prose, no markdown fences) matching this exact shape:
{
  "systems_mentioned": ["array of system/component names found in this note, lowercase"],
  "decision_rationale": "one sentence explaining WHY this decision/finding was made, or empty string",
  "problems_solved": ["array of problems this note addresses"],
  "depends_on_raw": ["array of systems/concepts this note says depends on something else"],
  "implements_raw": ["array of things this note describes implementing or building"],
  "keywords": ["5-10 unique keywords for clustering, lowercase"],
  "importance_score": 0.0
}

importance_score rules: 0.9+ = core architectural decision; 0.7–0.9 = significant finding; 0.4–0.7 = routine; < 0.4 = minor note.`;

export async function extractDocument(
  supabase: SupabaseClient,
  documentId: string,
  title: string,
  body: string,
): Promise<ExtractionResult> {
  const prompt = `Title: ${title}\n\n${body.slice(0, 3000)}`;
  const raw    = await callLLM(prompt, EXTRACT_SYSTEM);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      systems_mentioned: [],
      decision_rationale: '',
      problems_solved: [],
      depends_on_raw: [],
      implements_raw: [],
      keywords: [],
      importance_score: 0.5,
    };
  }

  const result: ExtractionResult = {
    documentId,
    systemsMentioned: (parsed.systems_mentioned as string[]) ?? [],
    decisionRationale: (parsed.decision_rationale as string) ?? '',
    problemsSolved: (parsed.problems_solved as string[]) ?? [],
    dependsOnRaw: (parsed.depends_on_raw as string[]) ?? [],
    implementsRaw: (parsed.implements_raw as string[]) ?? [],
    keywords: (parsed.keywords as string[]) ?? [],
    importanceScore: Math.min(1, Math.max(0, Number(parsed.importance_score) || 0.5)),
  };

  // Persist to DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('memory_graph_extractions') as any).upsert(
    {
      document_id:        documentId,
      systems_mentioned:  result.systemsMentioned,
      decision_rationale: result.decisionRationale,
      problems_solved:    result.problemsSolved,
      depends_on_raw:     result.dependsOnRaw,
      implements_raw:     result.implementsRaw,
      keywords:           result.keywords,
      importance_score:   result.importanceScore,
      extracted_at:       new Date().toISOString(),
      model:              MODEL,
    },
    { onConflict: 'document_id' },
  );

  return result;
}

// ── LLM edge resolution ───────────────────────────────────────────────────────
// After extraction, try to resolve depends_on_raw / implements_raw phrases to
// actual document IDs and create typed edges.

export async function resolveExtractionEdges(
  supabase: SupabaseClient,
  documentId: string,
  result: ExtractionResult,
): Promise<number> {
  let created = 0;

  async function resolve(
    phrases: string[],
    rel: RelationshipType,
  ): Promise<void> {
    if (phrases.length === 0) return;

    // For each phrase, find the closest-matching document by title ilike
    for (const phrase of phrases) {
      const { data: matches } = await supabase
        .from('memory_documents')
        .select('id, title')
        .ilike('title', `%${phrase.slice(0, 40)}%`)
        .eq('status', 'active')
        .neq('id', documentId)
        .limit(1);

      if (!matches || matches.length === 0) continue;

      const { error } = await supabase.from('memory_edges').upsert(
        {
          source_id:    documentId,
          target_id:    matches[0].id,
          relationship: rel,
          strength:     0.7,
          metadata:     { raw_phrase: phrase },
          extracted_by: 'llm',
        },
        { onConflict: 'source_id,target_id,relationship' },
      );
      if (!error) created++;
    }
  }

  await resolve(result.dependsOnRaw, 'depends_on');
  await resolve(result.implementsRaw, 'implements');

  return created;
}

// ── Contradiction detection ───────────────────────────────────────────────────

const CONTRADICTION_SYSTEM = `You are a knowledge consistency checker for an operations platform.
Given two knowledge notes from the same system, determine if they contain conflicting facts, decisions, or guidance.

Output ONLY valid JSON:
{
  "contradicts": true or false,
  "severity": "minor" or "major",
  "explanation": "one sentence explaining the conflict, or empty string if none"
}

minor = different perspectives on the same thing, or outdated info that should be superseded.
major = direct factual conflict that would cause implementation errors if both were followed.`;

export async function detectContradiction(
  supabase: SupabaseClient,
  docA: { id: string; title: string; body: string },
  docB: { id: string; title: string; body: string },
  similarity: number,
): Promise<{ contradicts: boolean; severity: 'minor' | 'major'; explanation: string }> {
  // Check cache first
  const { data: cached } = await supabase
    .from('memory_contradiction_log')
    .select('contradicts, severity, explanation')
    .or(`and(doc_a_id.eq.${docA.id},doc_b_id.eq.${docB.id}),and(doc_a_id.eq.${docB.id},doc_b_id.eq.${docA.id})`)
    .single();

  if (cached) {
    return {
      contradicts: cached.contradicts,
      severity:    cached.severity ?? 'minor',
      explanation: cached.explanation ?? '',
    };
  }

  const prompt = `Note A: ${docA.title}\n${docA.body.slice(0, 1500)}\n\n---\n\nNote B: ${docB.title}\n${docB.body.slice(0, 1500)}`;
  const raw    = await callLLM(prompt, CONTRADICTION_SYSTEM);

  let parsed: { contradicts: boolean; severity: 'minor' | 'major'; explanation: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { contradicts: false, severity: 'minor', explanation: '' };
  }

  // Cache result
  await supabase.from('memory_contradiction_log').upsert(
    {
      doc_a_id:    docA.id,
      doc_b_id:    docB.id,
      contradicts: parsed.contradicts,
      severity:    parsed.severity,
      explanation: parsed.explanation,
      checked_at:  new Date().toISOString(),
    },
    { onConflict: 'doc_a_id,doc_b_id' },
  );

  // Create a contradicts edge if confirmed
  if (parsed.contradicts) {
    await supabase.from('memory_edges').upsert(
      {
        source_id:    docA.id,
        target_id:    docB.id,
        relationship: 'contradicts',
        strength:     parsed.severity === 'major' ? 0.9 : 0.6,
        metadata:     { explanation: parsed.explanation, similarity, severity: parsed.severity },
        extracted_by: 'llm',
      },
      { onConflict: 'source_id,target_id,relationship' },
    );
  }

  return parsed;
}

// ── Check contradictions for a new document ──────────────────────────────────
// Finds semantically similar existing docs and runs contradiction checks.

export async function checkNewDocumentContradictions(
  supabase: SupabaseClient,
  doc: { id: string; title: string; body: string; embedding: number[] },
  similarityThreshold = 0.80,
): Promise<Array<{ docId: string; title: string; contradicts: boolean; severity: 'minor' | 'major'; explanation: string }>> {
  if (doc.embedding.length === 0) return [];

  const { data: similar } = await supabase.rpc('search_memory', {
    query_embedding: doc.embedding,
    match_threshold: similarityThreshold,
    match_count:     5,
    filter_category: null,
    filter_scope:    null,
  });

  if (!similar || similar.length === 0) return [];

  const results = [];
  for (const s of similar as Array<{ id: string; title: string; body: string; similarity: number }>) {
    if (s.id === doc.id) continue;
    const check = await detectContradiction(
      supabase,
      doc,
      { id: s.id, title: s.title, body: s.body },
      s.similarity,
    );
    results.push({ docId: s.id, title: s.title, ...check });
  }

  return results;
}
