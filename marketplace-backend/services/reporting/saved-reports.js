const store = new Map()

function key(dealershipId, id) {
  return `${dealershipId}:${id}`
}

export function saveReport(dealershipId, userId, definition, opts = {}) {
  if (!dealershipId) {
    const err = new Error('Tenant required')
    err.code = 'TENANT_REQUIRED'
    throw err
  }
  const id = opts.id || definition.id || `saved_${Date.now()}`
  const row = {
    id,
    dealership_id: dealershipId,
    owner_id: userId,
    name: opts.name || definition.name,
    favourite: !!opts.favourite,
    pinned: !!opts.pinned,
    shared_with: opts.shared_with || [],
    schedule: opts.schedule || null,
    alert_thresholds: opts.alert_thresholds || null,
    definition: { ...definition, id },
    created_at: new Date().toISOString()
  }
  store.set(key(dealershipId, id), row)
  return row
}

export function getSavedReport(dealershipId, id) {
  const row = store.get(key(dealershipId, id))
  if (!row || row.dealership_id !== dealershipId) return null
  return row
}

export function listSavedReports(dealershipId) {
  return [...store.values()].filter((r) => r.dealership_id === dealershipId)
}

export function scheduleReport(dealershipId, id, cadence, permissions) {
  const row = getSavedReport(dealershipId, id)
  if (!row) return null
  const allowed = ['daily', 'weekly', 'monthly', 'quarter_end']
  if (!allowed.includes(cadence)) {
    const err = new Error('Invalid cadence')
    err.code = 'INVALID_CADENCE'
    throw err
  }
  row.schedule = { cadence, permissions: [...(permissions || row.definition.permissions || [])] }
  store.set(key(dealershipId, id), row)
  return row
}

export function exportAllowed(row, actor) {
  if (!row || row.dealership_id !== actor.dealershipId) return false
  if (actor.role && ['SALESPERSON'].includes(actor.role) && row.definition.permissions?.includes('accounting.view')) {
    return false
  }
  return true
}

export function _resetSavedReportsForTests() {
  store.clear()
}
