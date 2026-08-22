const num = (value, min = 0, max = 10000000) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(max, Math.max(min, Math.round(parsed * 100) / 100))
}
const oneOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback

export function normalizeCommissionPlanConfig(raw = {}) {
  const front = raw.front && typeof raw.front === 'object' ? raw.front : {}
  const back = raw.back && typeof raw.back === 'object' ? raw.back : {}
  const split = raw.split_covers && typeof raw.split_covers === 'object' ? raw.split_covers : {}
  const bonuses = Array.isArray(raw.bonuses) ? raw.bonuses : []
  return {
    front: {
      method: oneOf(front.method, ['greater', 'percent', 'flat'], 'greater'),
      percent: num(front.percent, 0, 100),
      flat: num(front.flat),
      min: num(front.min),
      pack: num(front.pack),
      pack_type: oneOf(front.pack_type, ['flat', 'percent'], 'flat'),
    },
    back: {
      method: oneOf(back.method, ['percent', 'flat'], 'percent'),
      percent: num(back.percent, 0, 100),
      flat: num(back.flat),
    },
    back_to: oneOf(raw.back_to, ['salesperson', 'fni_manager', 'split'], 'salesperson'),
    back_fni_pct: num(raw.back_fni_pct, 0, 100),
    split_covers: {
      front: split.front !== false,
      back: split.back !== false,
      spiff: split.spiff !== false,
    },
    spiff_per_deal: num(raw.spiff_per_deal),
    bonuses: bonuses.slice(0, 30).map(rule => ({
      basis: oneOf(rule?.basis, ['units', 'gross'], 'units'),
      threshold: num(rule?.threshold),
      amount: num(rule?.amount),
    })).filter(rule => rule.threshold > 0 && rule.amount > 0),
  }
}

export function planHasPayRule(config) {
  const c = normalizeCommissionPlanConfig(config)
  return c.front.percent > 0 || c.front.flat > 0 || c.front.min > 0 ||
    c.back.percent > 0 || c.back.flat > 0 || c.spiff_per_deal > 0 || c.bonuses.length > 0
}

export function normalizeCommissionImport(result = {}, sourceName = 'commission document') {
  const questions = Array.isArray(result.questions)
    ? result.questions.map(q => String(q || '').trim()).filter(Boolean).slice(0, 3)
    : []
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.map(w => String(w || '').trim()).filter(Boolean).slice(0, 12)
    : []
  const plans = (Array.isArray(result.plans) ? result.plans : []).slice(0, 10).map((plan, index) => {
    const config = normalizeCommissionPlanConfig(plan?.config || plan || {})
    return {
      name: String(plan?.name || `${sourceName.replace(/\.[^.]+$/, '')} ${index + 1}`).trim().slice(0, 80),
      config,
      evidence: Array.isArray(plan?.evidence)
        ? plan.evidence.map(v => String(v || '').trim()).filter(Boolean).slice(0, 12)
        : [],
      warnings: Array.isArray(plan?.warnings)
        ? plan.warnings.map(v => String(v || '').trim()).filter(Boolean).slice(0, 12)
        : [],
    }
  }).filter(plan => plan.name)

  if (!plans.length && !questions.length) {
    questions.push('What is the main commission rule this document should create (for example, 25% of front gross or $300 per delivered vehicle)?')
  } else if (plans.length && !plans.some(plan => planHasPayRule(plan.config)) && !questions.length) {
    questions.push('What commission amount or percentage should this plan pay? The document did not contain a usable pay rule.')
  }
  return { plans, questions, warnings }
}

export function commissionImportSummary(plans, warnings = []) {
  const names = (plans || []).map(plan => plan.name).filter(Boolean)
  const lead = names.length === 1
    ? `I created one inactive commission-plan draft: ${names[0]}.`
    : `I created ${names.length} inactive commission-plan drafts: ${names.join(', ')}.`
  const warningText = warnings.length ? ` Review notes: ${warnings.join(' ')}` : ''
  return `${lead} Nothing is active, assigned, or used for payroll yet. Review the structure in Accounting Settings, then activate and assign it when it is correct.${warningText}`
}
