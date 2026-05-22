# Autonomous Improvement Pipeline — Mission Control integration

Drops the live, Realtime-backed pipeline view into the Mission Control overview tab
of your Next.js 15 + Supabase app. Replaces the static diagram with a component that
streams real run state, per surface.

## What this folder contains

```
supabase/migrations/20260522120000_autonomy_pipeline.sql   ← control-plane schema, RLS, realtime, kill switch
lib/pipeline/types.ts                                      ← shared TypeScript types
lib/pipeline/stages.ts                                     ← the 10 stage definitions
app/(app)/dashboard/mission-control/_components/
  AutonomyPipeline.tsx                                     ← client component (subscribes to realtime)
  MissionControlAutonomy.tsx                               ← server component wrapper
app/api/pipeline/runs/route.ts                             ← GET list of runs
app/api/pipeline/runs/[id]/route.ts                        ← GET single run detail
app/api/pipeline/kill-switch/route.ts                      ← global autonomy pause
scripts/seed-pipeline-run.ts                               ← demo-run seeder
```

Mirror this layout into your repo (the paths assume the routes / aliases you described
already exist: `@/lib/...`, `app/(app)/dashboard/...`, App Router on Vercel).

## Step-by-step install

### 1. Run the migration

```bash
supabase migration up           # if you use the CLI
# or paste the SQL into the Supabase SQL editor and run it
```

It creates four tables (`pipeline_runs`, `pipeline_stage_events`, `pipeline_artifacts`,
`pipeline_agent_scores`), a KPI view (`pipeline_kpis_7d`), an autonomy policy table
seeded with sensible per-surface defaults, and a kill switch — plus RLS that locks
reads to admin/owner. Adjust `is_pipeline_admin()` at the bottom of the migration if
your role check lives somewhere other than `public.profiles.role`.

### 2. Drop the lib and component files into your app

```
lib/pipeline/*          → @/lib/pipeline/*
app/(app)/dashboard/mission-control/_components/*  → same path in your repo
app/api/pipeline/*      → same path in your repo
```

### 3. Mount the section in your Mission Control overview tab

Wherever your `mission-control/page.tsx` renders the Overview tab, add:

```tsx
import MissionControlAutonomy from './_components/MissionControlAutonomy';
import type { PipelineSurface } from '@/lib/pipeline/types';

export default async function MissionControlPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; surface?: PipelineSurface }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'overview';
  const surface = (sp.surface ?? 'admin') as PipelineSurface;

  return (
    <main className="space-y-8 p-6">
      {tab === 'overview' && <MissionControlAutonomy surface={surface} />}
      {/* ...other tabs */}
    </main>
  );
}
```

The URL `…/mission-control?tab=overview&surface=customer` now deep-links to
the customer-portal pipeline view.

### 4. Light it up

Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (you'll already have it for
server-side work), then:

```bash
pnpm tsx scripts/seed-pipeline-run.ts --surface=admin
# in another terminal, watch the dashboard at /dashboard/mission-control?tab=overview&surface=admin
```

You should see every stage card go active → passed live, the detail panel
populate with the synthetic agent scores at the Debate stage, and the verdict
appear in the header. Try also:

```bash
pnpm tsx scripts/seed-pipeline-run.ts --surface=customer --outcome=rejected
pnpm tsx scripts/seed-pipeline-run.ts --surface=public   --outcome=rollback
```

## What's stubbed vs what's real

This delivery is the *live UI + control-plane schema*. Real autonomy needs
the worker that orchestrates the stages. That worker reads `pipeline_kill_switch`
+ `pipeline_policy`, calls the Anthropic API (you already have 36 agent
definitions), opens GitHub PRs, monitors CI, and writes `pipeline_stage_events`
back to Supabase — which lights up this same UI. The stage contracts
(inputs / outputs / pass criteria) in `lib/pipeline/stages.ts` are the
worker's spec.

### Build order for the real worker

1. **Observer only — admin dashboard, LCP signal.**
   A Vercel cron + Supabase Edge Function that polls Speed Insights, computes
   anomaly score, opens a `pipeline_run` row, walks `detect → analyze` only,
   stops. Verifies the data path end-to-end with zero risk.

2. **Add Architect + Generate, gated to a human reviewer.**
   Verdict = `human_review` for every run. A human approves the PR. Watch
   the agent scores for ~20 runs and tune the composite threshold.

