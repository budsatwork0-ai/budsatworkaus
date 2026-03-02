-- Add user_id column to applicants table to link activated applicants to their auth user
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id) WHERE user_id IS NOT NULL;
