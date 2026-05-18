-- 048_knowledge_graph.sql
--
-- Knowledge graph layer for the Obsidian-native memory system.
-- Adds directed, typed, weighted edges between memory_documents,
-- LLM-extracted metadata per document, and SQL graph traversal.

-- ── Relationship types ────────────────────────────────────────────────────────
-- Stored in memory_edges.relationship. Order matters: more specific types
-- take precedence over generic ones when edges are deduplicated.

-- backlink    — explicit [[wikilink]] reference in the note body
-- tag_shared  — two notes share one or more #tags (weight = Jaccard similarity)
-- semantic    — embedding cosine similarity above threshold
-- depends_on  — A depends on B (LLM-extracted architectural dependency)
-- implements  — A implements B (design spec → code, SOP → action)
-- contradicts — LLM detected conflicting facts between A and B
-- supersedes  — A supersedes/replaces B (newer decision overrules older one)
-- caused_by   — A (bug/incident) was caused by decision B
-- informs     — A's findings directly informed decision/design B

-- ── memory_edges ─────────────────────────────────────────────────────────────

create table if not exists public.memory_edges (
  id             uuid        primary key default gen_random_uuid(),
  source_id      uuid        not null references public.memory_documents(id) on delete cascade,
  target_id      uuid        not null references public.memory_documents(id) on delete cascade,
  relationship   text        not null
                             check (relationship in (
                               'backlink', 'tag_shared', 'semantic',
                               'depends_on', 'implements', 'contradicts',
                               'supersedes', 'caused_by', 'informs'
                             )),
  -- 0.0–1.0: higher = stronger / more confident
  strength       float       not null default 1.0
                             check (strength between 0.0 and 1.0),
  -- Extra context: shared tags, similarity score, LLM explanation, etc.
  metadata       jsonb       not null default '{}',
  -- 'system' = derived from backlinks/tags, 'llm' = LLM-extracted, agent id = agent-written
  extracted_by   text        not null default 'system',
  extracted_at   timestamptz not null default now(),

  -- One edge per (source, target, type) triplet — use upsert to update strength
  constraint memory_edges_unique unique (source_id, target_id, relationship)
);

create index if not exists memory_edges_source_idx
  on public.memory_edges (source_id);

create index if not exists memory_edges_target_idx
  on public.memory_edges (target_id);

create index if not exists memory_edges_relationship_idx
  on public.memory_edges (relationship);

create index if not exists memory_edges_strength_idx
  on public.memory_edges (strength desc);

-- Quickly find all edges involving a node (either direction)
create index if not exists memory_edges_any_node_idx
  on public.memory_edges (source_id, target_id);

alter table public.memory_edges enable row level security;

create policy "Admins read memory_edges"
  on public.memory_edges for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

-- ── memory_graph_extractions ──────────────────────────────────────────────────
-- LLM-extracted structured metadata per document.
-- One row per document; re-run extraction to update.

create table if not exists public.memory_graph_extractions (
  document_id        uuid        primary key
                                 references public.memory_documents(id) on delete cascade,
  -- Systems / components referenced in this note (e.g. "quote-builder", "stripe")
  systems_mentioned  text[]      not null default '{}',
  -- Why was this decision / finding documented?
  decision_rationale text,
  -- What problems does this solve?
  problems_solved    text[]      not null default '{}',
  -- Raw text phrases that describe things this document depends on
  depends_on_raw     text[]      not null default '{}',
  -- Raw text phrases that describe things this document implements/produces
  implements_raw     text[]      not null default '{}',
  -- Keywords useful for graph clustering and search
  keywords           text[]      not null default '{}',
  -- LLM-assigned importance score (0–1): helps surface central nodes
  importance_score   float       not null default 0.5
                                 check (importance_score between 0.0 and 1.0),
  extracted_at       timestamptz not null default now(),
  model              text
);

create index if not exists memory_graph_extractions_systems_idx
  on public.memory_graph_extractions using gin (systems_mentioned);

create index if not exists memory_graph_extractions_keywords_idx
  on public.memory_graph_extractions using gin (keywords);

alter table public.memory_graph_extractions enable row level security;

create policy "Admins read memory_graph_extractions"
  on public.memory_graph_extractions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

-- ── memory_contradiction_log ──────────────────────────────────────────────────
-- Caches LLM contradiction comparisons so we don't re-run them on every build.

