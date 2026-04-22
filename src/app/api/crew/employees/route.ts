/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { buildEmployeeOnboardingSnapshot } from '@/lib/crew-onboarding';
import { ONBOARDING_SECTION_LABELS } from '@/types/crew';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/crew/employees - List all employees with their auth role (admin use)
export async function GET() {
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

  const { data: employees, error } = await (client as any)
    .from('employees')
    .select('id, user_id, full_name, email, services, suburb, status, onboarding_complete, crew_access_approved, ndis_worker, hourly_rate, default_role, employment_type, roster_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profile roles for employees that have a linked auth user
  const userIds = (employees || []).filter((e: any) => e.user_id).map((e: any) => e.user_id);
  let roleMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await (client as any)
      .from('profiles')
      .select('id, role')
      .in('id', userIds);
    roleMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.role]));
  }

  const employeeIds = (employees || []).map((e: any) => e.id);
  let sectionsByEmployee = new Map<string, Array<{ section: string; completed: boolean }>>();
  let docsByEmployee = new Map<string, Array<{ doc_type: string; file_url?: string | null; file_name?: string | null; status?: string | null; created_at?: string; expires_at?: string | null }>>();

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

    sectionsByEmployee = new Map<string, Array<{ section: string; completed: boolean }>>();
    for (const section of sections || []) {
      const list = sectionsByEmployee.get(section.employee_id) || [];
      list.push({ section: section.section, completed: section.completed });
      sectionsByEmployee.set(section.employee_id, list);
    }

    docsByEmployee = new Map<string, Array<{ doc_type: string; file_url?: string | null; file_name?: string | null; status?: string | null; created_at?: string; expires_at?: string | null }>>();
    for (const document of documents || []) {
      const list = docsByEmployee.get(document.employee_id) || [];
      list.push(document);
      docsByEmployee.set(document.employee_id, list);
    }
  }

  const enriched = (employees || []).map((e: any) => {
    const snapshot = buildEmployeeOnboardingSnapshot({
      employee: e,
      sections: sectionsByEmployee.get(e.id) || [],
      documents: docsByEmployee.get(e.id) || [],
    });

    return {
      ...e,
      role: e.user_id ? (roleMap[e.user_id] ?? 'employee') : null,
      ...snapshot,
      currentSectionLabel: snapshot.currentSection ? ONBOARDING_SECTION_LABELS[snapshot.currentSection] : null,
      crewPortalEnabled: snapshot.onboardingComplete && snapshot.crewAccessApproved && e.status === 'active',
      canApproveCrewAccess: snapshot.readyForCrewApproval && e.user_id,
    };
  });

  return NextResponse.json({ employees: enriched });
}
