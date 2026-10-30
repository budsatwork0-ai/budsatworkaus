import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b?.service || !b?.caption) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { data, error } = await db().from('content_posts').insert({
    service: String(b.service).slice(0, 100), suburb: b.suburb ? String(b.suburb).slice(0, 100) : null,
    caption: String(b.caption).slice(0, 3000), cta: b.cta ? String(b.cta).slice(0, 500) : null,
    photo_tip: b.photo_tip ? String(b.photo_tip).slice(0, 500) : null, created_by: user.id,
  }).select('id,service,suburb,caption,cta,photo_tip,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// Hide (archive) a saved post. Reversible: clears nothing but sets archived_at.
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await db().from('content_posts').update({ archived_at: new Date().toISOString() }).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
