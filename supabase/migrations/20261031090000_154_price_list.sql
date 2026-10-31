-- Price list (editable from admin) + history of every change.
-- Reversible: drop table public.price_history; drop table public.price_list;
create table if not exists public.price_list (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  item text not null,
  label text not null,
  unit text not null,
  price numeric(10,2),
  minimum numeric(10,2),
  market_low numeric(10,2),
  market_high numeric(10,2),
  source text,
  checked_at date,
  note text,
  active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (service, item)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_list(id),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

alter table public.price_list enable row level security;
alter table public.price_history enable row level security;

drop policy if exists price_list_public_read on public.price_list;
create policy price_list_public_read on public.price_list for select using (active = true);
drop policy if exists price_list_admin_all on public.price_list;
create policy price_list_admin_all on public.price_list for all
  using (get_user_role() = 'admin') with check (get_user_role() = 'admin');
drop policy if exists price_history_admin_all on public.price_history;
create policy price_history_admin_all on public.price_history for all
  using (get_user_role() = 'admin') with check (get_user_role() = 'admin');

-- Residential window cleaning, approved by Jackson 31 Oct 2026. Not GST registered.
-- Market data: Brisbane research 31 Oct 2026.
insert into public.price_list (service, item, label, unit, price, minimum, market_low, market_high, source, checked_at, note, sort_order) values
 ('windows','pane_interior','Interior glass pane','pane',6,null,4,14,'https://wsicleaning.com/guides/window-cleaning-brisbane-cost ; https://4kwindows.com.au/calculator ; https://ecobriscleaning.com/services/window-washing ; https://clean4you.com.au/domestic-window-cleaning-brisbane-cost/','2026-10-31','Per side. Market both-sides $7–8 (4K, Ecobris, Will''s); WSI $8–14 per side.',10),
 ('windows','pane_exterior','Exterior glass pane','pane',6,null,6,18,'https://whatsthedamage.com.au/window-cleaning-cost-brisbane/ ; https://wsicleaning.com/guides/window-cleaning-brisbane-cost','2026-10-31','Per side. Outside-only typical $11 (WhatsTheDamage).',20),
 ('windows','track','Window track','track',5,null,3,15,'https://wsicleaning.com/guides/window-cleaning-brisbane-cost ; https://whatsthedamage.com.au/window-cleaning-cost-brisbane/','2026-10-31','Many locals include tracks free (4K, Ecobris, Shining).',30),
 ('windows','screen','Window screen','screen',4,null,4,8,'https://4kwindows.com.au/calculator ; https://wsicleaning.com/guides/window-cleaning-brisbane-cost','2026-10-31','4K $5; WSI $4–8.',40),
 ('windows','job_minimum','Minimum job','job',null,150,99,240,'https://shiningservices.com.au/locations/brisbane/window-cleaning/ ; https://onendonebondclean.com.au/window-cleaning/logan-central/ ; https://www.willswindowwashing.com.au/pricing/','2026-10-31','Shining $150 (≤10 windows); One N Done from $99; Will''s 2h × $120.',50)
on conflict (service, item) do nothing;
