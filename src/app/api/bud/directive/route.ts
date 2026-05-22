import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTIVE_KEY = 'bud_mission_directive';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', DIRECTIVE_KEY)
    .maybeSingle();

  return NextResponse.json({ directive: (data?.value as string) ?? '' });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { directive?: string };
  const directive = (body.directive ?? '').trim().slice(0, 500);

  const supabase = adminClient();
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: DIRECTIVE_KEY, value: directive }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, directive });
}
