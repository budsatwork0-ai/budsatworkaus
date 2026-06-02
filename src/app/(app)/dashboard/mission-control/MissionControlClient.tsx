'use client';

/**
 * Buds OS — Mission Control
 *
 * Tabs:
 *   Home         - operator cockpit (platform state, attention queue, activity, deployment)
 *   Agents       - real-time agent fleet view
 *   Improvements - tracked fix and refactor backlog
 *   Dev          - Development Command (Terminal, Dev OS, Design System, Graphify, Evidence)
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import type { BudActivityEvent } from '@/lib/bud/types';
import type { MissionControlHealth } from '@/lib/bud/health';
import type { BudOsQueueItem } from '@/lib/bud/os-view-model';
import type { DevOsResponse } from '@/app/api/dev-os/route';
import { OverviewCore } from './_components/OverviewCore';
import { AgentHierarchy } from './_components/AgentHierarchy';
import { ImprovementsTab } from './_components/ImprovementsTab';
import { DevTab } from './_components/DevTab';
import { BridgeStatus } from './_components/BridgeStatus';
import { deriveGlobalTruth } from '@/lib/bud/overview-v2';

type AgentRow = {
  id: string; name: string; status: string; category: string;
  autonomy: string; last_run_at?: string | null; last_success_at?: string | null;
};

export type BusinessSnapshotData = {
  mtd_revenue: number;
  mtd_orders: number;
  completed_mtd: number;
  in_progress: number;
  jobs_today: number;
};

type Props = {
  agents?: AgentRow[];
  latestRuns?: Record<string, { confidence_score: number | null; finished_at: string | null }>;
  budActivity?: BudActivityEvent[];
  commandState: MissionControlHealth;
  businessSnapshot: BusinessSnapshotData;
  budOs: {
    actionQueue: BudOsQueueItem[];
  };
  devOs: DevOsResponse;
};

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'home',         label: 'Home' },
  { key: 'agents',       label: 'Agents' },
  { key: 'improvements', label: 'Improvements' },
  { key: 'dev',          label: 'Dev' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/* ─────────────────────────────────────────────────────────────────────────── */

type ActivityEvent = {
  id: string; event_type: string; narrative: string;
  actor: string; created_at: string; metadata?: Record<string, unknown>; target?: string;
};

