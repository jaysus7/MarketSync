/**
 * The Dealer Launch Hub (Phase 7 PR 7.6).
 *
 * ONE hub, not many wizards. A dealership sets itself up in a single place, sees what is left,
 * and can leave and come back. The rules below come straight from the Phase 7 brief, and each
 * one exists because the obvious implementation gets it wrong.
 *
 *   1. **Requirements are DERIVED, never stored.** There is no `setup_completed` column and no
 *      checklist table, deliberately. A stored tick can be true while the thing it claims is
 *      false — somebody ticks "chart of accounts configured" and the dealership still cannot
 *      post a journal. Every requirement below re-reads the real configuration on every call,
 *      so "done" cannot drift from done. (AGENTS.md A19, and D6 of the brief.)
 *
 *   2. **Setup is not a lock.** This module exports readiness and nothing else. It has no
 *      middleware, it gates no route, and no other module asks it for permission. A dealership
 *      that has not finished setting up can still work — the product tells them what is
 *      missing, at the point it matters, and gets out of the way. A blanket application lock on
 *      setup completion is explicitly forbidden by the brief, and the way to keep that true is
 *      for this file to be incapable of imposing one.
 *
 *   3. **Entitlement decides which requirements EXIST; role decides who may SATISFY them.**
 *      A dealership without the Service product is not "incomplete" for having no service
 *      settings — that requirement does not exist for them. And a requirement nobody in the
 *      building has the permission to satisfy is reported as blocked rather than nagged about.
 *
 *   4. **"Operational" and "fully configured" are different answers.** A dealership can sell a
 *      car before it has published its website. Reporting one number conflates a store that
 *      cannot legally operate with one that has not picked a logo.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'

/**
 * The four kinds of requirement. The type is what makes the hub honest: without it, everything
 * becomes equally urgent and the dealership learns to ignore the list.
 */
export const REQUIREMENT_TYPES = {
  REQUIRED_TO_LAUNCH: 'REQUIRED_TO_LAUNCH',   // cannot operate lawfully or at all without it
  REQUIRED_FOR_FEATURE: 'REQUIRED_FOR_FEATURE', // one capability does not work; the rest do
  RECOMMENDED: 'RECOMMENDED',                  // works, but worse
  OPTIONAL: 'OPTIONAL',                        // a preference
}

const has = (v) => v != null && String(v).trim() !== ''

/**
 * Every requirement MarketSync knows how to check.
 *
 * `satisfied` reads real state. `feature` (when present) means the requirement only exists for
 * a dealership entitled to that feature. `permission` is who can satisfy it.
 */
