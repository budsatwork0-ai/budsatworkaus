-- =====================================================================
-- Migration 145: orders.status_updated_at + stale detection support
-- =====================================================================
-- Adds a status_updated_at timestamp to orders that is automatically
-- stamped whenever the status column changes. This enables the
-- auto-complete-jobs cron to detect orders stuck in_progress.
-- =====================================================================

alter table public.orders
  add column if not exists status_updated_at timestamptz;

-- Trigger function: stamp status_updated_at when status changes
create or replace function public.trg_fn_orders_status_updated_at()
returns trigger language plpgsql as $$
begin
  if NEW.status is distinct from OLD.status then
    NEW.status_updated_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orders_status_updated_at on public.orders;
create trigger trg_orders_status_updated_at
  before update of status
  on public.orders
  for each row
  execute function public.trg_fn_orders_status_updated_at();

-- Backfill: use updated_at as the best available proxy for existing rows
update public.orders
set status_updated_at = updated_at
where status_updated_at is null;

-- Index for the stale detection query (in_progress + old status_updated_at)
create index if not exists orders_status_updated_at_idx
  on public.orders (status, status_updated_at)
  where status = 'in_progress';
