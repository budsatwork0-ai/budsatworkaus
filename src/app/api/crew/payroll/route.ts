import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

// Sensitive fields stored in this table — protected by RLS.
// Never log raw TFN, BSB, or account numbers.

const PAYROLL_SELECT = [
  'id', 'employment_type',
  'right_to_work_type', 'right_to_work_visa_subclass', 'right_to_work_expiry',
  'tfn',
  'bank_bsb', 'bank_account_number', 'bank_account_name', 'bank_institution',
  'super_fund_name', 'super_usi', 'super_member_number',
  'tfn_declaration_received', 'bank_details_received', 'super_details_received', 'right_to_work_confirmed',
  'updated_at',
].join(', ');

const VALID_EMPLOYMENT_TYPES = ['casual', 'contractor', 'volunteer', 'trainee', 'part_time', 'full_time'];
const VALID_RIGHT_TO_WORK_TYPES = ['citizen', 'permanent_resident', 'work_visa', 'other'];

// GET /api/crew/payroll
// Returns the employee's own payroll details (all fields, protected by RLS).
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) return NextResponse.json({ payroll: null });

  const { data: payroll, error } = await db
    .from('employee_payroll_details')
    .select(PAYROLL_SELECT)
    .eq('employee_id', employee.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payroll: payroll || null });
}

// POST /api/crew/payroll
// Upserts payroll/employment details for the authenticated employee.
// Boolean flags are auto-derived from the presence of real data.
export async function POST(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'employee' && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.employment_type != null && !VALID_EMPLOYMENT_TYPES.includes(body.employment_type as string)) {
    return NextResponse.json({ error: 'Invalid employment_type' }, { status: 400 });
  }
  if (body.right_to_work_type != null && !VALID_RIGHT_TO_WORK_TYPES.includes(body.right_to_work_type as string)) {
    return NextResponse.json({ error: 'Invalid right_to_work_type' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', authUser.id)
    .single();

  if (!employee) return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });

  // Allowed fields — never accept arbitrary columns from the body
  const textFields = [
    'employment_type',
    'right_to_work_type', 'right_to_work_visa_subclass',
    'tfn',
    'bank_bsb', 'bank_account_number', 'bank_account_name', 'bank_institution',
    'super_fund_name', 'super_usi', 'super_member_number',
  ] as const;
  const dateFields = ['right_to_work_expiry'] as const;

  const payload: Record<string, unknown> = {
    employee_id: employee.id,
    updated_at: new Date().toISOString(),
  };

  for (const field of textFields) {
    if (field in body) payload[field] = (body[field] as string)?.trim() || null;
  }
  for (const field of dateFields) {
    if (field in body) payload[field] = body[field] || null;
  }

  // Auto-derive legacy boolean flags from actual data
  if ('tfn' in body) payload.tfn_declaration_received = Boolean(payload.tfn);
  if ('bank_account_number' in body) payload.bank_details_received = Boolean(payload.bank_account_number);
  if ('super_fund_name' in body) payload.super_details_received = Boolean(payload.super_fund_name);
  if ('right_to_work_type' in body) payload.right_to_work_confirmed = Boolean(payload.right_to_work_type);

  const { data: payroll, error } = await db
    .from('employee_payroll_details')
    .upsert(payload, { onConflict: 'employee_id' })
    .select(PAYROLL_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payroll });
}
