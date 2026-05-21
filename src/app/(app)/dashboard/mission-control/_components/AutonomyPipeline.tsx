'use client';

/**
 * AutonomyPipeline
 *
 * Live view of the Autonomous Improvement Pipeline for a given surface
 * (public | admin | crew | customer). Subscribes to Supabase Realtime on
 * pipeline_stage_events + pipeline_runs and updates in place.
 *
 * Render this inside MissionControlAutonomy (server component) which
 * provides the initial run + KPIs + supabase browser client.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  PipelineAgentScore,
  PipelineArtifact,
  PipelineKpis,
  PipelineRun,
  PipelineRunDetail,
  PipelineStageEvent,
  PipelineStageId,
  PipelineStageStatus,
  PipelineSurface,
} from '@/lib/pipeline/types';
import { STAGES, STAGE_BY_ID, type StageDefinition } from '@/lib/pipeline/stages';
import { createBrowserClient } from '@supabase/ssr';

type SurfaceLabel = Record<PipelineSurface, string>;
const SURFACE_LABEL: SurfaceLabel = {
  public: 'Public website',
  admin: 'Admin dashboard',
  crew: 'Crew portal',
  customer: 'Customer portal',
};

interface Props {
  surface: PipelineSurface;
  initialRun: PipelineRunDetail | null;
  initialKpis: PipelineKpis | null;
  /** When non-null, the kill-switch state shown in the header. */
  killSwitchPaused?: boolean;
}

const EMPTY_STAGE_MAP = (): Record<PipelineStageId, PipelineStageStatus> =>
  STAGES.reduce(
    (acc, s) => {
      acc[s.id] = 'idle';
      return acc;
    },
    {} as Record<PipelineStageId, PipelineStageStatus>,
  );

type SimulateOutcome = 'success' | 'rejected' | 'rollback';

