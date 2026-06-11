ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_discount_offer_sent_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS day_before_reminder_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_quotes_last_reminder_sent_at
  ON public.quotes(last_reminder_sent_at);

CREATE INDEX IF NOT EXISTS idx_quotes_last_discount_offer_sent_at
  ON public.quotes(last_discount_offer_sent_at);

CREATE INDEX IF NOT EXISTS idx_orders_day_before_reminder
  ON public.orders(day_before_reminder_sent, scheduled_date);

INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'automations',
    '{
      "quote24hReminder": true,
      "quote48hDiscount": true,
      "dayBeforeReminder": true,
      "weeklyKpiEmail": true,
      "autoCompleteJobs": false
    }'::jsonb,
    'Automation toggle flags for cron-driven sales and ops workflows'
  ),
  (
    'automationConfig',
    '{
      "quoteReengagementDiscountPercent": 10
    }'::jsonb,
    'Configuration values for automations'
  ),
  (
    'goals',
    '{
      "monthlyRevenueTarget": 15000,
      "monthlyJobsTarget": 30
    }'::jsonb,
    'Monthly dashboard goal targets'
  )
ON CONFLICT (key) DO NOTHING;
