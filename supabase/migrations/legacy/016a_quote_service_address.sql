-- Add service address capture to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS service_address TEXT;
