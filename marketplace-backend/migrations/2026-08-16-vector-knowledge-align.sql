-- Vector Knowledge — alignment migration
--
-- Supersedes the earlier 2026-08-15-vector-knowledge.sql draft, which described a
-- second, INCOMPATIBLE `ai_knowledge_chunks` shape (source_doc/hash, nullable
-- dealership_id, match_knowledge_chunks). The canonical table already exists in
-- staging/prod with authz-integrated RLS and a match_ai_knowledge_chunks(...) RPC.
-- This migration does NOT recreate the table. It only:
--   1. Establishes the global-knowledge sentinel dealership (nil UUID).
--   2. Extends match_ai_knowledge_chunks so authenticated dealership users retrieve
--      their own knowledge PLUS global knowledge — never another tenant's.
--   3. Adds match_ai_knowledge_chunks_admin for the trusted backend (service role),
--      which has already authorized the request and passes an explicit dealership.
--
-- Idempotent: safe to re-run.

-- 1. Global knowledge sentinel dealership. `dealership_id` on ai_knowledge_chunks is
--    NOT NULL and FK-references dealerships, so global knowledge needs a real owner row.
INSERT INTO public.dealerships (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'MarketSync Global Knowledge (system)')
ON CONFLICT (id) DO NOTHING;

-- 2. JWT/RLS-context retrieval: own dealership + global. Isolation preserved — the
--    caller must belong to (or be platform staff of) target_dealership, and only that
--    dealership's rows plus global (nil-UUID) rows are ever returned.
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_chunks(
  query_embedding vector,
  target_dealership uuid,
  match_count integer DEFAULT 10,
  source_types text[] DEFAULT NULL,
  min_similarity double precision DEFAULT 0
)
RETURNS TABLE (
  id uuid, source_type text, source_key text, source_id text, source_name text,
  chunk_index integer, content text, metadata jsonb, required_permission text,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  select
    k.id, k.source_type, k.source_key, k.source_id, k.source_name, k.chunk_index,
    k.content, k.metadata, k.required_permission,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.ai_knowledge_chunks k
  where k.embedding is not null
    and (
      authz.is_platform_staff()
      or authz.belongs_to_dealership(target_dealership)
    )
    and (
      k.dealership_id = target_dealership
      or k.dealership_id = '00000000-0000-0000-0000-000000000000'::uuid
    )
    and (
      k.required_permission is null
      or authz.is_platform_staff()
      or authz.has_permission(target_dealership, k.required_permission)
    )
    and (source_types is null or k.source_type = any(source_types))
    and (1 - (k.embedding <=> query_embedding)) >= greatest(0, least(1, min_similarity))
  order by k.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 10), 100));
$function$;

-- 3. Trusted-backend retrieval (SECURITY DEFINER). The server-side RAG path uses the
--    service role (no end-user JWT), so authz.* would evaluate to false and the RLS
--    function above would return nothing. This variant trusts the backend to have
--    already authorized the request; isolation is guaranteed by the explicit predicate
--    (`target OR global`), never another tenant. `allowed_permissions` gates
--    permission-scoped rows (NULL => only rows with required_permission IS NULL).
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_chunks_admin(
  query_embedding vector,
  target_dealership uuid,
  match_count integer DEFAULT 10,
  source_types text[] DEFAULT NULL,
  min_similarity double precision DEFAULT 0,
  allowed_permissions text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid, dealership_id uuid, source_type text, source_key text, source_id text,
  source_name text, chunk_index integer, content text, metadata jsonb,
  required_permission text, similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  select
    k.id, k.dealership_id, k.source_type, k.source_key, k.source_id, k.source_name,
    k.chunk_index, k.content, k.metadata, k.required_permission,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.ai_knowledge_chunks k
  where k.embedding is not null
    and target_dealership is not null
    and (
      k.dealership_id = target_dealership
      or k.dealership_id = '00000000-0000-0000-0000-000000000000'::uuid
    )
    and (
      k.required_permission is null
      or (allowed_permissions is not null and k.required_permission = any(allowed_permissions))
    )
    and (source_types is null or k.source_type = any(source_types))
    and (1 - (k.embedding <=> query_embedding)) >= greatest(0, least(1, min_similarity))
  order by k.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 10), 100));
$function$;

-- Only the trusted backend (service role) may call the admin variant.
REVOKE ALL ON FUNCTION public.match_ai_knowledge_chunks_admin(vector, uuid, integer, text[], double precision, text[])
  FROM PUBLIC, anon, authenticated;