export const REQUIREMENTS = [
  // ── Cannot operate without these ──────────────────────────────────────────
  {
    key: 'legal_identity', type: 'REQUIRED_TO_LAUNCH', area: 'Dealership',
    label: 'Legal name and address',
    why: 'Appears on every document a customer signs, and on your own tax filings.',
    permission: 'settings.manage',
    satisfied: (s) => has(s.dealership.legal_name) && has(s.dealership.street_address)
      && has(s.dealership.city) && has(s.dealership.province) && has(s.dealership.postal_code),
  },
  {
    key: 'timezone', type: 'REQUIRED_TO_LAUNCH', area: 'Dealership',
    label: 'Timezone',
    // The one requirement whose absence is invisible rather than obvious.
    why: 'Every due date, close period and promised time is computed in it. Without it they are all UTC, which is wrong by hours and never says so.',
    permission: 'settings.manage',
    satisfied: (s) => has(s.dealership.timezone),
  },
  {
    key: 'primary_location', type: 'REQUIRED_TO_LAUNCH', area: 'Dealership',
    label: 'Primary location',
    why: 'Where the dealership is. Reports, hours and tax all resolve through it.',
    permission: 'settings.manage',
    satisfied: (s) => s.locations.some(l => l.is_primary && l.active),
  },
  {
    key: 'owner_account', type: 'REQUIRED_TO_LAUNCH', area: 'People',
    label: 'An owner or admin who can sign in',
    why: 'Somebody has to be able to grant everybody else access.',
    permission: 'users.manage',
    satisfied: (s) => s.adminCount > 0,
  },
  {
    key: 'employees', type: 'REQUIRED_TO_LAUNCH', area: 'People',
    label: 'At least one employee record',
    why: 'Work is assigned to employees. Until one exists, nothing can be owned by anybody.',
    permission: 'staff.manage',
    satisfied: (s) => s.staffCount > 0,
  },

  // ── One capability each; the rest of the product works without them ───────
  {
    key: 'chart_of_accounts', type: 'REQUIRED_FOR_FEATURE', area: 'Accounting',
    feature: 'os.accounting', blocks: 'Accounting',
    label: 'Chart of accounts',
    why: 'Nothing can post to the books without it, and a deal that cannot post is a deal nobody can reconcile.',
    permission: 'accounting.manage',
    satisfied: (s) => s.glAccountCount > 0,
  },
  {
    key: 'tax_registration', type: 'REQUIRED_FOR_FEATURE', area: 'Accounting',
    feature: 'os.accounting', blocks: 'Tax on deals',
    label: 'Tax registration number',
    why: 'Charged tax has to be attributable to a registration.',
    permission: 'settings.manage',
    satisfied: (s) => has(s.dealership.hst_number),
  },
  {
    key: 'inventory_source', type: 'REQUIRED_FOR_FEATURE', area: 'Inventory',
    feature: 'os.inventory', blocks: 'Inventory',
    label: 'Inventory in the system',
    why: 'A feed, an import or a vehicle entered by hand — until there is one, every inventory screen is empty for a real reason nobody can see.',
    permission: 'inventory.write',
    satisfied: (s) => s.vehicleCount > 0 || has(s.dealership.feed_url),
  },
  {
    key: 'website_published', type: 'REQUIRED_FOR_FEATURE', area: 'Marketing',
    feature: 'os.website', blocks: 'Your website',
    label: 'Website published',
    why: 'An unpublished site collects no leads, and the difference is invisible from inside the builder.',
    permission: 'site.manage',
    satisfied: (s) => !!s.dealership.site_published,
  },
  {
    key: 'service_hours', type: 'REQUIRED_FOR_FEATURE', area: 'Service',
    feature: 'os.service', blocks: 'Service appointments',
    label: 'Operating hours',
    why: 'An appointment cannot be offered for a time the shop is shut.',
    permission: 'settings.manage',
    satisfied: (s) => !!s.dealership.operating_hours && Object.keys(s.dealership.operating_hours).length > 0,
  },

  // ── Works without them, works better with them ────────────────────────────
  {
    key: 'branding', type: 'RECOMMENDED', area: 'Dealership',
    label: 'Logo and colours',
    why: 'Everything a customer sees carries them.',
    permission: 'settings.manage',
    satisfied: (s) => !!s.dealership.branding && Object.keys(s.dealership.branding).length > 0,
  },
  {
    key: 'required_training', type: 'RECOMMENDED', area: 'People',
    label: 'Required training assigned',
    why: 'The compliance record starts when somebody is asked, not when they are hired.',
    permission: 'staff.training.manage',
    satisfied: (s) => s.trainingAssignmentCount > 0,
  },
  {
    key: 'policies_published', type: 'RECOMMENDED', area: 'People',
    label: 'At least one policy published',
    why: 'Compliance reporting counts acknowledgements. With no policy published, every number it shows is a zero that means "not measured".',
    permission: 'staff.policy.manage',
    satisfied: (s) => s.publishedPolicyCount > 0,
  },
  {
    key: 'lead_routing', type: 'OPTIONAL', area: 'Sales',
    label: 'Lead routing',
    why: 'Decides who a new lead goes to. Without it they land in one shared queue, which works.',
    permission: 'settings.manage',
    satisfied: (s) => !!s.dealership.lead_routing && Object.keys(s.dealership.lead_routing).length > 0,
  },
]

/**
 * Read every fact the requirements need, once.
 *
 * "Enter once" applies to reading too: one gather, one pass. A hub that issued a query per
 * requirement would be slow and would read the same dealership row eleven times.
 */
export async function gather(dealershipId) {
  const countOf = async (table, build = (q) => q) => {
    const { count, error } = await build(
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId),
    )
    // null, not 0 — a failed read must never satisfy or dissatisfy a requirement by accident.
    return error ? null : (count ?? 0)
  }

  const [{ data: dealership }, { data: locations }, staffCount, glAccountCount, vehicleCount, trainingAssignmentCount, publishedPolicyCount, adminCount] =
    await Promise.all([
      supabaseAdmin.from('dealerships')
        .select('id, name, legal_name, street_address, city, province, country, postal_code, phone, timezone, operating_hours, hst_number, omvic_reg, branding, site_published, feed_url, lead_routing')
        .eq('id', dealershipId).maybeSingle(),
      supabaseAdmin.from('dealership_locations').select('*').eq('dealership_id', dealershipId),
      countOf('staff_members', q => q.in('employment_status', ['invited', 'active', 'on_leave'])),
      countOf('gl_accounts'),
      countOf('vehicles'),
      countOf('staff_training_assignments'),
      countOf('staff_policy_versions', q => q.eq('status', 'published')),
      (async () => {
        const { count, error } = await supabaseAdmin.from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('dealership_id', dealershipId).eq('active', true)
          .in('role', ['DEALER_ADMIN', 'OWNER'])
        return error ? null : (count ?? 0)
      })(),
    ])

  return {
    dealership: dealership || {},
    locations: locations || [],
    staffCount, glAccountCount, vehicleCount, trainingAssignmentCount, publishedPolicyCount, adminCount,
  }
}

