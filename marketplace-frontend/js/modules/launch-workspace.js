/**
 * The Dealer Launch Hub — one setup surface (Phase 7 PR 7.6).
 *
 * ONE hub, not many wizards. Everything a dealership has to configure is here, grouped the way
 * a person thinks about it, with what is left visible at a glance.
 *
 * Three things this screen deliberately does NOT do:
 *
 *   • **It does not block anything.** There is no "finish setup to continue", no modal on the
 *     way in, no disabled navigation. A dealership can work while it is still being set up;
 *     the product says what is missing at the point it matters and gets out of the way.
 *
 *   • **It does not show one progress number.** "Operational" and "fully configured" are
 *     different answers, and a single bar conflates a store that cannot legally operate with
 *     one that has not picked a logo.
 *
 *   • **It does not invent state.** Every item comes from `/launch`, which re-derives it from
 *     real configuration. A requirement whose check failed renders as "could not check", never
 *     as done and never as outstanding.
 */

const LAUNCH_TYPE = {
  REQUIRED_TO_LAUNCH: { label: 'Required', tone: 'text-rose-600 dark:text-rose-400', rank: 0 },
  REQUIRED_FOR_FEATURE: { label: 'Needed for a feature', tone: 'text-amber-600 dark:text-amber-400', rank: 1 },
  RECOMMENDED: { label: 'Recommended', tone: 'text-slate-500', rank: 2 },
  OPTIONAL: { label: 'Optional', tone: 'text-slate-400', rank: 3 },
}

const launchTone = (i) =>
  i.status === 'done' ? 'text-emerald-600 dark:text-emerald-400'
  : i.status === 'unknown' ? 'text-slate-400'
  : (LAUNCH_TYPE[i.type]?.tone || 'text-slate-500')

const launchStatus = (i) =>
  i.status === 'done' ? 'Done'
  // A check that failed is not a thing the dealership has to go and do.
  : i.status === 'unknown' ? 'Could not check'
  : (LAUNCH_TYPE[i.type]?.label || 'Outstanding')

const LAUNCH_ACTIONS = {
  legal_identity: ["engineTab('launch','work')", 'Edit dealership'],
  timezone: ["engineTab('launch','work')", 'Set timezone'],
  tax_registration: ["engineTab('launch','work')", 'Add tax registration'],
  primary_location: ["engineTab('launch','insights')", 'Manage locations'],
  branding: ["switchPage('profile')", 'Open branding'],
  owner_account: ["switchPage('owner-users')", 'Manage access'],
  employees: ["switchPage('people-overview');setTimeout(()=>engineTab('people-overview','work'),0)", 'Open Team'],
  chart_of_accounts: ["switchPage('accounting-overview');setTimeout(()=>engineTab('accounting-overview','work'),0)", 'Open Accounting'],
  inventory_source: ["switchPage('inventory-overview');setTimeout(()=>engineTab('inventory-overview','work'),0)", 'Add inventory'],
  website_published: ["switchPage('website')", 'Open website'],
  service_hours: ["switchPage('service-settings')", 'Set service hours'],
  required_training: ["switchPage('academy')", 'Open Academy'],
  policies_published: ["switchPage('people-overview');setTimeout(()=>engineTab('people-overview','insights'),0)", 'Open compliance'],
  lead_routing: ["switchPage('sales');setTimeout(()=>engineTab('sales','settings'),0)", 'Set lead routing'],
}

function launchRow(i) {
  const blocked = i.status === 'outstanding' && i.blocks
  const action = LAUNCH_ACTIONS[i.key]
  return `<div class="flex items-start gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(i.label)}</div>
      <div class="text-[12px] text-slate-500 dark:text-slate-400">${esc(i.why)}</div>
      ${blocked ? `<div class="text-[12px] font-semibold mt-0.5 text-amber-600 dark:text-amber-400">${esc(i.blocks)} does not work until this is done</div>` : ''}
      ${i.actionable_by_you === false && i.status === 'outstanding'
        ? `<div class="text-[12px] text-slate-400 mt-0.5">Somebody with ${esc(i.permission)} has to do this</div>` : ''}
      ${i.status === 'outstanding' && i.actionable_by_you !== false && action
        ? `<button onclick="${action[0]}" class="mt-2 text-[12px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">${esc(action[1])}</button>` : ''}
    </div>
    <div class="shrink-0 text-right text-[12px] font-bold ${launchTone(i)}">${esc(launchStatus(i))}</div>
  </div>`
}

