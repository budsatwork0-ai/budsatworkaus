-- NDIS-specific columns for quotes. Lets the admin dashboard route quotes to
-- plan-managed / self-managed / agency-managed participants and track the
-- estimated hours billed under the NDIS Price Guide cap (~$57.10/hr).
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS ndis_management_type text,
  ADD COLUMN IF NOT EXISTS ndis_forward_contact text,
  ADD COLUMN IF NOT EXISTS ndis_forward_email text,
  ADD COLUMN IF NOT EXISTS ndis_estimated_hours numeric(5,2),
  ADD COLUMN IF NOT EXISTS ndis_hourly_rate numeric(6,2),
  ADD COLUMN IF NOT EXISTS ndis_forwarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS ndis_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ndis_booked_at timestamptz;

-- Restrict the management type to known values; NULL = not an NDIS quote.
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_ndis_management_type_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_ndis_management_type_check
  CHECK (
    ndis_management_type IS NULL
    OR ndis_management_type IN ('plan_managed', 'self_managed', 'agency_managed')
  );

-- Indexes to support admin filters + insights on NDIS quotes.
CREATE INDEX IF NOT EXISTS quotes_ndis_management_type_idx
  ON quotes(ndis_management_type)
  WHERE ndis_management_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotes_ndis_forwarded_at_idx
  ON quotes(ndis_forwarded_at DESC)
  WHERE ndis_forwarded_at IS NOT NULL;
