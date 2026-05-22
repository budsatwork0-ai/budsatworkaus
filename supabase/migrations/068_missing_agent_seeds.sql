-- 068: Seed missing agent rows
--
-- 8 agents exist in the TypeScript registry but had no row in public.agents.
-- Every cron firing against them failed immediately at the DB lookup in runtime.ts.
-- This includes 'bud' itself, which runs every 6 hours and drives all orchestration.

insert into public.agents (id, name, description, category, autonomy, schedule, config) values

  ('bud',
   'Bud',
   'Autonomous AI orchestrator — monitors all agents, investigates failures, detects bottlenecks, coordinates repairs, and generates the living operational state for Mission Control.',
   'ops', 'manual', null, '{}'::jsonb),

  ('bud-observer',
   'Bud Observer',
   'Continuously monitors UX, performance, conversions, agent quality, and design signals to feed the autonomous improvement pipeline.',
   'ops', 'auto', '0 */6 * * *', '{}'::jsonb),

  ('browser-agent',
   'Browser Agent',
   'Runs Playwright golden-path tests against the live site and reports pass/fail. Triggered automatically after UI repairs; can also be run manually to verify a deploy.',
   'ops', 'review', null, '{}'::jsonb),

  ('admin-optimization',
   'Admin Optimization',
   'Operational intelligence for the admin surface: friction scoring, workflow mapping, automation candidates, and landscape-first redesign proposals. Stores findings in Obsidian.',
   'ops', 'review', '0 7 * * 3', '{}'::jsonb),

  ('github-historian',
   'GitHub Historian',
   'Weekly synthesis of GitHub activity into implementation timelines, architecture evolution, bug patterns, and rollback readiness. Writes to Obsidian Dev/ via memory.',
   'ops', 'review', '0 6 * * 5', '{}'::jsonb),

  ('ux-intelligence',
   'UX Intelligence',
   'Autonomous UX audit across quoting flows, sticky footers, admin UX, maps, and mobile. Stores findings in Obsidian with historical pattern detection and priority scoring.',
   'ops', 'review', '0 8 * * 1', '{}'::jsonb),

  ('analytics-intelligence',
   'Analytics Intelligence',
   'Multi-source analytics synthesis: PostHog funnels, Clarity rage clicks, internal sessions. Detects quote abandonment, weak CTAs, admin bottlenecks, mobile drop-offs, and deployment regressions.',
   'ops', 'review', '0 7 * * 3', '{}'::jsonb),

  ('design-system',
   'Design System',
   'Audits 8 design system areas (glass morphism, typography, colors, duplication, spacing, CTAs, sticky footer, Apple simplicity). Scores consistency 0–100, generates refactor tasks, and maintains canonical design spec in Obsidian.',
   'ops', 'review', '0 6 * * 6', '{}'::jsonb)

on conflict (id) do nothing;
