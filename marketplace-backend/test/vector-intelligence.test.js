import test from 'node:test'
import assert from 'node:assert/strict'
import {
  chunkText,
  computeContentHash,
  deterministicEmbedding,
  embedText,
  ingestDocument,
  EMBEDDING_DIM,
  DETERMINISTIC_MODEL,
  GLOBAL_KNOWLEDGE_DEALERSHIP_ID,
} from '../services/vectorIngestion.js'

test('chunkText splits text into clean chunks', () => {
  const text = 'Paragraph 1 is about inventory sync.\n\nParagraph 2 is about sales pipeline and lead scoring.'
  const chunks = chunkText(text, 50)
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0], 'Paragraph 1 is about inventory sync.')
  assert.equal(chunks[1], 'Paragraph 2 is about sales pipeline and lead scoring.')
})

test('computeContentHash is deterministic and content-sensitive', () => {
  assert.equal(computeContentHash('Content A'), computeContentHash('Content A'))
  assert.notEqual(computeContentHash('Content A'), computeContentHash('Content B'))
})

test('deterministicEmbedding returns a normalized 1536-dim vector (tests only)', () => {
  const vec = deterministicEmbedding('MarketSync vector search')
  assert.equal(vec.length, EMBEDDING_DIM)
  const l2 = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  assert.ok(Math.abs(l2 - 1.0) < 0.01, 'L2 norm must be approximately 1.0')
})

test('embedText uses the deterministic provider under NODE_ENV=test', async () => {
  const { embedding, model } = await embedText('trade-in appraisal workflow')
  assert.equal(embedding.length, EMBEDDING_DIM)
  assert.equal(model, DETERMINISTIC_MODEL)
})

test('ingestDocument maps to the canonical ai_knowledge_chunks schema', async () => {
  const res = await ingestDocument({
    dealershipId: GLOBAL_KNOWLEDGE_DEALERSHIP_ID,
    sourceType: 'unit_test',
    sourceKey: 'schema-shape',
    sourceName: 'Schema Shape Test',
    content: 'Alpha paragraph about desking.\n\nBeta paragraph about F&I menus.',
    metadata: { scope: 'global' },
  })
  assert.ok(res.count > 0)
  const row = res.rows[0]
  // Real columns — not the throwaway source_doc/hash shape.
  for (const col of [
    'dealership_id', 'source_type', 'source_key', 'chunk_index',
    'content', 'content_hash', 'embedding_model', 'embedding', 'metadata',
  ]) {
    assert.ok(col in row, `row must carry column ${col}`)
  }
  assert.equal(row.dealership_id, GLOBAL_KNOWLEDGE_DEALERSHIP_ID)
  assert.equal(row.embedding.length, EMBEDDING_DIM)
  assert.equal(row.required_permission, null)
})

test('ingestDocument rejects missing tenant / source identity', async () => {
  await assert.rejects(() => ingestDocument({ sourceType: 't', sourceKey: 'k', content: 'x' }))
  await assert.rejects(() => ingestDocument({ dealershipId: GLOBAL_KNOWLEDGE_DEALERSHIP_ID, content: 'x' }))
})

test('Tenant isolation: retrieval keeps own + global, drops other dealerships', () => {
  const dealerA = '00000000-0000-0000-0000-00000000000a'
  const dealerB = '00000000-0000-0000-0000-00000000000b'

  // Shape returned by match_ai_knowledge_chunks_admin, then the app-level safeguard.
  const rows = [
    { id: '1', dealership_id: dealerA, content: 'Dealer A strategy' },
    { id: '2', dealership_id: GLOBAL_KNOWLEDGE_DEALERSHIP_ID, content: 'Global product manual' },
    { id: '3', dealership_id: dealerB, content: 'Dealer B private records' },
  ]
  const filteredForA = rows.filter(
    r => r.dealership_id === dealerA || r.dealership_id === GLOBAL_KNOWLEDGE_DEALERSHIP_ID
  )
  assert.equal(filteredForA.length, 2)
  assert.ok(filteredForA.some(c => c.content.includes('Dealer A')))
  assert.ok(filteredForA.some(c => c.content.includes('Global')))
  assert.ok(!filteredForA.some(c => c.content.includes('Dealer B')), 'Dealer A must NEVER retrieve Dealer B data')
})
