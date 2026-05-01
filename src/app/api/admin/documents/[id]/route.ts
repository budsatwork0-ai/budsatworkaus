import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'expired'];

// PATCH /api/admin/documents/[id]
// Admin updates a document: status, reviewer notes, and/or expiry date.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  let body: { status?: string; notes?: string; expires_at?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    patch.status = body.status;
    patch.reviewed_by = authUser.email || authUser.id;
    patch.reviewed_at = new Date().toISOString();
  }
  if ('notes' in body) patch.notes = body.notes ?? null;
  if ('expires_at' in body) patch.expires_at = body.expires_at ?? null;

  const { data: document, error } = await db
    .from('employee_documents')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  return NextResponse.json({ document });
}
