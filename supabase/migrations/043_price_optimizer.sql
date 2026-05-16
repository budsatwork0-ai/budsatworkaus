-- =====================================================================
-- Migration 043: Price Optimizer agent
-- =====================================================================
-- Adds:
--   service_pricing            — the live rate card the agent reads & updates
--   pricing_recommendations    — every recommendation the agent has made
--   v_pricing_recs_pending     — convenience view for the dashboard
--   seed row in public.agents for 'price-optimizer'
--
-- Additive only. Safe to apply on top of 037–042.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. service_pricing — the current rate card
-- ---------------------------------------------------------------------
create table if not exists public.service_pricing (
  id              uuid primary key default gen_random_uuid(),
  service         text not null,                       -- 'cleaning','yard','windows','dump','auto','laundry_sneakers'
  suburb          text,                                -- null = applies everywhere we operate
  price_unit      text not null check (price_unit in (
                    'per_hour','per_visit','per_sqm','flat'
                  )),
  price_aud       numeric(10,2) not null check (price_aud > 0),
  effective_from  timestamptz not null default now(),
  set_by          uuid references auth.users(id) on delete set null,
  set_reason      text,
  created_at      timestamptz not null default now(),
  unique(service, suburb, price_unit, effective_from)
);

create index if not exists idx_service_pricing_service_suburb
  on public.service_pricing(service, suburb);

comment on table public.service_pricing is
  'Live service rate card. The Price Optimizer agent reads from this table to know the baseline and proposes updates that, once approved by an admin in /dashboard/agents, are written back here.';

-- ---------------------------------------------------------------------
-- 2. pricing_recommendations — audit trail of every recommendation
-- ---------------------------------------------------------------------
create table if not exists public.pricing_recommendations (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid references public.agent_runs(id) on delete cascade,
  service            text not null,
  suburb             text,
  price_unit         text not null,
  current_price      numeric(10,2) not null,
  recommended_price  numeric(10,2) not null,
  direction          text not null check (direction in ('raise','lower','hold')),
  delta_pct          numeric(5,2) not null,
  capacity_pct       numeric(5,2),
  win_rate_pct       numeric(5,2),
  competitor_p25     numeric(10,2),
  competitor_p50     numeric(10,2),
  competitor_p75     numeric(10,2),
  cost_drift_pct     numeric(5,2),
  rationale          text not null,
  status             text not null default 'pending' check (status in (
                       'pending','approved','rejected','applied','superseded'
                     )),
  created_at         timestamptz not null default now()
);

create index if not exists idx_pricing_recs_status
  on public.pricing_recommendations(status) where status in ('pending','approved');
create index if not exists idx_pricing_recs_service_suburb
  on public.pricing_recommendations(service, suburb, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Convenience view for the dashboard
-- ---------------------------------------------------------------------
create or replace view public.v_pricing_recs_pending as
select
  pr.id,
  pr.run_id,
  pr.service,
  pr.suburb,
  pr.price_unit,
  pr.current_price,
  pr.recommended_price,
  pr.direction,
  pr.delta_pct,
  pr.capacity_pct,
  pr.win_rate_pct,
  pr.competitor_p50,
  pr.rationale,
  pr.created_at,
  ar.summary as run_summary
from public.pricing_recommendations pr
left join public.agent_runs ar on ar.id = pr.run_id
where pr.status = 'pending'
order by pr.created_at desc;

-- ---------------------------------------------------------------------
-- 4. RLS — admin read, service-role write (matches existing pattern)
-- ---------------------------------------------------------------------
alter table public.service_pricing          enable row level security;
alter table public.pricing_recommendations  enable row level security;

create policy if not exists "service_pricing_admin_read"
  on public.service_pricing for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "service_pricing_admin_write"
  on public.service_pricing for all
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "service_pricing_service_write"
  on public.service_pricing for all
  using (auth.role() = 'service_role');

create policy if not exists "pricing_recs_admin_read"
  on public.pricing_recommendations for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "pricing_recs_service_write"
  on public.pricing_recommendations for all
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- 5. Seed the agent
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('price-optimizer', 'Price Optimizer',
     'Recommends price changes per service/suburb based on win rate, crew capacity, cost drift, and competitor moves. Every change requires admin approval.',
     'sales', 'review', '0 5 * * 1',
     jsonb_build_object(
       'min_quote_volume_28d', 8,
       'max_delta_pct', 10,
       'capacity_lookahead_days', 14,
       'win_rate_lookback_days', 28,
       'competitor_stale_after_days', 45,
       'exclude_ndis', true,
       'services_in_scope', jsonb_build_array('cleaning','yard','windows','dump','auto','laundry_sneakers')
     ))
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Backfill template — uncomment & edit with your current rates, or
--    insert via the admin UI later.
-- ---------------------------------------------------------------------
-- insert into public.service_pricing (service, suburb, price_unit, price_aud, set_reason) values
--   ('yard',     null, 'per_visit', 95.00,  'initial backfill'),
--   ('cleaning', null, 'per_hour',  55.00,  'initial backfill'),
--   ('windows',  null, 'per_visit', 120.00, 'initial backfill'),
--   ('dump',     null, 'flat',      180.00, 'initial backfill'),
--   ('auto',     null, 'flat',      85.00,  'initial backfill'),
--   ('laundry_sneakers', null, 'flat', 35.00, 'initial backfill')
-- on conflict do nothing;