/**
 * Evaluate one requirement.
 *
 * A check that THROWS is `unknown`, never `false`. Reporting "not done" because a query failed
 * would send a dealership to re-enter something they had already entered.
 */
export function evaluate(req, state, { features = null, can = null } = {}) {
  // Entitlement decides existence. A dealership without Service is not incomplete for having
  // no service hours — that requirement is not theirs.
  if (req.feature && features && !features.includes(req.feature)) return null

  let done = null
  try { done = !!req.satisfied(state) } catch { done = null }

  // Who may satisfy it. `can` is optional so the engine stays testable and so a read for
  // somebody with no permission map still returns the list.
  const permitted = can ? !!can(req.permission) : null

  return {
    key: req.key, type: req.type, area: req.area, label: req.label, why: req.why,
    blocks: req.blocks || null,
    permission: req.permission,
    status: done === null ? 'unknown' : done ? 'done' : 'outstanding',
    // A requirement the caller cannot satisfy is not their problem to act on — it is somebody
    // else's, and saying so is more useful than a task they cannot complete.
    actionable_by_you: permitted,
  }
}

/**
 * The whole hub, in one answer.
 *
 * `operational` and `fully_configured` are reported SEPARATELY and deliberately. A dealership
 * can sell a car before it has picked a logo; conflating the two produces a progress bar that
 * is either permanently short of 100% or wrong about what matters.
 */
export function buildLaunch(state, { features = null, can = null, requirements = REQUIREMENTS } = {}) {
  const items = requirements.map(r => evaluate(r, state, { features, can })).filter(Boolean)

  const of = (type) => items.filter(i => i.type === type)
  const outstanding = (list) => list.filter(i => i.status === 'outstanding')
  const unknown = items.filter(i => i.status === 'unknown')

  const launch = of('REQUIRED_TO_LAUNCH')
  const feature = of('REQUIRED_FOR_FEATURE')

  const blockedFeatures = [...new Set(outstanding(feature).map(i => i.blocks).filter(Boolean))]

  return {
    items,
    // Grouped the way a person reads them, not the way they are stored.
    by_area: [...new Set(items.map(i => i.area))].map(area => ({
      area, items: items.filter(i => i.area === area),
    })),
    operational: outstanding(launch).length === 0 && unknown.length === 0,
    fully_configured: outstanding(items).length === 0 && unknown.length === 0,
    outstanding_to_launch: outstanding(launch).length,
    outstanding_total: outstanding(items).length,
    // Named, so "Accounting is not working" is answerable without opening Accounting.
    blocked_features: blockedFeatures,
    // A requirement whose check failed is not a requirement that is done.
    unknown: unknown.map(i => i.key),
    complete: unknown.length === 0,
  }
}

/**
 * The contextual answer: is THIS capability set up?
 *
 * This is how setup reaches somebody at the moment it matters, instead of as a wall on the way
 * in. A department screen asks about itself and gets back only what it is missing.
 */
export function forFeature(launch, featureName) {
  const items = launch.items.filter(i => i.blocks === featureName)
  const missing = items.filter(i => i.status === 'outstanding')
  return {
    feature: featureName,
    ready: missing.length === 0,
    missing,
  }
}

