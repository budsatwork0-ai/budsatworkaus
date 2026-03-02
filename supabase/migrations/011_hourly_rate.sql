-- 011_hourly_rate.sql
-- Add hourly_rate to employees so admins can configure per-crew-member pay rates.
-- Used by the crew portal to show: estimated hours × hourly rate = expected pay.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(8,2) NOT NULL DEFAULT 25.00;

COMMENT ON COLUMN employees.hourly_rate IS
  'Base hourly rate in AUD. Set by admin. Used to calculate expected earnings for upcoming jobs.';