/**
 * The contextual prompt a department shows when its own setup is incomplete.
 *
 * This is the other half of "not a wall": rather than stopping somebody on the way in, the
 * department they opened tells them what it needs. Returns '' when there is nothing to say, so
 * a configured dealership sees no setup furniture at all.
 */
function launchFeatureNotice(missing, featureLabel) {
  if (!missing || !missing.length) return ''
  return `<div class="rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 mb-3">
    <div class="font-bold text-[13px] text-amber-700 dark:text-amber-300">${esc(featureLabel)} is not set up yet</div>
    <div class="text-[12px] text-slate-600 dark:text-slate-300 mt-1">${missing.map(m => esc(m.label)).join(' · ')}</div>
    <button onclick="switchPage('launch')" class="mt-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[12px] font-bold">Finish setup</button>
  </div>`
}
window.launchFeatureNotice = launchFeatureNotice;

async function launchSaveConfig(form) {
  const body = {}
  for (const el of form.querySelectorAll('[data-field]')) {
    const v = el.value.trim()
    if (v) body[el.dataset.field] = v
  }
  if (!Object.keys(body).length) { showToast('Nothing to save', 'error'); return }
  try {
    await apiSendJson('/launch/dealership', 'PATCH', body)
    showToast('Saved ✓', 'success')
    refreshSetupIndicator();
    ENGINE_DATA['launch'] = undefined
    engineTab('launch', ENGINE_STATE['launch'] || 'overview', true)
  } catch (e) { showToast(e.message, 'error') }
}
window.launchSaveConfig = launchSaveConfig;

function launchSubmitConfig(btn) {
  const form = btn.closest('[data-launch-form]')
  if (form) launchSaveConfig(form)
}
window.launchSubmitConfig = launchSubmitConfig;

