/**
 * MarketSync Customer Intelligence — Conversation Ownership State Machine & SLA Engine.
 *
 * Enforces explicit ownership states:
 * AI_ACTIVE → HANDOFF_PENDING → HUMAN_ACTIVE → AI_ASSISTING_HUMAN → AI_RESUMED → CLOSED.
 * Tracks representative response SLA and executes inactivity recovery.
 */

export const CONVERSATION_OWNERSHIP_STATES = {
  AI_ACTIVE: 'AI_ACTIVE',
  HANDOFF_PENDING: 'HANDOFF_PENDING',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  AI_ASSISTING_HUMAN: 'AI_ASSISTING_HUMAN',
  AI_RESUMED: 'AI_RESUMED',
  CLOSED: 'CLOSED',
}

/**
 * Validates whether a state transition is legal.
 */
export function transitionOwnershipState(currentState = CONVERSATION_OWNERSHIP_STATES.AI_ACTIVE, targetState, context = {}) {
  const legalTransitions = {
    [CONVERSATION_OWNERSHIP_STATES.AI_ACTIVE]: [
      CONVERSATION_OWNERSHIP_STATES.HANDOFF_PENDING,
      CONVERSATION_OWNERSHIP_STATES.HUMAN_ACTIVE,
      CONVERSATION_OWNERSHIP_STATES.CLOSED,
    ],
    [CONVERSATION_OWNERSHIP_STATES.HANDOFF_PENDING]: [
      CONVERSATION_OWNERSHIP_STATES.HUMAN_ACTIVE,
      CONVERSATION_OWNERSHIP_STATES.AI_RESUMED,
      CONVERSATION_OWNERSHIP_STATES.CLOSED,
    ],
    [CONVERSATION_OWNERSHIP_STATES.HUMAN_ACTIVE]: [
      CONVERSATION_OWNERSHIP_STATES.AI_ASSISTING_HUMAN,
      CONVERSATION_OWNERSHIP_STATES.AI_RESUMED,
      CONVERSATION_OWNERSHIP_STATES.CLOSED,
    ],
    [CONVERSATION_OWNERSHIP_STATES.AI_ASSISTING_HUMAN]: [
      CONVERSATION_OWNERSHIP_STATES.HUMAN_ACTIVE,
      CONVERSATION_OWNERSHIP_STATES.AI_RESUMED,
      CONVERSATION_OWNERSHIP_STATES.CLOSED,
    ],
    [CONVERSATION_OWNERSHIP_STATES.AI_RESUMED]: [
      CONVERSATION_OWNERSHIP_STATES.HANDOFF_PENDING,
      CONVERSATION_OWNERSHIP_STATES.HUMAN_ACTIVE,
      CONVERSATION_OWNERSHIP_STATES.CLOSED,
    ],
    [CONVERSATION_OWNERSHIP_STATES.CLOSED]: [
      CONVERSATION_OWNERSHIP_STATES.AI_ACTIVE,
    ],
  }

  const allowed = legalTransitions[currentState]?.includes(targetState)
  if (!allowed) {
    return {
      success: false,
      current_state: currentState,
      error: `Illegal transition from ${currentState} to ${targetState}`,
    }
  }

  return {
    success: true,
    previous_state: currentState,
    current_state: targetState,
    transitioned_at: new Date().toISOString(),
    actor: context.actor || 'system',
  }
}

/**
 * Checks if a handoff has exceeded the representative response SLA.
 */
export function checkHandoffSlaViolation(handoffTimestamp, slaMinutes = 5) {
  if (!handoffTimestamp) return { violated: false, elapsed_minutes: 0 }
  const elapsedMs = Date.now() - new Date(handoffTimestamp).getTime()
  const elapsedMins = Math.floor(elapsedMs / 60000)
  return {
    violated: elapsedMins >= slaMinutes,
    elapsed_minutes: elapsedMins,
    sla_minutes: slaMinutes,
  }
}
