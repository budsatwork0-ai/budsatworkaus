-- Applicants table for tracking people who submit the "Get Involved" form
-- Feeds into the onboarding pipeline dashboard

CREATE TABLE IF NOT EXISTS applicants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Role selected on the form
  role text NOT NULL CHECK (role IN ('Casual crew', 'Support worker', 'Quality partner', 'Innovation partner')),

  -- Pipeline stage
  stage text NOT NULL DEFAULT 'intake' CHECK (stage IN ('intake', 'verify', 'paperwork', 'induct', 'ready')),

  -- Personal info
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  suburb text,

  -- Crew-specific
  availability text[],
  services text[],
  needs_transport boolean DEFAULT false,
  pickup_suburb text,
  max_ride_minutes integer,
  ndis_participant boolean DEFAULT false,
  ndis_number text,
  ndis_funding_type text,
  support_coordinator_contact text,
  mobility_aid text,
  ride_preferences text,

  -- Support Worker-specific
  car_compliant boolean DEFAULT false,
  all_clearances boolean DEFAULT false,
  resume text,
  abn text,
  years_experience integer,
  seats_available integer,
  boot_space text,
  can_carry_aid text,
  pickup_radius_km integer,

  -- Quality Partner-specific
  quality_business_name text,
  quality_contribution_types text[],
  quality_message text,

  -- Innovation Partner-specific
  innovation_organisation text,
  innovation_interest_areas text[],
  innovation_notes text,

  -- Pipeline metadata
  owner text,
  notes text,
  missing_docs text[],
  sla_deadline timestamptz DEFAULT (now() + interval '72 hours'),
  consent boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_applicants_stage ON applicants(stage);
CREATE INDEX IF NOT EXISTS idx_applicants_role ON applicants(role);
CREATE INDEX IF NOT EXISTS idx_applicants_created_at ON applicants(created_at DESC);

COMMENT ON TABLE applicants IS 'People who submitted the Get Involved form, tracked through onboarding pipeline';
