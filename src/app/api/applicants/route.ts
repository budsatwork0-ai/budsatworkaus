/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildEmployeeOnboardingSnapshot } from '@/lib/crew-onboarding';
import { ONBOARDING_SECTION_LABELS } from '@/types/crew';
import type { ApplicantInsert } from '@/types/database';
import { getAuthUser } from '@/lib/auth';

// GET /api/applicants - List applicants with optional filters
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin' && authUser.role !== 'employee') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage');
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Note: cast to 'any' until `supabase gen types` is re-run after migration 005
  let query = (client as any)
    .from('applicants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage && stage !== 'all') {
    query = query.eq('stage', stage);
  }
  if (role && role !== 'all') {
    query = query.eq('role', role);
  }
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,suburb.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const applicants = data || [];
  const crewRoles = new Set(['Casual crew', 'Support worker']);
  const linkedUserIds = applicants
    .filter((applicant: { role?: string; user_id?: string | null }) => crewRoles.has(applicant.role || '') && applicant.user_id)
    .map((applicant: { user_id?: string | null }) => applicant.user_id as string);

  let employeesByUserId = new Map<string, {
    id: string;
    user_id: string;
    ndis_worker: boolean;
    onboarding_complete: boolean;
    crew_access_approved: boolean;
    status: string;
  }>();
  const sectionsByEmployee = new Map<string, Array<{ section: string; completed: boolean }>>();
  const docsByEmployee = new Map<string, Array<{
    doc_type: string;
    file_url?: string | null;
    file_name?: string | null;
    status?: string | null;
    created_at?: string;
    expires_at?: string | null;
  }>>();

  if (linkedUserIds.length > 0) {
    const { data: employees } = await (client as any)
      .from('employees')
      .select('id, user_id, ndis_worker, onboarding_complete, crew_access_approved, status')
      .in('user_id', linkedUserIds);

    employeesByUserId = new Map(
      (employees || []).map((employee: {
        id: string;
        user_id: string;
        ndis_worker: boolean;
        onboarding_complete: boolean;
        crew_access_approved: boolean;
        status: string;
      }) => [employee.user_id, employee])
    );

    const employeeIds = (employees || []).map((employee: { id: string }) => employee.id);
    if (employeeIds.length > 0) {
      const [{ data: sections }, { data: documents }] = await Promise.all([
        (client as any)
          .from('employee_onboarding')
          .select('employee_id, section, completed')
          .in('employee_id', employeeIds),
        (client as any)
          .from('employee_documents')
          .select('employee_id, doc_type, file_url, file_name, status, created_at, expires_at')
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false }),
      ]);

      for (const section of sections || []) {
        const list = sectionsByEmployee.get(section.employee_id) || [];
        list.push({ section: section.section, completed: section.completed });
        sectionsByEmployee.set(section.employee_id, list);
      }

      for (const document of documents || []) {
        const list = docsByEmployee.get(document.employee_id) || [];
        list.push(document);
        docsByEmployee.set(document.employee_id, list);
      }
    }
  }

  const enrichedApplicants = applicants.map((applicant: { role?: string; user_id?: string | null }) => {
    if (!crewRoles.has(applicant.role || '') || !applicant.user_id) {
      return applicant;
    }

    const employee = employeesByUserId.get(applicant.user_id);
    if (!employee) {
      return applicant;
    }

    const snapshot = buildEmployeeOnboardingSnapshot({
      employee,
      sections: sectionsByEmployee.get(employee.id) || [],
      documents: docsByEmployee.get(employee.id) || [],
    });

    return {
      ...applicant,
      employee_id: employee.id,
      onboarding: {
        ...snapshot,
        currentSectionLabel: snapshot.currentSection ? ONBOARDING_SECTION_LABELS[snapshot.currentSection] : null,
        crewPortalEnabled: snapshot.onboardingComplete && snapshot.crewAccessApproved && employee.status === 'active',
      },
    };
  });

  return NextResponse.json({ applicants: enrichedApplicants, total: count });
}

// POST /api/applicants - Create a new applicant from the Get Involved form
export async function POST(req: NextRequest) {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: ApplicantInsert;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
  }
  if (!body.email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (!body.role?.trim()) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 });
  }

  const validRoles = ['Casual crew', 'Support worker', 'Quality partner', 'Innovation partner', 'Sponsor'];
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('applicants')
    .insert({
      ...body,
      stage: 'intake',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applicant: data }, { status: 201 });
}
