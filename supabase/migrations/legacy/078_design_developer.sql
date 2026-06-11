-- Migration 078: Design Developer Agent
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('design-developer', 'Design Developer',
     'Applies theme changes and visual design modifications to the dashboard, crew portal, and public themes based on natural language requests.',
     'ops', 'review', null, '{"allowed_themes": ["dashboard", "crew", "public"]}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  autonomy = excluded.autonomy,
  config = excluded.config;