export function MissionControlClient({
  agents = [],
  latestRuns = {},
  commandState,
  businessSnapshot,
  budOs,
  budActivity = [],
  devOs,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const rawTab = search?.get('tab');
  const initialTab: TabKey = TABS.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : 'home';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [queue, setQueue] = useState<BudOsQueueItem[]>(budOs.actionQueue);
  const [selectedId, setSelectedId] = useState<string | null>(budOs.actionQueue[0]?.id ?? null);
  const [liveActivity, setLiveActivity] = useState<BudActivityEvent[]>(budActivity.slice(0, 12));
  const [investigatingIds, setInvestigatingIds] = useState<Set<string>>(new Set());
  const actionedIdsRef = useRef<Set<string>>(new Set());
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const incomingQueueKey = budOs.actionQueue.map((i) => i.id).join(',');
  useEffect(() => {
    const filtered = budOs.actionQueue.filter((i) => !actionedIdsRef.current.has(i.id));
    setQueue(filtered);
    setSelectedId((prev) =>
      filtered.find((i) => i.id === prev) ? prev : (filtered[0]?.id ?? null),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingQueueKey]);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, [tab]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const channel = supabase
      .channel('bud-live-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bud_activity_feed' }, (payload) => {
        const row = payload.new as ActivityEvent;
        setLiveActivity((prev) => [{
          id: row.id,
          event_type: row.event_type as BudActivityEvent['event_type'],
          narrative: row.narrative,
          actor: row.actor ?? null,
          target: row.target ?? null,
          metadata: row.metadata ?? {},
          created_at: row.created_at,
        }, ...prev].slice(0, 20));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bud_approval_queue' }, () => {
        if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = setTimeout(() => router.refresh(), 10_000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bud_tasks' }, () => {
        if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = setTimeout(() => router.refresh(), 10_000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    };
  }, [router]);

  async function approve(item: BudOsQueueItem, notes = '') {
    if (item.approval && item.approval.readiness !== 'ready') {
      toast.error(`Not ready: ${item.approval.readiness_summary}`);
      return;
    }
    try {
      const url = item.source === 'agent_action'
        ? `/api/agents/actions/${item.source_id}`
        : '/api/bud/approval';
      const body = item.source === 'agent_action'
        ? { decision: 'approve', notes: notes || undefined }
        : { id: item.source_id, decision: 'approved', notes: notes || undefined };
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Approval failed');
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success(notes ? 'Approved with note' : 'Bud approval recorded');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    }
  }

  async function reject(item: BudOsQueueItem, notes = '') {
    try {
      const url = item.source === 'agent_action'
        ? `/api/agents/actions/${item.source_id}`
        : '/api/bud/approval';
      const body = item.source === 'agent_action'
        ? { decision: 'reject', notes: notes || undefined }
        : { id: item.source_id, decision: 'rejected', notes: notes || undefined };
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Rejection failed');
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success('Rejected and removed from queue');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rejection failed');
    }
  }

  async function investigate(item: BudOsQueueItem) {
    setInvestigatingIds((prev) => new Set([...prev, item.id]));
    try {
      if (item.source === 'agent_run' && item.agent_id) {
        const res = await fetch('/api/bud/investigate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId: item.source_id, agentId: item.agent_id, agentName: item.agent_name ?? item.agent_id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Investigation failed');
      } else {
        const res = await fetch('/api/bud/command', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command: `Investigate and propose a fix: ${item.title}. ${item.detail}` }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Bud command failed');
      }
      setInvestigatingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
      actionedIdsRef.current.add(item.id);
      setQueue((prev) => prev.filter((e) => e.id !== item.id));
      const agentLabel = item.agent_name ?? item.title;
      toast.success(`Bud is on it — investigating ${agentLabel}. Check the approvals queue.`);
      router.refresh();
    } catch (error) {
      setInvestigatingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
      toast.error(error instanceof Error ? error.message : 'Investigation failed');
    }
  }

  const truth = deriveGlobalTruth(commandState);
  const truthDot = {
    healthy:   'bg-emerald-400',
    degraded:  'bg-amber-400',
    approval:  'bg-yellow-300',
    recovering:'bg-sky-400',
    blocked:   'bg-red-400',
  }[truth.state];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">

        {/* Header */}
        <header className="flex flex-wrap items-center gap-3 pb-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${truthDot}`} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Bud · {truth.headline}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <BridgeStatus />
            <button
              onClick={() => router.refresh()}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.08]"
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav className="sticky top-0 z-10 -mx-4 mb-5 border-b border-white/[0.07] bg-slate-950/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((entry) => {
              const active = tab === entry.key;
              return (
                <button
                  key={entry.key}
                  onClick={() => setTab(entry.key)}
                  className={`relative shrink-0 border-b-2 px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition ${
                    active
                      ? 'border-sky-400 text-white'
                      : 'border-transparent text-white/55 hover:text-white/85'
                  }`}
                >
                  {entry.label}
                  {active && (
                    <span className="pointer-events-none absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <div className="space-y-4">
          {tab === 'home' && (
            <OverviewCore
              commandState={commandState}
              businessSnapshot={businessSnapshot}
              queue={queue}
              activity={liveActivity}
              selectedId={selectedId}
              investigatingIds={investigatingIds}
              onSelect={(item) => setSelectedId(item.id)}
              onApprove={(item) => void approve(item)}
              onReject={(item) => void reject(item)}
              onInvestigate={(item) => void investigate(item)}
            />
          )}

          {tab === 'agents' && agents.length > 0 && (
            <AgentHierarchy agents={agents} latestRuns={latestRuns} />
          )}
          {tab === 'agents' && agents.length === 0 && (
            <p className="py-12 text-center text-sm text-white/40">No agents registered yet.</p>
          )}

          {tab === 'improvements' && <ImprovementsTab />}

          {tab === 'dev' && <DevTab devOs={devOs} />}
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-4 text-[11px] text-white/40">
          <span>Buds OS · operational intelligence layer</span>
          <span className="ml-auto">{truth.headline} · {truth.detail}</span>
        </footer>
      </div>
    </div>
  );
}
