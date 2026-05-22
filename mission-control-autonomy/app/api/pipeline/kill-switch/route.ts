/**
 * GET  /api/pipeline/kill-switch   — current state
 * POST /api/pipeline/kill-switch   — { paused: boolean, reason?: string }
 *
 * Toggles the global autonomy pause. Workers must consult pipeline_kill_switch
 * before every merge. Admin/owner only (RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function client() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
}

export async function GET() {
  const supabase = await client();
  const { data, error } = await supabase
    .from('pipeline_kill_switch')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { paused: false });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const paused = !!body.paused;
  const reason = typeof body.reason === 'string' ? body.reason : null;

  const supabase = await client();
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id ?? null;

  const { error } = await supabase
    .from('pipeline_kill_switch')
    .update({
      paused,
      reason,
      paused_at: paused ? new Date().toISOString() : null,
      paused_by: paused ? userId : null,
    })
    .eq('id', 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paused });
}