create table if not exists public.memory_contradiction_log (
  id            uuid        primary key default gen_random_uuid(),
  doc_a_id      uuid        not null references public.memory_documents(id) on delete cascade,
  doc_b_id      uuid        not null references public.memory_documents(id) on delete cascade,
  contradicts   boolean     not null,
  severity      text        check (severity in ('minor', 'major')),
  explanation   text,
  checked_at    timestamptz not null default now(),
  constraint contradiction_pair_unique unique (doc_a_id, doc_b_id)
);

alter table public.memory_contradiction_log enable row level security;

create policy "Admins read memory_contradiction_log"
  on public.memory_contradiction_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

-- ── SQL graph traversal ───────────────────────────────────────────────────────
-- BFS up to max_depth hops from start_id.
-- Returns each reachable node with its depth, path, and the edge that reached it.

create or replace function public.graph_neighbors(
  start_id      uuid,
  max_depth     int     default 2,
  rel_types     text[]  default null,   -- null = all types
  min_strength  float   default 0.0
)
returns table (
  node_id       uuid,
  depth         int,
  path          uuid[],
  relationship  text,
  strength      float
)
language sql stable as $$
  with recursive bfs as (
    -- Base: the starting node itself (depth 0)
    select
      start_id      as node_id,
      0             as depth,
      array[start_id] as path,
      null::text    as relationship,
      1.0::float    as strength

    union all

    -- Recurse: follow edges outward from each frontier node
    select
      e.target_id,
      b.depth + 1,
      b.path || e.target_id,
      e.relationship,
      e.strength
    from bfs b
    join public.memory_edges e on e.source_id = b.node_id
    where
      b.depth < max_depth
      and e.target_id <> all(b.path)           -- no cycles
      and (rel_types is null or e.relationship = any(rel_types))
      and e.strength >= min_strength
  )
  select distinct on (node_id)
    node_id, depth, path, relationship, strength
  from bfs
  order by node_id, depth;
$$;

-- ── Shortest path between two nodes ─────────────────────────────────────────

create or replace function public.graph_shortest_path(
  from_id  uuid,
  to_id    uuid,
  max_hops int default 5
)
returns table (
  node_id       uuid,
  depth         int,
  relationship  text,
  path          uuid[]
)
language sql stable as $$
  with recursive bfs as (
    select
      from_id as node_id,
      0       as depth,
      null::text as relationship,
      array[from_id] as path

    union all

    select
      e.target_id,
      b.depth + 1,
      e.relationship,
      b.path || e.target_id
    from bfs b
    join public.memory_edges e on e.source_id = b.node_id
    where
      b.depth < max_hops
      and e.target_id <> all(b.path)
  )
  select node_id, depth, relationship, path
  from bfs
  where node_id = to_id
  order by depth
  limit 1;
$$;

-- ── Node degree (connectivity score) ────────────────────────────────────────

create or replace function public.graph_degree(node_id uuid)
returns table (
  in_degree   int,
  out_degree  int,
  total       int
)
language sql stable as $$
  select
    (select count(*)::int from public.memory_edges where target_id = node_id) as in_degree,
    (select count(*)::int from public.memory_edges where source_id = node_id) as out_degree,
    (select count(*)::int from public.memory_edges
     where source_id = node_id or target_id = node_id)                       as total;
$$;

-- ── Full graph export (for visualization) ────────────────────────────────────
-- Returns all active nodes and edges in one shot.

create or replace function public.graph_export()
returns json language sql stable as $$
  select json_build_object(
    'nodes', (
      select json_agg(json_build_object(
        'id',            d.id,
        'title',         d.title,
        'category',      d.category,
        'tags',          d.tags,
        'freshness',     d.freshness_score,
        'source',        d.source,
        'importance',    coalesce(e.importance_score, 0.5),
        'systems',       coalesce(e.systems_mentioned, '{}'),
        'vault_path',    d.vault_path,
        'updated_at',    d.updated_at
      ))
      from public.memory_documents d
      left join public.memory_graph_extractions e on e.document_id = d.id
      where d.status = 'active'
    ),
    'links', (
      select json_agg(json_build_object(
        'source',       me.source_id,
        'target',       me.target_id,
        'type',         me.relationship,
        'strength',     me.strength,
        'metadata',     me.metadata
      ))
      from public.memory_edges me
      join public.memory_documents src on src.id = me.source_id and src.status = 'active'
      join public.memory_documents tgt on tgt.id = me.target_id and tgt.status = 'active'
    )
  );
$$;

