/**
 * POST /api/bud/authority
 * Body: { ceiling: BudAuthorityLevel }
 * Persists the operator-chosen authority ceiling for Bud OS.
 * Role-gated to admin/owner. Stored in an HttpOnly cookie that the
 * server reads in mission-control's loadData.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth';
import { AUTHORITY_LABELS, BUD_AUTHORITY_COOKIE, type BudAuthorityLevel } from '@/lib/bud/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_LEVELS: BudAuthorityLevel[] = [
  'L0_OBSERVER',
  'L1_ASSISTANT',
  'L2_OPERATOR',
  'L3_AUTONOMOUS_OPERATOR',
  'L4_SELF_EVOLVING_SYSTEM',
];

export async function GET() {
  const store = await cookies();
  const value = store.get(BUD_AUTHORITY_COOKIE)?.value as BudAuthorityLevel | undefined;
  return NextResponse.json({ ceiling: value ?? null });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { ceiling?: string };
  const ceiling = body.ceiling as BudAuthorityLevel | undefined;
  if (!ceiling || !ALLOWED_LEVELS.includes(ceiling)) {
    return NextResponse.json({ error: 'invalid ceiling' }, { status: 400 });
  }

  const store = await cookies();
  store.set({
    name: BUD_AUTHORITY_COOKIE,
    value: ceiling,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return NextResponse.json({ ok: true, ceiling, label: AUTHORITY_LABELS[ceiling] });
}
