import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { classifyRootCause } from '../src/lib/bud/root-cause';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

type Json = Record<string, unknown>;

type SignalRow = {
  id: string;
  signal_type: string | null;
  title: string | null;
  description: string | null;
  affected_area: string | null;
  reference_files: string[] | null;
  root_cause_id: string | null;
  root_cause_key: string | null;
  created_at: string;
};

type ActionRow = {
  id: string;
  agent_id: string | null;
  action_type: string;
  preview: string | null;
  payload: Json | null;
  status: string;
  action_identity: string | null;
  root_cause_id: string | null;
  root_cause_key: string | null;
  initiative_id: string | null;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  action_type: string;
  payload: Json | null;
  status: string;
  task_id: string | null;
  root_cause_id: string | null;
  root_cause_key: string | null;
  initiative_id: string | null;
  created_at: string;
  bud_tasks?: {
    description?: string | null;
    source_agent?: string | null;
    raw_input?: Json | null;
  } | Array<{
    description?: string | null;
    source_agent?: string | null;
    raw_input?: Json | null;
  }> | null;
};

type InitiativeRow = {
  id: string;
  root_cause_id: string;
  root_cause_key: string;
  title: string;
  status: string;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function firstSignal(payload: Json | null | undefined): Json | null {
  const signals = payload?.signals;
  return Array.isArray(signals) && signals[0] && typeof signals[0] === 'object'
    ? signals[0] as Json
    : null;
}

function titleFor(rootCauseId: string, rootCauseKey: string): string {
  if (rootCauseKey === 'silent_success') return 'Fleet-Wide Output Semantics / Silent Success';
  if (rootCauseId === 'output_contract') return 'Agent Output Contract Enforcement';
  if (rootCauseId === 'customer_reply_routing') return 'Customer Reply Routing Readiness';
  if (rootCauseId === 'agent_config_missing') return 'Agent Configuration Readiness';
  if (rootCauseId === 'observability_gap') return 'Silent-Success Observability';
  return 'Agent Data Readiness';
}

function classifySignal(row: SignalRow) {
  return classifyRootCause({
    signalType: row.signal_type,
    title: row.title,
    description: row.description,
    affectedArea: row.affected_area,
    referenceFiles: row.reference_files,
  });
}

function classifyAction(row: ActionRow) {
  const signal = firstSignal(row.payload);
  return classifyRootCause({
    signalType: row.action_type,
    title: String(signal?.title ?? row.preview ?? ''),
    description: String(signal?.description ?? row.payload?.description ?? ''),
    affectedArea: String(signal?.affected_area ?? row.payload?.affected_area ?? row.agent_id ?? ''),
    metadata: row.payload,
  });
}

function classifyApproval(row: ApprovalRow) {
  const task = Array.isArray(row.bud_tasks) ? row.bud_tasks[0] : row.bud_tasks;
  const rawInput = task?.raw_input ?? {};
  const payload = { ...(row.payload ?? {}), ...rawInput };
  return classifyRootCause({
    signalType: row.action_type,
    title: String(payload.title ?? task?.description ?? row.action_type),
    description: String(payload.description ?? ''),
    affectedArea: String(payload.affected_area ?? task?.source_agent ?? ''),
    metadata: payload,
  });
}

async function checked<T>(label: string, promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
}

async function backfillSignals() {
  const rows = await checked<SignalRow[]>('read bud_improvement_signals',
    supabase.from('bud_improvement_signals')
      .select('id, signal_type, title, description, affected_area, reference_files, root_cause_id, root_cause_key, created_at')
      .is('root_cause_key', null)
      .limit(1000),
  );

  let updated = 0;
  for (const row of rows) {
    const root = classifySignal(row);
    const { error } = await supabase.from('bud_improvement_signals').update({
      root_cause_id: root.rootCauseId,
      root_cause_key: root.rootCauseKey,
    }).eq('id', row.id);
    if (error) throw new Error(`update signal ${row.id}: ${error.message}`);
    updated++;
  }
  return updated;
}

async function backfillActions() {
  const rows = await checked<ActionRow[]>('read agent_actions',
    supabase.from('agent_actions')
      .select('id, agent_id, action_type, preview, payload, status, action_identity, root_cause_id, root_cause_key, initiative_id, created_at')
      .is('root_cause_key', null)
      .or('agent_id.eq.bud-observer,action_type.eq.flag_for_review')
      .limit(1000),
  );

  let updated = 0;
  for (const row of rows) {
    const root = classifyAction(row);
    const { error } = await supabase.from('agent_actions').update({
      root_cause_id: root.rootCauseId,
      root_cause_key: root.rootCauseKey,
    }).eq('id', row.id);
    if (error) throw new Error(`update action ${row.id}: ${error.message}`);
    updated++;
  }
  return updated;
}

async function backfillApprovals() {
  const response = await supabase.from('bud_approval_queue')
    .select('id, action_type, payload, status, task_id, root_cause_id, root_cause_key, initiative_id, created_at, bud_tasks(description, source_agent, raw_input)')
    .is('root_cause_key', null)
    .limit(1000);
  if (response.error) throw new Error(`read bud_approval_queue: ${response.error.message}`);
  const rows = (response.data ?? []) as ApprovalRow[];

  let updated = 0;
  for (const row of rows) {
    const root = classifyApproval(row);
    const { error } = await supabase.from('bud_approval_queue').update({
      root_cause_id: root.rootCauseId,
      root_cause_key: root.rootCauseKey,
    }).eq('id', row.id);
    if (error) throw new Error(`update approval ${row.id}: ${error.message}`);
    updated++;
  }
  return updated;
}

async function upsertInitiatives() {
  const [signals, actions, approvals] = await Promise.all([
    checked<Array<{ root_cause_id: string | null; root_cause_key: string | null; created_at: string }>>('read clustered signals',
      supabase.from('bud_improvement_signals').select('root_cause_id, root_cause_key, created_at').not('root_cause_key', 'is', null).limit(5000)),
    checked<Array<{ root_cause_id: string | null; root_cause_key: string | null; created_at: string }>>('read clustered actions',
      supabase.from('agent_actions').select('root_cause_id, root_cause_key, created_at').not('root_cause_key', 'is', null).limit(5000)),
    checked<Array<{ root_cause_id: string | null; root_cause_key: string | null; created_at: string }>>('read clustered approvals',
      supabase.from('bud_approval_queue').select('root_cause_id, root_cause_key, created_at').not('root_cause_key', 'is', null).limit(5000)),
  ]);

  const grouped = new Map<string, { rootCauseId: string; latest: string }>();
  for (const row of [...signals, ...actions, ...approvals]) {
    if (!row.root_cause_id || !row.root_cause_key) continue;
    const existing = grouped.get(row.root_cause_key);
    if (!existing || row.created_at > existing.latest) {
      grouped.set(row.root_cause_key, { rootCauseId: row.root_cause_id, latest: row.created_at });
    }
  }

  const payload = Array.from(grouped.entries()).map(([rootCauseKey, value]) => ({
    root_cause_id: value.rootCauseId,
    root_cause_key: rootCauseKey,
    title: titleFor(value.rootCauseId, rootCauseKey),
    status: 'open',
    latest_signal_at: value.latest,
    metadata: { activated_by: 'scripts/activate-agent-intelligence-v2.ts' },
  }));

  if (payload.length === 0) return new Map<string, InitiativeRow>();

  const { data, error } = await supabase.from('bud_root_cause_initiatives')
    .upsert(payload, { onConflict: 'root_cause_key' })
    .select('id, root_cause_id, root_cause_key, title, status');
  if (error) throw new Error(`upsert initiatives: ${error.message}`);

  return new Map((data ?? []).map((row) => [row.root_cause_key, row as InitiativeRow]));
}

async function attachInitiatives(initiatives: Map<string, InitiativeRow>) {
  let updated = 0;
  for (const [rootCauseKey, initiative] of initiatives) {
    for (const table of ['bud_improvement_signals', 'agent_actions', 'bud_approval_queue'] as const) {
      const { data, error } = await supabase.from(table)
        .update({ initiative_id: initiative.id })
        .eq('root_cause_key', rootCauseKey)
        .select('id');
      if (error) throw new Error(`attach ${table} ${rootCauseKey}: ${error.message}`);
      updated += data?.length ?? 0;
    }
  }
  return updated;
}

async function dedupePendingObserverActions() {
  const rows = await checked<ActionRow[]>('read pending observer actions',
    supabase.from('agent_actions')
      .select('id, agent_id, action_type, preview, payload, status, action_identity, root_cause_id, root_cause_key, initiative_id, created_at')
      .eq('status', 'pending')
      .eq('action_type', 'flag_for_review')
      .not('root_cause_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000),
  );

  const groups = new Map<string, ActionRow[]>();
  for (const row of rows) {
    if (!row.root_cause_key) continue;
    groups.set(row.root_cause_key, [...(groups.get(row.root_cause_key) ?? []), row]);
  }

  let archived = 0;
  for (const [rootCauseKey, group] of groups) {
    const ranked = [...group].sort((a, b) => {
      const signalsA = Array.isArray(a.payload?.signals) ? a.payload.signals.length : 0;
      const signalsB = Array.isArray(b.payload?.signals) ? b.payload.signals.length : 0;
      if (signalsA !== signalsB) return signalsB - signalsA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const [canonical, ...duplicates] = ranked;
    if (!canonical) continue;

    const { error: identityError } = await supabase.from('agent_actions').update({
      action_identity: `observer:flag_for_review:${rootCauseKey}`,
      is_duplicate: false,
      superseded_by: null,
    }).eq('id', canonical.id);
    if (identityError) throw new Error(`set canonical identity ${canonical.id}: ${identityError.message}`);

    for (const duplicate of duplicates) {
      const { error } = await supabase.from('agent_actions').update({
        status: 'rejected',
        is_duplicate: true,
        superseded_by: canonical.id,
        action_identity: `observer:flag_for_review:${rootCauseKey}`,
        reviewed_at: new Date().toISOString(),
        review_notes: `superseded_by_initiative:${rootCauseKey}`,
      }).eq('id', duplicate.id).eq('status', 'pending');
      if (error) throw new Error(`archive duplicate action ${duplicate.id}: ${error.message}`);
      archived++;
    }
  }
  return archived;
}

async function dedupePendingBudApprovals() {
  const rows = await checked<ApprovalRow[]>('read pending bud approvals',
    supabase.from('bud_approval_queue')
      .select('id, action_type, payload, status, task_id, root_cause_id, root_cause_key, initiative_id, created_at')
      .eq('status', 'pending')
      .not('root_cause_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000),
  );

  const groups = new Map<string, ApprovalRow[]>();
  for (const row of rows) {
    if (!row.root_cause_key) continue;
    groups.set(row.root_cause_key, [...(groups.get(row.root_cause_key) ?? []), row]);
  }

  let archived = 0;
  for (const [rootCauseKey, group] of groups) {
    const [canonical, ...duplicates] = [...group].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (!canonical) continue;
    await supabase.from('bud_approval_queue').update({ is_duplicate: false, superseded_by: null }).eq('id', canonical.id);
    for (const duplicate of duplicates) {
      const { error } = await supabase.from('bud_approval_queue').update({
        status: 'archived',
        is_duplicate: true,
        superseded_by: canonical.id,
        archived_at: new Date().toISOString(),
        archive_reason: `superseded_by_initiative:${rootCauseKey}`,
      }).eq('id', duplicate.id).eq('status', 'pending');
      if (error) throw new Error(`archive duplicate approval ${duplicate.id}: ${error.message}`);
      archived++;
    }
  }
  return archived;
}

async function refreshInitiativeCounts(initiatives: Map<string, InitiativeRow>) {
  for (const [rootCauseKey, initiative] of initiatives) {
    try {
      const signals = await supabase.from('bud_improvement_signals').select('id', { count: 'exact', head: true }).eq('root_cause_key', rootCauseKey);
      const signalDupes = await supabase.from('bud_improvement_signals').select('id', { count: 'exact', head: true }).eq('root_cause_key', rootCauseKey).not('duplicate_of', 'is', null);
      const actions = await supabase.from('agent_actions').select('id', { count: 'exact', head: true }).eq('root_cause_key', rootCauseKey).eq('status', 'pending').eq('is_duplicate', false);
      const actionDupes = await supabase.from('agent_actions').select('id', { count: 'exact', head: true }).eq('root_cause_key', rootCauseKey).eq('is_duplicate', true);
      const approvals = await supabase.from('bud_approval_queue').select('id', { count: 'exact', head: true }).eq('root_cause_key', rootCauseKey).eq('status', 'pending').eq('is_duplicate', false);
      const approvalDupes = await supabase.from('bud_approval_queue').select('id', { count: 'exact', head: true }).eq('root_cause_key', rootCauseKey).eq('is_duplicate', true);

      const results = [signals, signalDupes, actions, actionDupes, approvals, approvalDupes];
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        console.warn(`Skipping initiative count refresh for ${rootCauseKey}: ${failed.error.message}`);
        continue;
      }

      const { error } = await supabase.from('bud_root_cause_initiatives').update({
        signal_count: signals.count ?? 0,
        duplicate_count: (signalDupes.count ?? 0) + (actionDupes.count ?? 0) + (approvalDupes.count ?? 0),
        approval_count: (actions.count ?? 0) + (approvals.count ?? 0),
      }).eq('id', initiative.id);
      if (error) {
        console.warn(`Skipping initiative count update for ${rootCauseKey}: ${error.message}`);
      }
    } catch (error) {
      console.warn(`Skipping initiative count refresh for ${rootCauseKey}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
  }
}

async function summarize() {
  const [quality, initiatives, actions, approvals, rootSignals] = await Promise.all([
    supabase.from('v_agent_intelligence_quality').select('*').limit(1).maybeSingle(),
    supabase.from('bud_root_cause_initiatives').select('id', { count: 'exact', head: true }),
    supabase.from('agent_actions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bud_approval_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bud_improvement_signals').select('root_cause_key').not('root_cause_key', 'is', null).limit(5000),
  ]);
  return {
    quality: quality.data,
    initiatives: initiatives.count ?? 0,
    pending_agent_actions: actions.count ?? 0,
    pending_bud_approvals: approvals.count ?? 0,
    clustered_signal_roots: new Set((rootSignals.data ?? []).map((row) => row.root_cause_key)).size,
  };
}

async function main() {
  const before = await summarize();
  const signals = await backfillSignals();
  const actions = await backfillActions();
  const approvals = await backfillApprovals();
  const initiatives = await upsertInitiatives();
  const attached = await attachInitiatives(initiatives);
  const archivedActions = await dedupePendingObserverActions();
  const archivedApprovals = await dedupePendingBudApprovals();
  await refreshInitiativeCounts(initiatives);
  const after = await summarize();

  console.log(JSON.stringify({
    before,
    changed: {
      signals_backfilled: signals,
      actions_backfilled: actions,
      approvals_backfilled: approvals,
      initiatives_upserted: initiatives.size,
      rows_attached_to_initiatives: attached,
      duplicate_actions_archived: archivedActions,
      duplicate_approvals_archived: archivedApprovals,
    },
    after,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
