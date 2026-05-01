-- 031_crew_documents_expand.sql
-- Adds new document types for compliance and role-based docs.
-- Adds employee_payroll_details for secure payroll status tracking.
-- Raw sensitive values (TFN, BSB, super fund numbers) are NEVER stored here.

-- ============================================================
-- 1. Expand doc_type CHECK constraint on employee_documents
-- ============================================================
ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_doc_type_check;

ALTER TABLE employee_documents
  ADD CONSTRAINT employee_documents_doc_type_check
  CHECK (doc_type IN (
    -- Required compliance
    'wwcc', 'police_check', 'first_aid', 'cpr_certificate', 'ndis_orientation',
    -- NDIS conditional
    'ndis_screening',
    -- Role-based optional
    'drivers_license', 'vehicle_registration', 'vehicle_insurance',
    'abn', 'insurance', 'public_liability', 'resume', 'references',
    -- Fallback
    'other'
  ));

-- ============================================================
-- 2. employee_payroll_details — secure payroll status flags
--    IMPORTANT: This table stores only boolean confirmation flags.
--    Actual sensitive values (TFN, BSB, super account) must be
--    collected via a secure channel (paper form, ATO tax file
--    declaration, encrypted HR system) — never via Google Drive.
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_payroll_details (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id      uuid        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  -- Boolean status flags only — raw values are never stored
  tfn_declaration_received  boolean NOT NULL DEFAULT false,
  bank_details_received     boolean NOT NULL DEFAULT false,
  super_details_received    boolean NOT NULL DEFAULT false,
  right_to_work_confirmed   boolean NOT NULL DEFAULT false,
  employment_type  text        CHECK (employment_type IN (
    'casual', 'contractor', 'volunteer', 'trainee', 'part_time', 'full_time'
  )),
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL,
  UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_employee ON employee_payroll_details(employee_id);

-- ============================================================
-- 3. RLS for employee_payroll_details
-- ============================================================
ALTER TABLE employee_payroll_details ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins full access to payroll details"
  ON employee_payroll_details FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Employees: can manage their own row
CREATE POLICY "Employees manage their own payroll details"
  ON employee_payroll_details FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_payroll_details.employee_id
        AND employees.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_payroll_details.employee_id
        AND employees.user_id = auth.uid()
    )
  );
