-- Agent Intelligence v2 activation: backfill root causes, create initiatives,
-- expose compressed approval metadata, and suppress historical duplicates.

create extension if not exists pgcrypto;

alter table public.agent_actions
  add column if not exists superseded_by uuid references public.agent_actions(id) on delete set null,
  add column if not exists is_duplicate boolean not null default false;

alter table public.bud_approval_queue
  add column if not exists superseded_by uuid references public.bud_approval_queue(id) on delete set null,
  add column if not exists is_duplicate boolean not null default false;

create or replace function public.ai_v2_normalize_area(area text)
returns text language sql immutable as $$
  select nullif(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(area, '')), '^(agents?|agent)\s*/\s*', ''), '[^a-z0-9-]+', '-', 'g'), '(^-+|-+$)', '', 'g'), '')
$$;

create or replace function public.ai_v2_classify_root_cause(
  signal_type text,
  title text,
  description text,
  affected_area text,
  payload jsonb default '{}'::jsonb
)
returns table(root_cause_id text, root_cause_key text, initiative_title text)
language plpgsql immutable as $$
declare
  combined text;
  area text;
begin
  combined := lower(concat_ws(' ',
    signal_type,
    title,
    description,
    affected_area,
    coalesce(payload::text, '')
  ));
  area := public.ai_v2_normalize_area(affected_area);

  if combined ~ '(silent[-\s]?success|succeeded[_\s-]?no[_\s-]?output|no[-\s]?output|empty output|produced no output|no useful output|output contract|schema validation|output schema|runtime schema|agentresult|agent-output-guard)' then
    root_cause_id := 'silent_success';
    root_cause_key := 'silent_success';
    initiative_title := 'Fleet-Wide Output Semantics / Silent Success';
  elsif combined ~ '(reply_channel|reply channel|messenger_psid|sms|phone lead|manual callback|unroutable|missing psid)' then
    root_cause_id := 'customer_reply_routing';
    root_cause_key := case when area is null then 'customer_reply_routing' else 'customer_reply_routing:' || area end;
    initiative_title := 'Customer Reply Routing Readiness';
  elsif combined ~ '(watch_urls|watch urls|competitor_pages|no competitor|knowledge_articles|knowledge corpus|corpus|not configured|config missing)' then
    root_cause_id := 'agent_config_missing';
    root_cause_key := case when area is null then 'agent_config_missing' else 'agent_config_missing:' || area end;
    initiative_title := 'Agent Configuration Readiness';
  elsif combined ~ '(observability|metric|alert|monitoring|dashboard|blind spot|telemetry)' then
    root_cause_id := 'observability_gap';
    root_cause_key := 'observability_gap';
    initiative_title := 'Silent-Success Observability';
  else
    root_cause_id := 'data_readiness';
    root_cause_key := case when area is null then 'data_readiness' else 'data_readiness:' || area end;
    initiative_title := 'Agent Data Readiness';
  end if;

  return next;
end;
$$;

with classified as (
  select
    s.id,
    c.root_cause_id,
    c.root_cause_key
  from public.bud_improvement_signals s
  cross join lateral public.ai_v2_classify_root_cause(
    s.signal_type,
    s.title,
    s.description,
    s.affected_area,
    jsonb_build_object('reference_files', s.reference_files)
  ) c
  where s.root_cause_key is null
)
update public.bud_improvement_signals s
set
  root_cause_id = classified.root_cause_id,
  root_cause_key = classified.root_cause_key
from classified
where s.id = classified.id;

with classified as (
  select
    a.id,
    c.root_cause_id,
    c.root_cause_key
  from public.agent_actions a
  cross join lateral public.ai_v2_classify_root_cause(
    a.action_type,
    coalesce(a.preview, a.payload->'signals'->0->>'title'),
    coalesce(a.payload->'signals'->0->>'description', a.payload->>'description'),
    coalesce(a.payload->'signals'->0->>'affected_area', a.payload->>'affected_area'),
    a.payload
  ) c
  where a.root_cause_key is null
    and (
      a.agent_id = 'bud-observer'
      or a.action_type = 'flag_for_review'
      or a.payload ? 'signals'
      or lower(coalesce(a.preview, '')) ~ '(silent|no[-\s]?output|quote-triage|customer-reply|output contract)'
    )
)
update public.agent_actions a
set
  root_cause_id = classified.root_cause_id,
  root_cause_key = classified.root_cause_key
