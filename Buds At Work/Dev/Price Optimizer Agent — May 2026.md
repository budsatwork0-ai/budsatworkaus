# Price Optimizer Agent — May 2026

> Tracks our pricing exactly and recommends adjustments based on **market capacity** — our own crew availability, demand signals, wholesale cost drift, and competitor prices. Recommendations land in the approval queue on `/dashboard/agents` so an admin reviews every change before it goes live.

## The problem

We have plenty of signals about whether our prices are right but no one looking at them together:

- **Win rate by service / suburb** — quote-triage estimates land in `quotes.agent_estimate_aud`, and we know which got accepted. If yard quotes in Springwood are winning 85% at $180 we are leaving money on the table; at 30% we are too high.
- **Crew capacity** — the scheduling agent knows how many crew-hours we have next week. If we are 95% booked, raise prices; if we are 40% booked, drop them or run a promo.
- **Wholesale drift** — fuel, dump-fees, detergent. When inputs move, prices should follow.
- **Competitor moves** — `competitor-scout` and `competitor-watcher` already populate `competitor_intel`. Today no one acts on it.

Today these live in five different places and pricing changes happen ad-hoc.

## What the agent does

Runs weekly (Mondays 5am Brisbane time). For each `(service, suburb)` pair with enough volume to be statistically meaningful:

1. **Pull baseline** — current rate from `service_pricing`.
2. **Compute win-rate** over the last 28 days from `quotes` (won / sent).
3. **Compute capacity utilisation** — booked crew-hours next 14 days ÷ available crew-hours.
4. **Compute cost drift** — current input costs vs. costs at the time of the last price change.
5. **Compute competitor band** — p25 / median / p75 from `competitor_intel` filtered to that service+suburb in the last 30 days.
6. **Ask Claude** for a single integer recommendation (`hold`, `raise`, `lower`) with a target price and a one-paragraph justification grounded in the numbers above.
7. **Propose an action** with `requires_approval: true`. The payload contains the proposed `service_pricing` update. An admin clicks approve in the existing approval queue → the runtime executes the update.

No price ever changes without a human approving it. We chose `autonomy: 'review'` for that reason.

## Market-capacity rule of thumb (the agent's prior)

| Capacity (next 14d) | Win rate | Bias       |
|---------------------|----------|------------|
| > 85%               | any      | raise 3–8% |
| 60–85%              | > 70%    | raise 2–4% |
| 60–85%              | 40–70%   | hold       |
| 60–85%              | < 40%    | lower 3–5% |
| < 60%               | < 50%    | lower 5–10% + promo |
| < 60%               | > 50%    | hold (capacity is the problem, not price) |

These are starting weights; `agent-architect` can revise them by editing `agents.config` for `price-optimizer`.

## Data model additions

### `service_pricing` (new)

The current rate card. One row per `(service, suburb, price_unit)`.

```sql
create table public.service_pricing (
  id          uuid primary key default gen_random_uuid(),
  service     text not null,            -- 'cleaning','yard','windows','dump','auto','laundry_sneakers'
  suburb      text,                     -- nullable = applies to all suburbs
  price_unit  text not null check (price_unit in ('per_hour','per_visit','per_sqm','flat')),
  price_aud   numeric(10,2) not null,
  effective_from timestamptz not null default now(),
  set_by      uuid references auth.users(id),
  set_reason  text,
  unique(service, suburb, price_unit, effective_from)
);
```

### `pricing_recommendations` (new)

Every recommendation the agent has made, whether approved or not.

```sql
create table public.pricing_recommendations (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.agent_runs(id) on delete cascade,
  service         text not null,
  suburb          text,
  price_unit      text not null,
  current_price   numeric(10,2) not null,
  recommended_price numeric(10,2) not null,
  direction       text not null check (direction in ('raise','lower','hold')),
  delta_pct       numeric(5,2) not null,
  capacity_pct    numeric(5,2),
  win_rate_pct    numeric(5,2),
  competitor_p25  numeric(10,2),
  competitor_p50  numeric(10,2),
  competitor_p75  numeric(10,2),
  cost_drift_pct  numeric(5,2),
  rationale       text not null,
  status          text not null default 'pending' check (status in (
                    'pending','approved','rejected','applied','superseded'
                  )),
  created_at      timestamptz not null default now()
);
```

## Dashboard integration

The new agent shows up automatically in the grid on `/dashboard/agents` once we run the seed insert. Pending price changes appear in the existing **Pending approvals** section because they are `agent_actions` with `requires_approval = true`.

Future polish (out of scope for the first cut):

- A dedicated **Pricing** tab under `/dashboard/agents/[price-optimizer]` showing the rec table with sparkline of win-rate per service.
- A **Capacity gauge** alongside the existing Stats row.

## Failure modes & guards

- **Not enough data.** If a `(service, suburb)` has fewer than 8 quotes in 28 days, skip it. Log `insufficient_volume`.
- **Wild swings.** Cap recommended deltas at ±10% of the current price. Anything beyond that becomes two recommendations a week apart.
- **Competitor data stale.** If the freshest `competitor_intel` row for a service is older than 45 days, ignore the competitor signal (still recommend, but on win-rate + capacity only).
- **NDIS jobs.** NDIS pricing is regulated. The agent **excludes** any quote where `agent_ndis = true` from win-rate calculations and never proposes a change to an NDIS service.

## Config (stored in `agents.config`)

```json
{
  "min_quote_volume_28d": 8,
  "max_delta_pct": 10,
  "capacity_lookahead_days": 14,
  "win_rate_lookback_days": 28,
  "competitor_stale_after_days": 45,
  "exclude_ndis": true,
  "services_in_scope": ["cleaning","yard","windows","dump","auto","laundry_sneakers"]
}
```

## Files (additive, mirrors the rest of the agents framework)

- `supabase/migrations/043_price_optimizer.sql` — `service_pricing`, `pricing_recommendations`, seed.
- `src/lib/agents/agents/price-optimizer.ts` — the agent.
- `src/lib/agents/registry.ts` — one-line addition.
- `Buds At Work/Dev/Price Optimizer Agent — May 2026.md` — this file.

## Roll-out

1. Apply migration `043_price_optimizer.sql`.
2. Backfill `service_pricing` with current rates (manual one-off).
3. Add the import + registry entry.
4. Trigger one manual run via `POST /api/agents/run { "agent_id": "price-optimizer" }`.
5. Eyeball the pending recommendations on `/dashboard/agents` — approve a few, reject the silly ones, sit with it for two weeks before flipping the cron on.

## Related agents

- **competitor-scout** — provides the `competitor_intel` data this agent depends on. Make sure it has run at least once recently.
- **competitor-watcher** — narrower; polls URLs you have already configured. Both can run.
- **scheduling** — its booked-vs-available crew-hour calc is exactly the capacity signal we need. We will read directly from the jobs table for now and migrate to a shared helper later.
- **quote-triage** — the price estimates it produces are how we measure win rate. Don't change its prompt without re-running win-rate baselines.
- **agent-architect** — will see this agent's reject ratio after a month of runs and may propose config tweaks.
