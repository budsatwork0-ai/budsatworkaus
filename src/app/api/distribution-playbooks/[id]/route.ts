import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type DistributionPlaybookStatus } from '@/types/distribution-playbook';

const UPDATABLE = [
  'title',
  'description',
  'content_type',
  'primary_platform',
  'secondary_platforms',
  'steps',
  'checklist',
  'linked_campaign_id',
  'status',
  'notes',
] as const;

const STATUSES = new Set<DistributionPlaybookStatus>(['active', 'draft', 'archived']);

type RouteParams = { params: Promise<{ id: string }> };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function cleanTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean) : [];
}

async function requireAdmin() {
  const authUser = await getAuthUser();
  if (!authUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (authUser.role !== 'admin') return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { authUser };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_distribution_playbooks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Distribution playbook not found' }, { status: 404 });
    console.error('[api/distribution-playbooks/[id]] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch distribution playbook' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of UPDATABLE) {
    if (!(key in body)) continue;
    if (key === 'linked_campaign_id') update[key] = cleanNullableText(body[key]);
    else if (key === 'secondary_platforms' || key === 'steps' || key === 'checklist') update[key] = cleanTextArray(body[key]);
    else update[key] = cleanText(body[key]);
  }

  if (typeof update.status === 'string' && !STATUSES.has(update.status as DistributionPlaybookStatus)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('marketing_distribution_playbooks')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Distribution playbook not found' }, { status: 404 });
    console.error('[api/distribution-playbooks/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update distribution playbook' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { error } = await (client as any)
    .from('marketing_distribution_playbooks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[api/distribution-playbooks/[id]] DELETE:', error.message);
    return NextResponse.json({ error: 'Failed to delete distribution playbook' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
