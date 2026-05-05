-- NDIS organisations and participants
-- NDIS companies pay a subscription; their linked participants can then access the platform.

CREATE TABLE ndis_organisations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  abn                    TEXT,
  contact_name           TEXT NOT NULL,
  contact_email          TEXT NOT NULL,
  contact_phone          TEXT,
  website                TEXT,
  notes                  TEXT,
  -- Stripe billing
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT NOT NULL DEFAULT 'inactive'
    CONSTRAINT ndis_organisations_sub_status_check
    CHECK (subscription_status IN ('active', 'inactive', 'trialing', 'past_due', 'cancelled')),
  subscription_plan      TEXT DEFAULT 'standard',
  current_period_end     TIMESTAMPTZ,
  trial_ends_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ndis_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES ndis_organisations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  ndis_number     TEXT,
  date_of_birth   DATE,
  status          TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT ndis_participants_status_check
    CHECK (status IN ('active', 'inactive', 'suspended')),
  invite_token    TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  invite_sent_at  TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, email)
);

-- Indexes
CREATE INDEX idx_ndis_orgs_status    ON ndis_organisations(subscription_status);
CREATE INDEX idx_ndis_orgs_stripe    ON ndis_organisations(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_ndis_parts_org      ON ndis_participants(organisation_id);
CREATE INDEX idx_ndis_parts_user     ON ndis_participants(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_ndis_parts_email    ON ndis_participants(email);
CREATE INDEX idx_ndis_parts_token    ON ndis_participants(invite_token)
  WHERE invite_token IS NOT NULL;

-- updated_at trigger on organisations
CREATE OR REPLACE FUNCTION set_ndis_org_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ndis_org_updated_at
  BEFORE UPDATE ON ndis_organisations
  FOR EACH ROW EXECUTE FUNCTION set_ndis_org_updated_at();

-- RLS
ALTER TABLE ndis_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ndis_participants  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ndis_organisations" ON ndis_organisations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage ndis_participants" ON ndis_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Participants view own record" ON ndis_participants
  FOR SELECT USING (user_id = auth.uid());
