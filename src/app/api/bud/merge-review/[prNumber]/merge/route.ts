/**
 * POST /api/bud/merge-review/[prNumber]/merge
 *
 * Bud merges a PR directly. The operator approved the promotion — Bud handles
 * the actual merge so the operator never touches GitHub.
 *
 * Guardrails: will not merge a draft, a PR with failing CI, or one already merged.
 * Uses squash merge so the main branch history stays clean.
 *
 * Admin/owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { mergePR, getPRDetails } from '@/lib/bud/github-executor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface MergeResult {
  merged: boolean;
  sha: string;
  prNumber: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ prNumber: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { prNumber: prNumberStr } = await params;
  const prNumber = parseInt(prNumberStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    return NextResponse.json({ error: 'Invalid PR number' }, { status: 400 });
  }

  const details = await getPRDetails(prNumber);
  if (!details) {
    return NextResponse.json(
      { error: 'PR not found or GitHub not configured' },
      { status: 404 },
    );
  }
  if (details.state === 'merged') {
    return NextResponse.json({ error: 'PR is already merged' }, { status: 409 });
  }
  if (details.state === 'closed') {
    return NextResponse.json({ error: 'PR is closed' }, { status: 409 });
  }
  if (details.isDraft) {
    return NextResponse.json(
      { error: 'Cannot promote a draft — the improvement is not ready' },
      { status: 422 },
    );
  }
  if (details.ciStatus === 'failure') {
    return NextResponse.json(
      { error: 'Cannot promote — automated checks are failing' },
      { status: 422 },
    );
  }

  try {
    const body = await req.json().catch(() => ({})) as { commitMessage?: string };
    const { sha } = await mergePR(prNumber, undefined, body.commitMessage);
    return NextResponse.json({ merged: true, sha, prNumber } satisfies MergeResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
