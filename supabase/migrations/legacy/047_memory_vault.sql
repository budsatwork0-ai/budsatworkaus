-- 047_memory_vault.sql
--
-- Obsidian-native memory infrastructure for the Buds At Work agent system.
-- Requires pg_vector extension (available on all Supabase plans).

-- ── Extension ────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── memory_documents ─────────────────────────────────────────────────────────

create table if not exists public.memory_documents (
  id               uuid        primary key default gen_random_uuid(),
  -- Relative path inside the Obsidian vault, e.g. "ux/quote-friction.md".
  -- Null for agent-generated memories that haven't been synced to the vault yet.
  vault_path       text        unique,
  category         text        not null
                               check (category in (
                                 'ux', 'admin', 'deployments', 'bugs',
                                 'architecture', 'design', 'sops',
                                 'analytics', 'pricing', 'customers'
                               )),
  title            text        not null,
  body             text        not null,
  frontmatter      jsonb       not null default '{}',
  embedding        vector(1536),
  tags             text[]      not null default '{}',
  -- null  = visible to all agents (global)
  -- agent id = only surfaced to that specific agent by default
  agent_scope      text,
  source           text        not null default 'human'
                               check (source in (
                                 'human', 'agent', 'deployment', 'analytics', 'import'
                               )),
  -- SHA-256 of (title || body) for change detection during sync
  content_hash     text        not null,
  freshness_score  float       not null default 1.0
                               check (freshness_score between 0.0 and 1.0),
  -- When the vault file was last confirmed to match this record
  vault_synced_at  timestamptz,
  -- Pending = written by agent, not yet reviewed/pushed to vault
  -- Active  = confirmed in vault (or human-created directly in DB)
  -- Archived = superseded but kept for history
  status           text        not null default 'active'
                               check (status in ('active', 'archived', 'pending')),
  superseded_by    uuid        references public.memory_documents(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- ANN vector index. 50 lists is reasonable for < 50 k rows.
-- Re-run with higher lists after you cross 50 k documents.
create index if not exists memory_documents_embedding_idx
  on public.memory_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index if not exists memory_documents_category_idx
  on public.memory_documents (category);

create index if not exists memory_documents_tags_idx
  on public.memory_documents
  using gin (tags);

create index if not exists memory_documents_agent_scope_idx
  on public.memory_documents (agent_scope);

create index if not exists memory_documents_status_idx
  on public.memory_documents (status);

create index if not exists memory_documents_freshness_idx
  on public.memory_documents (freshness_score desc);

create index if not exists memory_documents_updated_at_idx
  on public.memory_documents (updated_at desc);

-- ── Trigger: keep updated_at current ────────────────────────────────────────

create or replace function public.touch_memory_document()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger memory_documents_updated_at
  before update on public.memory_documents
  for each row execute function public.touch_memory_document();

-- ── memory_read_log ──────────────────────────────────────────────────────────
-- Tracks which agents retrieved which documents. Used for freshness boosting
-- (a memory that agents keep reading is more relevant) and for audit trails.

create table if not exists public.memory_read_log (
  id           bigserial   primary key,
  document_id  uuid        not null references public.memory_documents(id) on delete cascade,
  agent_id     text,
  run_id       uuid,
  query        text,
  similarity   float,
  read_at      timestamptz not null default now()
);

create index if not exists memory_read_log_document_idx
  on public.memory_read_log (document_id, read_at desc);

create index if not exists memory_read_log_agent_idx
  on public.memory_read_log (agent_id, read_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.memory_documents enable row level security;
alter table public.memory_read_log   enable row level security;

drop policy if exists "Admins read memory_documents" on public.memory_documents;
create policy "Admins read memory_documents"
  on public.memory_documents for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

drop policy if exists "Admins read memory_read_log" on public.memory_read_log;
create policy "Admins read memory_read_log"
  on public.memory_read_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

-- ── Semantic search function ─────────────────────────────────────────────────

create or replace function public.search_memory(
  query_embedding  vector(1536),
  match_threshold  float   default 0.70,
  match_count      int     default 5,
  filter_category  text    default null,
  filter_scope     text    default null   -- null = global + scoped; agent id = include that agent's scope
)
returns table (
  id              uuid,
  vault_path      text,
  category        text,
  title           text,
  body            text,
  tags            text[],
  agent_scope     text,
  source          text,
  freshness_score float,
  similarity      float,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql stable as $$
  select
    d.id,
    d.vault_path,
    d.category,
    d.title,
    d.body,
    d.tags,
    d.agent_scope,
    d.source,
    d.freshness_score,
    1 - (d.embedding <=> query_embedding)  as similarity,
    d.created_at,
    d.updated_at
  from public.memory_documents d
  where
    d.status       = 'active'
    and d.embedding is not null
    and (filter_category is null or d.category = filter_category)
    -- scope: include global memories (agent_scope is null) plus any docs
    -- scoped to the requesting agent
    and (filter_scope is null or d.agent_scope is null or d.agent_scope = filter_scope)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ── Freshness update function ─────────────────────────────────────────────────
-- Recomputes freshness_score for all active documents based on days-since-update
-- and the per-category decay rates defined here to mirror freshness.ts.

create or replace function public.refresh_memory_freshness()
returns void language plpgsql as $$
declare
  rec        record;
  decay_rate float;
  days_old   float;
begin
  for rec in
    select id, category, updated_at, freshness_score
    from public.memory_documents
    where status = 'active'
  loop
    decay_rate := case rec.category
      when 'deployments'   then 0.93
      when 'bugs'          then 0.95
      when 'analytics'     then 0.97
      when 'pricing'       then 0.98
      when 'customers'     then 0.98
      when 'ux'            then 0.99
      when 'admin'         then 0.99
      when 'sops'          then 0.995
      when 'architecture'  then 0.999
      when 'design'        then 0.999
      else 0.99
    end;

    days_old := extract(epoch from (now() - rec.updated_at)) / 86400.0;

    update public.memory_documents
    set freshness_score = greatest(0.0, least(1.0, power(decay_rate, days_old)))
    where id = rec.id;
  end loop;
end;
$$;

-- ── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.memory_documents;
