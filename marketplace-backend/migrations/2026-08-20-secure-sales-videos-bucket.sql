-- Migration: Secure sales-videos storage bucket & Customer Share Links
-- Hardens sales-videos bucket by disabling public access (public = false) and enforcing
-- tenant-isolated RLS on storage.objects.
-- Adds revoked_at column to sales_videos for explicit link revocation.

-- 1. Make sales-videos bucket private
UPDATE storage.buckets
   SET public = false
 WHERE id = 'sales-videos';

-- 2. Add revoked_at column to public.sales_videos if not exists
ALTER TABLE public.sales_videos
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- 3. Storage RLS Policies for sales-videos
-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies on sales-videos
DROP POLICY IF EXISTS "sales_videos_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_authenticated_delete" ON storage.objects;

-- Authenticated dealership users can only select objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sales-videos' AND
    (storage.foldername(name))[1] = authz.current_dealership_id()::text
  );

-- Authenticated dealership users can only insert objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sales-videos' AND
    (storage.foldername(name))[1] = authz.current_dealership_id()::text
  );

-- Authenticated dealership users can only delete objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sales-videos' AND
    (storage.foldername(name))[1] = authz.current_dealership_id()::text
  );

