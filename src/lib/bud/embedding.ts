import type { SupabaseClient } from '@supabase/supabase-js';

const EMBED_MODEL = 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = 0.72;

type EmbeddingResponse = { data?: Array<{ embedding?: number[] }> };

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY || !text.trim()) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text.slice(0, 8192), model: EMBED_MODEL }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EmbeddingResponse;
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export async function writeLearningEmbedding(
  supabase: SupabaseClient,
  learningId: string,
  text: string,
): Promise<void> {
  const vec = await generateEmbedding(text);
  if (!vec) return;
  await supabase
    .from('bud_repair_learnings')
    .update({ summary_embedding: JSON.stringify(vec) })
    .eq('id', learningId);
}

export type SimilarLearning = {
  id: string;
  rootCauseType: string;
  fixPattern: string;
  outcome: string;
  createdAt: string;
  similarity: number;
};

export async function searchSimilarLearnings(
  supabase: SupabaseClient,
  text: string,
  matchCount = 5,
): Promise<SimilarLearning[]> {
  const vec = await generateEmbedding(text);
  if (!vec) return [];
  const { data } = await supabase.rpc('search_repair_learnings', {
    query_embedding: JSON.stringify(vec),
    match_count: matchCount,
  });
  if (!data) return [];
  return (
    data as Array<{
      id: string;
      root_cause_type: string | null;
      fix_pattern: string;
      outcome: string;
      created_at: string;
      similarity: number;
    }>
  )
    .filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
    .map((r) => ({
      id: r.id,
      rootCauseType: r.root_cause_type ?? '',
      fixPattern: r.fix_pattern,
      outcome: r.outcome,
      createdAt: r.created_at,
      similarity: r.similarity,
    }));
}
