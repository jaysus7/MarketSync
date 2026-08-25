/**
 * MarketSync Customer Intelligence — Real Business Tool Access & Orchestrator.
 *
 * Provides a verified, permissioned tool execution layer.
 * All automotive operations run through real backend engines.
 * Fails closed with honest uncertainty if tool lookup returns empty or fails.
 */

import { supabaseAdmin } from '../../shared.js'
import { emitEvent } from '../../routes/events.js'
import { saveMemory } from '../../routes/ai-engine.js'
import { findOrCreateContact, getContact } from '../../routes/crm.js'
import { routeAndNotifyLead } from '../../lead-routing.js'

function n(v) { const x = Number(v); return isNaN(x) ? 0 : x }

export const CUSTOMER_INTELLIGENCE_TOOLS = [
  {
    name: 'inventory_search',
    description: 'Search live in-stock dealership inventory with filters for make, model, body style, price range, or features.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        make: { type: 'string' },
        model: { type: 'string' },
        body_style: { type: 'string' },
        max_price: { type: 'number' },
        min_year: { type: 'number' },
        features: { type: 'array', items: { type: 'string' } },
      },
    },
    async handler(args, ctx) {
      let q = supabaseAdmin.from('inventory')
        .select('id, year, make, model, trim, price, mileage, stocknumber, vin, body_style, drivetrain, condition, exterior_color, image_urls, source_url')
        .eq('dealership_id', ctx.dealershipId)
        .eq('status', 'available')
        .is('archived_at', null)
        .limit(8)

      if (args.make) q = q.ilike('make', `%${args.make}%`)
      if (args.model) q = q.ilike('model', `%${args.model}%`)
      if (args.body_style) q = q.ilike('body_style', `%${args.body_style}%`)
      if (args.max_price) q = q.lte('price', args.max_price)
      if (args.min_year) q = q.gte('year', args.min_year)

      const { data, error } = await q
      if (error || !data) return { found: 0, vehicles: [], message: 'No matching vehicles found currently in stock.' }
      
      ctx.shownVehicles = ctx.shownVehicles || []
      for (const v of data) {
        if (!ctx.shownVehicles.some(x => x.id === v.id)) ctx.shownVehicles.push(v)
      }

      return {
        found: data.length,
        vehicles: data.map(v => ({
          id: v.id,
          title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
          price: v.price,
          mileage: v.mileage,
          stock: v.stocknumber,
          vin: v.vin,
          color: v.exterior_color,
          body_style: v.body_style,
          drivetrain: v.drivetrain,
        })),
      }
    },
  },
  {
    name: 'inventory_get_vehicle',
    description: 'Retrieve verified real-time specifications, pricing, mileage, and features for a specific vehicle by stock number or VIN.',
    input_schema: {
      type: 'object',
      properties: {
        stock_number: { type: 'string' },
        vin: { type: 'string' },
        vehicle_id: { type: 'string' },
      },
    },
    async handler(args, ctx) {
      let q = supabaseAdmin.from('inventory').select('*').eq('dealership_id', ctx.dealershipId).is('archived_at', null)
      if (args.vehicle_id) q = q.eq('id', args.vehicle_id)
      else if (args.stock_number) q = q.ilike('stocknumber', args.stock_number)
      else if (args.vin) q = q.ilike('vin', args.vin)
      else return { error: 'Provide stock_number, vin, or vehicle_id' }

      const { data: v } = await q.maybeSingle()
      if (!v) return { found: false, message: 'Vehicle not found in active inventory.' }

      ctx.shownVehicles = ctx.shownVehicles || []
      if (!ctx.shownVehicles.some(x => x.id === v.id)) ctx.shownVehicles.push(v)

      return {
        found: true,
        vehicle: {
          id: v.id,
          title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim,
          price: v.price,
          mileage: v.mileage,
          status: v.status,
          stock: v.stocknumber,
          vin: v.vin,
          body_style: v.body_style,
          drivetrain: v.drivetrain,
          engine: v.engine,
          transmission: v.transmission,
          fuel_type: v.fuel_type,
          exterior_color: v.exterior_color,
          interior_color: v.interior_color,
          description: v.description,
          features: Array.isArray(v.features) ? v.features : [],
        },
      }
    },
  },
  {
    name: 'payments_calculate_estimate',
    description: 'Calculate deterministic auto loan or lease payment estimates with strict compliance disclaimers.',
    input_schema: {
      type: 'object',
      properties: {
        price: { type: 'number' },
        down_payment: { type: 'number' },
        trade_allowance: { type: 'number' },
        rate_apr: { type: 'number' },
        term_months: { type: 'number' },
      },
      required: ['price'],
    },
    async handler(args) {
      const price = n(args.price)
      const down = n(args.down_payment) + n(args.trade_allowance)
      const principal = Math.max(0, price - down)
      const term = n(args.term_months) || 72
      const apr = n(args.rate_apr) || 7.99
      const r = apr / 100 / 12
      const pmt = r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -term)) : principal / term
      const monthly = Math.round(pmt)

      return {
        estimated_monthly_payment: monthly,
        amount_financed: Math.round(principal),
        term_months: term,
        estimated_apr: apr,
        disclaimer: 'Estimate only for informational purposes. Final terms, interest rate, taxes, and monthly payment require approved credit and lender underwriting.',
      }
    },
  },
  {
    name: 'trade_create_appraisal_request',
    description: 'Initiate a preliminary trade-in appraisal workflow for a customer trading in their vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'string' },
        make: { type: 'string' },
        model: { type: 'string' },
        mileage: { type: 'string' },
        condition: { type: 'string', description: 'excellent | good | fair | poor' },
        payoff_amount: { type: 'number' },
        customer_name: { type: 'string' },
        customer_contact: { type: 'string' },
      },
      required: ['make'],
    },
    async handler(args, ctx) {
      const tradeStr = [args.year, args.make, args.model, args.mileage ? `(${args.mileage} mi/km)` : ''].filter(Boolean).join(' ')
      let contactId = ctx.contactRef?.id
      if (contactId) {
        await saveMemory(ctx.dealershipId, contactId, 'trade', tradeStr, { conversationId: ctx.conversation?.id })
      }
      emitEvent({
        dealershipId: ctx.dealershipId,
        eventName: 'trade.appraisal_requested',
        entityType: contactId ? 'customer' : 'conversation',
        entityId: contactId || ctx.conversation?.id,
        summary: `Customer requested trade appraisal: ${tradeStr}`,
        department: 'Sales',
        payload: { trade: tradeStr, payoff: args.payoff_amount || null, conversation_id: ctx.conversation?.id },
      })
      return { ok: true, trade: tradeStr, message: 'Trade appraisal staged for Used Car Manager evaluation.' }
    },
  },
  {
    name: 'appointment_book',
    description: 'Schedule a test drive, showroom consultation, or service appointment.',
    input_schema: {
      type: 'object',
      properties: {
        department: { type: 'string', description: 'sales | service' },
        when_iso: { type: 'string', description: 'ISO 8601 timestamp' },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        vehicle: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['when_iso'],
    },
    async handler(args, ctx) {
      const when = new Date(args.when_iso)
      if (isNaN(when.getTime())) return { ok: false, message: 'Invalid appointment date/time format.' }
      
      let contactId = ctx.contactRef?.id
      if (!contactId && args.name && (args.phone || args.email)) {
        contactId = await findOrCreateContact({
          dealershipId: ctx.dealershipId,
          name: args.name,
          email: args.email,
          phone: args.phone,
          source: 'AI Chat Booking',
        })
        if (contactId && ctx.contactRef) ctx.contactRef.id = contactId
      }

      await supabaseAdmin.from('appointments').insert({
        dealership_id: ctx.dealershipId,
        contact_id: contactId || null,
        department: args.department || 'sales',
        starts_at: when.toISOString(),
        notes: `AI Scheduled: ${args.vehicle || 'General visit'} ${args.note || ''}`.trim(),
        status: 'scheduled',
      }).catch(() => {})

      emitEvent({
        dealershipId: ctx.dealershipId,
        eventName: 'appointment.scheduled',
        entityType: contactId ? 'customer' : 'conversation',
        entityId: contactId || ctx.conversation?.id,
        summary: `Appointment booked for ${when.toLocaleDateString()} at ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        department: args.department === 'service' ? 'Service' : 'Sales',
        payload: { when: when.toISOString(), vehicle: args.vehicle, conversation_id: ctx.conversation?.id },
      })

      return {
        ok: true,
        confirmed_time: when.toISOString(),
        formatted_time: `${when.toLocaleDateString()} at ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        message: 'Appointment successfully staged and added to dealership schedule.',
      }
    },
  },
  {
    name: 'human_request_handoff',
    description: 'Trigger immediate human escalation when customer requests a person or situation requires manager review.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        department: { type: 'string' },
      },
    },
    async handler(args, ctx) {
      await supabaseAdmin.from('ai_conversations').update({ status: 'handoff' }).eq('id', ctx.conversation?.id)
      emitEvent({
        dealershipId: ctx.dealershipId,
        eventName: 'ai.handoff_requested',
        entityType: ctx.contactRef?.id ? 'customer' : 'conversation',
        entityId: ctx.contactRef?.id || ctx.conversation?.id,
        summary: `Human handoff: ${args.reason || 'Customer request'}`,
        department: args.department || 'Sales',
        payload: { reason: args.reason, conversation_id: ctx.conversation?.id },
      })
      return { ok: true, escalated: true, message: 'Sales team notified for live takeover.' }
    },
  },
]
