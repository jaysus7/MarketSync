-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Secure sales-videos storage bucket & Customer Share Links
--
-- Security Guarantees:
-- 1. storage bucket 'sales-videos' is strictly private (public = false).
-- 2. No anonymous storage SELECT policy on storage.objects for sales-videos.
-- 3. Authenticated dealership users can only SELECT/INSERT/DELETE objects inside
--    their own dealership folder: <dealership_id>/<user_id>/<filename>.
-- 4. Public customer playback is strictly mediated through backend signed URLs
--    via /v/:token after validating the share token, expiration, and revocation.
-- 5. Explicit revocation supported via revoked_at on public.sales_videos.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure private sales-videos storage bucket
UPDATE storage.buckets
   SET public = false
 WHERE id = 'sales-videos';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sales-videos',
  'sales-videos',
  false,
  209715200, -- 200MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 209715200,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

-- 2. Add revoked_at column to public.sales_videos if not exists & index it
ALTER TABLE public.sales_videos
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS sales_videos_share_token_revoked_idx
  ON public.sales_videos (share_token)
  WHERE revoked_at IS NULL AND deleted_at IS NULL;

-- 3. Helper to extract dealership_id from storage path
CREATE SCHEMA IF NOT EXISTS authz;

CREATE OR REPLACE FUNCTION authz.storage_path_dealership(path text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN path IS NULL OR path = '' THEN NULL
    ELSE (
      CASE
        WHEN split_part(path, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(path, '/', 1)::uuid
        ELSE NULL
      END
    )
  END;
$$;

-- 4. Storage RLS Policies for sales-videos
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies on sales-videos (including any legacy public/anon select)
DROP POLICY IF EXISTS "sales_videos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "sales_videos_authenticated_delete" ON storage.objects;

-- Authenticated dealership users can only select objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sales-videos' AND
    (
      authz.belongs_to_dealership(authz.storage_path_dealership(name)) OR
      authz.is_platform_staff()
    )
  );

-- Authenticated dealership users can only insert objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sales-videos' AND
    (
      authz.belongs_to_dealership(authz.storage_path_dealership(name)) OR
      authz.is_platform_staff()
    )
  );

-- Authenticated dealership users can only update objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sales-videos' AND
    (
      authz.belongs_to_dealership(authz.storage_path_dealership(name)) OR
      authz.is_platform_staff()
    )
  )
  WITH CHECK (
    bucket_id = 'sales-videos' AND
    (
      authz.belongs_to_dealership(authz.storage_path_dealership(name)) OR
      authz.is_platform_staff()
    )
  );

-- Authenticated dealership users can only delete objects within their dealership folder
CREATE POLICY "sales_videos_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sales-videos' AND
    (
      authz.belongs_to_dealership(authz.storage_path_dealership(name)) OR
      authz.is_platform_staff()
    )
  );
