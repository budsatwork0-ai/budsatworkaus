import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

type RouteParams = { params: Promise<{ section: string }> };

const REQUIRED_DOCS = ['wwcc', 'police_check', 'first_aid'];
const NDIS_DOCS = ['ndis_screening'];

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

async function validateSectionCompletion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  employeeId: string,
  section: string,
  responses: Record<string, unknown>,
  ndisWorker: boolean
) {
  if (section === 'personal') {
    const valid =
      isNonEmptyString(responses.full_name) &&
      isNonEmptyString(responses.phone) &&
      isNonEmptyString(responses.suburb) &&
      isNonEmptyString(responses.photo_url);
    return valid
      ? { valid: true }
      : { valid: false, message: 'Personal details require name, phone, suburb, and photo URL.' };
  }

  if (section === 'emergency') {
    const valid =
      isNonEmptyString(responses.emergency_contact_name) &&
      isNonEmptyString(responses.emergency_contact_phone);
    return valid
      ? { valid: true }
      : { valid: false, message: 'Emergency section requires contact name and phone.' };
  }

  if (section === 'availability') {
    const valid = asStringArray(responses.availability).length > 0;
    return valid
      ? { valid: true }
      : { valid: false, message: 'Select at least one availability slot.' };
  }

  if (section === 'services') {
    const valid = asStringArray(responses.services).length > 0;
    return valid
      ? { valid: true }
      : { valid: false, message: 'Select at least one service skill before completing this step.' };
  }

  if (section === 'documents') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docs } = await (client as any)
      .from('employee_documents')
      .select('doc_type')
      .eq('employee_id', employeeId);

    const uploaded = new Set((docs || []).map((d: { doc_type: string }) => d.doc_type));
    const required = [...REQUIRED_DOCS, ...(ndisWorker ? NDIS_DOCS : [])];
    const missing = required.filter((doc) => !uploaded.has(doc));

    return missing.length === 0
      ? { valid: true }
      : { valid: false, message: `Missing required documents: ${missing.join(', ')}` };
  }

  if (section === 'ndis') {
    const valid =
      isNonEmptyString(responses.screening_number) &&
      isNonEmptyString(responses.screening_expiry) &&
      responses.code_of_conduct === true;
    return valid
      ? { valid: true }
      : { valid: false, message: 'NDIS section requires screening details and code of conduct acknowledgement.' };
  }

  return { valid: true };
}

// GET /api/crew/onboarding/[section] - Get section responses
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const { section } = await params;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (client as any)
    .from('employee_onboarding')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('section', section)
    .maybeSingle();

  return NextResponse.json({ onboarding: data || { section, responses: {}, completed: false } });
}

// PUT /api/crew/onboarding/[section] - Save/update section responses
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const { section } = await params;
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id, ndis_worker')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }

  let body: { responses: Record<string, unknown>; completed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const requestedComplete = Boolean(body.completed);
  const ndisWorkerFlag = Boolean(employee.ndis_worker || body.responses?.ndis_worker || section === 'ndis');
  if (requestedComplete) {
    const result = await validateSectionCompletion(
      client,
      employee.id,
      section,
      body.responses || {},
      ndisWorkerFlag
    );
    if (!result.valid) {
      return NextResponse.json({ error: result.message || 'Section is incomplete' }, { status: 400 });
    }
  }

  // Upsert onboarding section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('employee_onboarding')
    .upsert(
      {
        employee_id: employee.id,
        section,
        responses: body.responses || {},
        completed: requestedComplete,
      },
      { onConflict: 'employee_id,section' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Keep employee profile in sync as users save drafts or complete sections.
  const profileUpdates: Record<string, unknown> = {};
  const responses = body.responses || {};

  if (section === 'personal') {
    if (responses.full_name) profileUpdates.full_name = responses.full_name;
    if (responses.phone) profileUpdates.phone = responses.phone;
    if (responses.suburb) profileUpdates.suburb = responses.suburb;
    if (responses.photo_url) profileUpdates.photo_url = responses.photo_url;
  }
  if (section === 'emergency') {
    if (responses.emergency_contact_name) profileUpdates.emergency_contact_name = responses.emergency_contact_name;
    if (responses.emergency_contact_phone) profileUpdates.emergency_contact_phone = responses.emergency_contact_phone;
  }
  if (section === 'availability' && responses.availability) {
    profileUpdates.availability = responses.availability;
  }
  if (section === 'services') {
    if (responses.services) profileUpdates.services = responses.services;
    if (responses.ndis_worker === true) profileUpdates.ndis_worker = true;
  }
  if (section === 'ndis') {
    profileUpdates.ndis_worker = true;
  }

  if (Object.keys(profileUpdates).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('employees').update(profileUpdates).eq('id', employee.id);
  }

  // Recompute onboarding completion strictly from required sections.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allSections } = await (client as any)
    .from('employee_onboarding')
    .select('section, completed')
    .eq('employee_id', employee.id);

  const completedBySection = new Map(
    (allSections || []).map((s: { section: string; completed: boolean }) => [s.section, s.completed])
  );
  const requiredSections = ['personal', 'emergency', 'availability', 'services', 'documents'];
  if (ndisWorkerFlag) requiredSections.push('ndis');

  const onboardingComplete = requiredSections.every((requiredSection) => completedBySection.get(requiredSection));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('employees')
    .update({
      onboarding_complete: onboardingComplete,
      status: onboardingComplete ? 'active' : 'inactive',
    })
    .eq('id', employee.id);

  return NextResponse.json({ onboarding: data, onboardingComplete });
}
