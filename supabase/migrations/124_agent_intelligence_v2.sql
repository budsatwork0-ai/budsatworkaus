-- Agent Intelligence v2: root-cause initiatives and compressed approvals.

create extension if not exists pgcrypto;

create table if not exists public.bud_root_cause_initiatives (
  id uuid primary key default gen_random_uuid(),
  root_cause_id text not null,
  root_cause_key text not null,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'patching', 'validating', 'merged', 'resolved', 'blocked', 'archived')),
  signal_count integer not null default 0,
  duplicate_count integer not null default 0,
  approval_count integer not null default 0,
  latest_signal_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (root_cause_key)
);

alter table public.bud_root_cause_initiatives enable row level security;
create policy "service_role_all_root_cause_initiatives"
  on public.bud_root_cause_initiatives
  using (true)
  with check (true);

alter table public.bud_improvement_signals
  add column if not exists root_cause_id text,
  add column if not exists root_cause_key text,
  add column if not exists initiative_id uuid references public.bud_root_cause_initiatives(id) on delete set null,
  add column if not exists duplicate_of uuid references public.bud_improvement_signals(id) on delete set null;

alter table public.bud_improvement_executions
  add column if not exists root_cause_id text,
  add column if not exists root_cause_key text,
  add column if not exists initiative_id uuid references public.bud_root_cause_initiatives(id) on delete set null;

alter table public.bud_approval_queue
  add column if not exists root_cause_id text,
  add column if not exists root_cause_key text,
  add column if not exists initiative_id uuid references public.bud_root_cause_initiatives(id) on delete set null;

alter table public.agent_actions
  add column if not exists root_cause_id text,
  add column if not exists root_cause_key text,
  add column if not exists initiative_id uuid references public.bud_root_cause_initiatives(id) on delete set null;

create index if not exists bud_improvement_signals_root_cause_idx
  on public.bud_improvement_signals(root_cause_key, status);

create index if not exists bud_approval_queue_root_cause_idx
  on public.bud_approval_queue(root_cause_key, status);

create unique index if not exists agent_actions_one_pending_root_cause_review
  on public.agent_actions(action_identity)
  where status = 'pending'
    and action_identity is not null
    and action_type = 'flag_for_review';

create or replace function public.update_root_cause_initiative_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_root_cause_initiatives_updated_at on public.bud_root_cause_initiatives;
create trigger trg_root_cause_initiatives_updated_at
  before update on public.bud_root_cause_initiatives
  for each row execute function public.update_root_cause_initiative_updated_at();

create or replace view public.v_agent_intelligence_quality as
with signal_stats as (
  select
    count(*)::integer as signal_count,
    count(distinct coalesce(root_cause_key, fingerprint, id::text))::integer as root_cause_count
  from public.bud_improvement_signals
  where status in ('new', 'queued', 'executing')
),
approval_stats as (
  select
    (
      select count(*) from public.agent_actions
      where status = 'pending'
    )::integer
    +
    (
      select count(*) from public.bud_approval_queue
      where status = 'pending'
    )::integer as approval_count
),
initiative_stats as (
  select count(*)::integer as initiative_count
  from public.bud_root_cause_initiatives
  where status in ('open', 'patching', 'validating', 'blocked')
)
select
  signal_stats.signal_count,
  case
    when signal_stats.signal_count = 0 then 0::numeric
    else round(
      ((signal_stats.signal_count - signal_stats.root_cause_count)::numeric / signal_stats.signal_count::numeric),
      4
    )
  end as duplicate_rate,
  signal_stats.root_cause_count,
  approval_stats.approval_count,
  initiative_stats.initiative_count
from signal_stats, approval_stats, initiative_stats;
