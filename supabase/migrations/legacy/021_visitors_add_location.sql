-- 021_visitors_add_location.sql
-- Add city and country columns to site_visitors.
-- Populated from Vercel's automatic geolocation headers on each /api/track call.

ALTER TABLE site_visitors
  ADD COLUMN IF NOT EXISTS city    text,
  ADD COLUMN IF NOT EXISTS country text;
