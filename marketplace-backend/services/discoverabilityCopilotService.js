const clean = value => String(value || '').replace(/\s+/g, ' ').trim()

function evidenceItem(source, summary, value = {}) {
  return {
    source,
    summary: clean(summary),
    status: value.status || 'observed',
    measured_at: value.measured_at || value.measuredAt || value.created_at || null,
    affected_urls: value.affected_urls || (value.affectedUrl ? [value.affectedUrl] : []),
  }
}

function recommendationEvidence(rec) {
  return evidenceItem(rec.source || 'discoverability_recommendation', rec.title || rec.summary, rec)
}

function topOpenRecommendations(audit = {}) {
  return (audit.recommendations || [])
    .filter(item => item?.status === 'open' || !item?.status)
    .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
}

export function answerDiscoverabilityQuestion({ question = '', audit = {}, search = {} } = {}) {
  const q = clean(question).toLowerCase()
  const recommendations = topOpenRecommendations(audit)
  const validation = audit.pillars?.validation || {}
  const automotive = audit.pillars?.automotive || {}
  const searchStatus = search.search?.status || search.run?.status || 'not_connected'
  const searchMeasured = ['measured', 'completed', 'success', 'succeeded'].includes(String(searchStatus).toLowerCase())
  const searchOpportunities = Array.isArray(search.opportunities) ? search.opportunities : []
  const result = {
    intent: 'priorities',
    answer: '',
    evidence: [],
    proposals: [],
    limitations: [],
    suggested_questions: [
      'What should I fix first?',
      'Which pages have the biggest opportunity?',
      'Why is Google not indexing these vehicles?',
      'What can MarketSync safely fix automatically?',
      'What page or content should be created next?',
    ],
  }

  if (/visibility.*fall|drop.*visibility|why.*(traffic|rank)/.test(q)) {
    result.intent = 'visibility_change'
    if (!searchMeasured) {
      result.answer = 'MarketSync cannot prove that visibility fell because no measured Search Console history is available. The current website findings can explain risk, but they are not ranking data.'
      result.limitations.push('Connect and sync a verified Search Console property before attributing a visibility change.')
    } else {
      result.answer = 'The latest Search Console evidence is available, but a cause requires at least two comparable date ranges. Start with the current failed website checks and the highest-impression affected pages.'
      result.evidence.push(evidenceItem('search_console', `Latest measured search run: ${search.run?.fetched_at || search.run?.created_at || 'available'}`, search.run || {}))
      result.limitations.push('One search snapshot cannot establish a decline or its cause.')
    }
  } else if (/index.*vehicle|vehicle.*index|google.*vehicle/.test(q)) {
    result.intent = 'vehicle_indexing'
    const findings = automotive.inventoryComparison?.findings || []
    if (findings.length) {
      result.answer = `${findings.length} observed inventory-to-public finding${findings.length === 1 ? '' : 's'} may affect vehicle indexing. Review the cited public URLs and canonical inventory records first.`
      result.evidence.push(...findings.slice(0, 5).map(item => evidenceItem('automotive_public_inventory', item.type || item.description, item)))
    } else {
      result.answer = 'There is no measured public vehicle crawl proving why Google is not indexing these vehicles. Run a public crawl and sync Search Console before diagnosing index coverage.'
      result.limitations.push('Draft content and canonical inventory alone do not prove Google indexation.')
    }
  } else if (/safe.*fix|automatically|auto.?fix/.test(q)) {
    result.intent = 'safe_fixes'
    const safe = recommendations.filter(item => item.execution_class === 'auto_fixable' && (Number(item.confidence) || 0) >= 80)
    result.answer = safe.length
      ? `${safe.length} open recommendation${safe.length === 1 ? '' : 's'} meet the current auto-fix class and confidence threshold. Apply them individually or as an explicit safe batch; every change remains auditable and reversible.`
      : 'No open recommendation currently meets the safe auto-fix class and confidence threshold. MarketSync will not promote review-required or manual work into automatic changes.'
    result.evidence.push(...safe.slice(0, 5).map(recommendationEvidence))
    result.proposals = safe.slice(0, 5).map(item => ({ id: item.id, title: item.title, action: 'apply', execution_class: item.execution_class }))
  } else if (/content.*next|page.*next|what.*create|biggest opportunity|which pages?/.test(q)) {
    result.intent = /content.*next|page.*next|what.*create/.test(q) ? 'content_next' : 'opportunities'
    const opportunity = searchOpportunities[0]
    const recommended = recommendations.find(item => /content|page|keyword|search/i.test(`${item.category || ''} ${item.title || ''} ${item.summary || ''}`)) || recommendations[0]
    if (opportunity) {
      result.answer = `The highest persisted search opportunity is “${clean(opportunity.query || opportunity.opportunity_type || 'search opportunity')}”. Use its measured evidence to update an existing page or draft a new page for review.`
      result.evidence.push(evidenceItem('search_console_opportunity', opportunity.query || opportunity.opportunity_type, opportunity))
    } else if (recommended) {
      result.answer = `The best evidence-backed next step is “${clean(recommended.title)}”. This is a recommendation, not measured search demand, so review its evidence before creating content.`
      result.evidence.push(recommendationEvidence(recommended))
      result.limitations.push('No persisted Search Console opportunity is available; this priority comes from deterministic website findings.')
    } else {
      result.answer = 'There is not enough evidence to recommend a new page or topic. Sync Search Console or run a public crawl first.'
    }
  } else {
    result.intent = 'priorities'
    const top = recommendations[0]
    if (top) {
      result.answer = `Fix “${clean(top.title)}” first. It is the highest-confidence open recommendation in the current deterministic audit.`
      result.evidence.push(recommendationEvidence(top))
      result.proposals.push({ id: top.id, title: top.title, action: top.execution_class === 'auto_fixable' ? 'apply' : 'review', execution_class: top.execution_class })
    } else if (Number(validation.criticalCount || 0) + Number(validation.highCount || 0) > 0) {
      result.answer = `Start with the ${Number(validation.criticalCount || 0)} critical and ${Number(validation.highCount || 0)} high-severity validation findings. No persisted recommendation is available yet.`
      result.evidence.push(evidenceItem('discoverability_validation', 'Current deterministic validation findings', validation))
    } else {
      result.answer = 'No open evidence-backed priority is available. Run a fresh validation scan or connect a measured provider; MarketSync will not invent a recommendation.'
    }
  }

  return result
}
