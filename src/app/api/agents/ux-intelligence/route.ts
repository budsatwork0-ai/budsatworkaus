/**
 * POST /api/agents/ux-intelligence
 *
 * Trigger endpoint for the UX-Intelligence agent.
 * Always returns 200 with a structured JSON body — errors are embedded
 * in the payload rather than surfaced as 5xx so bud-observer can
 * distinguish agent logic failures from infrastructure failures.
 */

import { NextResponse } from 'next/server';
import { runUxIntelligenceAgent } from '@/agents/ux-intelligence';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  // runUxIntelligenceAgent never throws — errors are in result.error.
  const result = await runUxIntelligenceAgent();
  return NextResponse.json(result, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  const result = await runUxIntelligenceAgent();
  return NextResponse.json(result, { status: 200 });
}