from classified
where a.id = classified.id;

with task_payload as (
  select
    q.id,
    q.action_type,
    coalesce(q.payload, '{}'::jsonb) || coalesce(t.raw_input, '{}'::jsonb) as payload,
    coalesce(t.description, q.payload->>'title', q.action_type) as title,
    coalesce(t.raw_input->>'description', q.payload->>'description') as description,
    coalesce(t.raw_input->>'affected_area', q.payload->>'affected_area', t.source_agent) as affected_area
  from public.bud_approval_queue q
  left join public.bud_tasks t on t.id = q.task_id
  where q.root_cause_key is null
),
classified as (
  select
    task_payload.id,
    c.root_cause_id,
    c.root_cause_key
  from task_payload
  cross join lateral public.ai_v2_classify_root_cause(
    task_payload.action_type,
    task_payload.title,
    task_payload.description,
    task_payload.affected_area,
    task_payload.payload
  ) c
)
update public.bud_approval_queue q
set
  root_cause_id = classified.root_cause_id,
  root_cause_key = classified.root_cause_key
from classified
where q.id = classified.id;

insert into public.bud_root_cause_initiatives (
  root_cause_id,
  root_cause_key,
  title,
  status,
  latest_signal_at,
  metadata
)
select
  roots.root_cause_id,
  roots.root_cause_key,
  roots.title,
  'open',
  roots.latest_signal_at,
  jsonb_build_object('activated_by', 'migration_125_agent_intelligence_v2_activation')
from (
  select
    root_cause_id,
    root_cause_key,
    case
      when root_cause_key = 'silent_success' then 'Fleet-Wide Output Semantics / Silent Success'
      when root_cause_id = 'customer_reply_routing' then 'Customer Reply Routing Readiness'
      when root_cause_id = 'agent_config_missing' then 'Agent Configuration Readiness'
      when root_cause_id = 'observability_gap' then 'Silent-Success Observability'
      else 'Agent Data Readiness'
    end as title,
    max(created_at) as latest_signal_at
  from (
    select root_cause_id, root_cause_key, created_at from public.bud_improvement_signals where root_cause_key is not null
    union all
    select root_cause_id, root_cause_key, created_at from public.agent_actions where root_cause_key is not null
    union all
    select root_cause_id, root_cause_key, created_at from public.bud_approval_queue where root_cause_key is not null
  ) u
  where root_cause_key is not null
  group by root_cause_id, root_cause_key
) roots
on conflict (root_cause_key) do update
set
  root_cause_id = excluded.root_cause_id,
  title = excluded.title,
  latest_signal_at = greatest(
    coalesce(public.bud_root_cause_initiatives.latest_signal_at, '-infinity'::timestamptz),
    coalesce(excluded.latest_signal_at, '-infinity'::timestamptz)
  ),
  updated_at = now();

update public.bud_improvement_signals s
set initiative_id = i.id
from public.bud_root_cause_initiatives i
where s.root_cause_key = i.root_cause_key
  and s.initiative_id is distinct from i.id;

update public.agent_actions a
set initiative_id = i.id
from public.bud_root_cause_initiatives i
where a.root_cause_key = i.root_cause_key
  and a.initiative_id is distinct from i.id;

update public.bud_approval_queue q
set initiative_id = i.id
from public.bud_root_cause_initiatives i
where q.root_cause_key = i.root_cause_key
  and q.initiative_id is distinct from i.id;

