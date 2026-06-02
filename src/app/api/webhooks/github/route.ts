/**
 * GitHub webhook handler.
 *
 * Events handled:
 *   pull_request      → PR notes in Dev/PRs/
 *   push              → implementation journal entries in Dev/Journal/
 *   deployment_status → deployment logs in Dev/Deployments/
 *   release           → changelog entries in Dev/Releases/
 *
 * All events are persisted to:
 *   1. github_events table (raw delivery log + derived metadata)
 *   2. memory_documents via writeMemory() → syncs to Obsidian vault
 *
 * Signature verification uses GITHUB_WEBHOOK_SECRET (HMAC-SHA256).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { writeMemory } from '@/lib/memory';
import {
  classifyPushCommits,
  classifyPR,
  changeTypeToMemoryCategory,
} from '@/lib/github/classifier';
import {
  formatPRNote,
  formatDeploymentNote,
  formatPushNote,
  formatReleaseNote,
} from '@/lib/github/formatter';
import type {
  PullRequestPayload,
  PushPayload,
  DeploymentStatusPayload,
  ReleasePayload,
  ProcessedPR,
  ProcessedDeployment,
  ProcessedPush,
} from '@/lib/github/types';

export const dynamic = 'force-dynamic';
// Needs Node.js runtime for crypto — not Edge compatible
export const runtime = 'nodejs';

// ── Type escape for tables not yet in generated Supabase types ─────────────
// Remove once `npx supabase gen types` is re-run after migration 050.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eventsDb(sb: ReturnType<typeof createServiceClient>): any {
  return (sb as unknown as { from(t: string): unknown }).from('github_events');
}

// ── Signature verification ────────────────────────────────────────────────────

async function verifySignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // Allow unsigned webhooks only in local dev (no secret set)
    if (process.env.NODE_ENV === 'development') return true;
    return false;
  }
  const sig = req.headers.get('x-hub-signature-256');
  if (!sig) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Event router ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const event = req.headers.get('x-github-event') ?? 'unknown';
  const deliveryId = req.headers.get('x-github-delivery') ?? crypto.randomUUID();

  const rawBody = await req.text();

  // Verify before doing anything else
  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse early so we can reject bad payloads quickly
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Return 200 immediately — processing is async
  const supabase = createServiceClient();

  // Log raw delivery
  await eventsDb(supabase).insert({
    delivery_id: deliveryId,
    event_type:  event,
    action:      (payload.action as string) ?? null,
    repo:        (payload.repository as { full_name?: string })?.full_name ?? null,
    status:      'received',
  });

  // Process in background (fire-and-forget)
  void processEvent(event, payload, deliveryId, supabase).catch((err) => {
    console.error('[github/webhook] processing error:', err);
  });

  return NextResponse.json({ ok: true, event, delivery_id: deliveryId });
}

// ── Main processor ────────────────────────────────────────────────────────────

async function processEvent(
  event: string,
  payload: Record<string, unknown>,
  deliveryId: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  try {
    switch (event) {
      case 'pull_request': await handlePullRequest(payload as unknown as PullRequestPayload, supabase); break;
      case 'push':         await handlePush(payload as unknown as PushPayload, supabase); break;
      case 'deployment_status': await handleDeploymentStatus(payload as unknown as DeploymentStatusPayload, deliveryId, supabase); break;
      case 'release':      await handleRelease(payload as unknown as ReleasePayload, supabase); break;
      default:
        // Silently ignore unhandled events
        return;
    }

    await eventsDb(supabase)
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);
  } catch (err) {
    await eventsDb(supabase)
      .update({ status: 'error', error_message: String(err) })
      .eq('delivery_id', deliveryId);
    throw err;
  }
}

// ── pull_request ──────────────────────────────────────────────────────────────

async function handlePullRequest(
  payload: PullRequestPayload,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const { action, pull_request: pr, repository } = payload;

  // Only care about meaningful state changes
  if (!['opened', 'closed', 'reopened'].includes(action)) return;

  const state: ProcessedPR['state'] =
    action === 'closed' && pr.merged ? 'merged' :
    action === 'closed'              ? 'closed' :
    'opened';

  const classification = classifyPR(
    pr.title,
    pr.body,
    pr.labels,
    pr.additions,
    pr.deletions,
  );

  const processed: ProcessedPR = {
    number:          pr.number,
    title:           pr.title,
    url:             pr.html_url,
    author:          pr.user.login,
    branch:          pr.head.ref,
    base:            pr.base.ref,
    state,
    classification,
    additions:       pr.additions,
    deletions:       pr.deletions,
    changedFiles:    pr.changed_files,
    commits:         pr.commits,
    labels:          pr.labels.map((l) => l.name),
    body:            pr.body ?? '',
    mergedAt:        pr.merged_at,
    mergeCommitSha:  pr.merge_commit_sha,
    repo:            repository.full_name,
  };

  const note     = formatPRNote(processed);
  const category = changeTypeToMemoryCategory(classification.primary);

  await writeMemory(
    supabase,
    {
      category,
      title:     note.title,
      body:      note.body,
      tags:      note.tags,
      agentScope: 'github-historian',
      vaultPath: note.vaultPath,
      source:    'agent',
    },
    { allowSoftDuplicate: true, status: 'active', agentId: 'github-historian' },
  );

  // If merged and architectural, flag for ADR review
  if (state === 'merged' && classification.isArchitectural) {
    await eventsDb(supabase).insert({
      delivery_id:  `adr-flag-${pr.number}`,
      event_type:   'adr_flag',
      action:       'review_needed',
      repo:         repository.full_name,
      metadata: {
        pr_number:    pr.number,
        pr_title:     pr.title,
        affected_systems: classification.affectedSystems,
        note:         'Merged PR touches architectural components. ADR may need updating.',
      },
      status: 'pending',
    });
  }
}

// ── push ──────────────────────────────────────────────────────────────────────

async function handlePush(
  payload: PushPayload,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  // Only track pushes to the default branch
  const defaultBranch = payload.repository.default_branch;
  const pushedBranch  = payload.ref.replace('refs/heads/', '');
  if (pushedBranch !== defaultBranch) return;
  if (!payload.commits?.length) return;

  const classification = classifyPushCommits(payload.commits);

  const processed: ProcessedPush = {
    branch:      pushedBranch,
    sha:         payload.after,
    compareUrl:  payload.compare,
    commitCount: payload.commits.length,
    commits:     payload.commits,
    classification,
    author:      payload.head_commit?.author.name ?? payload.pusher.name,
    repo:        payload.repository.full_name,
    timestamp:   payload.head_commit?.timestamp ?? new Date().toISOString(),
  };

  const note     = formatPushNote(processed);
  const category = changeTypeToMemoryCategory(classification.primary);

  await writeMemory(
    supabase,
    {
      category,
      title:     note.title,
      body:      note.body,
      tags:      note.tags,
      agentScope: 'github-historian',
      vaultPath: note.vaultPath,
      source:    'agent',
    },
    { allowSoftDuplicate: true, status: 'active', agentId: 'github-historian' },
  );
}

// ── deployment_status ─────────────────────────────────────────────────────────

async function handleDeploymentStatus(
  payload: DeploymentStatusPayload,
  deliveryId: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const { deployment_status: ds, deployment, repository } = payload;

  // Only log terminal states
  if (!['success', 'failure', 'error'].includes(ds.state)) return;

  const processed: ProcessedDeployment = {
    environment: ds.environment,
    state:       ds.state,
    sha:         deployment.sha,
    branch:      deployment.ref,
    url:         ds.target_url,
    description: ds.description,
    timestamp:   ds.created_at,
    repo:        repository.full_name,
  };

  const note = formatDeploymentNote(processed);

  await eventsDb(supabase)
    .update({
      action: ds.state,
      repo: repository.full_name,
      metadata: {
        sha: deployment.sha,
        branch: deployment.ref,
        environment: ds.environment,
        target_url: ds.target_url,
        url: ds.target_url,
        description: ds.description,
      },
    })
    .eq('delivery_id', deliveryId);

  await writeMemory(
    supabase,
    {
      category:   'deployments',
      title:      note.title,
      body:       note.body,
      tags:       note.tags,
      agentScope: 'github-historian',
      vaultPath:  note.vaultPath,
      source:     'agent',
    },
    { allowSoftDuplicate: true, status: 'active', agentId: 'github-historian' },
  );

  // Log failures to an operational table for foreman visibility
  if (ds.state === 'failure' || ds.state === 'error') {
    await eventsDb(supabase).insert({
      delivery_id:  `deploy-fail-${deployment.sha.slice(0, 7)}-${Date.now()}`,
      event_type:   'deployment_failure',
      action:       ds.state,
      repo:         repository.full_name,
      metadata: {
        sha:         deployment.sha,
        branch:      deployment.ref,
        environment: ds.environment,
        url:         ds.target_url,
        description: ds.description,
      },
      status: 'flagged',
    });
  }
}

// ── release ───────────────────────────────────────────────────────────────────

async function handleRelease(
  payload: ReleasePayload,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  if (payload.action !== 'published') return;
  const { release, repository } = payload;
  if (release.draft) return;

  const note = formatReleaseNote({
    tag:         release.tag_name,
    name:        release.name ?? '',
    body:        release.body ?? '',
    url:         release.html_url,
    author:      release.author.login,
    publishedAt: release.published_at,
    repo:        repository.full_name,
  });

  await writeMemory(
    supabase,
    {
      category:   'architecture',
      title:      note.title,
      body:       note.body,
      tags:       note.tags,
      agentScope: 'github-historian',
      vaultPath:  note.vaultPath,
      source:     'agent',
    },
    { allowSoftDuplicate: false, status: 'active', agentId: 'github-historian' },
  );
}
