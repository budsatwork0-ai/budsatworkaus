import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/ndis/participants — list all NDIS-eligible employees with their support profiles
// Admin-only.
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // Check admin role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (client as any)
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all active employees who are ndis_workers, joined with their support profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('employees')
    .select(`
      id, full_name, email, phone, suburb, services, ndis_worker, status,
      participant_support_profiles (*)
    `)
    .eq('status', 'active')
    .order('full_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const participants = (data || []).map((emp: Record<string, unknown>) => ({
    ...emp,
    support_profile: Array.isArray(emp.participant_support_profiles)
      ? (emp.participant_support_profiles[0] ?? null)
      : null,
    participant_support_profiles: undefined,
  }));

  return NextResponse.json({ participants });
}
