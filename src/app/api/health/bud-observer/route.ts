import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type HealthStatus = 'ok' | 'degraded' | 'error';

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  checks: {
    db: { status: HealthStatus; latencyMs?: number; error?: string };
  };
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const start = Date.now();
  let dbStatus: HealthStatus = 'ok';
  let dbError: string | undefined;
  let latencyMs: number | undefined;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('agent_events')
      .select('id')
      .limit(1)
      .maybeSingle();
    latencyMs = Date.now() - start;
    if (error) {
      dbStatus = 'degraded';
      dbError = error.message;
    }
  } catch (err) {
    latencyMs = Date.now() - start;
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }

  const overallStatus: HealthStatus =
    dbStatus === 'error' ? 'error' : dbStatus === 'degraded' ? 'degraded' : 'ok';

  const body: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      db: { status: dbStatus, latencyMs, ...(dbError ? { error: dbError } : {}) },
    },
  };

  const httpStatus = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  return NextResponse.json(body, { status: httpStatus });
}
