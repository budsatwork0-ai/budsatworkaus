import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: { stepKey: string; value: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { stepKey, value } = body;
  if (typeof stepKey !== 'string' || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'stepKey (string) and value (boolean) are required' }, { status: 400 });
  }

  // Fetch current progress
  const { data: existing, error: fetchError } = await client
    .from('applicants')
    .select('induction_progress')
    .eq('id', params.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
  }

  const updatedProgress = {
    ...((existing.induction_progress as Record<string, boolean>) || {}),
    [stepKey]: value,
  };

  const { error: updateError } = await client
    .from('applicants')
    .update({ induction_progress: updatedProgress })
    .eq('id', params.id);

  if (updateError) {
    console.error('Induction PATCH error:', updateError);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }

  return NextResponse.json({ induction_progress: updatedProgress });
}
