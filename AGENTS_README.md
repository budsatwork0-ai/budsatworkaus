# Buds At Work — Agents

Everything in this drop is additive — no existing files were modified.
You can review and merge piece by piece.

## What was created

### Schema
- `supabase/migrations/037_agents.sql` — 4 new tables (`agents`, `agent_runs`,
  `agent_actions`, `agent_memory`), RLS, a view, and seed rows for the 8
  back-office agents.
- `supabase/migrations/038_design_agents.sql` — adds the 6 design/UX agents
  and a `design_insights` table for long-form recommendations
  (severity + status + proposed_change diffs).

### Runtime
- `src/lib/agents/types.ts` — shared types
- `src/lib/agents/runtime.ts` — `runAgent()` + `executeApprovedAction()`
- `src/lib/agents/registry.ts` — single import point
- `src/lib/agents/agents/*.ts` — one file per agent

### API routes
- `POST /api/agents/run` — manual trigger (admin only)
- `GET  /api/agents/runs?agent_id=…&limit=…`
- `POST /api/agents/actions/[id]` — approve or reject a queued action
- `GET  /api/agents/cron?agent_id=…&secret=…` — Vercel-Cron entry point

### UI
- `src/app/(app)/dashboard/agents/page.tsx` — the live monitoring page
- `src/app/(app)/dashboard/agents/_components/AgentGrid.tsx`
- `src/app/(app)/dashboard/agents/_components/ApprovalQueue.tsx`
- `src/app/(app)/dashboard/agents/_components/RecentRuns.tsx`

### Preview files (open in a browser, no setup)
- `agents-preview.html` — the admin dashboard view.
- `agents-lobby-preview.html` — the **Agent Lobby**, a live "video-game"
  visualization of all 14 agents at their desks, with animated activity,
  speech bubbles, data hand-offs between agents, and a live event ticker.
  Open this — it's the most direct way to *see* what you asked for.

### Design / UX agents
- `src/lib/lucky-orange.ts` — Lucky Orange v2 API client (heatmaps, top
  pages, funnels, notable sessions). Falls back to fixture data when
  credentials aren't set so the agents stay runnable.
- `src/lib/agents/agents/heatmap-analyst.ts` — pulls Lucky Orange data
  for your top pages, finds dead clicks / rage clicks / scroll dropoffs,
  writes findings to `design_insights`.
- `src/lib/agents/agents/copy-optimizer.ts` — audits headings, CTAs, and
  microcopy in your warm-Australian-tradie voice.
- `src/lib/agents/agents/conversion-funnel.ts` — runs the visit → quote
  → submitted → accepted → paid funnel and diagnoses the biggest leak.
- `src/lib/agents/agents/layout-critic.ts` — visual hierarchy, WCAG AA,
  mobile UX issues with concrete before/after CSS.
- `src/lib/agents/agents/seo-meta.ts` — titles, meta descriptions, JSON-LD,
  Logan/Brisbane local-SEO patterns.
- `src/lib/agents/agents/ab-test-architect.ts` — combines the insight
  backlog into prioritized A/B test proposals with sample size estimates.

### Batch 2 — smarter sales + closing the data gaps
- `supabase/migrations/039_agents_batch2.sql` — adds `phone_calls` and
  `job_photos` tables, adds `lead_score` / `yard_sqm` / `yard_complexity` /
  `geo_image_url` columns to `quotes`, seeds the 4 new agents.
- `src/lib/agents/agents/lead-scorer.ts` — 0-100 score on every inbound
  lead. Cheap (Haiku) and `auto` autonomy. Hands off hot leads to Quote
  Triage and Customer Reply.
- `src/lib/agents/agents/photo-qa.ts` — uses Claude vision to score
  before/after photos, flag missing pairs, and tag marketing-ready shots.
- `src/lib/agents/agents/yard-map-geo.ts` — fetches a Google Static Maps
  satellite image of the property and uses Claude vision to estimate
  lawn sqm + complexity. Auto-feeds Quote Triage.
- `src/lib/agents/agents/phone-transcriber.ts` — Whisper transcript +
  Claude summary + action items, attached to the customer record.
  Flags frustrated callers for follow-up.

Optional env vars for batch 2:
```
GOOGLE_MAPS_API_KEY=...       # Yard Map / Geo (falls back to fixtures)
OPENAI_API_KEY=...            # Phone Transcriber Whisper (falls back to fixture)
```

