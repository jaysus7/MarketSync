/**
 * Credit-application provider abstraction.
 *
 * Every rail — RouteOne, Dealertrack DealTransfer, or a manual export today —
 * implements the same interface so the desk/UI never changes when a live pipe turns
 * on. Until a dealer is a certified DSP with production creds, submit() falls back to
 * the manual path (export XML/PDF, upload in the vendor portal with the dealer's
 * account). When access is granted, add RouteOneProvider / DealertrackProvider here.
 *
 *   interface CreditProvider {
 *     name: string
 *     submit(app, ctx): Promise<{ mode, status, provider_ref?, message }>
 *     status(providerRef, ctx): Promise<{ status, decision? }>
 *   }
 */

class ManualCreditProvider {
  name = 'manual'
  async submit() {
    return {
      mode: 'manual',
      status: 'ready_to_export',
      message: 'No live lender connection is active for this dealer yet. Export the credit application (XML or PDF) and upload it in RouteOne / Dealertrack using the dealership’s own account. Once you are certified as a DSP, this button submits directly.',
    }
  }
  async status() { return { status: 'unknown' } }
}

// Placeholders so wiring a real rail later is a one-file change. They intentionally
// throw until implemented against the certified sandbox.
class NotYetImplementedProvider {
  constructor(name) { this.name = name }
  async submit() { return { mode: 'manual', status: 'ready_to_export', message: `${this.name} live submission isn’t enabled yet — use export for now.` } }
  async status() { return { status: 'unknown' } }
}

export function getCreditProvider(name, integration) {
  // A provider is only "live" when the dealer has an enabled, configured integration.
  const live = integration && integration.enabled && integration.status === 'live'
  switch ((name || '').toLowerCase()) {
    case 'routeone':   return live ? new NotYetImplementedProvider('RouteOne')   : new ManualCreditProvider()
    case 'dealertrack':return live ? new NotYetImplementedProvider('Dealertrack'): new ManualCreditProvider()
    default:           return new ManualCreditProvider()
  }
}
