const MIN_SAMPLE = 30

export function evaluateInsight(candidate = {}) {
  const sample = Number(candidate.sample_size || 0)
  const comparisonSample = Number(candidate.comparison_sample_size || 0)
  const effect = candidate.effect_size
  const period = candidate.time_period || null

  if (sample < MIN_SAMPLE || comparisonSample < MIN_SAMPLE) {
    return {
      accepted: false,
      reason: 'insufficient_sample',
      min_sample: MIN_SAMPLE,
      sample_size: sample,
      comparison_sample_size: comparisonSample
    }
  }

  const reliability = Math.min(0.99, 0.5 + Math.log10(sample) / 10)
  const causal = candidate.causal_evidence === true
  const statement = causal && candidate.causal_supported
    ? candidate.statement
    : correlate(candidate)

  return {
    accepted: true,
    statement,
    sample_size: sample,
    comparison_group: candidate.comparison_group || 'complement',
    time_period: period,
    effect_size: effect,
    reliability_score: Math.round(reliability * 100) / 100,
    relationship: causal && candidate.causal_supported ? 'causal' : 'correlation',
    data_freshness: candidate.data_freshness || 'unknown'
  }
}

function correlate(c) {
  const metric = c.metric_label || 'the observed rate'
  const cohort = c.cohort_label || 'this cohort'
  const effect = c.effect_size != null ? `${Math.abs(Number(c.effect_size))}%` : 'a measurable difference'
  const direction = Number(c.effect_size) >= 0 ? 'higher' : 'lower'
  return `${cohort} showed a ${effect} ${direction} ${metric} versus the comparison group. This is a correlation, not proven causation.`
}

export function rejectCausationClaim(text = '') {
  return /causes|caused|proven to increase/i.test(text)
}

export const INSIGHTS_MIN_SAMPLE = MIN_SAMPLE
