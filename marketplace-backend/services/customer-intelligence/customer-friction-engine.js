/**
 * MarketSync Customer Intelligence — Customer Friction & Question Budget Engine.
 *
 * Tracks conversational friction, enforces per-session question budgets,
 * prevents interrogation patterns, and halts qualification on rising customer frustration.
 */

export const FRICTION_THRESHOLDS = {
  LOW: 20,
  MEDIUM: 40,
  HIGH: 60,
  CRITICAL: 80,
}

export function createInitialFrictionState() {
  return {
    friction_score: 0, // 0..100
    consecutive_qualification_questions: 0,
    max_consecutive_questions: 2,
    customer_refusal_count: 0,
    failed_tool_attempts: 0,
    friction_events: [],
  }
}

/**
 * Updates friction state based on new message, assistant turns, and tool results.
 */
export function updateFrictionState(currentFrictionState = {}, userText = '', assistantResponse = '', toolResult = null) {
  const f = { ...createInitialFrictionState(), ...currentFrictionState }
  const lowerUser = String(userText || '').toLowerCase()

  // 1. Customer saying "already told you" / repeated question
  if (/\b(already told you|asked (?:you )?(?:multiple|several|twice|3|three) times|answer my question|repeat myself)\b/i.test(lowerUser)) {
    f.friction_score = Math.min(100, f.friction_score + 35)
    f.friction_events.push({ type: 'customer_repetition_complaint', at: new Date().toISOString() })
  }

  // 2. Refusal to provide information
  if (/\b(not giving you my (?:number|phone|email)|just answer|no phone|no email|why do you need that)\b/i.test(lowerUser)) {
    f.customer_refusal_count += 1
    f.friction_score = Math.min(100, f.friction_score + 25)
    f.friction_events.push({ type: 'contact_refusal', at: new Date().toISOString() })
  }

  // 3. Excessive consecutive qualification questions check
  const isQuestion = /\?/.test(assistantResponse)
  const isValueGiven = /\b(\$|in stock|available|miles|features|specifications|options|schedule)\b/i.test(assistantResponse)

  if (isQuestion && !isValueGiven) {
    f.consecutive_qualification_questions += 1
  } else if (isValueGiven) {
    // Reset consecutive question count when value/answer is provided!
    f.consecutive_qualification_questions = 0
  }

  if (f.consecutive_qualification_questions > f.max_consecutive_questions) {
    f.friction_score = Math.min(100, f.friction_score + 15)
  }

  // 4. Failed tool calls
  if (toolResult && toolResult.ok === false) {
    f.failed_tool_attempts += 1
    if (f.failed_tool_attempts >= 2) {
      f.friction_score = Math.min(100, f.friction_score + 20)
    }
  }

  return f
}

/**
 * Checks whether the AI is currently permitted to ask a qualification question.
 */
export function canAskQualificationQuestion(frictionState = {}) {
  const f = frictionState || {}
  // If friction is high or question budget is exhausted, do NOT ask another question!
  if ((f.friction_score || 0) >= FRICTION_THRESHOLDS.MEDIUM) {
    return {
      allowed: false,
      reason: 'Friction threshold reached — prioritize direct answer without questions',
    }
  }
  if ((f.consecutive_qualification_questions || 0) >= (f.max_consecutive_questions || 2)) {
    return {
      allowed: false,
      reason: 'Question budget reached — must provide value, answer, or inventory match before asking again',
    }
  }
  return { allowed: true }
}