with ranked as (
  select
    id,
    root_cause_key,
    first_value(id) over (
      partition by root_cause_key
      order by jsonb_array_length(coalesce(payload->'signals', '[]'::jsonb)) desc, created_at desc
    ) as canonical_id,
    row_number() over (
      partition by root_cause_key
      order by jsonb_array_length(coalesce(payload->'signals', '[]'::jsonb)) desc, created_at desc
    ) as rn
  from public.agent_actions
  where status = 'pending'
    and action_type = 'flag_for_review'
    and root_cause_key is not null
)
update public.agent_actions a
set
  status = 'rejected',
  is_duplicate = true,
  superseded_by = ranked.canonical_id,
  reviewed_at = coalesce(a.reviewed_at, now()),
  review_notes = coalesce(a.review_notes, 'superseded_by_initiative:' || ranked.root_cause_key)
from ranked
where a.id = ranked.id
  and ranked.rn > 1
  and a.status = 'pending';

update public.agent_actions
set action_identity = 'observer:flag_for_review:' || root_cause_key
where action_type = 'flag_for_review'
  and root_cause_key is not null
  and (action_identity is null or action_identity <> 'observer:flag_for_review:' || root_cause_key);

with ranked as (
  select
    id,
    root_cause_key,
    first_value(id) over (
      partition by root_cause_key
      order by created_at desc
    ) as canonical_id,
    row_number() over (
      partition by root_cause_key
      order by created_at desc
    ) as rn
  from public.bud_approval_queue
  where status = 'pending'
    and root_cause_key is not null
)
update public.bud_approval_queue q
set
  status = 'archived',
  is_duplicate = true,
  superseded_by = ranked.canonical_id,
  archived_at = coalesce(q.archived_at, now()),
  archive_reason = coalesce(q.archive_reason, 'superseded_by_initiative:' || ranked.root_cause_key)
from ranked
where q.id = ranked.id
  and ranked.rn > 1
  and q.status = 'pending';

with canonical as (
  select
    root_cause_key,
    (array_agg(id order by created_at desc))[1] as canonical_id
  from public.bud_improvement_signals
  where root_cause_key is not null
    and status in ('new', 'queued', 'executing')
  group by root_cause_key
)
update public.bud_improvement_signals s
set duplicate_of = canonical.canonical_id
from canonical
where s.root_cause_key = canonical.root_cause_key
  and s.id <> canonical.canonical_id
  and s.status in ('new', 'queued', 'executing')
  and s.duplicate_of is null;

update public.bud_root_cause_initiatives i
set
  signal_count = coalesce(s.signal_count, 0),
  duplicate_count = coalesce(s.duplicate_count, 0) + coalesce(a.duplicate_count, 0) + coalesce(q.duplicate_count, 0),
  approval_count = coalesce(a.approval_count, 0) + coalesce(q.approval_count, 0),
  latest_signal_at = greatest(
    coalesce(i.latest_signal_at, '-infinity'::timestamptz),
    coalesce(s.latest_at, '-infinity'::timestamptz),
    coalesce(a.latest_at, '-infinity'::timestamptz),
    coalesce(q.latest_at, '-infinity'::timestamptz)
  )
from (
  select root_cause_key, count(*)::integer as signal_count, count(duplicate_of)::integer as duplicate_count, max(created_at) as latest_at
  from public.bud_improvement_signals
  group by root_cause_key
) s
full join (
  select root_cause_key, count(*) filter (where is_duplicate)::integer as duplicate_count, count(*) filter (where status = 'pending' and not is_duplicate)::integer as approval_count, max(created_at) as latest_at
  from public.agent_actions
  group by root_cause_key
) a on a.root_cause_key = s.root_cause_key
full join (
  select root_cause_key, count(*) filter (where is_duplicate)::integer as duplicate_count, count(*) filter (where status = 'pending' and not is_duplicate)::integer as approval_count, max(created_at) as latest_at
  from public.bud_approval_queue
  group by root_cause_key
) q on q.root_cause_key = coalesce(s.root_cause_key, a.root_cause_key)
where i.root_cause_key = coalesce(s.root_cause_key, a.root_cause_key, q.root_cause_key);