3. **Flip `autonomy_enabled = true` on the admin surface for Class A only.**
   Visual / perf / a11y / copy / refactor / dep bumps only. Block everything
   else at the reject gate. Watch rollback rate.

4. **Expand to crew portal, then customer Class A, then public Class A.**
   One surface at a time. Each new surface re-enters calibration mode.

5. **Add Class B (UX flow tweaks) behind feature flags + cohort caps.**

The per-surface defaults seeded in `pipeline_policy` already reflect this
sequence: admin + crew start with `autonomy_enabled=true`, customer + public
start `false`. Flip them on as confidence grows.

## Per-surface autonomy policy

| Surface | Class A (visual/perf/a11y/copy) | Class B (UX flow) | Hard bans |
|---------|--------------------------------|-------------------|-----------|
| Admin (`/dashboard`)   | Auto-merge | Auto, flag-guarded | — |
| Crew (`/crew`)         | Auto-merge | Human review | Workflow steps |
| Customer (`/portal`)   | Auto-merge after calibration | Human review | Identity, permissions, notifications |
| Public (`budsatwork.com`) | Auto-merge after calibration | Human review | Pricing copy, legal claims, feature claims, analytics events, Stripe paths |

Enforce these in the worker's reject-gate code. The `pipeline_policy` table
is the single source of truth; the worker reads it on every run.

## Non-negotiable safety

These are the things the UI exposes; the worker enforces them:

- **Kill switch** — `POST /api/pipeline/kill-switch { paused: true }`. Worker
  refuses to merge while paused. Surface it as a prominent toggle in the
  Mission Control header.
- **Daily merge budget** — per surface, in `pipeline_policy.daily_merge_budget`.
  Worker drops to zero if the 24-hour rollback rate breaches threshold.
- **External guardrails** — page-load p95, error rate, conversion, support-ticket
  volume. The debate quorum cannot weight or argue them away.
- **Mandatory skeptic** — every debate row in `pipeline_agent_scores` must
  include at least one agent with `is_skeptic = true`, or the worker rejects.
- **Memory write on every outcome** — successful runs *and* rollbacks both write
  to memory. Self-improvement only happens because the system remembers.

## Realtime channels

The dashboard subscribes to four channels:

- `pipeline_runs` (INSERT, filtered by surface) — adopt new runs
- `pipeline_runs` (UPDATE) — verdict / score / ended_at
- `pipeline_stage_events` (INSERT) — live stage status flips
- `pipeline_artifacts`, `pipeline_agent_scores` (INSERT) — fills detail panel

Each is bound to the active run by `run_id` on the client.

## Files at a glance

| File | Lines | Purpose |
|------|------:|---------|
| `supabase/migrations/20260522120000_autonomy_pipeline.sql` | ~210 | Schema, RLS, realtime, kill switch, policy |
| `lib/pipeline/types.ts`        | ~95  | Shared TS types |
| `lib/pipeline/stages.ts`       | ~150 | 10 stage definitions (inputs, outputs, criteria) |
| `AutonomyPipeline.tsx`         | ~390 | Live client component |
| `MissionControlAutonomy.tsx`   | ~145 | Server wrapper + surface selector |
| `app/api/pipeline/runs/route.ts`    | ~45  | GET list |
| `app/api/pipeline/runs/[id]/route.ts` | ~55 | GET single run |
| `app/api/pipeline/kill-switch/route.ts` | ~55 | GET/POST kill switch |
| `scripts/seed-pipeline-run.ts` | ~170 | Demo runner |

## Dependencies you should already have

- `@supabase/ssr` (server + browser cookie clients)
- `@supabase/supabase-js` (for the seed script with service role)
- `next@^15`, `react@^19`, `typescript@^5`, `tailwindcss@^4`

If `tsx` isn't installed:

```bash
pnpm add -D tsx
```

## Next-step suggestions when you're ready

1. **Wire the kill switch toggle into the Mission Control header.** Tiny —
   one button that hits `POST /api/pipeline/kill-switch`. Should ship before
   any real worker runs against production.
2. **Build the Observer for admin/LCP** (smallest, safest first ingestor).
   This is the first time the dashboard sees a *real* run instead of a seed.
3. **Add a run-history drawer** below the pipeline — paginated list from
   `GET /api/pipeline/runs?surface=…`, click a row to swap the displayed run.
4. **Add an autonomy-policy editor** so admin/owner can flip `class_a_auto`,
   adjust `daily_merge_budget`, etc, without going into the DB.
