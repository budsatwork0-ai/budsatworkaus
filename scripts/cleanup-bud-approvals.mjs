#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) continue;
    const key = trimmed.slice(0, firstEquals).trim();
    let value = trimmed.slice(firstEquals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = process.env[key] ?? value;
  }
}

function hasExecutionProof(row) {
  const payload = row.payload ?? {};
  const task = Array.isArray(row.bud_tasks) ? row.bud_tasks[0] : row.bud_tasks;
  return Boolean(
    task?.linked_pr ||
    payload.pr_url ||
    payload.pull_request_url ||
    payload.diff ||
    payload.diff_summary ||
    payload.patch,
  );
}

function classify(row, nowMs = Date.now()) {
  if (row.status === 'archived') return 'Archived';
  if (row.status === 'blocked') return 'Blocked';
  if (row.status !== 'pending') return 'Archived';

  const task = Array.isArray(row.bud_tasks) ? row.bud_tasks[0] : row.bud_tasks;
  const createdAt = new Date(row.created_at).getTime();
  const stale = Number.isFinite(createdAt) && nowMs - createdAt > 24 * 3600_000;
  const closedTask = ['archived', 'completed'].includes(task?.status ?? '');
  const highRiskWithoutProof = ['high', 'critical'].includes(task?.risk_level ?? '') && !hasExecutionProof(row);

  if (stale && (closedTask || highRiskWithoutProof)) return 'Blocked';
  if (highRiskWithoutProof) return 'Needs manual review';
  return 'Actionable';
}

export function blockedReason(row) {
  const task = Array.isArray(row.bud_tasks) ? row.bud_tasks[0] : row.bud_tasks;
  if (['archived', 'completed'].includes(task?.status ?? '')) {
    return `Blocked historical approval: linked task is ${task.status}.`;
  }
  return 'Blocked historical approval: stale high-risk approval without PR, diff, patch, or linked pull request proof.';
}

export function summarize(rows) {
  const counts = {
    actionable_pending: 0,
    needs_manual_review: 0,
    blocked_historical: 0,
    archived_stale: 0,
    pending_bud_approvals: 0,
  };
  for (const row of rows) {
    if (row.status === 'pending') counts.pending_bud_approvals += 1;
    const label = classify(row);
    if (label === 'Actionable') counts.actionable_pending += 1;
    if (label === 'Needs manual review') counts.needs_manual_review += 1;
    if (label === 'Blocked') counts.blocked_historical += 1;
    if (label === 'Archived') counts.archived_stale += 1;
  }
  return counts;
}

export function cleanupProjection(rows, now = new Date().toISOString()) {
  const candidates = rows.filter((row) => row.status === 'pending' && classify(row) === 'Blocked');
  const candidateIds = new Set(candidates.map((row) => row.id));
  const projected = rows.map((row) => {
    if (!candidateIds.has(row.id)) return row;
    const next = {
      ...row,
      status: 'blocked',
      blocked_reason: row.blocked_reason ?? blockedReason(row),
    };
    if ('blocked_at' in row) next.blocked_at = row.blocked_at ?? now;
    return next;
  });
  return { candidates, projected };
}

function printCounts(title, counts, pendingAgentActions) {
  console.log(title);
  console.log(`  actionable_pending: ${counts.actionable_pending + pendingAgentActions}`);
  console.log(`  needs_manual_review: ${counts.needs_manual_review}`);
  console.log(`  blocked_historical: ${counts.blocked_historical}`);
  console.log(`  archived_stale: ${counts.archived_stale}`);
  console.log(`  pending_bud_approvals: ${counts.pending_bud_approvals}`);
  console.log(`  pending_agent_actions: ${pendingAgentActions}`);
}

async function main() {
  loadEnv();
  const apply = process.argv.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: approvals, error } = await supabase
    .from('bud_approval_queue')
    .select('id, task_id, action_type, payload, status, created_at, bud_tasks(id, status, risk_level, linked_pr)')
    .in('status', ['pending', 'archived', 'blocked'])
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load bud approvals: ${error.message}`);

  const { count: pendingAgentActions = 0, error: agentError } = await supabase
    .from('agent_actions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (agentError) throw new Error(`Failed to count pending agent actions: ${agentError.message}`);

  const before = summarize(approvals ?? []);
  const { candidates, projected } = cleanupProjection(approvals ?? []);

  printCounts('Before', before, pendingAgentActions ?? 0);
  console.log(`Dry-run count: ${candidates.length}`);
  console.log(`Candidates to block: ${candidates.length}`);
  for (const row of candidates.slice(0, 20)) {
    console.log(`  ${row.id} ${row.action_type} - ${blockedReason(row)}`);
  }
  if (candidates.length > 20) console.log(`  ...${candidates.length - 20} more`);

  if (apply && candidates.length > 0) {
    const blockedAt = new Date().toISOString();
    let applied = 0;
    for (const row of candidates) {
      const { error: updateError } = await supabase
        .from('bud_approval_queue')
        .update({
          status: 'blocked',
          blocked_at: blockedAt,
          blocked_reason: row.blocked_reason ?? blockedReason(row),
        })
        .eq('id', row.id)
        .eq('status', 'pending');
      if (updateError) throw new Error(`Failed to block ${row.id}: ${updateError.message}`);
      applied++;
    }
    console.log(`Applied count: ${applied}`);
    const { data: afterRows, error: afterError } = await supabase
      .from('bud_approval_queue')
      .select('id, task_id, action_type, payload, status, created_at, bud_tasks(id, status, risk_level, linked_pr)')
      .in('status', ['pending', 'archived', 'blocked'])
      .order('created_at', { ascending: false });
    if (afterError) throw new Error(`Failed to reload after cleanup: ${afterError.message}`);
    printCounts('After', summarize(afterRows ?? []), pendingAgentActions ?? 0);
    return;
  }

  console.log('Applied count: 0');
  printCounts(apply ? 'After' : 'Projected after dry-run', summarize(projected), pendingAgentActions ?? 0);
  if (!apply) console.log('Dry run only. Re-run with --apply after migration 083 is applied.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
