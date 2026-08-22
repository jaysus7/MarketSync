import crypto from 'crypto'
import { supabaseAdmin } from '../shared.js'

/**
 * Vector knowledge ingestion & retrieval, aligned to the CANONICAL staging/prod
 * `public.ai_knowledge_chunks` schema and its authz-integrated retrieval functions.
 *
 * Real columns (NOT the throwaway shape an earlier draft assumed):
 *   dealership_id (NOT NULL), source_type, source_key, source_id, source_name,
 *   chunk_index, content, content_hash, metadata, required_permission,
 *   embedding_model, embedding vector(1536)
 *
 * Global (cross-dealer, MarketSync-owned product) knowledge lives under a single
 * sentinel dealership (the nil UUID). Retrieval returns a dealership's own rows
 * PLUS global rows, and never another tenant's — enforced in SQL, re-checked here.
 */

export const EMBEDDING_DIM = 1536
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
export const DETERMINISTIC_MODEL = 'deterministic-sha256-v1'

// Sentinel dealership that owns global / MarketSync product knowledge.
// Kept in sync with migrations/2026-08-16-vector-knowledge-align.sql.
export const GLOBAL_KNOWLEDGE_DEALERSHIP_ID =
  process.env.GLOBAL_KNOWLEDGE_DEALERSHIP_ID || '00000000-0000-0000-0000-000000000000'

/**
 * Normalizes text and splits into clean chunks.
 */
export function chunkText(text, maxChunkSize = 500, overlap = 50) {
  if (!text || typeof text !== 'string') return []
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const paragraphs = clean.split(/\n\n+/)
  const chunks = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length <= maxChunkSize) {
      current = current ? current + '\n\n' + para : para
    } else {
      if (current) chunks.push(current)
      if (para.length > maxChunkSize) {
        // Sentence split fallback
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para]
        let sub = ''
        for (const s of sentences) {
          if ((sub + ' ' + s).length <= maxChunkSize) {
            sub = sub ? sub + ' ' + s : s
          } else {
            if (sub) chunks.push(sub)
            sub = s
          }
        }
        if (sub) current = sub
      } else {
        current = para
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/**
 * Content integrity hash (sha256 of the chunk text). Stored in `content_hash`
 * so a re-ingest can detect whether a chunk's text actually changed.
 */
export function computeContentHash(content) {
  return crypto.createHash('sha256').update(String(content)).digest('hex')
}

/**
 * Deterministic pseudo-embedding. NOT a semantic embedding — it is used ONLY in
 * unit tests / offline mode so the pipeline is exercisable without a paid API.
 * Production ingestion never uses this (see embedText()).
 */
export function deterministicEmbedding(text) {
  const vector = new Array(EMBEDDING_DIM).fill(0)
  const hash = crypto.createHash('sha256').update(String(text)).digest()
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vector[i] = (hash[i % hash.length] - 128) / 128.0
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
  return vector.map(v => Number((v / norm).toFixed(6)))
}

function useDeterministicEmbeddings() {
  return process.env.NODE_ENV === 'test' || process.env.EMBEDDINGS_MODE === 'deterministic'
}

function shouldSkipDb() {
  const url = process.env.SUPABASE_URL || ''
  return process.env.NODE_ENV === 'test' || !url || url.includes('dummy')
}

async function openAIEmbedding(text, model) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text, dimensions: EMBEDDING_DIM }),
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`OpenAI embeddings API ${resp.status}: ${detail.slice(0, 300)}`)
  }
  const json = await resp.json()
  return json?.data?.[0]?.embedding
}

/**
 * Produces a real semantic embedding for `text`.
 * - Tests / EMBEDDINGS_MODE=deterministic: deterministic vector (labelled as such).
 * - Otherwise: a real provider embedding (OpenAI text-embedding-3-small by default),
 *   the model recorded in `embedding_model`.
 * Fails loudly rather than silently degrading to a pseudo-vector in production.
 */
