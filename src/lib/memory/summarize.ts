/**
 * LLM-based memory summarization.
 *
 * Two use cases:
 *   1. Condense a long body into a shorter retrieval-optimised version
 *   2. Merge a cluster of related memories into a single authoritative record
 *
 * Uses the Anthropic API directly (same pattern as runtime.ts).
 */

const ANTHROPIC_API_KEY = () => process.env.ANTHROPIC_API_KEY!;
const MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-haiku-4-5-20251001';

// ── Low-level call ────────────────────────────────────────────────────────────

async function callLLM(prompt: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  return json.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}

// ── Condense ──────────────────────────────────────────────────────────────────

const CONDENSE_SYSTEM = `You are a memory archivist for an operations platform.
Condense the given knowledge note into a dense, retrieval-optimised summary.
Preserve all specific facts, numbers, dates, agent IDs, and action items.
Output ONLY the condensed note body — no preamble, no markdown headings.
Target: 2–5 sentences, under 300 words.`;

export async function condenseMemory(title: string, body: string): Promise<string> {
  const prompt = `Title: ${title}\n\n${body}`;
  return callLLM(prompt, CONDENSE_SYSTEM);
}

// ── Merge cluster ─────────────────────────────────────────────────────────────

const MERGE_SYSTEM = `You are a memory curator for an operations platform.
You will receive several related memory notes. Merge them into one authoritative record.
Rules:
- Keep all unique facts, dates, names, and figures
- Remove redundant information
- Use the most recent facts where there are conflicts
- Output ONLY the merged note body — no preamble, no markdown headings
- Target: 4–8 sentences, under 500 words`;

export interface MemoryNote {
  title: string;
  body: string;
  created_at: string;
}

export async function mergeMemories(notes: MemoryNote[]): Promise<string> {
  const parts = notes
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((n, i) => `--- Note ${i + 1} (${n.created_at.slice(0, 10)}) ---\nTitle: ${n.title}\n${n.body}`)
    .join('\n\n');

  return callLLM(parts, MERGE_SYSTEM);
}

// ── Auto-summarize stale long notes ───────────────────────────────────────────

/** Condense a document's body if it exceeds MAX_BODY_CHARS characters. */
const MAX_BODY_CHARS = 2000;

export async function maybeCondense(
  title: string,
  body: string,
): Promise<string> {
  if (body.length <= MAX_BODY_CHARS) return body;
  return condenseMemory(title, body);
}
