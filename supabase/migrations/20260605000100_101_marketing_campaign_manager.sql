-- Phase 4B: Marketing Campaign Manager
-- Manual campaign planning linked to existing Publishing Queue items.
-- No social channels, platform integrations, auto-posting, AI captions/summaries,
-- agents, automations, analytics dashboards, or Research Lab functionality.

create table if not exists public.marketing_campaigns (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  status      text        not null default 'planning',
  created_at  timestamptz not null default now()
);

alter table public.marketing_campaigns
  add column if not exists goal              text        not null default '',
  add column if not exists related_arc_id    uuid        references public.story_arcs(id) on delete set null,
  add column if not exists target_audience   text        not null default '',
  add column if not exists channels          text[]      not null default '{}',
  add column if not exists start_date        date,
  add column if not exists end_date          date,
  add column if not exists kpis              jsonb       not null default '{}'::jsonb,
  add column if not exists result_summary    text        not null default '',
  add column if not exists notes             text        not null default '',
  add column if not exists updated_at        timestamptz not null default now();

-- Legacy migration 077 used starts_on/ends_on/goal_notes and status 'wrapped'.
update public.marketing_campaigns
set
  goal = coalesce(nullif(goal, ''), goal_notes, ''),
  start_date = coalesce(start_date, starts_on),
  end_date = coalesce(end_date, ends_on),
  status = case when status = 'wrapped' then 'completed' else status end
where true;

do $$ begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'marketing_campaigns' and constraint_name = 'marketing_campaigns_status_check'
  ) then
    alter table public.marketing_campaigns drop constraint marketing_campaigns_status_check;
  end if;
end $$;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_status_check
  check (status in ('planning', 'active', 'completed', 'archived'));

create table if not exists public.marketing_campaign_queue_items (
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  queue_item_id uuid not null references public.marketing_publishing_queue(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, queue_item_id)
);

create index if not exists idx_marketing_campaigns_status on public.marketing_campaigns(status);
create index if not exists idx_marketing_campaigns_arc    on public.marketing_campaigns(related_arc_id);
create index if not exists idx_marketing_campaigns_dates  on public.marketing_campaigns(start_date, end_date);
create index if not exists idx_marketing_campaign_queue_items_queue on public.marketing_campaign_queue_items(queue_item_id);

-- updated_at trigger
create or replace function public.handle_marketing_campaigns_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_marketing_campaigns_updated_at on public.marketing_campaigns;
create trigger set_marketing_campaigns_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.handle_marketing_campaigns_updated_at();

-- RLS: admin/owner only
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_queue_items enable row level security;

drop policy if exists "marketing_campaigns_admin_read" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_service_all" on public.marketing_campaigns;
drop policy if exists "Admins manage marketing campaigns" on public.marketing_campaigns;
create policy "Admins manage marketing campaigns"
  on public.marketing_campaigns for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'owner')
  ));

drop policy if exists "Admins manage marketing campaign queue links" on public.marketing_campaign_queue_items;
create policy "Admins manage marketing campaign queue links"
  on public.marketing_campaign_queue_items for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'owner')
  ));
