/**
 * Plaid connect + sync routes (accounting → Bank account). Config-gated on the
 * Plaid app keys; every route no-ops cleanly until they're set.
 *
 *   GET  /plaid/config        -> { configured }
 *   POST /plaid/link-token    -> { link_token }   (opens Plaid Link on the client)
 *   POST /plaid/exchange      -> stores the linked item
 *   GET  /plaid/status        -> { connected, institution_name, accounts, last_sync }
 *   POST /plaid/sync          -> pull latest transactions now
 *   POST /plaid/disconnect    -> forget the item
 *   GET  /plaid/transactions  -> recent transactions (for the Bank account view)
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import {
  plaidConfigured, createLinkToken, exchangePublicToken, plaidStatus, plaidDisconnect, syncTransactions,
} from '../providers/plaid.js'

export function registerPlaid(app) {
  app.get('/plaid/config', requireAuth, (req, res) => res.json({ ok: true, configured: plaidConfigured() }))

  app.post('/plaid/link-token', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!plaidConfigured()) return res.status(501).json({ error: 'Bank linking isn’t configured on this server yet.' })
    try { res.json({ ok: true, link_token: await createLinkToken(req.dealershipId) }) }
    catch (e) { res.status(400).json({ error: e.message || 'Could not start bank linking.' }) }
  })

  app.post('/plaid/exchange', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const publicToken = String(req.body?.public_token || '')
    if (!publicToken) return res.status(400).json({ error: 'public_token required' })
    try {
      const info = await exchangePublicToken(req.dealershipId, publicToken)
      syncTransactions(req.dealershipId).catch(() => {})   // first pull in the background
      audit(req, 'integration.plaid_connected', { after_state: { institution_name: info?.institution_name || null } })
      res.json({ ok: true, ...info })
    } catch (e) { res.status(400).json({ error: e.message || 'Could not link the bank.' }) }
  })

  app.get('/plaid/status', requireAuth, requireMfa, requirePermission('accounting.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    res.json({ ok: true, configured: plaidConfigured(), ...(await plaidStatus(req.dealershipId)) })
  })

  app.post('/plaid/sync', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try { res.json({ ok: true, ...(await syncTransactions(req.dealershipId)) }) }
    catch (e) { res.status(400).json({ error: e.message || 'Sync failed.' }) }
  })

  app.post('/plaid/disconnect', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    await plaidDisconnect(req.dealershipId)
    audit(req, 'integration.plaid_disconnected')
    res.json({ ok: true })
  })

  app.get('/plaid/transactions', requireAuth, requireMfa, requirePermission('accounting.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data } = await supabaseAdmin.from('bank_transactions').select('*')
      .eq('dealership_id', req.dealershipId).order('txn_date', { ascending: false }).limit(100)
    res.json({ ok: true, transactions: data || [] })
  })
}