### Batches 3-5 — marketing, finance, wildcards
- `supabase/migrations/040_agents_batch345.sql` — adds 9 supporting tables
  (`content_drafts`, `lapsed_outreach`, `competitor_pages`,
  `cash_flow_forecasts`, `stripe_disputes`, `whs_records`,
  `knowledge_articles`, `crew_coach_notes`, `ndis_plan_matches`) and seeds
  the 9 new agents.
- Marketing wave: `content-agent.ts`, `lapsed-win-back.ts`,
  `competitor-watcher.ts` — drafts social/blog posts from real jobs +
  approved photos, runs 90-day win-backs, scrapes competitor pricing
  pages and flags moves to match.
- Finance wave: `cash-flow-forecaster.ts`, `stripe-dispute-manager.ts`,
  `whs-safety-reminder.ts` — 8-week cash forecast, Stripe dispute evidence
  packaging, crew compliance expiry reminders (induction / WWCC /
  first-aid / licence / equipment).
- Wildcards: `internal-qa.ts`, `crew-coach.ts`, `ndis-plan-matcher.ts` —
  plain-English Q&A over your SOPs, monthly per-crew coaching notes, and
  NDIS-plan-goal-to-service mapping with fundable-hours estimates.

A few of these depend on tables that may not exist yet in your schema
(e.g. `payables`, `subscriptions`, `reviews`, `crew_members.active`). The
agents will simply return early if those tables aren't there — add them
on your own schedule.

For the Internal Q&A agent's vector search to work, install the pgvector
extension:
```sql
create extension if not exists vector;
```
And run an ingest script (one is not included) that walks
`Buds At Work/SOPs/`, chunks the content, and embeds it into
`knowledge_articles`. Until then the agent falls back to ilike full-text.

### Lobby (live in your app)
- `src/app/(app)/dashboard/agents/lobby/page.tsx` — server-fetched initial
  state, hands off to the client component.
- `src/app/(app)/dashboard/agents/lobby/_components/LobbyClient.tsx` —
  animated office floor plan, subscribes to Supabase Realtime on
  `agent_runs`, `agent_actions`, and `design_insights` so the desks light
  up as your agents actually work.

## Setup

### 1. Run the migration
```bash
supabase db push
# or apply 037_agents.sql via your usual deploy path
```

### 2. Environment variables
Add to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
AGENT_DEFAULT_MODEL=claude-sonnet-4-6   # optional override
CRON_SECRET=<long-random-string>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Optional — Lucky Orange (without these the design agents use fixture data)
LUCKY_ORANGE_SITE_ID=a592b727
LUCKY_ORANGE_API_KEY=<from dash.luckyorange.com → API>
LUCKY_ORANGE_API_SECRET=<paired secret>
```

### 3. Verify admin auth helper
`runtime.ts` and the API routes both import `@/lib/auth` and call
`requireAdmin(req)`. If your existing auth helper uses a different name,
either alias it or tweak the import. Looking at `src/lib/auth.ts` you
should already have something close.

### 4. Hook up Vercel Cron
Add this to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/agents/cron?agent_id=quote-triage&secret=${CRON_SECRET}",       "schedule": "*/10 * * * *" },
    { "path": "/api/agents/cron?agent_id=customer-reply&secret=${CRON_SECRET}",     "schedule": "*/15 * * * *" },
    { "path": "/api/agents/cron?agent_id=scheduling&secret=${CRON_SECRET}",         "schedule": "0 16 * * *" },
    { "path": "/api/agents/cron?agent_id=applicant-screener&secret=${CRON_SECRET}", "schedule": "0 9 * * 1-5" },
    { "path": "/api/agents/cron?agent_id=ndis-compliance&secret=${CRON_SECRET}",    "schedule": "0 8,16 * * *" },
    { "path": "/api/agents/cron?agent_id=reviews&secret=${CRON_SECRET}",            "schedule": "0 10 * * *" },
    { "path": "/api/agents/cron?agent_id=crew-briefing&secret=${CRON_SECRET}",      "schedule": "0 6 * * *" },
    { "path": "/api/agents/cron?agent_id=reconciliation&secret=${CRON_SECRET}",     "schedule": "0 7 * * *" }
  ]
}
```
Vercel Cron on the Hobby plan limits you to daily — bump to Pro for the
sub-hour ones, or run them from a Supabase scheduled function instead.

### 5. Effect handlers
`runtime.ts` has a `dispatchEffect()` stub. Each `case` should call your
existing libraries, e.g.:

```ts
case 'send_email':
  await sendResendEmail(payload as {to:string; subject:string; html:string});
  return;
case 'send_sms':
  await sendTwilioSms(payload as {to:string; body:string});
  return;
case 'create_quote':
  await fetch('/api/quotes', { method:'POST', body:JSON.stringify(payload) });
  return;
```
Until you fill these in, approved actions log to console and mark themselves
executed — safe but a no-op.

### 6. Add columns the agents expect

A few agents reference columns that may not exist yet on your existing
tables. Add as needed:

```sql
alter table public.quotes
  add column if not exists agent_triaged_at  timestamptz,
  add column if not exists agent_estimate_aud numeric,
  add column if not exists agent_service     text,
  add column if not exists agent_ndis        boolean;

alter table public.applicants
  add column if not exists agent_screened_at   timestamptz,
  add column if not exists agent_score         integer,
  add column if not exists agent_recommendation text;

alter table public.jobs
  add column if not exists review_requested_at  timestamptz,
  add column if not exists review_responded_at  timestamptz,
  add column if not exists review_follow_up_at  timestamptz,
  add column if not exists ready_to_invoice_at  timestamptz;
```

### 7. Open the dashboard
- **Preview (no setup):** open `agents-preview.html` or
  `agents-lobby-preview.html` in any browser.
- **Live admin dashboard:** start `npm run dev` and visit
  `http://localhost:3000/dashboard/agents`.
- **Live lobby (the video-game view):** visit
  `http://localhost:3000/dashboard/agents/lobby` — pushes updates over
  Supabase Realtime, so as your agents actually run you'll see their
  desks light up.

### 8. Enable Realtime on the agent tables
The lobby uses Supabase Realtime. In the Supabase dashboard → Database
→ Replication, turn on replication for `agent_runs`, `agent_actions`,
and `design_insights`. Or run:
```sql
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.agent_actions;
alter publication supabase_realtime add table public.design_insights;
```

## How the autonomy levels work
- `auto`   — actions execute immediately on the agent's behalf (Crew Briefing).
- `review` — actions land in the approval queue; you click Approve to execute.
- `manual` — agent only runs when you click "Run now".

You can change an agent's autonomy at any time:
```sql
update public.agents set autonomy = 'auto' where id = 'quote-triage';
```

## Recommended rollout

1. **Week 1.** Run migration. Open the live dashboard. Click *Run now* on
   Quote Triage and Customer Reply with everything in `review` mode.
   Approve/reject manually to teach yourself the system's quirks.
2. **Week 2.** Wire the Vercel Cron entries. Watch the activity chart.
3. **Week 3.** Promote Crew Briefing to `auto` (already configured).
4. **Week 4.** If Quote Triage has < 5% rejection rate, raise its
   `auto_send_under_aud` threshold gradually.

## Cost expectations
At the volumes implied by your codebase (a few dozen quotes/week,
~10 applicants/week, ~5 design audits/week), all 14 agents together
should run **under $15/month** in model costs on Sonnet 4.6. Use
Haiku 4.5 (`AGENT_DEFAULT_MODEL=claude-haiku-4-5-20251001`) for the
non-creative agents to roughly halve that.

## How the design loop closes
1. **Heatmap Analyst** finds a hotspot or scroll-dropoff issue on a page.
2. It writes a row into `design_insights`.
3. **Copy Optimizer** and **Layout Critic** pick up the same page on
   their next runs and add complementary insights.
4. **A/B Test Architect** (manual trigger) reads the whole `design_insights`
   backlog and proposes prioritized A/B tests with sample-size estimates.
5. You review insights at `/dashboard/agents/insights` (mark accepted /
   shipped) — that page isn't built yet; one file, ~120 lines if you
   want me to add it.
6. Shipped changes feed back into Lucky Orange → the next run measures
   the effect.

This is the "evolve over time" loop. The agents don't retrain themselves,
but their `agent_memory` table is where you store the playbook lessons
(e.g. "yard CTAs convert 22% better in green than amber for our audience").

## Where memory lives
Each agent can write to `agent_memory` (key/value/weight). Use this to
store learned playbooks like "Springwood window jobs average 1.2× longer
than estimated — adjust quotes upward 15%" without touching prompts.

## Questions / next steps
- Want the **applicant**-side Aussie context tuned more sharply (e.g.
  postcode → suburb mapping for travel-distance filtering)?
- Want a per-agent **history page** (`/dashboard/agents/[id]`) that shows
  a single agent's run log with full input/output diffs? The route is
  wired; the page just isn't built yet.
- Want the Quote Triage agent to call your existing pricing rules
  programmatically rather than estimate from the LLM? That's a 30-line
  refactor of `quote-triage.ts`.
