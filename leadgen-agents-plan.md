# Lead-Gen Agents for budsatwork.com — Build Plan

**Goal:** 4 AI agents living inside `/dashboard/agents` that bring solid leads to budsatwork.com, modeled on the playbook Indicreative uses for its trades clients (Google Ads + Meta Ads + SEO + conversion websites), extended with LinkedIn and cold email.

The model isn't "Indicreative as a service" — it's: do what a full-service agency does for one client, but as software, running 24/7, inside your own console.

---

## The four agents

Each agent has the same anatomy: a job, inputs it needs from you, work it does on a schedule, leads it produces, and a scoring/handoff step. Quality > quantity. The whole system pivots on one shared **Lead** record so everything pours into one pipeline.

### 1. SEO & Content Agent — "Discovery"

Goal: capture people who are already searching for what you sell.

What it does on a loop:
- Keyword research from a seed list (your services + competitor terms) using a keyword API (DataForSEO, Ahrefs, Semrush — pick one).
- Cluster keywords into topics and rank them by `intent × volume × competition`.
- Draft long-form articles and service pages, write title/meta/schema, suggest internal links.
- Audit on-page issues (page speed, missing alts, broken links, thin pages) and queue fixes.
- Track ranking drift weekly; flag pages losing position.
- Watch your GSC data and surface "almost there" queries (positions 6–20) — those convert fastest with targeted work.

Inputs you give it once: your ICP, services, locations served, brand voice, 5–10 competitor URLs.

Outputs: published/draft articles, a content calendar, a rankings dashboard, and *leads from form fills* on those pages.

Integrations: your CMS (WordPress, Webflow, or your own admin), Google Search Console, Google Analytics 4, a keyword data provider, optionally Ahrefs/Semrush.

### 2. Paid Ads Agent — "Pressure"

Goal: buy intent (Google) and interrupt (Meta) at a controlled cost per lead.

What it does on a loop:
- Builds Google Search campaigns from your keyword clusters (one campaign per cluster, exact + phrase, negatives auto-pulled from search terms reports).
- Generates ad copy variants (5 headlines × 3 descriptions) and rotates them.
- Builds Meta campaigns with audience hypotheses (lookalikes off your customer list, interest stacks, retargeting) and rotates creative weekly.
- Generates landing pages tied to each ad cluster (one page per offer — this is the highest-leverage thing it does).
- Watches CPL, CTR, conversion rate; pauses losers, scales winners, rewrites underperforming ads.
- Sends a weekly "what I changed and what I learned" report.

Inputs you give it once: budget cap, offer, target CPL, conversion event, brand assets.

Outputs: live campaigns, landing pages, and *leads from form fills/calls*.

Integrations: Google Ads API, Meta Marketing API, your landing-page builder (or it generates pages directly into your stack), GA4, call tracking (CallRail/Twilio).

This is the agent that most directly mirrors what Indicreative actually sells — the "Old Mate Plumbing got 600% lead quality lift in month one" story is *this* agent.

### 3. LinkedIn Outreach Agent — "Direct"

Goal: get conversations started with named decision-makers.

What it does on a loop:
- Builds prospect lists from your ICP (title + industry + company size + geography).
- Enriches contacts (email + role + recent activity) via Apollo/Clay/ZoomInfo.
- Sends connection requests with a personal first line drawn from the prospect's recent post or company news.
- Multi-step sequences: connect → wait → soft message → wait → value drop → wait → ask.
- Replies are routed to a human (you) before any commitment is made — agent drafts, you approve.
- Tracks acceptance rate, reply rate, meeting-booked rate per persona and per opener; kills variants that underperform.

Inputs: ICP definition, list of competitor LinkedIn pages, your point of view / hook.

Outputs: booked meetings, plus warm replies handed to you.

Integrations: LinkedIn (via a compliant automation layer — Heyreach, La Growth Machine, or PhantomBuster), Apollo/Clay for enrichment, your calendar.

**Compliance note:** LinkedIn rate limits and ToS matter. Cap at ~20 connects/day per seat, vary timing, route through a residential proxy bound to one seat. Don't try to scale this past 2–3 seats per offer — it stops working.

### 4. Cold Email Agent — "Volume"

Goal: at-scale, deliverability-first outbound to the rest of the addressable market.

