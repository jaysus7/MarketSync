/**
 * MarketSync Customer Intelligence — Answer Verification & Response Quality Engine.
 *
 * Verifies that AI generated responses adhere strictly to verified business facts,
 * rejects hallucinated discounts, interest rates, or false inventory claims,
 * and dynamically adapts response length and tone to customer sentiment.
 */

export function verifyAndSanitizeAiResponse(responseText = '', context = {}) {
  let text = String(responseText || '').trim()
  const issues = []

  // 1. Prohibit fabricated zero percent / guaranteed credit approvals
  if (/\b(guarantee (?:your )?(?:credit )?approval|you are approved at 0%|i promise (?:you )?0%|approved at 0%|promise you 0%)/i.test(text)) {
    issues.push('Fabricated guaranteed credit approval')
    text = text.replace(/\b(guarantee (?:your )?(?:credit )?approval|you are approved at 0%|i promise (?:you )?0%|approved at 0%[a-z ]*|promise you 0%[a-z ]*)/gi,
      'we work with multiple lending partners to find the best available rates based on approved credit')
  }

  // 2. Prohibit unapproved manager discounts or firm trade purchase guarantees
  if (/\b(i can give you a \$\d+ discount|i will knock off \$\d+|i guarantee \$\d+ for your trade|\$\d+ guaranteed for your trade)/i.test(text)) {
    issues.push('Fabricated price discount or firm trade guarantee')
    text = text.replace(/\b(i can give you a \$\d+ discount|i will knock off \$\d+|i guarantee \$\d+ for your trade|\$\d+ guaranteed for your trade)/gi,
      'our sales manager can review custom incentives and provide a formal appraisal during your visit')
  }

  // 3. Prohibit claims that sold vehicles are still on lot
  if (context.targetVehicleSold && /\b(is still available|is waiting for you on the lot)\b/i.test(text)) {
    issues.push('Claimed sold vehicle is available')
    text = "That specific vehicle recently sold, but I found similar in-stock alternatives with comparable features and pricing. Would you like to see those?"
  }

  // 4. Frustration Adaptivity: If customer is frustrated, trim conversational filler
  if (context.frustrationScore >= 40) {
    // Keep to max 2 direct sentences
    const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean)
    if (sentences.length > 2) {
      text = sentences.slice(0, 2).join(' ')
    }
  }

  // 5. Length Guard: Prevent massive walls of text (max 4 sentences for conversational pacing)
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean)
  if (sentences.length > 5 && !context.isDetailedComparison) {
    text = sentences.slice(0, 4).join(' ')
  }

  return {
    verified: issues.length === 0,
    sanitized_text: text,
    issues_detected: issues,
  }
}
