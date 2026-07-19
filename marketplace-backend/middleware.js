import { supabase, supabaseAdmin } from './shared.js'

// Cache the demo dealership id (created by POST /demo/seed). Only positive results
// are cached, so it resolves as soon as the workspace is seeded.
let _demoDealerId = null
export function bustDemoDealerCache(id) { _demoDealerId = id || null }
async function resolveDemoDealership() {
  if (_demoDealerId) return _demoDealerId
  const { data } = await supabaseAdmin.from('dealerships').select('id').eq('name', 'MarketSync Demo').maybeSingle()
  if (data?.id) _demoDealerId = data.id
  return data?.id || null
}

// ── AUTH MIDDLEWARE ──
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'AUTH_EXPIRED — please sign in again' })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*, dealerships(*)')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return res.status(401).json({ error: 'Profile not found' })

    if (!req.path.startsWith('/billing')) {
      const isPersonal = profile.dealerships?.is_personal === true
      const useProfileBilling = !profile.dealership_id || isPersonal
      const status = useProfileBilling
        ? profile.billing_status
        : profile.dealerships?.billing_status
      const trialEndsAt = useProfileBilling
        ? profile.trial_ends_at
        : profile.dealerships?.trial_ends_at

      let blocked = null
      if (status === 'TRIALING') {
        // Self-managed trial — no card required upfront. Block once it expires.
        if (!trialEndsAt || new Date(trialEndsAt) < new Date()) blocked = 'TRIAL_EXPIRED'
      } else if (status === 'INACTIVE' || status === 'PAST_DUE') {
        blocked = 'SUBSCRIPTION_REQUIRED'
      }

      // Group coverage: if this dealership belongs to a group that bills centrally
      // (billing_mode='group') and the group's billing is active, the dealer is
      // covered even without its own subscription. A group can also leave billing
      // per-dealer, in which case each store pays on its own (default).
      if (blocked && profile.dealership_id && profile.dealerships?.group_id) {
        const { data: grp } = await supabaseAdmin
          .from('dealer_groups')
          .select('billing_mode, billing_status')
          .eq('id', profile.dealerships.group_id)
          .maybeSingle()
        if (grp?.billing_mode === 'group' && (grp.billing_status === 'ACTIVE' || grp.billing_status === 'TRIALING')) {
          blocked = null
        }
      }

      if (blocked) return res.status(402).json({ error: blocked })
    }

    req.user = user
    req.profile = profile
    req.dealershipId = profile.dealership_id

    // Owner-only DEMO workspace override: the MarketSync owner can flip the whole
    // dashboard into a sandboxed demo dealership (seeded fake cars/customers) without
    // touching their real MarketSync data. Gated to the JMS Automotive owner + an
    // explicit header, and scoped by dealership_id like everything else.
    if (req.headers['x-act-demo'] === '1' && profile.dealerships?.name === 'JMS Automotive') {
      const demoId = await resolveDemoDealership()
      if (demoId) { req.dealershipId = demoId; req.isDemo = true }
    }
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Internal server authorization error' })
  }
}
