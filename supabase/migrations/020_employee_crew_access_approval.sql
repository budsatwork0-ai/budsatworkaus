-- Separate onboarding completion from crew portal approval.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS crew_access_approved boolean DEFAULT false NOT NULL;

UPDATE employees
SET crew_access_approved = true
WHERE onboarding_complete = true
  AND status = 'active';
