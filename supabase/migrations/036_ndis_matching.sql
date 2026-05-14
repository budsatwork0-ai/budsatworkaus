-- 036_ndis_matching.sql
-- NDIS participant support profiles, job requirements, matching, and publication tables.

-- ============================================================
-- 1. participant_support_profiles — NDIS worker support needs
-- ============================================================
CREATE TABLE IF NOT EXISTS participant_support_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  -- Support window
  support_window_start        TIME,
  support_window_end          TIME,
  max_shift_duration_minutes  INT NOT NULL DEFAULT 240,
  -- Support mode
  support_mode                TEXT NOT NULL DEFAULT 'independent'
    CONSTRAINT psp_support_mode_check
    CHECK (support_mode IN ('independent', 'supported', 'team_based')),
  -- Transport
  transport_status            TEXT NOT NULL DEFAULT 'independent'
    CONSTRAINT psp_transport_status_check
    CHECK (transport_status IN ('independent', 'needs_transport', 'arranged')),
  travel_radius_km            INT NOT NULL DEFAULT 10,
  -- Capacity
  preferred_services          TEXT[] NOT NULL DEFAULT '{}',
  physical_capacity           TEXT NOT NULL DEFAULT 'medium'
    CONSTRAINT psp_physical_capacity_check
    CHECK (physical_capacity IN ('low', 'medium', 'high')),
  customer_facing_ok          BOOLEAN NOT NULL DEFAULT TRUE,
  can_work_after_support_hours BOOLEAN NOT NULL DEFAULT FALSE,
  -- Safety & support
  supervision_notes           TEXT,
  risk_notes                  TEXT,
  emergency_contact           TEXT,
  support_worker_name         TEXT,
  support_worker_provider     TEXT,
  -- Metadata
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id)
);

CREATE INDEX IF NOT EXISTS idx_psp_employee ON participant_support_profiles(employee_id);

-- ============================================================
-- 2. job_requirements — NDIS requirements for each order
-- ============================================================
CREATE TABLE IF NOT EXISTS job_requirements (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  estimated_duration_minutes  INT,
  required_support_mode       TEXT NOT NULL DEFAULT 'any'
    CONSTRAINT jr_support_mode_check
    CHECK (required_support_mode IN ('independent', 'supported', 'team_based', 'any')),
  physical_intensity          TEXT NOT NULL DEFAULT 'medium'
    CONSTRAINT jr_physical_intensity_check
    CHECK (physical_intensity IN ('low', 'medium', 'high')),
  transport_required          BOOLEAN NOT NULL DEFAULT FALSE,
  customer_facing_required    BOOLEAN NOT NULL DEFAULT TRUE,
  service_type                TEXT,
  location_suburb             TEXT,
  location_lat                NUMERIC,
  location_lng                NUMERIC,
  start_time                  TIME,
  end_time                    TIME,
  can_split_shift             BOOLEAN NOT NULL DEFAULT FALSE,
  requires_team               BOOLEAN NOT NULL DEFAULT FALSE,
  risk_notes                  TEXT,
  ndis_matching_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_jr_order ON job_requirements(order_id);
CREATE INDEX IF NOT EXISTS idx_jr_matching ON job_requirements(ndis_matching_enabled) WHERE ndis_matching_enabled = TRUE;

-- ============================================================
-- 3. job_participant_matches — cached match scores per job+employee
-- ============================================================
CREATE TABLE IF NOT EXISTS job_participant_matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  score        INT NOT NULL DEFAULT 0,
  max_score    INT NOT NULL DEFAULT 100,
  reasons      JSONB NOT NULL DEFAULT '[]',
  flags        JSONB NOT NULL DEFAULT '[]',
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_jpm_order ON job_participant_matches(order_id);
CREATE INDEX IF NOT EXISTS idx_jpm_employee ON job_participant_matches(employee_id);

-- ============================================================
-- 4. job_publications — which employees can see which jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS job_publications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  published_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'published'
    CONSTRAINT jp_status_check
    CHECK (status IN ('published', 'accepted', 'declined', 'withdrawn')),
  override_reason TEXT,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  UNIQUE(order_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_jp_order ON job_publications(order_id);
CREATE INDEX IF NOT EXISTS idx_jp_employee ON job_publications(employee_id);
CREATE INDEX IF NOT EXISTS idx_jp_status ON job_publications(status);

-- ============================================================
-- 5. shift_segments — split job shifts for shorter windows
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_segments (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  employee_id                UUID REFERENCES employees(id) ON DELETE SET NULL,
  segment_number             INT NOT NULL,
  start_time                 TIME,
  end_time                   TIME,
  estimated_duration_minutes INT,
  status                     TEXT NOT NULL DEFAULT 'unassigned'
    CONSTRAINT ss_status_check
    CHECK (status IN ('unassigned', 'published', 'accepted', 'completed')),
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, segment_number)
);

CREATE INDEX IF NOT EXISTS idx_ss_order ON shift_segments(order_id);

-- ============================================================
-- 6. transport_arrangements — per-job transport logistics
-- ============================================================
CREATE TABLE IF NOT EXISTS transport_arrangements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  arrangement_type  TEXT NOT NULL DEFAULT 'self'
    CONSTRAINT ta_type_check
    CHECK (arrangement_type IN ('self', 'support_worker', 'company', 'public')),
  notes             TEXT,
  confirmed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_ta_order ON transport_arrangements(order_id);
CREATE INDEX IF NOT EXISTS idx_ta_employee ON transport_arrangements(employee_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at_ndis()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_psp_updated_at
  BEFORE UPDATE ON participant_support_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_ndis();

CREATE TRIGGER trg_jr_updated_at
  BEFORE UPDATE ON job_requirements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_ndis();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE participant_support_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requirements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_participant_matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_publications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_segments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_arrangements       ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admins manage participant_support_profiles" ON participant_support_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage job_requirements" ON job_requirements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage job_participant_matches" ON job_participant_matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage job_publications" ON job_publications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage shift_segments" ON shift_segments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage transport_arrangements" ON transport_arrangements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Employees read/write own support profile
CREATE POLICY "Employees manage own support profile" ON participant_support_profiles
  FOR ALL USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Employees read job requirements for jobs published to them
CREATE POLICY "Employees read job requirements for published jobs" ON job_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_publications jp
        JOIN employees e ON e.id = jp.employee_id
      WHERE jp.order_id = job_requirements.order_id
        AND e.user_id = auth.uid()
        AND jp.status = 'published'
    )
  );

-- Employees read own match scores
CREATE POLICY "Employees read own match scores" ON job_participant_matches
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Employees read publications for themselves; can update own response
CREATE POLICY "Employees read own job publications" ON job_publications
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Employees update own job publication response" ON job_publications
  FOR UPDATE USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Employees read shift segments for their jobs
CREATE POLICY "Employees read own shift segments" ON shift_segments
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Employees read own transport arrangements
CREATE POLICY "Employees read own transport arrangements" ON transport_arrangements
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );
