import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { scoreMatch } from '@/lib/ndis/matching';
import type { ParticipantSupportProfile, JobRequirements } from '@/types/ndis';

type Params = { params: Promise<{ orderId: string }> };

async function requireAdmin(authUser: { id: string } | null, client: ReturnType<typeof createServiceClientSafe>) {
  if (!authUser) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (client as any)
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();
  return data?.role === 'admin';
}

// GET /api/ndis/jobs/[orderId]/matches
// Computes (or retrieves cached) match scores for all participants against this job.
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  if (!await requireAdmin(authUser, client)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Load job requirements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requirements } = await (client as any)
    .from('job_requirements')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!requirements) {
    return NextResponse.json({ error: 'Job requirements not configured. Set up requirements first.' }, { status: 422 });
  }

  // Load all active employees with support profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employees, error: empError } = await (client as any)
    .from('employees')
    .select(`
      id, full_name, email, suburb, services, ndis_worker, status,
      participant_support_profiles (*)
    `)
    .eq('status', 'active')
    .order('full_name');

  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });

  // Load existing publications for this job to show current state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: publications } = await (client as any)
    .from('job_publications')
    .select('employee_id, status')
    .eq('order_id', orderId);

  const pubMap: Record<string, string> = {};
  for (const p of publications ?? []) {
    pubMap[p.employee_id] = p.status;
  }

  // Compute match scores
  const matches = [];

  for (const emp of employees ?? []) {
    const rawProfiles = emp.participant_support_profiles;
    const supportProfile: ParticipantSupportProfile | null = Array.isArray(rawProfiles)
      ? (rawProfiles[0] ?? null)
      : null;

    const { score, max_score, reasons, flags } = supportProfile
      ? scoreMatch(supportProfile, requirements as JobRequirements)
      : { score: 0, max_score: 100, reasons: [], flags: [] };

    matches.push({
      employee_id: emp.id,
      employee: {
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        suburb: emp.suburb,
        services: emp.services,
        ndis_worker: emp.ndis_worker,
      },
      support_profile: supportProfile,
      score,
      max_score,
      reasons,
      flags,
      has_profile: supportProfile !== null,
      publication_status: pubMap[emp.id] ?? null,
    });
  }

  // Sort by score desc, then name
  matches.sort((a, b) => b.score - a.score || a.employee.full_name.localeCompare(b.employee.full_name));

  // Persist scores to job_participant_matches for record-keeping
  if (matches.length > 0) {
    const upsertRows = matches.map((m) => ({
      order_id: orderId,
      employee_id: m.employee_id,
      score: m.score,
      max_score: m.max_score,
      reasons: m.reasons,
      flags: m.flags,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('job_participant_matches')
      .upsert(upsertRows, { onConflict: 'order_id,employee_id' });
  }

  return NextResponse.json({ matches, requirements });
}
