/**
 * MissionControlAutonomy — server component.
 *
 * Loads the most recent run for the selected surface plus the 7-day KPIs
 * and renders the live AutonomyPipeline client component.
 *
 * Mount this in app/(app)/dashboard/mission-control/page.tsx inside the
 * Overview tab. It reads the `surface` query string (?surface=admin) so
 * the surface selector is shareable & deep-linkable.
 *
 * NOTE: requires a Supabase server client at @/lib/supabase/server that
 * uses the service role *or* an admin/owner session. If you're using
 * @supabase/ssr, the cookie-bound client is fine — RLS already restricts
 * reads to admin/owner via is_pipeline_admin().
 */

import Link from 'next/link';
import AutonomyPipeline from './AutonomyPipeline';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  PipelineKpis,
  PipelineRun,
  PipelineRunDetail,
  PipelineStageEvent,
  PipelineStageId,
  PipelineSurface,
} from '@/lib/pipeline/types';
import { STAGES } from '@/lib/pipeline/stages';

const SURFACES: { id: PipelineSurface; label: string }[] = [
  { id: 'public',   label: 'Public website' },
  { id: 'admin',    label: 'Admin' },
  { id: 'crew',     label: 'Crew' },
  { id: 'customer', label: 'Customer' },
];

export default async function MissionControlAutonomy({
  surface = 'admin',
}: {
  surface?: PipelineSurface;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in this server component */
        },
      },
    },
  );

  // Most recent run for this surface
  const { data: latestRun } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('surface', surface)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<PipelineRun>();

  let initialRun: PipelineRunDetail | null = null;
  if (latestRun) {
    const [{ data: events }, { data: artifacts }, { data: scores }] = await Promise.all([
      supabase
        .from('pipeline_stage_events')
        .select('*')
        .eq('run_id', latestRun.id)
        .order('ts', { ascending: true }),
      supabase
        .from('pipeline_artifacts')
        .select('*')
        .eq('run_id', latestRun.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('pipeline_agent_scores')
        .select('*')
        .eq('run_id', latestRun.id)
        .order('created_at', { ascending: true }),
    ]);

    // Derive stage map: latest status per stage from event stream
    const stages = STAGES.reduce(
      (acc, s) => {
        acc[s.id] = 'idle';
        return acc;
      },
      {} as Record<PipelineStageId, PipelineRunDetail['stages'][PipelineStageId]>,
    );
    (events ?? []).forEach((e: PipelineStageEvent) => {
      stages[e.stage] = e.status;
    });

    initialRun = {
      run: latestRun,
      stages,
      events: events ?? [],
      artifacts: artifacts ?? [],
      scores: scores ?? [],
    };
  }

  // 7d KPIs for the surface
  const { data: kpisRow } = await supabase
    .from('pipeline_kpis_7d')
    .select('*')
    .eq('surface', surface)
    .maybeSingle<PipelineKpis>();

  // Kill-switch
  const { data: kill } = await supabase
    .from('pipeline_kill_switch')
    .select('paused')
    .eq('id', 1)
    .maybeSingle<{ paused: boolean }>();

  return (
    <div
      className="rounded-3xl border border-white/10 p-6 backdrop-blur-2xl"
      style={{
        // brand.primary at low alpha so glass picks it up
        background:
          'linear-gradient(180deg, rgba(15,61,46,0.35) 0%, rgba(15,61,46,0.08) 60%, rgba(15,61,46,0.02) 100%)',
      }}
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-emerald-300/80">
            Mission Control · Overview
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Autonomous Improvement Pipeline
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">
            Every failure or optimisation opportunity passes through ten gates before it touches
            production. Bud agents observe, debate, validate, and learn. Claude writes surgical
            code — never broad rewrites.
          </p>
        </div>

        <SurfaceSwitcher current={surface} />
      </header>

      <AutonomyPipeline
        surface={surface}
        initialRun={initialRun}
        initialKpis={kpisRow ?? null}
        killSwitchPaused={!!kill?.paused}
      />
    </div>
  );
}

function SurfaceSwitcher({ current }: { current: PipelineSurface }) {
  return (
    <nav className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur">
      {SURFACES.map((s) => {
        const active = s.id === current;
        return (
          <Link
            key={s.id}
            href={`?tab=overview&surface=${s.id}`}
            className={[
              'rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors',
              active
                ? 'bg-emerald-400 text-emerald-950 shadow-[0_0_18px_rgba(74,222,128,0.35)]'
                : 'text-white/55 hover:text-white',
            ].join(' ')}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
