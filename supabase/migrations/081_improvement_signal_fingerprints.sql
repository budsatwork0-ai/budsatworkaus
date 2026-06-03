-- Phase 2: stable improvement fingerprints.
-- Gives Bud Observer a durable identity for active improvement signals so
-- repeated observations update the same row instead of creating duplicate
-- approvals.

create extension if not exists pgcrypto;

alter table public.bud_improvement_signals
  add column if not exists fingerprint text;

with computed as (
  select
    id,
    status,
    encode(digest(
      coalesce(lower(trim(signal_type)), '') || ':' ||
      coalesce(lower(trim(affected_area)), '') || ':' ||
      trim(regexp_replace(
        regexp_replace(lower(coalesce(title, '')), '\m\d+(\.\d+)?\M', '#', 'g'),
        '[^a-z0-9#/._-]+',
        ' ',
        'g'
      ))
    , 'sha256'), 'hex') as computed_fingerprint
  from public.bud_improvement_signals
  where fingerprint is null
),
ranked as (
  select
    *,
    row_number() over (
      partition by computed_fingerprint
      order by
        case when status in ('new', 'queued', 'executing') then 0 else 1 end,
        id
    ) as active_rank
  from computed
)
update public.bud_improvement_signals s
set fingerprint = r.computed_fingerprint
from ranked r
where s.id = r.id
  and (
    s.status not in ('new', 'queued', 'executing')
    or r.active_rank = 1
  );

create index if not exists bud_improvement_signals_fingerprint_idx
  on public.bud_improvement_signals (fingerprint);

create unique index if not exists bud_improvement_signals_one_active_fingerprint
  on public.bud_improvement_signals (fingerprint)
  where fingerprint is not null
    and status in ('new', 'queued', 'executing');
