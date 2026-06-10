import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

const EventSchema = z.object({
  action: z.string().min(1).max(120),
  entity_type: z.string().min(1).max(80),
  entity_id: z.string().min(1).max(120),
  details: z.record(z.string(), z.unknown()).optional(),
  source: z.string().max(120).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 });
  }

  const { action, entity_type, entity_id, details, source } = parsed.data;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('audit_log').insert({
      action,
      entity_type,
      entity_id,
      details: details ?? null,
      source: source ?? 'homepage',
    });

    if (error) {
      console.error('[/api/events] supabase insert error:', error.message);
      return NextResponse.json({ error: 'Persistence error' }, { status: 500 });
    }
  } catch (err) {
    console.error('[/api/events] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
