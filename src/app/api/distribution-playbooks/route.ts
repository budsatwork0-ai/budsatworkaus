import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { type DistributionPlaybookStatus } from '@/types/distribution-playbook';

const STATUSES = new Set<DistributionPlaybookStatus>(['active', 'draft', 'archived']);

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

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('marketing_distribution_playbooks')
    .select('*')
    .order('status')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api/distribution-playbooks] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch distribution playbooks' }, { status: 500 });
  }

  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(req: NextRequest) {
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

  const title = cleanText(body.title);
  const status = (cleanText(body.status) || 'draft') as DistributionPlaybookStatus;
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });

  const insert = {
    title,
    description:         cleanText(body.description),
    content_type:        cleanText(body.content_type),
    primary_platform:    cleanText(body.primary_platform),
    secondary_platforms: cleanTextArray(body.secondary_platforms),
    steps:               cleanTextArray(body.steps),
    checklist:           cleanTextArray(body.checklist),
    linked_campaign_id:  cleanNullableText(body.linked_campaign_id),
    status,
    notes:               cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('marketing_distribution_playbooks')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/distribution-playbooks] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create distribution playbook' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