export async function embedText(text) {
  if (useDeterministicEmbeddings()) {
    return { embedding: deterministicEmbedding(text), model: DETERMINISTIC_MODEL }
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'No embedding provider configured. Set OPENAI_API_KEY to generate real semantic ' +
      'embeddings (or EMBEDDINGS_MODE=deterministic for isolated tests).'
    )
  }
  const embedding = await openAIEmbedding(text, EMBEDDING_MODEL)
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding provider returned ${embedding?.length} dims; expected ${EMBEDDING_DIM}`)
  }
  return { embedding, model: EMBEDDING_MODEL }
}

/**
 * Idempotently ingests a document into public.ai_knowledge_chunks for one source.
 * Re-ingesting the same (dealership_id, source_type, source_key) replaces its chunks
 * wholesale, so running twice yields no duplicates and no orphaned tail chunks.
 */
export async function ingestDocument({
  dealershipId,
  sourceType,
  sourceKey,
  sourceName = null,
  sourceId = null,
  content,
  metadata = {},
  requiredPermission = null,
}) {
  if (!dealershipId) {
    throw new Error('ingestDocument requires dealershipId (use GLOBAL_KNOWLEDGE_DEALERSHIP_ID for global knowledge)')
  }
  if (!sourceType || !sourceKey) {
    throw new Error('ingestDocument requires sourceType and sourceKey')
  }

  const chunks = chunkText(content)
  const rows = []
  let embeddingModel = DETERMINISTIC_MODEL

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]
    const { embedding, model } = await embedText(chunk)
    embeddingModel = model
    rows.push({
      dealership_id: dealershipId,
      source_type: sourceType,
      source_key: sourceKey,
      source_id: sourceId,
      source_name: sourceName,
      chunk_index: idx,
      content: chunk,
      content_hash: computeContentHash(chunk),
      metadata: { ...metadata, ingested_at: new Date().toISOString() },
      required_permission: requiredPermission,
      embedding_model: model,
      embedding,
    })
  }

  if (!rows.length) return { count: 0, rows: [], embeddingModel }

  if (shouldSkipDb()) {
    return { count: rows.length, rows, embeddingModel }
  }

  // Clean re-ingest: drop prior chunks for this exact source, then insert fresh.
  const { error: delErr } = await supabaseAdmin
    .from('ai_knowledge_chunks')
    .delete()
    .eq('dealership_id', dealershipId)
    .eq('source_type', sourceType)
    .eq('source_key', sourceKey)
  if (delErr) {
    throw new Error(`Vector ingestion cleanup failed: ${delErr.message}`)
  }

  const { data, error } = await supabaseAdmin
    .from('ai_knowledge_chunks')
    .insert(rows)
    .select('id, dealership_id, source_type, source_key, chunk_index')
  if (error) {
    throw new Error(`Vector ingestion failed: ${error.message}`)
  }

  return { count: (data || []).length, rows: data || [], embeddingModel }
}

/**
 * Similarity retrieval for a trusted backend (service-role) caller that has ALREADY
 * authorized the request. Returns the dealership's own knowledge PLUS global
 * knowledge — never another tenant's. `allowedPermissions` gates permission-scoped
 * rows (null => only rows with required_permission IS NULL).
 */
export async function queryKnowledge({
  dealershipId,
  queryText,
  sourceTypes = null,
  allowedPermissions = null,
  threshold = 0,
  count = 5,
}) {
  if (shouldSkipDb()) return []
  if (!dealershipId) throw new Error('queryKnowledge requires dealershipId')

  const { embedding } = await embedText(queryText)
  const { data, error } = await supabaseAdmin.rpc('match_ai_knowledge_chunks_admin', {
    query_embedding: embedding,
    target_dealership: dealershipId,
    match_count: count,
    source_types: sourceTypes,
    min_similarity: threshold,
    allowed_permissions: allowedPermissions,
  })

  if (error) {
    console.error('[vectorIngestion] Knowledge query failed:', error.message)
    return []
  }

  // Defense-in-depth: the SQL already enforces this, but never surface a row that
  // is neither this dealership's nor global.
  return (data || []).filter(
    r => r.dealership_id === dealershipId || r.dealership_id === GLOBAL_KNOWLEDGE_DEALERSHIP_ID
  )
}
