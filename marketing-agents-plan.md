# Marketing Agent Team — Build Plan & Spec

**Status:** Proposal for approval. No production code written yet.
**Owner:** Jackson
**Date:** 2026-05-30
**Lives at:** `https://budsatwork.com/dashboard/insights` → new **Marketing Studio** tab
**Constitution:** Follows `CLAUDE.md` — surgical changes, agents are a real service layer, schema changes need your sign-off, nothing pricing-related is touched.

---

## 1. What you asked for

> "A team of agents that build full-scale, premium ads and marketing for Buds At Work without hiring anyone. Simple daily content from the jobs I'm on with the crew — and outside of jobs — so we build a base and scale customers. Track views, engagements, content published and followers. Make Stanley Henry and The Attention Seeker run the marketing. Live it in /dashboard/insights."

Locked decisions (from our kick-off):

| Decision | Choice |
|---|---|
| Channels | Instagram · TikTok · Facebook + Local Groups · Google Business Profile |
| How metrics get in | **Manual entry now**, platform APIs later |
| Content raw material | **Mix** — real job footage + AI-generated on quiet days |
| First deliverable | **This plan + a clickable mockup** before any production code |

---

## 2. The big idea

We already have half a marketing team built. The `src/lib/agents/` layer has a **Content Agent** that drafts Instagram/Facebook/GBP/blog posts from real recent jobs, plus Competitor Watcher, Copy Optimizer, SEO Meta, Reviews and Lapsed Win-Back. They're wired but they have no *director*, no *growth engine*, and no *scoreboard*.

This plan adds three things:

1. **A marketing pod with a brain** — two lead agents (Stanley Henry, The Attention Seeker) who direct the existing content agents, reporting up to **Bud** (your orchestrator) like every other pod.
2. **A daily capture loop** — a dead-simple brief that tells you and the crew what to film on each job, then turns it into premium posts. Works on quiet days too with AI-generated creative.
3. **A scoreboard** — views, engagements, content published, followers, tracked per channel, that the agents read to decide what to make next.

No hiring. The "team" is software. You stay the approver.

---

## 3. The agent pod

