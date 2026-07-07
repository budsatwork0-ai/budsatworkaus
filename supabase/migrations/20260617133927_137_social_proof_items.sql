-- Migration 137 — Admin-managed social proof feed for /get-involved
--
-- Additive only. Creates a lightweight table for manually featuring real
-- Buds At Work short-form videos from approved social channels.

CREATE TABLE IF NOT EXISTS public.social_proof_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook')),
  source_url    TEXT NOT NULL,
  thumbnail_url TEXT,
  posted_at     DATE,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'archived')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_proof_items_status_sort
  ON public.social_proof_items (status, sort_order);

ALTER TABLE public.social_proof_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_proof_items_public_read" ON public.social_proof_items;
CREATE POLICY "social_proof_items_public_read"
  ON public.social_proof_items
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live');

DROP TRIGGER IF EXISTS trg_social_proof_items_updated_at ON public.social_proof_items;
CREATE TRIGGER trg_social_proof_items_updated_at
  BEFORE UPDATE ON public.social_proof_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
