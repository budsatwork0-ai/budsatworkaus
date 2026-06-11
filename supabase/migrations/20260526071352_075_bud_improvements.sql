-- bud_improvements: evidence-backed improvement records for Mission Control.
-- Sources: vault (Obsidian refactor notes), graphify (hotspots), manual.

create table if not exists public.bud_improvements (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  issue          text        not null,
  root_cause     text,
  source         text        not null default 'manual'
                             check (source in ('vault', 'graphify', 'manual', 'agent')),
  evidence_type  text,
  evidence_ref   text,
  affected_files text[]      not null default '{}',
  risk_level     text        not null default 'low'
                             check (risk_level in ('low', 'medium', 'high', 'critical')),
  rollback_plan  text,
  status         text        not null default 'open'
                             check (status in ('open', 'in_progress', 'completed', 'dismissed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create index if not exists bud_improvements_status_idx on public.bud_improvements (status);
create index if not exists bud_improvements_created_idx on public.bud_improvements (created_at desc);

alter table public.bud_improvements enable row level security;

drop policy if exists "admin_service_bud_improvements" on public.bud_improvements;
create policy "admin_service_bud_improvements" on public.bud_improvements
  for all using (auth.jwt() ->> 'role' in ('admin', 'owner', 'service_role'));
