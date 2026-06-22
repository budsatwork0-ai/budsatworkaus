import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/artifacts/server';
import { getLearningGuidance } from '@/lib/content-feedback/engine';
import { createServiceClientSafe } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const goal = searchParams.get('goal');
  if (!goal) return NextResponse.json({ error: 'goal is required' }, { status: 400 });

  const guidance = await getLearningGuidance(client as any, goal);
  return NextResponse.json({ guidance });
}
