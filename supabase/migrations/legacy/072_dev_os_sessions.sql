-- dev_os_sessions: tracks Claude Code sessions that invoked Dev OS agents.
-- Populated by the vault-log.ts Stop hook after each session completes.

create table if not exists dev_os_sessions (
  id            uuid        primary key default gen_random_uuid(),
  session_id    text,
  agents_used   text[]      not null default '{}',
  task          text,
  files_changed text[]      not null default '{}',
  summary       text,
  risk_level    text,       -- LOW | MEDIUM | HIGH, extracted from Bud Researcher output
  created_at    timestamptz not null default now()
);

create index if not exists dev_os_sessions_created_idx on dev_os_sessions (created_at desc);
create index if not exists dev_os_sessions_agents_idx  on dev_os_sessions using gin (agents_used);

alter table dev_os_sessions enable row level security;

drop policy if exists "service_role_only" on dev_os_sessions;
create policy "service_role_only" on dev_os_sessions
  using  ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