drop view if exists public.v_pending_agent_actions cascade;
create view public.v_pending_agent_actions as
select
  a.id              as action_id,
  a.id,
  a.run_id,
  a.agent_id,
  ag.name           as agent_name,
  a.action_type,
  a.target_table,
  a.target_id,
  a.preview,
  a.payload,
  a.requires_approval,
  a.status,
  a.action_identity,
  a.root_cause_id,
  a.root_cause_key,
  a.initiative_id,
  a.superseded_by,
  a.is_duplicate,
  a.created_at
from public.agent_actions a
join public.agents ag on ag.id = a.agent_id
where a.status = 'pending'
  and coalesce(a.is_duplicate, false) = false
order by a.created_at desc;

drop view if exists public.v_bud_approval_truth cascade;
create view public.v_bud_approval_truth as
select
  q.id,
  q.task_id,
  q.action_type,
  q.status,
  q.created_at,
  q.archived_at,
  q.archive_reason,
  q.blocked_reason,
  q.payload,
  q.approval_identity,
  q.root_cause_id,
  q.root_cause_key,
  q.initiative_id,
  q.superseded_by,
  q.is_duplicate,
  t.status as task_status,
  t.risk_level,
  t.linked_pr,
  case
    when coalesce(q.is_duplicate, false) then 'Archived'
    when q.status = 'archived' then 'Archived'
    when q.status = 'blocked' then 'Blocked'
    when q.status <> 'pending' then 'Archived'
    when q.created_at < now() - interval '24 hours'
      and (
        t.status in ('archived', 'completed')
        or (
          t.risk_level in ('high', 'critical')
          and coalesce(t.linked_pr, '') = ''
          and coalesce(q.payload->>'pr_url', '') = ''
          and coalesce(q.payload->>'pull_request_url', '') = ''
          and coalesce(q.payload->>'diff', '') = ''
          and coalesce(q.payload->>'diff_summary', '') = ''
          and coalesce(q.payload->>'patch', '') = ''
        )
      )
      then 'Blocked'
    when t.risk_level in ('high', 'critical')
      and coalesce(t.linked_pr, '') = ''
      and coalesce(q.payload->>'pr_url', '') = ''
      and coalesce(q.payload->>'pull_request_url', '') = ''
      and coalesce(q.payload->>'diff', '') = ''
      and coalesce(q.payload->>'diff_summary', '') = ''
      and coalesce(q.payload->>'patch', '') = ''
      then 'Needs manual review'
    else 'Actionable'
  end as truth_label
from public.bud_approval_queue q
left join public.bud_tasks t on t.id = q.task_id;

create or replace view public.v_agent_intelligence_quality as
with signal_stats as (
  select
    count(*)::integer as signal_count,
    count(distinct coalesce(root_cause_key, fingerprint, id::text))::integer as root_cause_count
  from public.bud_improvement_signals
  where status in ('new', 'queued', 'executing')
),
approval_stats as (
  select
    (
      select count(*) from public.agent_actions
      where status = 'pending'
        and coalesce(is_duplicate, false) = false
    )::integer
    +
    (
      select count(*) from public.bud_approval_queue
      where status = 'pending'
        and coalesce(is_duplicate, false) = false
    )::integer as approval_count
),
initiative_stats as (
  select count(*)::integer as initiative_count
  from public.bud_root_cause_initiatives
  where status in ('open', 'patching', 'validating', 'blocked')
)
select
  signal_stats.signal_count,
  case
    when signal_stats.signal_count = 0 then 0::numeric
    else round(
      ((signal_stats.signal_count - signal_stats.root_cause_count)::numeric / signal_stats.signal_count::numeric),
      4
    )
  end as duplicate_rate,
  signal_stats.root_cause_count,
  approval_stats.approval_count,
  initiative_stats.initiative_count
from signal_stats, approval_stats, initiative_stats;
