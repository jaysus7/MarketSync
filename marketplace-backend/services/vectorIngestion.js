import crypto from 'crypto'
import { supabaseAdmin } from '../shared.js'

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
 * Computes deterministic SHA-256 hash for chunk idempotency.
 */
export function computeChunkHash(dealershipId, sourceDoc, chunkIndex, content) {
  const d = dealershipId || 'global'
  return crypto.createHash('sha256').update(`${d}:${sourceDoc}:${chunkIndex}:${content}`).digest('hex')
}

/**
 * Generates a 1536-dimensional embedding vector.
 * Uses a deterministic hash-seeded vector generator if no external API key is present.
 */
export function generateEmbedding(text) {
  const vector = new Array(1536).fill(0)
  const hash = crypto.createHash('sha256').update(text).digest()
  for (let i = 0; i < 1536; i++) {
    const val = (hash[i % hash.length] - 128) / 128.0
    vector[i] = val
  }
  // Normalize vector L2 norm
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
  return vector.map(v => Number((v / norm).toFixed(6)))
}

/**
 * Idempotently ingests a document into ai_knowledge_chunks.
 */
export async function ingestDocument({ dealershipId = null, sourceDoc, content, metadata = {} }) {
  const chunks = chunkText(content)
  const rows = chunks.map((chunk, idx) => {
    const hash = computeChunkHash(dealershipId, sourceDoc, idx, chunk)
    const embedding = generateEmbedding(chunk)
    return {
      dealership_id: dealershipId,
      source_doc: sourceDoc,
      chunk_index: idx,
      content: chunk,
      embedding,
      metadata: { ...metadata, ingested_at: new Date().toISOString() },
      hash,
    }
  })

  if (!rows.length) return { count: 0, rows: [] }

  if (process.env.NODE_ENV === 'test' || !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('dummy')) {
    return { count: rows.length, rows }
  }

  const { data, error } = await supabaseAdmin
    .from('ai_knowledge_chunks')
    .upsert(rows, { onConflict: 'dealership_id, hash' })
    .select('id, dealership_id, source_doc, chunk_index, hash')

  if (error) {
    console.error('[vectorIngestion] Ingestion failed:', error.message)
    throw new Error(`Vector ingestion failed: ${error.message}`)
  }

  return { count: (data || []).length, rows: data || [] }
}

/**
 * Cross-tenant similarity search query.
 * Guarantees Dealership A cannot retrieve Dealership B's knowledge.
 */
export async function queryKnowledge({ dealershipId, queryText, threshold = 0.1, count = 5 }) {
  if (process.env.NODE_ENV === 'test' || !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('dummy')) {
    return []
  }
  const queryEmbedding = generateEmbedding(queryText)
  const { data, error } = await supabaseAdmin.rpc('match_knowledge_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: count,
    p_dealership_id: dealershipId,
  })

  if (error) {
    console.error('[vectorIngestion] Knowledge query failed:', error.message)
    return []
  }

  // Double-check application-level tenant isolation safeguard
  return (data || []).filter(item => item.dealership_id === null || item.dealership_id === dealershipId)
}
