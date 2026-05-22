/**
 * POST /api/webhooks/vercel
 *
 * Receives Vercel deployment webhooks. When a bud/* branch deployment fails,
 * it fetches the build logs, parses the error, and creates a repair signal so
 * the Autonomous Improvement Pipeline can fix itself.
 *
 * Setup:
 *   1. In Vercel → Project → Settings → Webhooks, add this endpoint URL.
 *   2. Set VERCEL_WEBHOOK_SECRET in env vars (optional but recommended).
 *   3. Set VERCEL_API_TOKEN (a Vercel personal access token) for log fetching.
 *   4. Set VERCEL_TEAM_ID if your project is in a team (optional).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VERCEL_WEBHOOK_SECRET = process.env.VERCEL_WEBHOOK_SECRET;
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

// Vercel sends these event types — we only care about deployment failures.
type VercelWebhookPayload = {
  type: string;
  payload: {
    deployment?: {
      id: string;
      name: string;
      url: string;
      meta?: {
        githubCommitRef?: string;
        githubCommitSha?: string;
        githubOrg?: string;
        githubRepo?: string;
      };
    };
    target?: string;
    links?: { deployment?: string; project?: string };
    team?: { id: string };
    project?: { id: string };
  };
};

async function fetchBuildLogs(deploymentId: string): Promise<string> {
  if (!VERCEL_API_TOKEN) return 'VERCEL_API_TOKEN not set — cannot fetch logs';

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  const res = await fetch(
    `https://api.vercel.com/v3/deployments/${deploymentId}/events${teamParam}`,
    {
      headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` },
    },
  );

  if (!res.ok) return `Failed to fetch logs (${res.status})`;

  type LogEvent = { type: string; payload?: { text?: string; info?: { message?: string } } };
  const events = await res.json() as LogEvent[];

  // Collect error-adjacent lines
  const errorLines = events
    .filter((e) => {
      const text = e.payload?.text ?? e.payload?.info?.message ?? '';
      return (
        text.includes('error') ||
        text.includes('Error') ||
        text.includes('Failed') ||
        text.includes('Type error') ||
        text.includes('Cannot find') ||
        text.includes('is not exported')
      );
    })
    .map((e) => e.payload?.text ?? e.payload?.info?.message ?? '')
    .slice(0, 30)
    .join('\n');

  return errorLines || 'No error lines found in build logs';
}

function extractErrorSummary(logs: string): { title: string; description: string; referenceFiles: string[] } {
  // Extract the key error — TypeScript type errors, module errors, import errors
  const lines = logs.split('\n').map((l) => l.trim()).filter(Boolean);

  const typeErrorLine = lines.find((l) => l.includes('Type error:') || l.includes('Attempted import error:'));
  const importLine = lines.find((l) => l.includes("import {") || l.includes("from '"));

  // Find referenced file paths
  const fileMentions = Array.from(
    new Set(
      logs.match(/(?:src\/[\w/./-]+\.(?:ts|tsx))/g) ?? [],
    ),
  ).slice(0, 3);

  const title = typeErrorLine?.slice(0, 120) ?? lines[0]?.slice(0, 120) ?? 'Build failed';
  const description = [
    typeErrorLine,
    importLine,
    ...lines.slice(0, 5),
  ].filter(Boolean).join('\n').slice(0, 800);

  return { title, description, referenceFiles: fileMentions };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Optional: verify Vercel webhook signature
  if (VERCEL_WEBHOOK_SECRET) {
    const signature = req.headers.get('x-vercel-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    // Vercel signs with HMAC-SHA1; for now we check the header exists.
    // Full verification requires the raw body and crypto.subtle — add if needed.
  }

  let body: VercelWebhookPayload;
  try {
    body = await req.json() as VercelWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle deployment error events
  if (body.type !== 'deployment.error' && body.type !== 'deployment-error') {
    return NextResponse.json({ ok: true, skipped: true, reason: `event type: ${body.type}` });
  }

  const deployment = body.payload?.deployment;
  const branch = deployment?.meta?.githubCommitRef ?? '';

  // Only act on bud/* branches (pipeline-generated branches)
  if (!branch.startsWith('bud/')) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not a bud/* branch' });
  }

  const deploymentId = deployment?.id ?? '';
  const deploymentUrl = deployment?.url ?? '';

  // Fetch build logs to understand the error
  const logs = deploymentId ? await fetchBuildLogs(deploymentId) : 'No deployment ID in payload';

  // Skip if we can't extract a real error — there's nothing for Bud to patch
  if (
    logs === 'No error lines found in build logs' ||
    logs.startsWith('Failed to fetch logs') ||
    logs.startsWith('VERCEL_API_TOKEN not set') ||
    logs.startsWith('No deployment ID')
  ) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no actionable error lines — cannot generate a repair signal', branch });
  }

  const { title, description, referenceFiles } = extractErrorSummary(logs);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Check kill-switch
  try {
    const { data: ks } = await supabase
      .from('pipeline_kill_switch').select('paused').eq('id', 1).single();
    if ((ks as { paused: boolean } | null)?.paused) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'kill switch active' });
    }
  } catch { /* non-fatal */ }

  // Dedup: skip if we already have a queued signal for this branch in the last hour
  const since1h = new Date(Date.now() - 3600_000).toISOString();
  const { data: existing } = await supabase
    .from('bud_improvement_signals')
    .select('id')
    .eq('signal_type', 'vercel_build_failure')
    .ilike('title', `%${branch}%`)
    .in('status', ['new', 'queued', 'executing'])
    .gte('created_at', since1h)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate signal in last hour' });
  }

  // Create a repair signal — the pipeline cron will pick this up and fix it
  const { data: signal, error } = await supabase
    .from('bud_improvement_signals')
    .insert({
      source: 'vercel_webhook',
      signal_type: 'vercel_build_failure',
      severity: 'high',
      title: `Vercel build failed on ${branch}: ${title.slice(0, 100)}`,
      description: [
        `Branch: ${branch}`,
        `Deployment: ${deploymentUrl}`,
        '',
        'Build error:',
        description,
        '',
        'Full error log excerpt:',
        logs.slice(0, 1200),
      ].join('\n'),
      affected_area: branch,
      proposed_approach: [
        'Read the affected files listed in the build error.',
        'Fix the TypeScript type error, missing export, or import mismatch.',
        'Commit the fix to the same branch so Vercel retries the build.',
        'Common fixes: use the correct export name from the module,',
        'remove await from synchronous functions, add missing type annotations.',
      ].join(' '),
      reference_files: referenceFiles.length > 0 ? referenceFiles : null,
      metadata: {
        deployment_id: deploymentId,
        deployment_url: deploymentUrl,
        branch,
        commit_sha: deployment?.meta?.githubCommitSha ?? null,
        log_excerpt: logs.slice(0, 2000),
      },
      status: 'queued',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[vercel-webhook] Failed to create repair signal:', error);
    return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
  }

  // Write activity feed entry
  await supabase.from('bud_activity_feed').insert({
    event_type: 'detection',
    narrative: `Vercel build failed on ${branch} — repair signal created. Error: ${title.slice(0, 120)}`,
    actor: 'vercel_webhook',
    target: branch,
    metadata: { signal_id: signal.id, deployment_id: deploymentId },
  });

  return NextResponse.json({ ok: true, signal_id: signal.id, branch });
}