export default function AutonomyPipeline({
  surface,
  initialRun,
  initialKpis,
  killSwitchPaused = false,
}: Props) {
  const [run, setRun] = useState<PipelineRunDetail | null>(initialRun);
  const [selectedId, setSelectedId] = useState<PipelineStageId>('detect');
  const [simulating, setSimulating] = useState(false);
  const [simOutcome, setSimOutcome] = useState<SimulateOutcome>('success');

  async function startSimulation() {
    if (simulating) return;
    setSimulating(true);
    try {
      await fetch('/api/pipeline/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ surface, outcome: simOutcome }),
      });
    } finally {
      setSimulating(false);
    }
  }
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  // Subscribe to the active run's incremental changes.
  const runIdRef = useRef<string | null>(initialRun?.run.id ?? null);
  useEffect(() => {
    runIdRef.current = run?.run.id ?? null;
  }, [run]);

  useEffect(() => {
    // 1. Watch for *new* runs on this surface and switch to them.
    const newRunChannel = supabase
      .channel(`pipeline_runs:${surface}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_runs',
          filter: `surface=eq.${surface}`,
        },
        async (payload) => {
          const r = payload.new as PipelineRun;
          // Adopt this run; clear stages so the live ones light up as events arrive.
          setRun({
            run: r,
            stages: EMPTY_STAGE_MAP(),
            events: [],
            artifacts: [],
            scores: [],
          });
        },
      )
      .subscribe();

    // 2. Watch updates to the current run row (verdict, composite_score, ended_at).
    const runUpdatesChannel = supabase
      .channel(`pipeline_runs_updates:${surface}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pipeline_runs',
          filter: `surface=eq.${surface}`,
        },
        (payload) => {
          const updated = payload.new as PipelineRun;
          setRun((prev) =>
            prev && prev.run.id === updated.id ? { ...prev, run: updated } : prev,
          );
        },
      )
      .subscribe();

    // 3. Watch stage_events for the run we are currently displaying.
    const eventsChannel = supabase
      .channel(`pipeline_stage_events`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_stage_events',
        },
        (payload) => {
          const e = payload.new as PipelineStageEvent;
          if (e.run_id !== runIdRef.current) return;
          setRun((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              events: [...prev.events, e],
              stages: { ...prev.stages, [e.stage]: e.status },
            };
          });
          setSelectedId(e.stage);
        },
      )
      .subscribe();

    // 4. Artifacts + scores stream into the detail panel.
    const artifactsChannel = supabase
      .channel(`pipeline_artifacts`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pipeline_artifacts' },
        (payload) => {
          const a = payload.new as PipelineArtifact;
          if (a.run_id !== runIdRef.current) return;
          setRun((prev) => (prev ? { ...prev, artifacts: [...prev.artifacts, a] } : prev));
        },
      )
      .subscribe();

    const scoresChannel = supabase
      .channel(`pipeline_agent_scores`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pipeline_agent_scores' },
        (payload) => {
          const s = payload.new as PipelineAgentScore;
          if (s.run_id !== runIdRef.current) return;
          setRun((prev) => (prev ? { ...prev, scores: [...prev.scores, s] } : prev));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(newRunChannel);
      supabase.removeChannel(runUpdatesChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(artifactsChannel);
      supabase.removeChannel(scoresChannel);
    };
  }, [supabase, surface]);

  const selectedStage = STAGE_BY_ID[selectedId];
  const stageStatus = run?.stages[selectedId] ?? 'idle';

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* ── Simulate controls ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/45">
          Trigger a run
        </span>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {(['success', 'rejected', 'rollback'] as SimulateOutcome[]).map((o) => (
            <button
              key={o}
              onClick={() => setSimOutcome(o)}
              className={[
                'rounded-md px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors',
                simOutcome === o
                  ? o === 'success'
                    ? 'bg-emerald-400 text-emerald-950'
                    : o === 'rejected'
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-400 text-amber-950'
                  : 'text-white/40 hover:text-white',
              ].join(' ')}
            >
              {o}
            </button>
          ))}
        </div>
        <button
          onClick={() => void startSimulation()}
          disabled={simulating}
          className={[
            'ml-auto flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-all',
            simulating
              ? 'cursor-not-allowed border border-white/10 text-white/30'
              : 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)]',
          ].join(' ')}
        >
          {simulating ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
              running…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Simulate
            </>
          )}
        </button>
        <p className="w-full font-mono text-[10px] text-white/30">
          Walks all ten stages live via Realtime · ~5 s · no real code is changed
        </p>
      </div>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_420px]">
        <PipelineColumn
          surface={surface}
          run={run}
          selectedId={selectedId}
          onSelect={setSelectedId}
          killSwitchPaused={killSwitchPaused}
        />
        <DetailPanel
          stage={selectedStage}
          status={stageStatus}
          artifacts={run?.artifacts.filter((a) => a.stage === selectedId || a.stage === null) ?? []}
          scores={run?.scores ?? []}
        />
        <div className="lg:col-span-2">
          <TelemetryStrip kpis={initialKpis} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Pipeline column ──────────────────────────── */

function PipelineColumn({
  surface,
  run,
  selectedId,
  onSelect,
  killSwitchPaused,
}: {
  surface: PipelineSurface;
  run: PipelineRunDetail | null;
  selectedId: PipelineStageId;
  onSelect: (id: PipelineStageId) => void;
  killSwitchPaused: boolean;
}) {
  const verdict = run?.run.verdict;
  const runId = run?.run.id?.slice(0, 8);

  return (
    <section
      className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 pl-12 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      {/* spine */}
      <div className="pointer-events-none absolute left-7 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />

      <header className="mb-5 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">
            Surface · {SURFACE_LABEL[surface]}
          </div>
          <div className="mt-1 text-sm text-white/60">
            {run
              ? `Run ${runId} · ${run.run.trigger_signal} · verdict ${verdict}`
              : 'No active run · waiting for next opportunity from Bud Observer'}
          </div>
        </div>
        {killSwitchPaused && (
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-red-300">
            kill-switch paused
          </span>
        )}
      </header>

      <ol className="space-y-3">
        {STAGES.map((stage, i) => {
          const status = run?.stages[stage.id] ?? 'idle';
          return (
            <StageCard
              key={stage.id}
              index={i + 1}
              stage={stage}
              status={status}
              selected={selectedId === stage.id}
              onClick={() => onSelect(stage.id)}
            />
          );
        })}
      </ol>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-emerald-400/[0.03] px-4 py-3 text-[13px] text-white/60">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" /><path d="M3 21v-5h5" />
        </svg>
        <span>
          <span className="text-white">Continuous learning loop.</span>{' '}
          Each successful improvement and each rollback feeds Bud’s memory, design intelligence,
          and operational knowledge graph.
        </span>
      </div>
    </section>
  );
}

