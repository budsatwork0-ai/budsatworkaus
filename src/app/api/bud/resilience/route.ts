import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET() {
  const { data } = await db()
    .from('resilience_events')
    .select('id, guard, event_type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ events: data ?? [] });
}
