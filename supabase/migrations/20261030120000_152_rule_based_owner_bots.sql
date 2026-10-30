-- Rule-based owner reminder bots (no AI). They only create review items for the owner.
insert into public.agents (id, name, description, category, status, autonomy, schedule, config)
values
  ('new-lead-alert',    'New Lead Alert',               'Tells you when a new lead comes in. Never messages the customer.', 'sales',   'enabled', 'review', '*/15 * * * *', '{}'::jsonb),
  ('quote-follow-up',   'Quote Follow-up',              'Reminds you to chase quotes with no answer after 3 days.',        'sales',   'enabled', 'review', '0 23 * * *',   '{}'::jsonb),
  ('booking-run-sheet', 'Booking Reminder & Run Sheet', 'Each morning, lists tomorrow''s jobs for you.',                    'ops',     'enabled', 'review', '0 20 * * *',   '{}'::jsonb),
  ('invoice-chaser',    'Invoice Chaser',               'Reminds you about invoices unpaid after 7 days.',                 'finance', 'enabled', 'review', '30 23 * * *',  '{}'::jsonb),
  ('review-rebook',     'Review & Rebook',              'Reminds you to ask for a review and rebook after 8 weeks.',       'sales',   'enabled', 'review', '0 0 * * 1',    '{}'::jsonb)
on conflict (id) do nothing;

-- Replaced by the bots above (they needed paid AI). Reversible: set status back to 'enabled'.
update public.agents set status = 'disabled' where id in ('quote-triage', 'customer-reply', 'lead-scorer');
