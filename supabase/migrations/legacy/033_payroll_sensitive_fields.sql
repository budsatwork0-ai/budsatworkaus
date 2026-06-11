-- 033_payroll_sensitive_fields.sql
-- Adds real data columns for sensitive payroll/employment details.
-- All data is protected by existing RLS: employees see only their own row,
-- admins have full access. Never expose these fields in public API routes.

ALTER TABLE employee_payroll_details

  -- Tax File Number (9-digit Australian TFN)
  ADD COLUMN IF NOT EXISTS tfn text,

  -- Bank account for payroll
  ADD COLUMN IF NOT EXISTS bank_bsb              text,
  ADD COLUMN IF NOT EXISTS bank_account_number   text,
  ADD COLUMN IF NOT EXISTS bank_account_name     text,
  ADD COLUMN IF NOT EXISTS bank_institution      text,

  -- Superannuation
  ADD COLUMN IF NOT EXISTS super_fund_name       text,
  ADD COLUMN IF NOT EXISTS super_usi             text,
  ADD COLUMN IF NOT EXISTS super_member_number   text,

  -- Right to work in Australia
  ADD COLUMN IF NOT EXISTS right_to_work_type    text
    CHECK (right_to_work_type IN ('citizen', 'permanent_resident', 'work_visa', 'other')),
  ADD COLUMN IF NOT EXISTS right_to_work_visa_subclass text,
  ADD COLUMN IF NOT EXISTS right_to_work_expiry  date;
