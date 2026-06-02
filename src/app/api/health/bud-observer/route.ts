/**
 * GET  /api/health/bud-observer  — liveness ping for the bud-observer agent.
 * POST /api/health/bud-observer  — accepts a minimal payload and echoes status.
 *
 * An external cron hits this endpoint to detect observer failures independently
 * of the observer itself.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const PingSchema = z.object({
  source: z.string().optional(),
  ts: z.string().optional(),
});

function buildResponse(source?: string) {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'bud-observer',
      source: source ?? 'external',
      respondedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return buildResponse();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json().catch(() => ({}));
    const parsed = PingSchema.safeParse(body);
    const source = parsed.success ? parsed.data.source : undefined;
    return buildResponse(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        service: 'bud-observer',
        message,
        respondedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
