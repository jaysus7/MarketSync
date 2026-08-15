-- Vector Database & Intelligence Schema Migration (Task 6)
-- 1. Enable pgvector extension
-- 2. Create ai_knowledge_chunks table with tenant ownership and metadata
-- 3. Enforce idempotency via unique content hash index
-- 4. Create vector similarity search function with strict tenant isolation (dealership_id matching + global fallback)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE, -- null = global knowledge
  source_doc TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: prevent duplicate chunks per dealership/document chunk
CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_chunks_identity_uk
  ON public.ai_knowledge_chunks (COALESCE(dealership_id, '00000000-0000-0000-0000-000000000000'::uuid), hash);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_dealer_idx
  ON public.ai_knowledge_chunks (dealership_id);

-- Enable RLS
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks FORCE ROW LEVEL SECURITY;

-- Similarity Retrieval Function with Tenant Isolation
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_dealership_id uuid
)
RETURNS TABLE (
  id uuid,
  dealership_id uuid,
  source_doc text,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.dealership_id,
    kc.source_doc,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    (1 - (kc.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_knowledge_chunks kc
  WHERE (kc.dealership_id = p_dealership_id OR kc.dealership_id IS NULL)
    AND (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, float, int, uuid) FROM PUBLIC, anon, authenticated;
