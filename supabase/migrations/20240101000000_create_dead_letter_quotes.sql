-- Dead-letter table for durably capturing failed quote agent payloads
create table if not exists public.dead_letter_quotes (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  payload jsonb not null,
  error_message text not null,
  retry_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dead_letter_quotes_status_retry_idx
  on public.dead_letter_quotes (status, retry_count, created_at)
  where status = 'pending';

-- RLS: only service role can read/write dead letters
alter table public.dead_letter_quotes enable row level security;
