import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/employees - List all employees with their auth role (admin use)
export async function GET() {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employees, error } = await (client as any)
    .from('employees')
    .select('id, user_id, full_name, email, services, suburb, status')
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profile roles for employees that have a linked auth user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = (employees || []).filter((e: any) => e.user_id).map((e: any) => e.user_id);
  let roleMap: Record<string, string> = {};

  if (userIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles } = await (client as any)
      .from('profiles')
      .select('id, role')
      .in('id', userIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    roleMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.role]));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (employees || []).map((e: any) => ({
    ...e,
    role: e.user_id ? (roleMap[e.user_id] ?? 'employee') : null,
  }));

  return NextResponse.json({ employees: enriched });
}
