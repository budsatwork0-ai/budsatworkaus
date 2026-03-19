-- 018_site_feedback.sql
-- Public feedback / ideas submissions from the get-involved page

CREATE TABLE IF NOT EXISTS site_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('bug_report', 'feature_idea', 'general')),
  subject     text NOT NULL,
  description text NOT NULL,
  photo_url   text,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  admin_notes text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_feedback_status ON site_feedback (status);
CREATE INDEX IF NOT EXISTS idx_site_feedback_created_at ON site_feedback (created_at DESC);

-- RLS
ALTER TABLE site_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert feedback"
  ON site_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can view feedback"
  ON site_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

CREATE POLICY "Staff can update feedback"
  ON site_feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );
