/**
 * POST /api/bud/merge-review/explain
 *
 * Takes a MergeReviewItem and generates a plain-English explanation
 * for a non-technical business owner: what it does, why it matters,
 * whether to approve it, and what happens if it's ignored.
 *
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import type { MergeReviewItem } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-sonnet-4-6';

export interface ExplainResponse {
  whatItDoes: string;
  whyItMatters: string;
  shouldYouApprove: string;
  whatHappensIfIgnored: string;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { item?: MergeReviewItem };
  if (!body.item) {
    return NextResponse.json({ error: 'item required' }, { status: 400 });
  }

  const item = body.item;

  const prompt = `You are explaining a software change to Jackson, the owner of Buds at Work — a local cleaning and home services business in Brisbane. He is not a developer. He runs the business and needs to decide whether a code change should go live on his platform.

Here is the change:

Title: ${item.plainTitle}
Raw branch/PR title: ${item.rawTitle}
System area: ${item.systemArea.replace(/_/g, ' ')}
Risk level: ${item.riskLevel}
CI status: ${item.ciStatus}
Lines added/removed: +${item.additions} / -${item.deletions}
Checks: typecheck=${item.checks.typecheck}, lint=${item.checks.lint}, build=${item.checks.build}, tests=${item.checks.unitTests}${item.checks.migrationSafe != null ? `, migration=${item.checks.migrationSafe}` : ''}
Current recommendation: ${item.recommendationLabel}
Could break: ${item.couldBreak}
Rollback plan: ${item.rollbackPlan}

Respond with ONLY a valid JSON object with exactly these four keys. No markdown, no code fences, no explanation outside the JSON:
{
  "whatItDoes": "One or two plain-English sentences. What does this change actually do? Avoid all technical jargon.",
  "whyItMatters": "One or two sentences. Why should Jackson care about this? Connect it to the business — orders, revenue, crew, customers, reliability.",
  "shouldYouApprove": "One direct sentence with a clear yes/no recommendation, and one sentence explaining why.",
  "whatHappensIfIgnored": "One sentence. What is the consequence of leaving this change in preview forever and never pushing it to production?"
}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `LLM error ${res.status}: ${text}` }, { status: 502 });
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const raw = json.content?.find((c) => c.type === 'text')?.text ?? '';

    // Strip any accidental markdown fences
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let explanation: ExplainResponse;
    try {
      explanation = JSON.parse(stripped) as ExplainResponse;
    } catch {
      // Fallback: return the raw text in whatItDoes if JSON parse fails
      explanation = {
        whatItDoes: raw.trim(),
        whyItMatters: item.whyItMatters,
        shouldYouApprove: item.recommendationLabel,
        whatHappensIfIgnored: 'The improvement stays in preview and never reaches production.',
      };
    }

    return NextResponse.json(explanation);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