What it does on a loop:
- Pulls TAM lists matching your ICP (Apollo / Clay).
- Verifies every email (NeverBounce / MillionVerifier) — never send to unverified.
- Warms up sender domains automatically (Instantly, Smartlead, lemwarm).
- Sends from 5–10 secondary domains, 30–50 emails/day per inbox, rotates inboxes.
- Personalizes the first line per prospect using a small LLM call against scraped public signals (recent funding, hiring, blog post).
- 3-step sequence: hook → case study → break-up. No more than 3 follow-ups, ever.
- Routes positive replies to you within 2 minutes; auto-handles "wrong person" and "not interested" responses.
- Tracks deliverability per inbox (spam rate, bounce rate) and pauses inboxes that degrade.

Inputs: ICP, offer, 2–3 case studies, sender domains (buy these in advance — they need 2–3 weeks of warmup).

Outputs: positive replies and booked calls.

Integrations: Apollo/Clay for lists, Instantly or Smartlead as the sender layer, NeverBounce, your calendar.

---

## The thing that ties them together — the Lead Concierge

Without this, you have four lead firehoses going in four different directions. With it, you have one pipeline.

The Concierge is a fifth agent (or just a service inside the dashboard) that:

1. **Catches every lead** from every source — form fill, ad conversion, LinkedIn reply, email reply, organic page view that converted.
2. **Normalizes** them into a single `Lead` record: name, company, email, source, source detail, intent signals, enrichment data.
3. **Scores** them 0–100 based on ICP fit + intent (a positive reply scores higher than a whitepaper download, a CFO at a 500-person SaaS scores higher than an intern at a 10-person agency).
4. **Routes** them:
   - 80+ → notify you immediately, draft personalized follow-up.
   - 50–79 → into a nurture sequence (email + retargeting).
   - <50 → archive, but keep for cohort learning.
5. **Closes the loop** — when a lead becomes a customer, that data goes back into all four agents so they learn what good actually looks like (used to retrain ICP, refresh keyword targets, rebuild lookalike audiences).

This last point is what most lead-gen "stacks" miss. Without closed-loop learning, the agents drift.

---

## Dashboard architecture at /dashboard/agents

Five top-level panels — one per agent plus the Concierge:

```
/dashboard/agents
├── /seo            -- SEO & Content Agent
├── /ads            -- Paid Ads Agent
├── /linkedin       -- LinkedIn Outreach Agent
├── /email          -- Cold Email Agent
└── /concierge      -- Pipeline + scoring + routing
```

Each agent panel has the same shape so the UX is consistent:

- **Status card** — running / paused, last run, next run, today's output.
- **Inbox** — leads / outputs the agent produced that need your eyes.
- **Settings** — the ICP, voice, budget, guardrails you control. Editing settings retrains/redeploys the agent.
- **Performance** — north-star metric per agent (SEO: rankings + organic leads; Ads: CPL + leads; LinkedIn: reply rate + meetings; Email: positive replies + meetings).
- **Activity log** — every action the agent took, with diff so you can audit.

Plus a top-level **Overview** card showing all four agents at a glance with traffic-light status and total qualified leads this week. Make this the default view — it's what you'll open every morning.

### Data model (minimum viable)

```
Lead
  id, source ('seo'|'ads'|'linkedin'|'email'), sourceDetail
  contact (name, email, title, company, linkedin)
  enrichment (industry, size, signals[])
  score (0-100), scoreBreakdown
  status ('new'|'engaged'|'qualified'|'meeting'|'won'|'lost')
  events[] (timestamped — touches, opens, replies)

Agent
  id, type, status ('idle'|'running'|'paused'|'error')
  config (the ICP, voice, budget, guardrails)
  lastRunAt, nextRunAt
  metrics (rolling 7d / 30d)

AgentAction
  agentId, type, payload, result, cost, createdAt
  (so you can audit every move + compute spend)
```

### Agent runtime

You have two reasonable shapes:

- **Cron + worker** (simpler) — each agent is a scheduled job. Easy to reason about. Good if budgets are bounded and runs are short.
- **Event-driven + queue** (more flexible) — agents react to events (new keyword discovered, new prospect enriched, reply received). Better for the Concierge, mandatory for real-time lead routing.

Start with cron for everything except the Concierge (which has to be event-driven). Add events as you go.

