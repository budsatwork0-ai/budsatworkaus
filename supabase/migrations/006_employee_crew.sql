-- 006_employee_crew.sql
-- Employee/Crew management tables for job assignments, checklists, onboarding, and documents.

-- ============================================================
-- 1. employees — links Clerk user to internal employee profile
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  suburb text,
  availability text[],
  services text[],
  bio text,
  emergency_contact_name text,
  emergency_contact_phone text,
  onboarding_complete boolean DEFAULT false NOT NULL,
  ndis_worker boolean DEFAULT false NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ============================================================
-- 2. job_assignments — links orders to employees
-- ============================================================
CREATE TABLE IF NOT EXISTS job_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'accepted', 'declined', 'in_progress', 'completed')),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(order_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_job_assignments_order ON job_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_employee ON job_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(status);

-- ============================================================
-- 3. checklist_templates — default checklists per service type
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type text NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  is_default boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_service ON checklist_templates(service_type);

-- ============================================================
-- 4. job_completions — completion records per assignment
-- ============================================================
CREATE TABLE IF NOT EXISTS job_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  checklist_responses jsonb DEFAULT '[]',
  notes text,
  photos text[],
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_completions_assignment ON job_completions(assignment_id);

-- ============================================================
-- 5. employee_documents — onboarding document uploads
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL
    CHECK (doc_type IN ('wwcc', 'police_check', 'first_aid', 'drivers_license', 'abn', 'insurance', 'ndis_screening', 'other')),
  file_url text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);

-- ============================================================
-- 6. employee_onboarding — per-section questionnaire responses
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_onboarding (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  section text NOT NULL
    CHECK (section IN ('personal', 'emergency', 'availability', 'services', 'documents', 'ndis')),
  responses jsonb NOT NULL DEFAULT '{}',
  completed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(employee_id, section)
);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_employee ON employee_onboarding(employee_id);

-- ============================================================
-- Triggers — auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_employee_documents_updated_at
  BEFORE UPDATE ON employee_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_employee_onboarding_updated_at
  BEFORE UPDATE ON employee_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Seed default checklist templates
-- ============================================================
INSERT INTO checklist_templates (service_type, name, items, is_default) VALUES
  ('yard', 'Yard Work Checklist', '[
    {"label": "Mow front lawn", "required": true, "order": 1},
    {"label": "Mow back lawn", "required": true, "order": 2},
    {"label": "Whipper-snip edges", "required": true, "order": 3},
    {"label": "Blow paths and driveway", "required": true, "order": 4},
    {"label": "Remove green waste", "required": true, "order": 5},
    {"label": "Check for hazards cleared", "required": false, "order": 6}
  ]', true),
  ('cleaning', 'Cleaning Checklist', '[
    {"label": "Vacuum all rooms", "required": true, "order": 1},
    {"label": "Mop hard floors", "required": true, "order": 2},
    {"label": "Clean kitchen surfaces", "required": true, "order": 3},
    {"label": "Clean bathrooms", "required": true, "order": 4},
    {"label": "Dust surfaces and skirting", "required": true, "order": 5},
    {"label": "Empty bins", "required": true, "order": 6},
    {"label": "Wipe light switches and handles", "required": false, "order": 7}
  ]', true),
  ('windows', 'Window Cleaning Checklist', '[
    {"label": "Clean exterior windows", "required": true, "order": 1},
    {"label": "Clean interior windows", "required": true, "order": 2},
    {"label": "Clean window sills and tracks", "required": true, "order": 3},
    {"label": "Clean fly screens", "required": false, "order": 4},
    {"label": "Dry and polish glass", "required": true, "order": 5}
  ]', true),
  ('dump', 'Dump Run Checklist', '[
    {"label": "Load items onto vehicle", "required": true, "order": 1},
    {"label": "Secure load for transport", "required": true, "order": 2},
    {"label": "Deliver to tip/recycling", "required": true, "order": 3},
    {"label": "Obtain dump receipt", "required": true, "order": 4},
    {"label": "Clean up loading area", "required": true, "order": 5}
  ]', true),
  ('auto', 'Auto Detailing Checklist', '[
    {"label": "Exterior wash", "required": true, "order": 1},
    {"label": "Interior vacuum", "required": true, "order": 2},
    {"label": "Dashboard and console wipe", "required": true, "order": 3},
    {"label": "Windows inside and out", "required": true, "order": 4},
    {"label": "Tyre shine", "required": false, "order": 5}
  ]', true),
  ('laundry_sneakers', 'Laundry & Sneaker Care Checklist', '[
    {"label": "Sort items by type", "required": true, "order": 1},
    {"label": "Pre-treat stains", "required": true, "order": 2},
    {"label": "Wash cycle complete", "required": true, "order": 3},
    {"label": "Dry items", "required": true, "order": 4},
    {"label": "Fold and package", "required": true, "order": 5},
    {"label": "Quality check", "required": true, "order": 6}
  ]', true);
