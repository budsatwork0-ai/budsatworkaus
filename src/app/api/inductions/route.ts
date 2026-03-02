import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export type Inductee = {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
  induction_progress: Record<string, boolean>;
};

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  type ApplicantRow = {
    id: string;
    full_name: string;
    role: string | null;
    created_at: string;
    induction_progress: Record<string, boolean> | null;
  };

  // Cast to unknown because the generated types don't yet include
  // induction_progress (added in migration 016, types not regenerated)
  const { data, error } = await (client
    .from('applicants')
    .select('id, full_name, role, created_at, induction_progress')
    .in('stage', ['verify', 'paperwork', 'induct'])
    .order('created_at', { ascending: true }) as unknown as Promise<{ data: ApplicantRow[] | null; error: unknown }>);

  if (error) {
    console.error('Inductions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inductees' }, { status: 500 });
  }

  const inductees: Inductee[] = (data || []).map(row => ({
    id: row.id,
    full_name: row.full_name,
    role: row.role || 'Field Tech',
    created_at: row.created_at,
    induction_progress: row.induction_progress || {},
  }));

  return NextResponse.json({ inductees });
}
