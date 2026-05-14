import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/support-profile — fetch current employee's support profile
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('participant_support_profiles')
    .select('*')
    .eq('employee_id', employee.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}

// PUT /api/crew/support-profile — upsert current employee's support profile
export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const allowed = [
    'support_window_start', 'support_window_end', 'max_shift_duration_minutes',
    'support_mode', 'transport_status', 'travel_radius_km',
    'preferred_services', 'physical_capacity', 'customer_facing_ok',
    'can_work_after_support_hours', 'supervision_notes', 'risk_notes',
    'emergency_contact', 'support_worker_name', 'support_worker_provider',
  ];
  const payload: Record<string, unknown> = { employee_id: employee.id };
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('participant_support_profiles')
    .upsert(payload, { onConflict: 'employee_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}
