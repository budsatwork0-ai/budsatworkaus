import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Safe client creation with fallback
function supabaseSafe() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

// GET /api/site-settings - Get all site settings
export async function GET() {
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data, error } = await client
    .from('site_settings')
    .select('key, value, updated_at')
    .order('key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert array to object for easier consumption
  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings, raw: data });
}

// POST /api/site-settings - Update site settings
export async function POST(req: NextRequest) {
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: { settings: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ error: 'Missing settings object' }, { status: 400 });
  }

  // Upsert each setting
  const updates = Object.entries(body.settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('site_settings')
    .upsert(updates, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
