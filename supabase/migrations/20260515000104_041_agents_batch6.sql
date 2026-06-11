-- =====================================================================
-- Migration 041: Design-evolution agents + Competitor Scout + meta-agent
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. lobby_themes — visual themes for the agent lobby
-- ---------------------------------------------------------------------
create table if not exists public.lobby_themes (
  id            text primary key,            -- slug, e.g. 'medieval-keep'
  name          text not null,
  description   text,
  preview_image text,
  tokens        jsonb not null,              -- {colors, fonts, sprites, sounds}
  active        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Only one theme can be active at a time (enforced via trigger)
create or replace function public.enforce_single_active_theme()
returns trigger language plpgsql as $$
begin
  if new.active = true then
    update public.lobby_themes set active = false where id <> new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_lobby_themes_single_active on public.lobby_themes;
create trigger trg_lobby_themes_single_active
  before insert or update on public.lobby_themes
  for each row execute function public.enforce_single_active_theme();

-- ---------------------------------------------------------------------
-- 2. competitor_intel — broad scraped competitor data
-- ---------------------------------------------------------------------
create table if not exists public.competitor_intel (
  id              uuid primary key default gen_random_uuid(),
  competitor_name text not null,
  url             text not null,
  suburb          text,
  service         text,                       -- 'cleaning','yard','windows','dump','auto','laundry_sneakers'
  price_aud       numeric,
  price_unit      text,                       -- 'per_hour','per_visit','per_sqm','flat'
  promo           text,
  raw_snippet     text,
  confidence      real default 0.5,
  source_query    text,                       -- the web search that surfaced this
  scraped_at      timestamptz not null default now(),
  unique(competitor_name, url, service)
);
create index if not exists idx_competitor_intel_service_suburb
  on public.competitor_intel(service, suburb);

-- ---------------------------------------------------------------------
-- 3. agent_evolutions — the meta-agent's proposed changes to other agents
-- ---------------------------------------------------------------------
create table if not exists public.agent_evolutions (
  id              uuid primary key default gen_random_uuid(),
  target_agent_id text not null references public.agents(id) on delete cascade,
  run_id          uuid references public.agent_runs(id) on delete set null,
  evolution_type  text not null check (evolution_type in (
                    'prompt_tweak','config_change','autonomy_change',
                    'schedule_change','retire','new_agent'
                  )),
  rationale       text not null,
  evidence        jsonb,                       -- the metrics that motivated it
  proposed_diff   jsonb,                       -- before/after for the change
  status          text not null default 'pending' check (status in (
                    'pending','approved','rejected','applied'
                  )),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_agent_evolutions_pending
  on public.agent_evolutions(target_agent_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- 4. admin_ux_proposals — UX critique of internal admin pages
-- ---------------------------------------------------------------------
create table if not exists public.admin_ux_proposals (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.agent_runs(id) on delete set null,
  page_path       text not null,               -- e.g. '/dashboard/crew'
  audience        text not null check (audience in ('admin','crew','public','lobby')),
  severity        text not null default 'medium' check (severity in ('low','medium','high','critical')),
  title           text not null,
  body            text not null,
  proposed_change jsonb,
  status          text not null default 'new' check (status in ('new','reviewing','accepted','rejected','shipped')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_admin_ux_proposals_page on public.admin_ux_proposals(page_path);
create index if not exists idx_admin_ux_proposals_status on public.admin_ux_proposals(status) where status in ('new','reviewing');

-- ---------------------------------------------------------------------
-- 5. RLS on all new tables
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'lobby_themes','competitor_intel','agent_evolutions','admin_ux_proposals'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy "%1$s_admin_read" on public.%1$I for select
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')))$f$, t);
    execute format($f$create policy "%1$s_admin_write" on public.%1$I for all
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')))$f$, t);
    execute format($f$create policy "%1$s_service" on public.%1$I for all using (auth.role() = 'service_role')$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Seed agents
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('admin-ux-designer',  'Admin UX Designer',
     'Reviews admin dashboard, crew portal, and public pages; proposes UX improvements for each audience.',
     'ops',     'review', '0 3 * * 4',     '{"audiences":["admin","crew","public","lobby"]}'::jsonb),

  ('lobby-theme-curator','Lobby Theme Curator',
     'Generates and curates visual themes for the agent lobby (medieval keep, cyberpunk, retro arcade, ...).',
     'ops',     'manual', null,            '{"max_themes":12}'::jsonb),

  ('agent-architect',    'Agent Architect',
     'Meta-agent. Reviews every other agent''s performance and proposes prompt, config, or schedule tweaks.',
     'ops',     'review', '0 4 * * 0',     '{"min_runs_for_review":10,"reject_ratio_threshold":0.3}'::jsonb),

  ('competitor-scout',   'Competitor Scout',
     'Crawls the open web for local home-services competitors; scrapes pricing pages; stores structured prices.',
     'sales',   'review', '0 6 * * 3',     '{"region":"Logan,South Brisbane","services":["cleaning","yard","windows","dump","auto"]}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 7. Seed the medieval-keep theme so it's immediately selectable
-- ---------------------------------------------------------------------
insert into public.lobby_themes (id, name, description, tokens, active) values
('medieval-keep', 'Medieval Keep',
 'Candlelit stone hall with heraldic banners. Each agent occupies a guildmaster''s seat.',
 jsonb_build_object(
   'palette', jsonb_build_object(
     'bg_outer','#1a1108','bg_inner','#2a1d12',
     'stone_dark','#2a2520','stone_mid','#4a423a','stone_light','#6b6055',
     'wood_dark','#3a2616','wood_mid','#6b3f1f','wood_light','#8b6239',
     'parchment','#e8d9b5','ink','#3a2a18',
     'fire','#f59e0b','ember','#b45309','candle','#fde68a',
     'gold','#d4a72c','silver','#cbd5e1'),
   'banners', jsonb_build_object(
     'sales','#7a1a1a','support','#1a3b6b','ops','#3d2a6b',
     'finance','#2d5b2d','hiring','#6b4a1a','compliance','#3a3a3a'),
   'fonts', jsonb_build_object(
     'display','"Cinzel", "Trajan Pro", serif',
     'body','"Lora", Georgia, serif'),
   'emojis', jsonb_build_object(
     'quote-triage','📜','copy-optimizer','🪶','conversion-funnel','⚱️',
     'seo-meta','🔮','ab-test-architect','⚖️','lead-scorer','🏹',
     'content-agent','✒️','lapsed-win-back','🕯️','competitor-watcher','🐦',
     'customer-reply','📯','reviews','🏆','phone-transcriber','📯',
     'internal-qa','🧙','scheduling','🗺️','crew-briefing','🐎',
     'heatmap-analyst','🔥','layout-critic','📐','photo-qa','🖼️',
     'yard-map-geo','🦅','reconciliation','🪙','cash-flow-forecaster','💰',
     'stripe-dispute-manager','🛡️','applicant-screener','⚔️','crew-coach','🛡️',
     'ndis-compliance','📋','ndis-plan-matcher','🤝','whs-safety-reminder','⚒️',
     'admin-ux-designer','🪞','lobby-theme-curator','🎨','agent-architect','🦉',
     'competitor-scout','🐺')
 ),
 true)
on conflict (id) do nothing;