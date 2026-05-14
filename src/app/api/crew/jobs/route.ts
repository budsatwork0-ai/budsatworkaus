import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/jobs — List available job assignments for current employee.
// Includes NDIS publication metadata (match score, flags, support requirements)
// for jobs that were published via the NDIS matching flow.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get('service_type');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Get available assignments with order details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from('job_assignments')
    .select('*, orders(*)', { count: 'exact' })
    .eq('employee_id', employee.id)
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  if (limit > 0) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let assignments = data || [];

  // Apply order-level filters client-side
  if (serviceType && serviceType !== 'all') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = assignments.filter((a: any) => a.orders?.service_type === serviceType);
  }
  if (dateFrom) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = assignments.filter((a: any) => a.orders?.scheduled_date >= dateFrom);
  }
  if (dateTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = assignments.filter((a: any) => a.orders?.scheduled_date <= dateTo);
  }

  if (assignments.length === 0) {
    return NextResponse.json({ assignments: [], total: count ?? 0 });
  }

  // Enrich with NDIS publication + match data where available
  const orderIds = assignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => a.order_id)
    .filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: publications }, { data: matchScores }, { data: jobReqs }] = await Promise.all([
    (client as any)
      .from('job_publications')
      .select('order_id, status, published_at, override_reason')
      .eq('employee_id', employee.id)
      .in('order_id', orderIds),
    (client as any)
      .from('job_participant_matches')
      .select('order_id, score, max_score, flags')
      .eq('employee_id', employee.id)
      .in('order_id', orderIds),
    (client as any)
      .from('job_requirements')
      .select('order_id, required_support_mode, transport_required, customer_facing_required, physical_intensity, location_suburb, start_time, end_time, estimated_duration_minutes')
      .in('order_id', orderIds),
  ]);

  const pubMap: Record<string, { status: string; published_at: string; override_reason: string | null }> = {};
  for (const p of publications ?? []) pubMap[p.order_id] = p;

  const matchMap: Record<string, { score: number; max_score: number; flags: unknown[] }> = {};
  for (const m of matchScores ?? []) matchMap[m.order_id] = m;

  const reqMap: Record<string, Record<string, unknown>> = {};
  for (const r of jobReqs ?? []) reqMap[r.order_id] = r;

  // Merge NDIS data into assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = assignments.map((a: any) => ({
    ...a,
    ndis_publication: pubMap[a.order_id] ?? null,
    ndis_match: matchMap[a.order_id] ?? null,
    ndis_requirements: reqMap[a.order_id] ?? null,
  }));

  return NextResponse.json({ assignments: enriched, total: count });
}
