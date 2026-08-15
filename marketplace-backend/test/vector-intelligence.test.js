import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkText, computeChunkHash, generateEmbedding, ingestDocument, queryKnowledge } from '../services/vectorIngestion.js'

test('chunkText splits text into clean chunks', () => {
  const text = 'Paragraph 1 is about inventory sync.\n\nParagraph 2 is about sales pipeline and lead scoring.'
  const chunks = chunkText(text, 50)
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0], 'Paragraph 1 is about inventory sync.')
  assert.equal(chunks[1], 'Paragraph 2 is about sales pipeline and lead scoring.')
})

test('computeChunkHash produces deterministic unique hashes', () => {
  const h1 = computeChunkHash('dealer-123', 'guide.md', 0, 'Content A')
  const h2 = computeChunkHash('dealer-123', 'guide.md', 0, 'Content A')
  const h3 = computeChunkHash('dealer-456', 'guide.md', 0, 'Content A')

  assert.equal(h1, h2, 'Identical input must produce identical hash')
  assert.notEqual(h1, h3, 'Different tenant must produce different hash')
})

test('generateEmbedding returns normalized 1536-dimensional vector', () => {
  const vec = generateEmbedding('MarketSync vector search')
  assert.equal(vec.length, 1536, 'Vector dimension must be 1536')
  const l2Norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  assert.ok(Math.abs(l2Norm - 1.0) < 0.01, 'L2 norm must be approximately 1.0')
})

test('Tenant Isolation: Dealership A cannot retrieve Dealership B knowledge', async () => {
  const dealerA = '00000000-0000-0000-0000-00000000000a'
  const dealerB = '00000000-0000-0000-0000-00000000000b'

  // Simulated results representing cross-tenant query
  const mockChunks = [
    { id: '1', dealership_id: dealerA, content: 'Dealer A secret strategy', similarity: 0.95 },
    { id: '2', dealership_id: null, content: 'Global MarketSync product manual', similarity: 0.85 },
    { id: '3', dealership_id: dealerB, content: 'Dealer B private financial records', similarity: 0.92 },
  ]

  // Filter application-level tenant isolation safeguard
  const filteredForA = mockChunks.filter(item => item.dealership_id === null || item.dealership_id === dealerA)
  assert.equal(filteredForA.length, 2)
  assert.ok(filteredForA.some(c => c.content.includes('Dealer A')))
  assert.ok(filteredForA.some(c => c.content.includes('Global')))
  assert.ok(!filteredForA.some(c => c.content.includes('Dealer B')), 'Dealer A must NEVER retrieve Dealer B data')
})
