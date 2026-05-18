/**
 * Embedding pipeline — provider-agnostic with OpenAI text-embedding-3-small
 * as the default. Uses raw fetch (no SDK) to match the project's pattern.
 *
 * Env vars:
 *   OPENAI_API_KEY          — required for embedding generation
 *   EMBEDDING_MODEL         — override model (default: text-embedding-3-small)
 *   EMBEDDING_BASE_URL      — override API base (for Azure / proxy setups)
 */

import type { EmbeddingProvider } from './types';
import { EMBEDDING_MODEL, EMBEDDING_DIMS, EMBEDDING_MAX_CHARS } from './config';

// ── Text preparation ──────────────────────────────────────────────────────────

/**
 * Prepare text for embedding:
 *   - collapse whitespace
 *   - strip markdown syntax (headers, links, code blocks)
 *   - truncate to EMBEDDING_MAX_CHARS
 */
export function prepareText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')     // remove code blocks
    .replace(/`[^`]+`/g, '')            // remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1') // [[wikilink]] → text
    .replace(/^#{1,6}\s+/gm, '')        // remove heading markers
    .replace(/[*_~]{1,3}/g, '')         // remove bold/italic/strikethrough
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, EMBEDDING_MAX_CHARS);
}

// ── Cosine similarity (in-process, for dedup) ─────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── OpenAI provider ───────────────────────────────────────────────────────────

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY env var is not set — required for memory embeddings');
  return key;
}

async function openAIEmbed(texts: string[]): Promise<number[][]> {
  const model   = process.env.EMBEDDING_MODEL ?? EMBEDDING_MODEL;
  const baseUrl = process.env.EMBEDDING_BASE_URL ?? 'https://api.openai.com';

  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${body}`);
  }

  const json = (await res.json()) as OpenAIEmbeddingResponse;

  // API returns results in the same order as input
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ── Public provider singleton ─────────────────────────────────────────────────

let _provider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (_provider) return _provider;

  _provider = {
    dimensions: EMBEDDING_DIMS,

    async embed(text: string): Promise<number[]> {
      const prepared = prepareText(text);
      const [embedding] = await openAIEmbed([prepared]);
      return embedding;
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      // OpenAI allows up to 2048 texts per call — batch in chunks of 100
      const BATCH = 100;
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        const chunk = texts.slice(i, i + BATCH).map(prepareText);
        const batch = await openAIEmbed(chunk);
        results.push(...batch);
      }
      return results;
    },
  };

  return _provider;
}

// ── Embed a memory document ────────────────────────────────────────────────────

/** Combine title + body for a richer embedding representation. */
export function buildEmbedText(title: string, body: string): string {
  return prepareText(`${title}\n\n${body}`);
}

/** Generate an embedding for a memory document's combined title + body. */
export async function embedDocument(title: string, body: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  const text     = buildEmbedText(title, body);
  return provider.embed(text);
}
