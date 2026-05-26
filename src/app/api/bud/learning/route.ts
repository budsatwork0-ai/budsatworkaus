import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { writeLearning } from '@/lib/bud/obsidian-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type LearningRequest = {
  title: string;
  summary: string;
  filesChanged?: string[];
  testsRun?: string[];
  patterns?: string[];
  whatFailed?: string;
};

export type LearningResponse =
  | { success: true; vaultPath: string; supabaseId: string | null }
  | { success: false; error: string };

export async function POST(req: NextRequest): Promise<NextResponse<LearningResponse>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: LearningRequest;
  try {
    body = await req.json() as LearningRequest;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.title?.trim() || !body.summary?.trim()) {
    return NextResponse.json({ success: false, error: 'title and summary are required' }, { status: 400 });
  }

  // 1. Write to Obsidian vault
  let vaultPath: string;
  try {
    vaultPath = writeLearning({
      title: body.title.trim(),
      summary: body.summary.trim(),
      filesChanged: body.filesChanged,
      testsRun: body.testsRun,
      patterns: body.patterns,
      whatFailed: body.whatFailed,
      agent: 'mission-control',
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: `Vault write failed: ${String(e)}` }, { status: 500 });
  }

  // 2. Record in bud_evidence (best-effort)
  let supabaseId: string | null = null;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase
      .from('bud_evidence')
      .insert({
        type: 'learning',
        source: 'manual',
        status: 'recorded',
        command: body.title,
        summary: body.summary,
        file_path: vaultPath,
      })
      .select('id')
      .single();
    supabaseId = data?.id ?? null;
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, vaultPath, supabaseId });
}
