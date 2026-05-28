-- bud_evidence: cross-cutting evidence store for Mission Control.
-- Every claim in Mission Control traces back to a row here or a linked table.

create table if not exists public.bud_evidence (
  id             uuid        primary key default gen_random_uuid(),
  type           text        not null
                             check (type in (
                               'terminal_command',
                               'build_output',
                               'lint_output',
                               'test_output',
                               'git_diff',
                               'deployment',
                               'graphify',
                               'approval',
                               'learning'
                             )),
  source         text        not null
                             check (source in (
                               'bud_terminal',
                               'github_webhook',
                               'cron',
                               'manual',
                               'session_hook'
                             )),
  status         text        not null default 'recorded'
                             check (status in ('recorded', 'passed', 'failed', 'blocked')),
  task_id        uuid        references public.bud_tasks(id) on delete set null,
  command        text,
  file_path      text,
  deployment_id  text,
  summary        text,
  raw_output     text,
  stderr         text,
  created_at     timestamptz not null default now()
);

create index if not exists bud_evidence_created_idx on public.bud_evidence (created_at desc);
create index if not exists bud_evidence_type_idx    on public.bud_evidence (type);
create index if not exists bud_evidence_task_idx    on public.bud_evidence (task_id) where task_id is not null;

alter table public.bud_evidence enable row level security;

drop policy if exists "admin_service_bud_evidence" on public.bud_evidence;
create policy "admin_service_bud_evidence" on public.bud_evidence
  for all using (auth.jwt() ->> 'role' in ('admin', 'owner', 'service_role'));

-- ── Unified evidence view ─────────────────────────────────────────────────────
-- Merges terminal history, deployment events, and bud_evidence into a single
-- time-ordered stream. Mission Control reads from this view only.

create or replace view public.mission_control_latest_evidence as
select * from (
  -- Terminal command history
  select
    'terminal'                                                    as source_type,
    id::text                                                      as source_id,
    coalesce(command, '(unknown command)')                        as label,
    output                                                        as body,
    null::text                                                    as stderr,
    case status
      when 'passed' then 'passed'
      when 'failed' then 'failed'
      else 'recorded'
    end                                                           as status,
    started_at                                                    as recorded_at
  from public.bud_terminal_sessions

  union all

  -- GitHub deployment events
  select
    'deployment'                                                  as source_type,
    id::text                                                      as source_id,
    event_type || '/' || coalesce(action, 'unknown')             as label,
    coalesce(metadata::text, '')                                  as body,
    null::text                                                    as stderr,
    case
      when action = 'success'                         then 'passed'
      when action in ('failure', 'error')             then 'failed'
      else 'recorded'
    end                                                           as status,
    created_at                                                    as recorded_at
  from public.github_events
  where event_type in ('deployment_status', 'deployment_failure')

  union all

  -- Cross-cutting bud_evidence rows
  select
    'evidence'                                                    as source_type,
    id::text                                                      as source_id,
    coalesce(command, summary, type)                              as label,
    coalesce(raw_output, summary)                                 as body,
    stderr,
    status,
    created_at                                                    as recorded_at
  from public.bud_evidence
) combined
order by recorded_at desc
limit 100;
