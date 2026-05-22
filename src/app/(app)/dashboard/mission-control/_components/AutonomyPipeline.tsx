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
  PipelineLearningEntry,
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
  initialLearnings?: PipelineLearningEntry[];
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
  initialLearnings = [],
  killSwitchPaused = false,
}: Props) {
  const [run, setRun] = useState<PipelineRunDetail | null>(initialRun);
  const [learnings, setLearnings] = useState<PipelineLearningEntry[]>(initialLearnings);
  const [selectedId, setSelectedId] = useState<PipelineStageId>('detect');
  const [simulating, setSimulating] = useState(false);
  const [simOutcome, setSimOutcome] = useState<SimulateOutcome>('success');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

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

  async function triggerRealRun() {
    if (triggering) return;
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          surface,
          signal_type: 'manual',
          severity: 'medium',
          title: `Manual improvement run — ${surface} surface`,
          affected_area: surface === 'public' ? '/' : `/${surface}`,
          proposed_approach: 'Analyse the surface for low-hanging improvements and apply the safest one.',
        }),
      });
      const json = await res.json().catch(() => ({})) as { status?: string; error?: string };
      if (!res.ok) {
        setTriggerMsg(`Error: ${json.error ?? res.statusText}`);
      } else {
        setTriggerMsg('Pipeline started — watch stages light up via Realtime.');
        setTimeout(() => setTriggerMsg(null), 6000);
      }
    } catch {
      setTriggerMsg('Network error — check console.');
    } finally {
      setTriggering(false);
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

    // 5. Watch for new improvement and repair learnings
    const improvementLearningsChannel = supabase
      .channel('bud_improvement_learnings_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bud_improvement_learnings' },
        async (payload) => {
          const row = payload.new as {
            id: string; outcome: string; improvement_pattern: string;
            signal_type: string | null; affected_area: string | null; created_at: string;
          };
          const entry: PipelineLearningEntry = {
            id: row.id, kind: 'improvement',
            outcome: row.outcome as PipelineLearningEntry['outcome'],
            pattern: row.improvement_pattern,
            signal_type: row.signal_type,
            affected_area: row.affected_area,
            diff_summary: null, pr_url: null, confidence: null,
            ci_conclusion: null, taste_pass: null,
            created_at: row.created_at,
          };
          setLearnings((prev) => [entry, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    const repairLearningsChannel = supabase
      .channel('bud_repair_learnings_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bud_repair_learnings' },
        (payload) => {
          const row = payload.new as {
            id: string; outcome: string; fix_pattern: string;
            root_cause_type: string | null; created_at: string;
          };
          const entry: PipelineLearningEntry = {
            id: row.id, kind: 'repair',
            outcome: row.outcome as PipelineLearningEntry['outcome'],
            pattern: row.fix_pattern,
            signal_type: row.root_cause_type,
            affected_area: null,
            diff_summary: null, pr_url: null, confidence: null,
            ci_conclusion: null, taste_pass: null,
            created_at: row.created_at,
          };
          setLearnings((prev) => [entry, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    // 6. Watch for new convention learnings (dev-session captured rules)
    const conventionLearningsChannel = supabase
      .channel('bud_convention_learnings_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bud_convention_learnings' },
        (payload) => {
          const row = payload.new as {
            id: string; title: string; rule: string;
            category: string | null;
            example_wrong: string | null; example_correct: string | null;
            created_at: string;
          };
          const entry: PipelineLearningEntry = {
            id: row.id, kind: 'convention',
            outcome: 'shipped',
            pattern: `${row.title}: ${row.rule}`,
            signal_type: row.category,
            affected_area: null,
            diff_summary: row.example_wrong ?? null,
            pr_url: null, confidence: null,
            ci_conclusion: row.example_correct ?? null,
            taste_pass: null,
            created_at: row.created_at,
          };
          setLearnings((prev) => [entry, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(newRunChannel);
      supabase.removeChannel(runUpdatesChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(artifactsChannel);
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(improvementLearningsChannel);
      supabase.removeChannel(repairLearningsChannel);
      supabase.removeChannel(conventionLearningsChannel);
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
        <button
          onClick={() => void triggerRealRun()}
          disabled={triggering}
          className={[
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-all',
            triggering
              ? 'cursor-not-allowed border border-white/10 text-white/30'
              : 'border border-sky-400/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)]',
          ].join(' ')}
        >
          {triggering ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
              starting…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
              </svg>
              Run Real
            </>
          )}
        </button>
        <p className="w-full font-mono text-[10px] text-white/30">
          Simulate: walks all ten stages live · ~5 s · no real code changed&nbsp;&nbsp;·&nbsp;&nbsp;Run Real: fires the actual improvement pipeline via Bud
        </p>
        {triggerMsg && (
          <p className={`w-full font-mono text-[10.5px] ${triggerMsg.startsWith('Error') ? 'text-red-300' : 'text-sky-300'}`}>
            {triggerMsg}
          </p>
        )}
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
        <div className="lg:col-span-2">
          <LearningFeed learnings={learnings} run={run} />
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

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">
            Surface · {SURFACE_LABEL[surface]}
          </div>
          <div className="mt-1 text-sm text-white/60">
            {run
              ? `Run ${runId} · ${run.run.trigger_signal}`
              : 'No active run · waiting for next opportunity from Bud Observer'}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {run && verdict && (() => {
            if (verdict === 'pending') return (
              <span className="flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-sky-300">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                running
              </span>
            );
            return (
              <span className={[
                'rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest',
                verdict === 'auto_merge'
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : verdict === 'rolled_back'
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                  : verdict === 'rejected'
                  ? 'border-red-400/30 bg-red-500/10 text-red-300'
                  : 'border-sky-400/30 bg-sky-400/10 text-sky-300',
              ].join(' ')}>
                {verdict === 'auto_merge' ? '✓ shipped' : verdict.replace('_', ' ')}
              </span>
            );
          })()}
          {killSwitchPaused && (
            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-red-300">
              kill-switch paused
            </span>
          )}
        </div>
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

/* ──────────────────────────── Learning feed ──────────────────────────── */

function LearningFeed({
  learnings,
  run,
}: {
  learnings: PipelineLearningEntry[];
  run: PipelineRunDetail | null;
}) {
  const currentVerdict = run?.run.verdict;
  const currentScore = run?.run.composite_score;
  const currentPR = run?.run.pr_url;
  const currentRollbackReason = run?.run.rollback_reason;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
      {/* ── Header ── */}
      <div className="mb-5 flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300 flex-shrink-0">
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" /><path d="M3 21v-5h5" />
        </svg>
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-emerald-300">
            Continuous learning loop
          </div>
          <p className="mt-0.5 text-[12.5px] text-white/45">
            Improvements, rollbacks, and dev-session conventions all feed Bud's memory, design intelligence, and operational knowledge graph.
          </p>
        </div>
      </div>

      {/* ── Current run result banner ── */}
      {run && currentVerdict && currentVerdict !== 'pending' && (
        <div className={[
          'mb-5 rounded-xl border px-4 py-3 text-[13px]',
          currentVerdict === 'auto_merge'
            ? 'border-emerald-400/30 bg-emerald-400/[0.06]'
            : currentVerdict === 'rolled_back'
            ? 'border-amber-400/30 bg-amber-400/[0.06]'
            : currentVerdict === 'rejected'
            ? 'border-red-400/20 bg-red-500/[0.05]'
            : 'border-sky-400/20 bg-sky-400/[0.04]',
        ].join(' ')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={[
                  'rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
                  currentVerdict === 'auto_merge' ? 'border-emerald-400/40 text-emerald-300'
                    : currentVerdict === 'rolled_back' ? 'border-amber-400/40 text-amber-300'
                    : currentVerdict === 'rejected' ? 'border-red-400/30 text-red-300'
                    : 'border-sky-400/30 text-sky-300',
                ].join(' ')}>
                  {currentVerdict === 'auto_merge' ? 'shipped' : currentVerdict.replace('_', ' ')}
                </span>
                {currentScore != null && (
                  <span className="font-mono text-[11px] text-white/45">
                    composite score {(currentScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-white/65">
                {currentVerdict === 'auto_merge'
                  ? 'This run was auto-merged — all gates passed. The change is in production.'
                  : currentVerdict === 'human_review'
                  ? 'Composite score 65–80% — queued for your review before merging.'
                  : currentVerdict === 'rolled_back'
                  ? `Rolled back${currentRollbackReason ? `: ${currentRollbackReason}` : '. Live telemetry detected a regression — production was restored automatically.'}`
                  : 'Rejected by the debate quorum or a hard safety rule before reaching production.'}
              </p>
            </div>
            {currentPR && (
              <a
                href={currentPR}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-white/60 hover:text-white hover:border-white/20 transition-colors"
              >
                View PR →
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Learning records ── */}
      {learnings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
          <p className="font-mono text-[12px] text-white/30">
            No learnings yet — they appear here after the first pipeline run completes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {learnings.map((l) => (
            <LearningCard key={l.id} entry={l} />
          ))}
        </div>
      )}
    </section>
  );
}

function LearningCard({ entry }: { entry: PipelineLearningEntry }) {
  const isGood = entry.outcome === 'shipped' || entry.outcome === 'recovered';
  const isRollback = entry.outcome === 'rolled_back';
  const isRepair = entry.kind === 'repair';
  const isConvention = entry.kind === 'convention';

  const outcomeColor = isConvention
    ? 'border-violet-400/30 text-violet-300'
    : isGood
    ? 'border-emerald-400/30 text-emerald-300'
    : isRollback
    ? 'border-amber-400/30 text-amber-300'
    : 'border-red-400/20 text-red-300';

  const leftBar = isConvention
    ? 'bg-violet-400/60'
    : isGood
    ? 'bg-emerald-400/60'
    : isRollback
    ? 'bg-amber-400/60'
    : 'bg-red-400/40';

  const timeAgo = formatRelativeTime(entry.created_at);

  // Split diff_summary into individual file lines
  const diffLines = entry.diff_summary
    ? entry.diff_summary.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  return (
    <div className={`relative flex gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 overflow-hidden`}>
      {/* left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${leftBar} rounded-l-xl`} />

      {/* icon */}
      <div className="mt-0.5 flex-shrink-0">
        {isConvention ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-300">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        ) : isRepair ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-300">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
            <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
            <path d="M12 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z" />
          </svg>
        )}
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${outcomeColor}`}>
            {entry.outcome}
          </span>
          <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-white/40">
            {isConvention ? entry.signal_type ?? 'convention' : isRepair ? 'repair' : entry.signal_type ?? 'improvement'}
          </span>
          {entry.affected_area && (
            <span className="font-mono text-[10.5px] text-white/30 truncate max-w-[180px]">
              {entry.affected_area}
            </span>
          )}
          <span className="ml-auto font-mono text-[10px] text-white/25 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* What was implemented */}
        <p className="text-[13px] leading-relaxed text-white/70 mb-2">{entry.pattern}</p>

        {/* Diff / files changed */}
        {diffLines.length > 0 && (
          <div className="mb-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1.5">What changed</div>
            {diffLines.slice(0, 4).map((line, i) => (
              <div key={i} className="font-mono text-[11px] text-white/55 flex gap-2">
                <span className="text-emerald-300/60 flex-shrink-0">›</span>
                <span className="truncate">{line}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quality signals */}
        <div className="flex flex-wrap gap-2">
          {entry.confidence != null && (
            <span className="font-mono text-[10.5px] text-white/35">
              confidence {Math.round(entry.confidence * 100)}%
            </span>
          )}
          {entry.ci_conclusion && (
            <span className={`font-mono text-[10.5px] ${entry.ci_conclusion === 'success' ? 'text-emerald-300/70' : 'text-red-300/70'}`}>
              CI {entry.ci_conclusion}
            </span>
          )}
          {entry.taste_pass != null && (
            <span className={`font-mono text-[10.5px] ${entry.taste_pass ? 'text-emerald-300/70' : 'text-amber-300/70'}`}>
              taste {entry.taste_pass ? 'passed' : 'failed'}
            </span>
          )}
          {entry.pr_url && (
            <a
              href={entry.pr_url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10.5px] text-sky-300/70 hover:text-sky-300 transition-colors"
            >
              PR →
            </a>
          )}
        </div>

        {/* Memory / knowledge graph note for rollbacks */}
        {isRollback && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-amber-300/60">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" /><path d="M3 21v-5h5" />
            </svg>
            Rollback pattern written to memory — Bud will avoid this approach next time
          </div>
        )}
        {isConvention && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-violet-300/60">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Convention written to CLAUDE.md + vault — enforced on every future session
          </div>
        )}
        {!isConvention && isGood && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-emerald-300/50">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" /><path d="M3 21v-5h5" />
            </svg>
            Fix pattern written to knowledge graph — boosts confidence on similar future signals
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
