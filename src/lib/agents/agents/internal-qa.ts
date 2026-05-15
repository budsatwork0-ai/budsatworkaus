/**
 * Internal Q&A — manual-only agent that answers questions from your
 * SOPs, contracts, and decisions log. Use it from a chat UI or API:
 *   POST /api/agents/run { agent_id: 'internal-qa', input: { question: '...' } }
 *
 * Indexing strategy: the migration creates a `knowledge_articles` table
 * with a pgvector column. A separate ingest script (not bundled here)
 * walks `Buds At Work/SOPs` and inserts chunks. Until you wire that up,
 * this agent falls back to full-text search on `body`.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You answer questions for the Buds At Work team using only
the provided source snippets. Cite the source by title at the end of each
fact. If unsure, say so plainly. Plain text, ≤ 180 words.`;

export const internalQaAgent: AgentDefinition = {
  id: 'internal-qa',
  name: 'Internal Q&A',
  description: 'Answers questions from your SOPs, contracts, and decisions log.',
  category: 'support',
  autonomy: 'manual',
  async run(ctx: AgentContext) {
    const question = ctx.input?.question as string | undefined;
    if (!question) return { summary: 'No question provided.', output: { error: 'missing question' } };

    // Pull a handful of plausible articles. Replace with vector search once embeddings are loaded.
    const terms = question.toLowerCase().split(/\W+/).filter((t) => t.length > 3).slice(0, 6);
    const orFilter = terms.map((t) => `body.ilike.%${t}%`).join(',');
    const { data: hits } = await ctx.supabase
      .from('knowledge_articles')
      .select('title, body, source_path')
      .or(orFilter || 'body.ilike.%')
      .limit(8);

    if (!hits?.length) return { summary: "I don't have anything in the knowledge base on that yet.", output: { answer: null } };

    const prompt = `Question: ${question}\n\nSources:\n${hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.body.slice(0, 800)}`).join('\n---\n')}`;
    const answer = await ctx.llm(prompt, { system: SYSTEM });

    return {
      summary: `Answered: "${question.slice(0, 60)}…"`,
      output: { question, answer, sources: hits.map((h) => h.source_path) },
    };
  },
};
