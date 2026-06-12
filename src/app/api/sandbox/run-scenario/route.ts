/**
 * POST /api/sandbox/run-scenario
 * Body: { slug: string }
 *
 * Runs a single sandbox scenario against its configured agent.
 * Admin-gated. No production side effects.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { runSandboxScenario } from '@/lib/sandbox/arena';
import { getScenarioTemplate } from '@/lib/sandbox/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { slug?: string };
  if (!body.slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  const template = getScenarioTemplate(body.slug);
  if (!template) {
    return NextResponse.json({ error: `Unknown scenario: ${body.slug}` }, { status: 404 });
  }

  try {
    const result = await runSandboxScenario(template, { triggeredBy: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
