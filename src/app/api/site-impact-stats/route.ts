import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export interface SiteImpactStats {
  id: string;
  participants_supported: number;
  paid_jobs_completed: number;
  training_hours_delivered: number;
  employment_opportunities_created: number;
  updated_at: string;
}

// GET /api/site-impact-stats — public
export async function GET() {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('site_impact_stats')
    .select('*')
    .single();

  if (error) {
    // Return sensible zeros if the row doesn't exist yet
    return NextResponse.json({
      stats: {
        participants_supported: 0,
        paid_jobs_completed: 0,
        training_hours_delivered: 0,
        employment_opportunities_created: 0,
      },
    });
  }

  return NextResponse.json({ stats: data });
}

// POST /api/site-impact-stats — admin only, upserts the single stats row
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: Partial<SiteImpactStats>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // First check if a row exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (client as any)
    .from('site_impact_stats')
    .select('id')
    .single();

  const updates = {
    participants_supported: body.participants_supported ?? 0,
    paid_jobs_completed: body.paid_jobs_completed ?? 0,
    training_hours_delivered: body.training_hours_delivered ?? 0,
    employment_opportunities_created: body.employment_opportunities_created ?? 0,
  };

  let result;
  if (existing?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (client as any)
      .from('site_impact_stats')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (client as any)
      .from('site_impact_stats')
      .insert(updates)
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  revalidatePath('/get-involved');
  return NextResponse.json({ stats: result.data });
}
