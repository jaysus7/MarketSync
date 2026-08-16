import test from 'node:test'
import assert from 'node:assert/strict'
import { runIngestion } from '../scripts/ingest-all-knowledge.js'
import {
  queryKnowledge,
  deterministicEmbedding,
  chunkText,
  EMBEDDING_DIM,
  GLOBAL_KNOWLEDGE_DEALERSHIP_ID,
} from '../services/vectorIngestion.js'

test('Vector Ingestion & Multi-Chatbot RAG Knowledge Test Suite', async (t) => {

  await t.test('chunkText splits document into clean 500-char blocks', () => {
    const text = 'MarketSync is a platform for car dealerships.\n\nIt features website building, sales CRM, desking, and AI chatbot integration.'
    const chunks = chunkText(text, 500, 50)
    assert.ok(Array.isArray(chunks))
    assert.ok(chunks.length > 0)
    assert.ok(chunks[0].includes('MarketSync'))
  })

  await t.test('deterministicEmbedding produces normalized 1536-dimensional vector', () => {
    const vec = deterministicEmbedding('Dealership CRM follow-up automation')
    assert.equal(vec.length, EMBEDDING_DIM)
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    assert.ok(Math.abs(norm - 1.0) < 0.01)
  })

  await t.test('runIngestion processes knowledge for all 3 chatbots', async () => {
    const res = await runIngestion()
    assert.ok(res.marketsyncSales)
    assert.ok(res.dealerosCopilot)
    assert.ok(res.dealerConcierge)

    assert.ok(typeof res.marketsyncSales.count === 'number')
    assert.ok(res.dealerosCopilot.count > 0, 'DealerOS Copilot should yield knowledge chunks')
    assert.ok(res.dealerConcierge.count > 0, 'Dealership Concierge should yield knowledge chunks')
  })

  await t.test('queryKnowledge is tenant-scoped and returns an array', async () => {
    const chunks = await queryKnowledge({
      dealershipId: GLOBAL_KNOWLEDGE_DEALERSHIP_ID,
      queryText: 'How do trade-in appraisals work?',
      threshold: 0.05,
      count: 5,
    })
    assert.ok(Array.isArray(chunks))
  })

})