For the LLM layer, each agent should expose a small set of well-typed tools (e.g. `search_keywords`, `draft_article`, `generate_ad_copy`, `send_email`, `enrich_contact`). Anthropic SDK or OpenAI tool-use works fine. Don't let the agent write SQL or call arbitrary APIs — every tool is a checked interface.

---

## Integrations checklist (what you need to buy/build)

| Layer | Tool options |
|---|---|
| Keyword & SEO data | DataForSEO API ($), Ahrefs API ($$), Semrush API ($$) |
| Search Console / Analytics | Google Search Console API, GA4 API (free) |
| Ads | Google Ads API, Meta Marketing API (free, but accounts needed) |
| Landing pages | Build natively in your stack OR Unbounce/Instapage |
| Call tracking | CallRail or Twilio Programmable Voice |
| LinkedIn automation | Heyreach, La Growth Machine, Lemlist (pick one — don't roll your own) |
| Prospect data | Apollo, Clay, ZoomInfo |
| Email verification | NeverBounce, MillionVerifier |
| Cold email sending | Instantly or Smartlead |
| CRM (or build into your own admin) | HubSpot free tier, or Pipedrive, or your own table |
| Domains for cold email | 5–10 secondary domains, $10/yr each, warmed 2–3 weeks |

Total monthly software cost for a serious setup: **~$800–$1,500/mo** before ad spend.

---

## Recommended build sequence

You said you're starting from zero. Don't try to ship all four at once. Build in this order:

**Phase 0 — Decide your ICP (this week).** You said "mixed / not sure yet." The agents can't work without a target. Even a *provisional* ICP works — write down: who is the buyer, what trigger makes them buy, what does a $5–10k deal look like, what does a $50k deal look like? You can refine later. The Concierge's scoring function depends on this.

**Phase 1 — Concierge + Lead model + dashboard skeleton (Weeks 1–3).** Build the data model, the shared dashboard shell, and the scoring/routing logic. Wire it to your existing site forms so it captures *anything* — even pre-agent — into one pipeline. You'll thank yourself later.

**Phase 2 — Paid Ads Agent (Weeks 3–6).** Fastest path to leads. Indicreative's clients see results in month one because paid ads buy time. Start with Google Search only (intent is purer than Meta), add Meta after CPL is stable.

**Phase 3 — Cold Email Agent (Weeks 5–8).** Domains warm in parallel during Phase 2. Once warm, this scales fast.

**Phase 4 — SEO & Content Agent (Weeks 6–12).** SEO is a 6-month investment, so start it early but don't expect leads from it for ~3 months.

**Phase 5 — LinkedIn Outreach Agent (Weeks 9–12).** Slowest to scale and highest manual oversight, so build it last when the rest of the loop is humming.

---

## Guardrails — what the agents must NOT do without you

This matters because lead-gen agents can do real damage (burn ad spend, get domains blacklisted, get LinkedIn banned, send embarrassing email).

Hard rules:

- **No agent spends > $X/day without your approval.** Daily budget caps on every paid campaign.
- **No agent sends from your primary domain.** Cold email goes from secondary domains only.
- **No agent publishes content without a one-click review.** SEO articles go to drafts, you approve.
- **No agent claims things in copy it can't back up.** Agents should be fed your verified case studies and only quote those.
- **Every outbound message is logged and reversible** — you can pull any sequence, see who got what, and stop it in one click.

---

## Honest take

The agency model Indicreative uses works because they combine **paid intent capture** (Google Ads), **paid interruption** (Meta), and **organic intent capture** (SEO), all pointing at **conversion-built landing pages**, with a real human triaging leads. Replacing the human triage with an agent (the Concierge) is the new and interesting bit. Replacing the strategy with an agent isn't — strategy still comes from you defining ICP and offer. Treat the agents as execution layers; you stay the strategist.

The biggest reason DIY lead-gen agents fail is not the AI. It's that the founder hasn't nailed the ICP and offer first, so the agents amplify the wrong signal. Spend the week on ICP before you write a line of code.

---

## What to do next

1. Lock down the ICP and offer in writing.
2. Decide build vs. buy on the integrations (most teams buy Instantly/Heyreach/Apollo and build the orchestration layer themselves — that's the right split).
3. Stand up the Concierge + dashboard shell. Without it, the other four agents have nowhere to put their leads.
4. Ship the Paid Ads agent first. Fastest to revenue.
