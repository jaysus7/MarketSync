import express from 'express'
import { stripe, supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { requireAuth } from '../middleware.js'

export function registerRoutes(app) {
  // ── 1. STRIPE WEBHOOK ──
  app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const sub = await stripe.subscriptions.retrieve(session.subscription)
        const meta = session.metadata || {}
        // AI Boost add-on checkout — activate immediately (covers both trialing and active)
        if (meta.type === 'ai_boost' && meta.dealership_id) {
          const updates = { ai_boost_active: true }
          if (session.customer) updates.stripe_customer_id = session.customer
          await supabaseAdmin.from('dealerships').update(updates).eq('id', meta.dealership_id)
          break;
        }
        const billing = {
          stripe_customer_id: session.customer,
          subscription_id: session.subscription,
          stripe_price_id: sub.items.data[0].price.id,
          billing_status: 'ACTIVE',
          trial_ends_at: null
        }
        if (meta.type === 'solo_rep' && meta.user_id) {
          await supabaseAdmin.from('profiles').update(billing).eq('id', meta.user_id)
        } else {
          await supabaseAdmin.from('dealerships').update(billing).eq('id', meta.dealership_id || session.client_reference_id)
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const subId = sub.id
        const aiBoostPriceId = process.env.STRIPE_AI_BOOST_PRICE_ID
        // Check if this subscription contains the AI Boost price
        const hasAiBoost = aiBoostPriceId && sub.items?.data?.some(item => item.price.id === aiBoostPriceId)
        if (hasAiBoost) {
          // Keep active during trial; deactivate on cancel, past_due, or unpaid
          const isActive = sub.status === 'active' || sub.status === 'trialing'
          await supabaseAdmin.from('dealerships').update({ ai_boost_active: isActive }).eq('stripe_customer_id', sub.customer)
          break;
        }
        // Standard subscription cancel/update
        if (event.type === 'customer.subscription.deleted') {
          const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('subscription_id', subId).maybeSingle()
          if (prof) {
            await supabaseAdmin.from('profiles').update({ billing_status: 'INACTIVE' }).eq('id', prof.id)
          } else {
            await supabaseAdmin.from('dealerships').update({ billing_status: 'INACTIVE' }).eq('subscription_id', subId)
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (invoice.subscription && invoice.customer) {
          // Check if this is an AI Boost invoice — if so, deactivate ai_boost_active
          const aiBoostPriceId = process.env.STRIPE_AI_BOOST_PRICE_ID
          if (aiBoostPriceId) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription)
            const hasAiBoost = sub.items?.data?.some(item => item.price.id === aiBoostPriceId)
            if (hasAiBoost) {
              await supabaseAdmin.from('dealerships').update({ ai_boost_active: false }).eq('stripe_customer_id', invoice.customer)
              break;
            }
          }
          const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', invoice.customer).maybeSingle()
          if (prof) {
            await supabaseAdmin.from('profiles').update({ billing_status: 'PAST_DUE' }).eq('id', prof.id)
          } else {
            await supabaseAdmin.from('dealerships').update({ billing_status: 'PAST_DUE' }).eq('stripe_customer_id', invoice.customer)
          }
        }
        break;
      }
      case 'checkout.session.completed_ai_boost': {
        // Handled below via subscribe-ai-boost metadata check on checkout.session.completed
        break;
      }
    }
    res.json({ received: true })
  })

  // ── 8. BILLING ──
  app.post('/billing/checkout', requireAuth, async (req, res) => {
    const isPersonal = req.profile.dealerships?.is_personal === true
    const isSolo = !req.dealershipId || isPersonal

    if (req.profile.role === 'SALES_REP' && req.dealershipId && !isPersonal) {
      return res.status(403).json({ error: 'Sales reps under a dealership do not manage billing.' })
    }

    const existingCustomerId = isSolo
      ? req.profile.stripe_customer_id
      : req.profile.dealerships?.stripe_customer_id

    // Complimentary / comped account: no Stripe customer was ever created, and the
    // account isn't mid-trial either. Nothing to manage — tell the frontend so it can
    // show a friendly message instead of bouncing them into a brand-new checkout.
    const billingStatus = isSolo
      ? req.profile.billing_status
      : req.profile.dealerships?.billing_status
    if (!existingCustomerId && billingStatus !== 'TRIALING') {
      return res.status(200).json({ complimentary: true })
    }

    const priceId = req.body?.priceId || (isSolo
      ? process.env.STRIPE_SOLO_PRICE_ID
      : process.env.STRIPE_DEALER_PRICE_ID)
    if (!priceId) return res.status(500).json({ error: 'Missing Stripe price ID env var' })

    const metadata = isSolo
      ? { type: 'solo_rep', user_id: req.user.id }
      : { type: 'dealership', dealership_id: req.dealershipId }

    const clientRefId = isSolo ? req.user.id : req.dealershipId

    try {
      if (existingCustomerId) {
        try {
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: existingCustomerId,
            return_url: `${FRONTEND_URL}/dashboard.html`
          })
          return res.json({ url: portalSession.url })
        } catch (portalErr) {
          console.warn('Portal initialization bypassed:', portalErr.message)
        }
      }
      // No Stripe-side trial — we self-manage the 7-day no-card trial via billing_status='TRIALING'.
      // By the time the user hits checkout, their trial has either ended or they chose to upgrade early;
      // either way Stripe charges immediately.
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        client_reference_id: clientRefId,
        metadata,
        subscription_data: { metadata },
        success_url: `${FRONTEND_URL}/dashboard.html`,
        cancel_url: `${FRONTEND_URL}/dashboard.html`
      })
      res.json({ url: session.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/billing/portal', requireAuth, async (req, res) => {
    // Don't HTTP-redirect here — fetch() redirects drop the Authorization header,
    // which causes a 401 on the second hop. Just run checkout's handler directly
    // in-process instead, so auth context carries through correctly.
    req.url = '/billing/checkout'
    app._router.handle(req, res)
  })

  // POST /billing/subscribe-ai-boost — create Stripe Checkout for the $199/month AI Boost add-on
  app.post('/billing/subscribe-ai-boost', requireAuth, async (req, res) => {
    if (req.profile?.role !== 'DEALER_ADMIN') {
      return res.status(403).json({ error: 'DEALER_ADMIN role required' })
    }
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const priceId = process.env.STRIPE_AI_BOOST_PRICE_ID
    if (!priceId) return res.status(500).json({ error: 'AI Boost price not configured (STRIPE_AI_BOOST_PRICE_ID missing)' })

    const existingCustomerId = req.profile.dealerships?.stripe_customer_id

    try {
      const sessionParams = {
        payment_method_types: ['card'],
        payment_method_collection: 'if_required',
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        metadata: { type: 'ai_boost', dealership_id: req.dealershipId },
        subscription_data: { trial_period_days: 3, metadata: { type: 'ai_boost', dealership_id: req.dealershipId } },
        success_url: `${FRONTEND_URL}/dashboard.html?ai_boost_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}/dashboard.html`
      }
      if (existingCustomerId) sessionParams.customer = existingCustomerId

      const session = await stripe.checkout.sessions.create(sessionParams)
      res.json({ url: session.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /billing/ai-boost-verify?session_id=xxx
  // Called by the frontend on return from Stripe. Verifies the session is paid/trialing
  // and activates AI Boost immediately without waiting for the webhook.
  app.get('/billing/ai-boost-verify', requireAuth, async (req, res) => {
    const { session_id } = req.query
    if (!session_id) return res.status(400).json({ error: 'session_id required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      const meta = session.metadata || {}
      if (meta.type !== 'ai_boost' || meta.dealership_id !== req.dealershipId) {
        return res.status(403).json({ error: 'Session does not belong to this dealership' })
      }
      // Accept completed sessions (covers both trialing and immediately active)
      if (session.status !== 'complete') {
        return res.status(400).json({ error: 'Session not complete', status: session.status })
      }
      const updates = { ai_boost_active: true }
      if (session.customer) updates.stripe_customer_id = session.customer
      await supabaseAdmin.from('dealerships').update(updates).eq('id', req.dealershipId)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/billing/trial-status', requireAuth, async (req, res) => {
    const isPersonal = req.profile.dealerships?.is_personal === true
    const useProfileBilling = !req.profile.dealership_id || isPersonal
    const status = useProfileBilling
      ? req.profile.billing_status
      : req.profile.dealerships?.billing_status
    const trialEndsAt = useProfileBilling
      ? req.profile.trial_ends_at
      : req.profile.dealerships?.trial_ends_at

    let daysRemaining = null
    if (status === 'TRIALING' && trialEndsAt) {
      const ms = new Date(trialEndsAt).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
    }

    res.json({
      status: status || null,
      trial_ends_at: trialEndsAt || null,
      days_remaining: daysRemaining,
      is_active: status === 'ACTIVE',
      is_trialing: status === 'TRIALING' && daysRemaining !== null && daysRemaining > 0
    })
  })
}
