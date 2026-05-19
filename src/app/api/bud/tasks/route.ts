/**
 * GET  /api/bud/tasks      — list open Bud tasks
 * POST /api/bud/tasks      — create a task manually
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { createBudTask } from '@/lib/bud/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('bud_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json()) as {
    description: string;
    source_agent?: string;
    target_agent?: string;
    confidence?: number;
    risk_level?: string;
  };
  if (!body.description) {
    return NextResponse.json({ error: 'description required' }, { status: 400 });
  }
  const supabase = adminClient();
  try {
    const task = await createBudTask(supabase, body as Parameters<typeof createBudTask>[1]);
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
