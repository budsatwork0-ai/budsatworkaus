import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export type EvidenceRow = {
  source_type: string;
  source_id: string;
  label: string;
  body: string | null;
  stderr: string | null;
  status: string;
  recorded_at: string;
};

export type EvidenceResponse =
  | { available: false; reason: string }
  | { available: true; rows: EvidenceRow[]; total: number };

export async function GET(): Promise<NextResponse<EvidenceResponse>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ available: false, reason: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from('mission_control_latest_evidence')
      .select('source_type, source_id, label, body, stderr, status, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ available: false, reason: error.message });
    }

    return NextResponse.json({
      available: true,
      rows: (data ?? []) as EvidenceRow[],
      total: data?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ available: false, reason: String(e) });
  }
}
