-- Convention learnings: coding rules discovered during dev sessions.
-- These feed the Continuous Learning Loop alongside improvement and repair learnings.

create table if not exists bud_convention_learnings (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  rule        text        not null,
  category    text        not null default 'pattern'
                          check (category in ('design', 'import', 'pattern', 'agent', 'other')),
  source      text        not null default 'manual'
                          check (source in ('manual', 'pipeline', 'auto')),
  severity    text        not null default 'error'
                          check (severity in ('warning', 'error')),
  example_wrong   text,
  example_correct text,
  session_id  text,
  created_at  timestamptz not null default now()
);

alter table bud_convention_learnings enable row level security;

-- Service role can write (from the API route / scripts).
-- Anon can read (dashboard).
drop policy if exists "anon read conventions" on bud_convention_learnings;
create policy "anon read conventions"
  on bud_convention_learnings for select
  using (true);

drop policy if exists "service write conventions" on bud_convention_learnings;
create policy "service write conventions"
  on bud_convention_learnings for insert
  with check (true);

-- Seed the two known rules so the dashboard shows something immediately.
insert into bud_convention_learnings (title, rule, category, source, severity, example_wrong, example_correct) values
(
  'glass / glassSoft are class strings, not CSS objects',
  'glass and glassSoft (from @/app/ui/theme) are Tailwind class strings joined with spaces. Use them as className values only — never spread them into style props.',
  'design',
  'manual',
  'error',
  'style={{...glass}} or {..."glass"}',
  'className={glass} or className={`${glass} extra`}'
),
(
  'Theme token imports must come from @/app/ui/theme',
  'Always import glass, glassSoft, and brand from "@/app/ui/theme" (no file extension, no relative path). Any other import path will break in production builds or after refactors.',
  'import',
  'manual',
  'error',
  'import { glass } from "../theme" or from "@/app/ui/theme.ts"',
  'import { glass, glassSoft, brand } from "@/app/ui/theme"'
);
