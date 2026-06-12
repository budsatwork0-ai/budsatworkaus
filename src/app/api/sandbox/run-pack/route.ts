/**
 * POST /api/sandbox/run-pack
 * Body: { category?: string; difficulty?: string; slugs?: string[] }
 *
 * Runs a filtered pack of scenarios sequentially.
 * Admin-gated. No production side effects.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { runSandboxPack } from '@/lib/sandbox/arena';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { ScenarioCategory, ScenarioDifficulty } from '@/lib/sandbox/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    category?: string;
    difficulty?: string;
    slugs?: string[];
  };

  let pack = SANDBOX_SCENARIOS;

  if (body.slugs && body.slugs.length > 0) {
    const slugSet = new Set(body.slugs);
    pack = pack.filter((s) => slugSet.has(s.slug));
  } else {
    if (body.category) {
      pack = pack.filter((s) => s.category === (body.category as ScenarioCategory));
    }
    if (body.difficulty) {
      pack = pack.filter((s) => s.difficulty === (body.difficulty as ScenarioDifficulty));
    }
  }

  if (pack.length === 0) {
    return NextResponse.json({ error: 'No matching scenarios found for the given filters' }, { status: 400 });
  }

  // Safety cap — prevent runaway cost from oversized packs.
  if (pack.length > 20) {
    return NextResponse.json(
      { error: `Pack too large (${pack.length} scenarios). Maximum is 20 per request.` },
      { status: 400 },
    );
  }

  try {
    const results = await runSandboxPack(pack, { triggeredBy: user.id });
    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