/* ──────────────────────────── Stage card ──────────────────────────── */

function StageCard({
  index,
  stage,
  status,
  selected,
  onClick,
}: {
  index: number;
  stage: StageDefinition;
  status: PipelineStageStatus;
  selected: boolean;
  onClick: () => void;
}) {
  const dot =
    status === 'active'
      ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.18),0_0_14px_rgba(74,222,128,1)]'
      : status === 'passed'
      ? 'bg-emerald-400'
      : status === 'rejected'
      ? 'bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
      : 'bg-white/15 border border-white/20';

  const badge =
    status === 'active' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10'
      : status === 'passed' ? 'text-emerald-300 border-emerald-400/20'
      : status === 'rejected' ? 'text-red-300 border-red-400/30 bg-red-500/10'
      : 'text-white/40 border-white/10';

  return (
    <li
      onClick={onClick}
      className={[
        'relative cursor-pointer rounded-xl border px-4 py-3 transition-all',
        'bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-white/20 hover:translate-x-[2px]',
        selected
          ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(110,231,183,0.4),0_0_30px_rgba(74,222,128,0.08)]'
          : 'border-white/8',
      ].join(' ')}
    >
      {/* timeline dot, attaches into the column spine */}
      <span className={`absolute -left-[19px] top-5 h-3.5 w-3.5 rounded-full ${dot}`} />

      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] tracking-[0.12em] text-white/35">
          STAGE {String(index).padStart(2, '0')}
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">{stage.name}</span>
        <span className="ml-auto rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-2 py-0.5 font-mono text-[10px] tracking-wider text-sky-300">
          {stage.owner}
        </span>
        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${badge}`}>
          {status === 'idle' ? '—' : status}
        </span>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{stage.desc}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {stage.signals.map((s) => (
          <span
            key={s}
            className="rounded border border-white/10 bg-white/[0.025] px-2 py-0.5 font-mono text-[10.5px] text-white/55"
          >
            {s}
          </span>
        ))}
      </div>
    </li>
  );
}

/* ──────────────────────────── Detail panel ──────────────────────────── */

function DetailPanel({
  stage,
  status,
  artifacts,
  scores,
}: {
  stage: StageDefinition;
  status: PipelineStageStatus;
  artifacts: PipelineArtifact[];
  scores: PipelineAgentScore[];
}) {
  const debateScores = stage.id === 'debate' ? scores : [];

  return (
    <aside className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-xl">
      <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-emerald-300">
        Stage · {stage.id}
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-white">{stage.name}</h3>
      <div className="mb-4 mt-0.5 font-mono text-[11px] text-sky-300">owner: {stage.owner}</div>
      <p className="mb-5 text-[13.5px] leading-relaxed text-white/65">{stage.desc}</p>

      <PanelSection title="Current status">
        <span
          className={[
            'inline-flex rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-widest',
            status === 'passed' ? 'border-emerald-400/30 text-emerald-300'
              : status === 'active' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : status === 'rejected' ? 'border-red-400/30 bg-red-500/10 text-red-300'
              : 'border-white/10 text-white/40',
          ].join(' ')}
        >
          {status === 'idle' ? 'waiting' : status}
        </span>
      </PanelSection>

      <PanelSection title="Signals watched">
        <div className="flex flex-wrap gap-1.5">
          {stage.signals.map((s) => (
            <span
              key={s}
              className="rounded border border-sky-400/20 bg-sky-400/[0.05] px-2 py-0.5 font-mono text-[10.5px] text-sky-200"
            >
              {s}
            </span>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Inputs">
        <Bullets items={stage.inputs} />
      </PanelSection>

      <PanelSection title="Outputs">
        <Bullets items={stage.outputs} />
      </PanelSection>

      <PanelSection title="Pass criteria">
        <Bullets items={stage.criteria} />
      </PanelSection>

      {debateScores.length > 0 && (
        <PanelSection title="Live composite — current run">
          {debateScores.map((s) => (
            <ScoreBar key={`${s.agent}-${s.dimension}-${s.id}`} k={`${s.agent} · ${s.dimension}`} v={s.value} />
          ))}
        </PanelSection>
      )}

      {artifacts.length > 0 && (
        <PanelSection title="Artifacts">
          <ul className="space-y-1.5">
            {artifacts.map((a) => (
              <li key={a.id} className="text-[13px] text-white/70">
                <span className="font-mono text-[10.5px] text-white/40">{a.kind}</span>{' '}
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">
                    {a.label ?? a.url}
                  </a>
                ) : (
                  <span>{a.label}</span>
                )}
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </aside>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h4 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/45">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x} className="relative pl-4 text-[13px] text-white/75">
          <span className="absolute left-0 top-2 h-px w-2.5 bg-sky-300/60" />
          {x}
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ k, v }: { k: string; v: number }) {
  return (
    <div className="mb-2 grid grid-cols-[140px_1fr_40px] items-center gap-2.5 font-mono text-[11.5px]">
      <span className="truncate text-white/55">{k}</span>
      <span className="h-1.5 overflow-hidden rounded border border-white/10 bg-white/[0.04]">
        <span
          className="block h-full bg-gradient-to-r from-sky-400 to-emerald-400"
          style={{ width: `${Math.round(v * 100)}%` }}
        />
      </span>
      <span className="text-right text-emerald-300">{v.toFixed(2)}</span>
    </div>
  );
}

/* ──────────────────────────── Telemetry strip ──────────────────────────── */

function TelemetryStrip({ kpis }: { kpis: PipelineKpis | null }) {
  const tiles = [
    {
      label: 'Auto-merged · 7d',
      value: kpis ? kpis.auto_merged.toString() : '—',
      delta: kpis && kpis.auto_merged ? `+${kpis.auto_merged} this week` : '0',
      bad: false,
    },
    {
      label: 'Auto-rejected · 7d',
      value: kpis ? kpis.auto_rejected.toString() : '—',
      delta: kpis ? `${rejectionRate(kpis)}% rejection rate` : '—',
      bad: false,
    },
    {
      label: 'Rollbacks · 7d',
      value: kpis ? kpis.rollbacks.toString() : '—',
      delta: kpis ? `${rollbackRate(kpis)}% of deploys` : '—',
      bad: !!kpis && kpis.rollbacks > 0,
    },
    {
      label: 'Median detect → deploy',
      value: kpis ? formatDuration(kpis.median_seconds) : '—',
      delta: 'last 7 days',
      bad: false,
    },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/45">
            {t.label}
          </span>
          <span className="font-mono text-lg text-white">{t.value}</span>
          <span className={`font-mono text-[11px] ${t.bad ? 'text-red-300' : 'text-emerald-300'}`}>
            {t.delta}
          </span>
        </div>
      ))}
    </div>
  );
}

function rejectionRate(k: PipelineKpis): string {
  const total = k.auto_merged + k.auto_rejected;
  if (!total) return '0';
  return Math.round((k.auto_rejected / total) * 100).toString();
}

function rollbackRate(k: PipelineKpis): string {
  const total = k.auto_merged + k.rollbacks;
  if (!total) return '0';
  return ((k.rollbacks / total) * 100).toFixed(2);
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
