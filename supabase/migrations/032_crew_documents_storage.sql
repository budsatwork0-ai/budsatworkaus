-- 032_crew_documents_storage.sql
-- Migrates crew document storage from Google Drive links to Supabase Storage.
-- Creates a private crew-documents bucket and extends the employee_documents schema.

-- ============================================================
-- 1. Create private storage bucket for crew documents
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crew-documents',
  'crew-documents',
  false,              -- private: all access via server-generated signed URLs
  10485760,           -- 10 MB per file
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Storage RLS (defense in depth — server uses service role)
-- ============================================================

-- Admins can read any object in the bucket
CREATE POLICY "Admins read crew documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'crew-documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Employees can read their own objects (path starts with their employee UUID)
CREATE POLICY "Employees read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'crew-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = auth.uid()
        AND name LIKE (employees.id::text || '/%')
    )
  );

-- ============================================================
-- 3. Extend employee_documents table
-- ============================================================

-- Storage path in the crew-documents bucket (e.g. {employee_id}/{doc_type}/timestamp-name.pdf)
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS storage_path text;

-- Original file name, size and MIME type
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type text;

-- Allow file_url to be null for new Storage-backed uploads
ALTER TABLE employee_documents ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE employee_documents ALTER COLUMN file_url SET DEFAULT NULL;
