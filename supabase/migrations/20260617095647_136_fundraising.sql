-- Migration 136 — Fundraising system
--
-- Creates two new tables:
--   fundraising_items  — admin-managed wishlist / fundraising cards shown on /get-involved
--   site_impact_stats  — single-row table of editable impact metrics shown publicly
--
-- Additive only. No existing tables altered.
-- Idempotent: all DDL uses IF NOT EXISTS guards.

-- ── 1. fundraising_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fundraising_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'general',
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'live', 'funded', 'archived')),
  image_url            TEXT,
  goal_amount_cents    INTEGER NOT NULL DEFAULT 0,
  raised_amount_cents  INTEGER NOT NULL DEFAULT 0,
  short_reason         TEXT,
  who_it_helps         TEXT,
  employment_impact    TEXT,
  cta_label            TEXT NOT NULL DEFAULT 'Fund This',
  payment_url          TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  is_featured          BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique slug for clean URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_fundraising_items_slug
  ON public.fundraising_items (slug);

-- Fast lookup for the public /get-involved page (live items ordered by sort_order)
CREATE INDEX IF NOT EXISTS idx_fundraising_items_status_sort
  ON public.fundraising_items (status, sort_order);

-- ── 2. site_impact_stats ──────────────────────────────────────────────────────
-- Single-row table. Enforced by a partial unique index on a constant expression.

CREATE TABLE IF NOT EXISTS public.site_impact_stats (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants_supported          INTEGER NOT NULL DEFAULT 0,
  paid_jobs_completed             INTEGER NOT NULL DEFAULT 0,
  training_hours_delivered        INTEGER NOT NULL DEFAULT 0,
  employment_opportunities_created INTEGER NOT NULL DEFAULT 0,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce single-row by making id unique across the whole table using a
-- constant partial index — only one row can ever satisfy (true).
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_impact_stats_singleton
  ON public.site_impact_stats ((true));

-- Seed with the values currently hardcoded on /get-involved (honest starting point)
INSERT INTO public.site_impact_stats (
  participants_supported,
  paid_jobs_completed,
  training_hours_delivered,
  employment_opportunities_created
)
SELECT 1, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.site_impact_stats);

-- ── 3. RLS policies ───────────────────────────────────────────────────────────

ALTER TABLE public.fundraising_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_impact_stats  ENABLE ROW LEVEL SECURITY;

-- Public read: only live fundraising items
DROP POLICY IF EXISTS "fundraising_items_public_read" ON public.fundraising_items;
CREATE POLICY "fundraising_items_public_read"
  ON public.fundraising_items
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live');

-- Service role has unrestricted access (bypasses RLS by default in Postgres)
-- Admin API routes use createServiceClientSafe() which uses the service role key,
-- so no explicit service_role policy is needed.

-- Public read: stats are always public
DROP POLICY IF EXISTS "site_impact_stats_public_read" ON public.site_impact_stats;
CREATE POLICY "site_impact_stats_public_read"
  ON public.site_impact_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── 4. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fundraising_items_updated_at ON public.fundraising_items;
CREATE TRIGGER trg_fundraising_items_updated_at
  BEFORE UPDATE ON public.fundraising_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_site_impact_stats_updated_at ON public.site_impact_stats;
CREATE TRIGGER trg_site_impact_stats_updated_at
  BEFORE UPDATE ON public.site_impact_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
