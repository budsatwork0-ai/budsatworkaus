-- Add lean staff setup fields so "Convert to Staff" can prepare roster configuration.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS default_role text,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS roster_active boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_employment_type_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_employment_type_check
      CHECK (employment_type IN ('casual', 'contractor', 'part_time', 'full_time'));
  END IF;
END $$;

COMMENT ON COLUMN employees.default_role IS
  'Primary operational role used when the crew member joins the active roster.';

COMMENT ON COLUMN employees.employment_type IS
  'Employment classification chosen during staff conversion.';

COMMENT ON COLUMN employees.roster_active IS
  'Whether this crew member should appear in the active scheduling pool.';
