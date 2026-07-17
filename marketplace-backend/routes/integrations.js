/**
 * Per-dealer credentials for the gated F&I / history networks (Carfax, RouteOne,
 * Dealertrack). Secrets are encrypted at rest (crypto-pii) and NEVER returned to the
 * client — the UI only learns whether a provider is configured/enabled and its status.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { encryptJson, piiConfigured } from '../crypto-pii.js'

const PROVIDERS = ['carfax', 'routeone', 'dealertrack']
const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)

export function registerIntegrations(app) {
  // List all providers with their (non-secret) status for this dealership.
  app.get('/integrations', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data: rows } = await supabaseAdmin.from('dealer_integrations')
      .select('provider, enabled, status, lender_code_map, updated_at, credentials_enc')
      .eq('dealership_id', req.dealershipId)
    const byProvider = {}
    for (const r of (rows || [])) byProvider[r.provider] = r
    const list = PROVIDERS.map(p => {
      const r = byProvider[p]
      return {
        provider: p,
        enabled: !!r?.enabled,
        status: r?.status || 'not_connected',
        configured: !!r?.credentials_enc,             // has a stored secret (never the secret itself)
        lender_code_map: r?.lender_code_map || {},
        updated_at: r?.updated_at || null,
      }
    })
    res.json({ providers: list, pii_ready: piiConfigured() })
  })

  // Create/update a provider's config. Only overwrites the secret when new
  // credentials are supplied, so toggling `enabled` doesn't wipe stored creds.
  app.put('/integrations/:provider', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const provider = String(req.params.provider || '').toLowerCase()
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider' })
    const b = req.body || {}

    const patch = { dealership_id: req.dealershipId, provider, updated_by: req.user?.id || null, updated_at: new Date().toISOString() }
    if (b.enabled !== undefined) patch.enabled = !!b.enabled
    if (b.status !== undefined && typeof b.status === 'string') patch.status = b.status.slice(0, 30)
    if (b.lender_code_map && typeof b.lender_code_map === 'object') patch.lender_code_map = b.lender_code_map

    // Encrypt a credential blob only if one was provided and non-empty.
    if (b.credentials && typeof b.credentials === 'object' && Object.keys(b.credentials).length) {
      if (!piiConfigured()) return res.status(400).json({ error: 'Set the PII_ENCRYPTION_KEY environment variable before storing credentials.' })
      patch.credentials_enc = encryptJson(b.credentials)
      if (patch.status === undefined) patch.status = 'configured'
      patch.last_status_at = new Date().toISOString()
    }

    const { error } = await supabaseAdmin.from('dealer_integrations')
      .upsert(patch, { onConflict: 'dealership_id,provider' })
    if (error) { console.error('[integrations] save failed:', error.message); return res.status(500).json({ error: 'Save failed' }) }
    res.json({ ok: true })
  })

  // Disconnect: remove the stored config (and secret) for a provider.
  app.delete('/integrations/:provider', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const provider = String(req.params.provider || '').toLowerCase()
    await supabaseAdmin.from('dealer_integrations').delete()
      .eq('dealership_id', req.dealershipId).eq('provider', provider)
    res.json({ ok: true })
  })
}