ENGINES['launch'] = {
  rootId: 'launch-root', title: 'Set up your dealership',
  subtitle: 'Everything MarketSync needs to work properly, in one place',
  icon: 'shield', accent: 'indigo',
  tabLabels: { overview: 'What is left', work: 'Dealership', insights: 'Locations' },
  get tabOrder() { return ['overview', 'work', 'insights'] },

  quickActions: [
    { label: 'What is left', icon: 'shield', onclick: "engineTab('launch','overview')" },
    { label: 'Dealership', icon: 'user', onclick: "engineTab('launch','work')" },
  ],
  nextActions: (d) => (d?.launch?.items || [])
    .filter(i => i.status === 'outstanding' && i.type === 'REQUIRED_TO_LAUNCH')
    .slice(0, 5)
    .map(i => ({ label: i.label, icon: 'flame', tone: 'text-rose-600 dark:text-rose-400', onclick: "engineTab('launch','work')" })),

  fetch: async () => {
    const [launch, locations] = await Promise.all([
      apiGetJson('/launch').catch(e => ({ error: e.message })),
      apiGetJson('/launch/locations').catch(() => ({ locations: [] })),
    ])
    return { launch, locations: locations.locations || [], error: launch?.error || null }
  },

  tabs: {
    /** What is left — grouped by area, worst first, never as one number. */
    overview(body, d) {
      if (d.error) {
        body.innerHTML = engCard('Setup', engEmpty(`Setup could not be loaded — ${esc(d.error)}`))
        return
      }
      const l = d.launch || {}
      const items = l.items || []
      const areas = (l.by_area || []).map(a => ({
        ...a,
        items: [...a.items].sort((x, y) =>
          (LAUNCH_TYPE[x.type]?.rank ?? 9) - (LAUNCH_TYPE[y.type]?.rank ?? 9)),
      }))

      // Two answers, deliberately. One bar would say the wrong thing whichever way it leaned.
      const state = (ok, label, note) => `<div class="rounded-xl border ${ok ? 'border-emerald-300/60 dark:border-emerald-800/50' : 'border-slate-200 dark:border-slate-800'} p-3">
        <div class="text-[11px] uppercase tracking-wide text-slate-400">${esc(label)}</div>
        <div class="text-lg font-black ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">${ok ? 'Yes' : 'Not yet'}</div>
        <div class="text-[12px] text-slate-500 mt-0.5">${esc(note)}</div>
      </div>`

      body.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${state(l.operational, 'Can you operate', l.operational
            ? 'Everything required to run the dealership is in place.'
            : `${l.outstanding_to_launch || 0} required item${l.outstanding_to_launch === 1 ? '' : 's'} outstanding`)}
          ${state(l.fully_configured, 'Fully configured', l.fully_configured
            ? 'Nothing left, including the optional pieces.'
            : `${l.outstanding_total || 0} item${l.outstanding_total === 1 ? '' : 's'} in total`)}
        </div>
        ${(l.blocked_features || []).length ? engCard('Not working yet', `
          <p class="text-[12px] text-slate-500 mb-1">These parts of MarketSync are waiting on configuration. Everything else works.</p>
          ${l.blocked_features.map(f => `<div class="py-1.5 text-[13px] font-bold text-amber-600 dark:text-amber-400">${esc(f)}</div>`).join('')}
        `) : ''}
        ${(l.unknown || []).length ? engCard('Could not be checked', engEmpty(
          `${l.unknown.length} item${l.unknown.length === 1 ? '' : 's'} could not be read just now, so this page is not a complete answer.`)) : ''}
        ${areas.map(a => engCard(a.area, a.items.map(launchRow).join(''))).join('')}
        ${items.length ? '' : engEmpty('Nothing to set up.')}
        <p class="text-[12px] text-slate-500 px-1">Nothing here blocks you. You can use MarketSync while you finish setting it up — each department will tell you if it needs something.</p>
      `
    },

    /** The canonical configuration, entered once. */
    work(body, d) {
      const dd = (d.launch?.items || []).reduce((m, i) => (m[i.key] = i, m), {})
      const field = (key, label, placeholder = '') => `<label class="block mb-2">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300 mb-1">${esc(label)}</span>
        <input data-field="${esc(key)}" placeholder="${esc(placeholder)}"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px]">
      </label>`

      body.innerHTML = `
        ${engCard('Who the dealership is', `
          <p class="text-[12px] text-slate-500 mb-2">This appears on every document a customer signs. ${dd.legal_identity?.status === 'done' ? 'Recorded.' : 'Not recorded yet.'}</p>
          <div data-launch-form>
            ${field('legal_name', 'Legal name', 'Example Motors Ltd')}
            ${field('street_address', 'Street address', '1 Main Street')}
            ${field('city', 'City')}
            ${field('province', 'Province or state')}
            ${field('postal_code', 'Postal or ZIP code')}
            ${field('phone', 'Phone')}
            ${field('hst_number', 'Tax registration number', 'Needed before tax can be charged on a deal')}
            <button onclick="launchSubmitConfig(this)" class="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold">Save</button>
          </div>
        `)}
        ${engCard('Timezone', `
          <p class="text-[12px] text-slate-500 mb-2">Every due date, close period and promised time is computed in this. Until it is set they are all UTC, which is wrong by hours and never says so. ${dd.timezone?.status === 'done' ? 'Set.' : '<strong>Not set.</strong>'}</p>
          <div data-launch-form>
            ${field('timezone', 'Timezone', 'America/Toronto')}
            <button onclick="launchSubmitConfig(this)" class="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold">Save</button>
          </div>
        `)}
        <p class="text-[12px] text-slate-500 px-1">Only fields you fill in are changed — leaving one blank leaves it as it was.</p>
      `
    },

    /** Locations. One primary, and the first one comes from the address above. */
    insights(body, d) {
      const locs = d.locations || []
      body.innerHTML = `
        ${engCard('Locations', locs.length
          ? locs.map(l => `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(l.name)}</div>
                <div class="text-[12px] text-slate-400 truncate">${esc([l.street_address, l.city, l.province].filter(Boolean).join(', ') || 'No address recorded')}</div>
                ${(l.departments || []).length ? `<div class="text-[12px] text-slate-500">${esc(l.departments.join(' · '))}</div>` : ''}
              </div>
              <div class="shrink-0 text-[12px] font-bold ${l.is_primary ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${l.is_primary ? 'Primary' : 'Secondary'}</div>
            </div>`).join('')
          : engEmpty('No location recorded yet. Adding one takes the address from the Dealership tab, so you do not type it twice.'))}
        <div class="px-1">
          <button onclick="launchAddLocation()" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold">Add a location</button>
        </div>
      `
    },
  },
}

async function launchAddLocation() {
  const name = prompt('What is this location called?')
  if (!name) return
  try {
    await apiSendJson('/launch/locations', 'POST', { name })
    showToast('Location added ✓', 'success')
    refreshSetupIndicator();
    ENGINE_DATA['launch'] = undefined
    engineTab('launch', 'insights', true)
  } catch (e) { showToast(e.message, 'error') }
}
window.launchAddLocation = launchAddLocation;

function loadLaunchHub() { renderEngine('launch') }
window.loadLaunchHub = loadLaunchHub;