All agents follow the existing `AgentDefinition` contract (`id`, `name`, `description`, `category`, `autonomy`, `schedule`, `run()`) and register in `src/lib/agents/registry.ts`. Marketing files under the existing `sales` category (there's no `marketing` category in `types.ts` today — see §8 recommendation to add one).

### 3.1 Stanley Henry — Creative Director
- **Role:** Owns the brand and the *premium* bar. Turns raw job footage and campaign goals into full ad concepts: the hook, the shot list, the caption angle, the offer. Guards the "warm Australian tradie, never corporate" voice. Says no to anything that looks cheap.
- **Output:** Campaign concepts + ad briefs handed down to the Content Agent; final-polish pass on anything before it's queued.
- **Autonomy:** `review` — Stanley proposes, you approve. (Premium creative is judgement; keep a human gate.)
- **Schedule:** Weekly campaign planning + on-demand when a new campaign opens.
- **Reads:** `marketing_campaigns`, recent jobs, `content_drafts`, scoreboard.

### 3.2 The Attention Seeker — Growth & Distribution Lead
- **Role:** Chases reach. Owns hooks, trends, posting cadence, hashtags, and the follower/engagement curve. Watches what's working on the scoreboard and doubles down. Where Stanley protects the brand, The Attention Seeker protects the *numbers*.
- **Output:** Daily posting schedule, hook variations, trend-jack suggestions, "post this now" nudges, engagement plays (reply prompts, CTAs, local-group seeding).
- **Autonomy:** `review` for anything published; `auto` for internal recommendations and scheduling proposals.
- **Schedule:** Daily.
- **Reads:** `marketing_metrics` (scoreboard), `content_drafts`, Competitor Watcher output.

### 3.3 Field Producer — Daily Capture Brief *(new, lightweight)*
- **Role:** The bridge between you-on-a-job and the content machine. Each morning it looks at the day's scheduled jobs (service, suburb) and produces a **3-line shot list**: what to film, the one before/after to nail, and the line to say to camera. On no-job days it issues an "evergreen" brief (tips, team, behind-the-scenes).
- **Output:** A `capture_brief` for the day, shown at the top of the Marketing Studio tab and (optionally) texted/emailed to crew.
- **Autonomy:** `auto` — it only suggests; costs nothing.
- **Schedule:** Daily, early AM. Use `preferredModel: 'claude-haiku-4-5-20251001'` (cheap, it's just aggregation).

### 3.4 Content Agent — *(exists, keep)*
Drafts the actual captions/posts per channel from the footage + Stanley's brief, into `content_drafts`. Already built. We extend it to accept a `campaign_id` and a Stanley brief as input.

### 3.5 Scoreboard Keeper — Metrics tracker *(new, lightweight)*
- **Role:** Owns the numbers. In manual-first mode it validates and stores the daily figures you log, computes deltas/trends, and flags anomalies ("TikTok views down 40% — last 2 posts had weak hooks"). When APIs are connected later, it pulls automatically instead.
- **Autonomy:** `auto`.
- **Schedule:** Daily, after capture brief.

**Reporting line:** Bud → {Stanley Henry, The Attention Seeker} → {Field Producer, Content Agent, Scoreboard Keeper, + existing Competitor Watcher / SEO Meta / Reviews}. This mirrors how Bud already orchestrates other pods, so no new data contracts for Bud are broken.

---

## 4. The daily content loop

```
06:30  Field Producer reads today's jobs → posts a 3-line capture brief to Marketing Studio
        ("Window clean in Springwood today. Film the glass before/after in one pan.
          Say: 'Streak-free or we come back free.'")

On job  You/crew shoot 2–3 clips + a before/after photo on the phone. Upload (or it
        flows from Photo QA, which already gates photos for marketing use).

Midday  Content Agent + Stanley Henry turn footage into premium posts for IG / TikTok /
        FB / GBP. Quiet day with no footage? AI-generated creative fills the gap.

PM      The Attention Seeker schedules them at peak local times, adds hooks/hashtags.
        Everything lands in the Content Queue as 'draft' → you tap approve.

Daily   You log the day's numbers (or it auto-pulls later). Scoreboard Keeper updates
        the KPIs and tells the pod what to make more of tomorrow.
```

The whole thing is designed so your part is: **shoot a few clips, tap approve, type four numbers.** Everything else is the agents.

---

## 5. The scoreboard (metrics)

Four headline KPIs you asked for, tracked **per channel and combined**, with 7-day and 30-day deltas:

| Metric | Definition | Source (now → later) |
|---|---|---|
| **Views** | Reach/impressions/plays | Manual daily entry → IG Graph / TikTok / Meta APIs |
| **Engagements** | Likes + comments + shares + saves | Manual → APIs |
| **Content Published** | Posts actually shipped that day | Auto-counted from the Content Queue (no typing needed) |
| **Followers** | Total followers per channel | Manual → APIs |

Plus two derived signals the agents act on: **engagement rate** (engagements ÷ views) and **publish streak** (consecutive days shipped — consistency is the #1 growth lever for local trades).

---

## 6. First campaign — "Streak-Free July" (window cleans, 8–11 July)

You've got one unofficial window-clean booking around **8–11 July**. We make that the team's first real campaign and the proof-of-concept:

- **Stanley Henry** builds the campaign: hook = *"Streak-free or we come back free,"* premium before/after format, one hero reel + 3 cut-downs.
- **Field Producer** briefs the actual 8–11 July job: film the glass, the squeegee pull, the reveal.
- **The Attention Seeker** runs a 2-week ramp *before* the job (build anticipation + book the surrounding week solid) and a 1-week proof run *after* (real results → more window-clean bookings).
- **GBP + Local Groups** push "window cleaning near me / Logan / South Brisbane" while intent is captured.
- **Goal:** turn one booking into a booked-out window-clean week in July, and a repeatable template for every service after.

This campaign is also the honest test of whether the system earns its keep before we scale it to cleaning, yard, detailing, dump runs, laundry and NDIS.

---

## 7. Where it lives — the Marketing Studio tab

New tab in `src/app/(app)/dashboard/insights/page.tsx` (the page already does tabbed nav: Bud Leads / Overview / Reports / Visitors → add **Marketing Studio**). Built with the existing shared components (`Panel`, `StatRow`, `WorkbenchStatGrid`, `WorkbenchTabs`) and `brand.*` / `glass` tokens, so it looks native. Sections:

1. **Scoreboard** — 4 KPI cards (Views, Engagements, Content Published, Followers) with deltas + per-channel breakdown.
2. **Today's Capture Brief** — the Field Producer's 3-line shot list for today.
3. **The Pod** — agent roster cards (Stanley Henry, The Attention Seeker, Field Producer, Content Agent, Scoreboard Keeper) with status + last run.
4. **Content Queue** — drafts → approved → scheduled → published, with one-tap approve.
5. **Campaigns** — Streak-Free July and future campaigns, with progress.
6. **Log Today's Numbers** — a 4-field manual entry strip (until APIs land).

A clickable mockup of this exact layout ships alongside this doc: `marketing-studio-preview.html`.

---

## 8. Proposed schema *(requires your approval before I apply it — per CLAUDE.md)*

New migration `077_marketing_studio.sql`. Three new tables + reuse of the existing `content_drafts`:

```sql
-- Daily metric snapshots (manual now, API-fed later)
create table public.marketing_metrics (
  id                uuid primary key default gen_random_uuid(),
  snapshot_date     date not null,
  channel           text not null check (channel in ('instagram','tiktok','facebook','gbp','combined')),
  views             integer default 0,
  engagements       integer default 0,
  content_published integer default 0,
  followers         integer default 0,
  source            text not null default 'manual' check (source in ('manual','api')),
  created_at        timestamptz not null default now(),
  unique (snapshot_date, channel)
);

-- Campaigns (e.g. Streak-Free July)
create table public.marketing_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  service_type  text,
  hook          text,
  starts_on     date,
  ends_on       date,
  status        text not null default 'planning'
                  check (status in ('planning','active','wrapped','archived')),
  goal_notes    text,
  created_at    timestamptz not null default now()
);

-- Daily capture briefs from the Field Producer
create table public.capture_briefs (
  id            uuid primary key default gen_random_uuid(),
  brief_date    date not null unique,
  job_context   text,        -- service + suburb for the day
  shot_list     text[] default '{}'::text[],
  say_to_camera text,
  run_id        uuid references public.agent_runs(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Extend existing content_drafts with campaign link (additive, backwards-compatible)
alter table public.content_drafts add column if not exists campaign_id uuid
  references public.marketing_campaigns(id) on delete set null;
alter table public.content_drafts add column if not exists channel_tiktok_ok boolean default false;
```

RLS: service-role write + admin read, matching the pattern in `040_agents_batch345.sql`. No existing table is altered destructively; the `content_drafts` change is additive only.

---

## 9. Build sequence (once you approve)

1. **DB** — apply `077_marketing_studio.sql` (after your sign-off).
2. **Agents** — add `stanley-henry.ts`, `attention-seeker.ts`, `field-producer.ts`, `scoreboard-keeper.ts`; extend `content-agent.ts` for campaigns; register all in `registry.ts`. Each is `review`/`auto` per §3 — nothing auto-publishes.
3. **Dashboard** — add the Marketing Studio tab + a `useMarketingData` hook, reusing shared components and brand tokens. Wire the manual-entry strip.
4. **Schedules** — Field Producer + Scoreboard Keeper daily; Stanley weekly; Attention Seeker daily (via the existing agent cron in `026_automation_cron_support.sql`).
5. **First campaign** — seed Streak-Free July, run the loop end-to-end against the 8–11 July booking.
6. **Verify** — `tsc --noEmit`, `eslint src/`, `next build`; `graphify update .` after.

Each step is a small reviewable batch, per the refactor strategy in CLAUDE.md.

---

## 10. Extra recommendations (your "add anything more" ask)

- **Add a real `marketing` agent category** to `types.ts` instead of overloading `sales`. Small change, makes the pod first-class and keeps Bud's dashboards clean. (Currently categories are sales/support/ops/hiring/finance/compliance.)
- **Consistency beats virality.** For a local trade, a 30-day publish streak will out-perform one viral hit. Make *publish streak* a headline number — the Attention Seeker should optimise for "shipped every day" first, reach second.
- **Reviews are content.** Wire the existing Reviews agent into the loop: every 5-star review becomes a post. Social proof is your cheapest premium content.
- **Local-first targeting.** Logan + South Brisbane suburb names in every caption/GBP post. The agents already know the suburb from the job — use it. "Window cleaning in Springwood" beats "window cleaning" for booking.
- **One CTA per post** (matches your UX rule). Every post points to the quote flow. Track which channel drives quotes by adding a `?utm_source=` tag the Visitors tab already captures — closes the loop from *view* to *booked job*.
- **Repurpose, don't reinvent.** One job's footage = an IG reel + a TikTok + an FB post + a GBP update + a blog. The Content Agent already thinks per-channel; lean on it.
- **A weekly "Marketing Standup"** auto-summary from Bud: what shipped, what moved the numbers, what Stanley + The Attention Seeker recommend next week. Reuses the existing standup/observer pattern.
- **Guardrail:** keep `review` autonomy on anything customer-facing until the brand voice is proven. Per CLAUDE.md, any comms sent to real customers/audiences need a human gate — the approve-to-publish queue enforces exactly that.

---

## 11. What I need from you to proceed

1. **Approve the schema** in §8 (or tell me what to change) — it's the one thing CLAUDE.md says needs your sign-off.
2. Confirm the **two lead-agent roles** (Stanley Henry = Creative Director, The Attention Seeker = Growth Lead) feel right, or reassign.
3. Say go, and I'll build in the sequence in §9 — starting with the Marketing Studio tab so you can see it live, then the agents behind it.