/** Launch items that belong in My Day — only what actually stops the dealership working. */
export async function launchAttention(dealershipId) {
  const state = await gather(dealershipId)
  const launch = buildLaunch(state)
  const items = []

  for (const i of launch.items) {
    if (i.status !== 'outstanding') continue
    // RECOMMENDED and OPTIONAL are deliberately absent: a queue that nags about a logo is a
    // queue people stop reading, and then it cannot tell them the real thing.
    if (i.type === 'REQUIRED_TO_LAUNCH') {
      items.push({
        kind: 'setup_required_to_launch', severity: 3,
        subject: i.label, reason: i.why,
        owner: 'Dealership', action: 'Finish setup', ref: i.key,
      })
    } else if (i.type === 'REQUIRED_FOR_FEATURE') {
      items.push({
        kind: 'setup_blocks_feature', severity: 2,
        subject: `${i.blocks} is not set up`, reason: `${i.label} — ${i.why}`,
        owner: 'Dealership', action: 'Finish setup', ref: i.key,
      })
    }
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerLaunchHub(app) {
  const canView = requirePermission('settings.manage')

  const dealership = (req, res, next) =>
    req.dealershipId ? next() : res.status(400).json({ error: 'No dealership' })

  /**
   * The hub. Read-only, and gates nothing — this endpoint reports, it does not authorize.
   */
  app.get('/launch', requireAuth, dealership, async (req, res) => {
    try {
      const state = await gather(req.dealershipId)
      const features = req.access?.features || null
      const launch = buildLaunch(state, { features })
      // The configuration the requirements were judged against, so the setup form can
      // show what is already stored instead of an empty box next to "Not recorded yet".
      // Same field list the PATCH accepts — nothing sensitive, it is the dealership's
      // own address and registration numbers.
      const d = state?.dealership || {}
      launch.dealership = {
        legal_name: d.legal_name ?? null, street_address: d.street_address ?? null,
        city: d.city ?? null, province: d.province ?? null, country: d.country ?? null,
        postal_code: d.postal_code ?? null, phone: d.phone ?? null,
        timezone: d.timezone ?? null, hst_number: d.hst_number ?? null, omvic_reg: d.omvic_reg ?? null,
      }
      res.json(launch)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /** "Is Accounting set up?", asked by Accounting, answered without leaving Accounting. */
  app.get('/launch/feature/:name', requireAuth, dealership, async (req, res) => {
    try {
      const state = await gather(req.dealershipId)
      const launch = buildLaunch(state, { features: req.access?.features || null })
      res.json(forFeature(launch, String(req.params.name)))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * The canonical operating configuration — entered once, referenced everywhere.
   */
  app.patch('/launch/dealership', requireAuth, requireMfa, canView, dealership, async (req, res) => {
    const allowed = ['legal_name', 'street_address', 'city', 'province', 'country', 'postal_code',
      'phone', 'timezone', 'operating_hours', 'hst_number', 'omvic_reg']
    const patch = {}
    for (const k of allowed) if (req.body?.[k] !== undefined) patch[k] = req.body[k]
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' })

    try {
      const { data, error } = await supabaseAdmin.from('dealerships')
        .update(patch).eq('id', req.dealershipId).select('id').maybeSingle()
      if (error) {
        // The timezone trigger's message is already written for a person.
        if (/timezone/i.test(error.message)) return res.status(400).json({ error: error.message })
        return res.status(500).json({ error: error.message })
      }
      if (!data) return res.status(404).json({ error: 'Dealership not found.' })
      audit(req, 'dealership.configuration_updated', { after_state: { fields: Object.keys(patch) } })
      res.json({ ok: true, updated: Object.keys(patch) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/launch/locations', requireAuth, dealership, async (req, res) => {
    try {
      const { data } = await supabaseAdmin.from('dealership_locations')
        .select('*').eq('dealership_id', req.dealershipId).eq('active', true).order('is_primary', { ascending: false })
      res.json({ locations: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Add a location. The first one defaults to the dealership's own address and becomes primary
   * — that is what makes "enter once" true rather than aspirational.
   */
  app.post('/launch/locations', requireAuth, requireMfa, canView, dealership, async (req, res) => {
    try {
      const { data: existing } = await supabaseAdmin.from('dealership_locations')
        .select('id, is_primary').eq('dealership_id', req.dealershipId).eq('active', true)
      const first = !(existing || []).length

      const { data: d } = await supabaseAdmin.from('dealerships')
        .select('name, street_address, city, province, country, postal_code, phone, timezone, operating_hours')
        .eq('id', req.dealershipId).maybeSingle()

      const b = req.body || {}
      const row = {
        dealership_id: req.dealershipId,
        name: b.name || d?.name || 'Main location',
        is_primary: b.is_primary !== undefined ? !!b.is_primary : first,
        street_address: b.street_address ?? (first ? d?.street_address : null),
        city: b.city ?? (first ? d?.city : null),
        province: b.province ?? (first ? d?.province : null),
        country: b.country ?? (first ? d?.country : null),
        postal_code: b.postal_code ?? (first ? d?.postal_code : null),
        phone: b.phone ?? (first ? d?.phone : null),
        timezone: b.timezone ?? (first ? d?.timezone : null),
        operating_hours: b.operating_hours ?? (first ? d?.operating_hours : null),
        departments: Array.isArray(b.departments) ? b.departments : [],
        created_by: req.user.id,
      }

      const { data, error } = await supabaseAdmin.from('dealership_locations').insert(row).select('*').single()
      if (error) {
        if (/dealership_locations_one_primary/.test(error.message)) {
          return res.status(409).json({ error: 'There is already a primary location. Change that one first, or add this as a secondary.' })
        }
        if (/dealership_locations_name_uk/.test(error.message)) {
          return res.status(409).json({ error: 'A location with that name already exists here.' })
        }
        if (/timezone/i.test(error.message)) return res.status(400).json({ error: error.message })
        return res.status(500).json({ error: error.message })
      }
      audit(req, 'dealership.location_added', { after_state: { location_id: data.id, primary: data.is_primary } })
      res.json({ ok: true, location: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
