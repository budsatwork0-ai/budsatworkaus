create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  suburb text,
  caption text not null,
  cta text,
  photo_tip text,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.content_posts enable row level security;
