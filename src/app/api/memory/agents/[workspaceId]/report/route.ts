/**
 * GET  /api/memory/agents/[workspaceId]/report
 *     Returns the most recent report for this workspace as markdown text.
 *
 * POST /api/memory/agents/[workspaceId]/report
 *     Generates a new LLM report from recent findings + run history.
 *     Body: { period?: 'daily' | 'weekly' | 'monthly' }
 *     Returns the vault path of the written report.
 *
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getLatestReportPath, readFile } from '@/lib/memory/agents/workspace';
import { generateReport } from '@/lib/memory/agents/report';
import type { ReportPeriod } from '@/lib/memory/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function getAdminClients() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return { session: null, supabase: null };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return { session, supabase: null };
  }
  return { session, supabase };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { supabase, session } = await getAdminClients();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { workspaceId } = await params;

  try {
    const filePath = getLatestReportPath(workspaceId);
    if (!filePath) {
      return NextResponse.json({ error: 'No reports found', workspaceId }, { status: 404 });
    }
    const content = readFile(filePath);
    return NextResponse.json({ workspaceId, filePath, content });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { supabase, session } = await getAdminClients();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { workspaceId } = await params;

  let period: ReportPeriod = 'weekly';
  try {
    const body = await req.json() as { period?: ReportPeriod };
    if (body.period) period = body.period;
  } catch { /* empty body */ }

  if (!process.env.OBSIDIAN_VAULT_PATH) {
    return NextResponse.json({ error: 'OBSIDIAN_VAULT_PATH not configured' }, { status: 500 });
  }

  try {
    const filePath = await generateReport({ workspaceId, period, supabase });
    return NextResponse.json({ ok: true, workspaceId, period, filePath });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
