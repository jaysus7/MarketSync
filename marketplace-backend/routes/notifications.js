import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { hasPermission } from '../authorization.js'

// Report / lot-health notification types are for management only
const MANAGER_ONLY_TYPES = ['weekly_report', 'aging', 'price_drift', 'missing_info', 'report', 'reconciliation']
const managerTypeList = '(' + MANAGER_ONLY_TYPES.map(t => `"${t}"`).join(',') + ')'

// Product classification mapping to normalize and filter notifications
export function classifyNotificationProduct(n) {
  if (n.product) return normalizeProductKey(n.product)
  const type = String(n.type || '').toLowerCase()
  const title = String(n.title || '').toLowerCase()
  const body = String(n.body || '').toLowerCase()
  const page = String(n.link_page || '').toLowerCase()

  if (type.startsWith('fb_') || type.includes('facebook') || type.includes('extension') || type === 'removal_required' || type === 'sold_vehicle' || type === 'pending_sale' || type === 'missing_source_alert' || type === 'source_sync_failure' || type === 'feed_disconnected' || type === 'listing_removed' || type.includes('inventory_sync') || title.includes('facebook') || title.includes('listing') || title.includes('extension') || title.includes('inventory feed') || title.includes('inventory source') || page === 'inventory') {
    return 'facebook'
  }
  if (type.startsWith('vid') || type.includes('video') || type.includes('walkaround') || title.includes('video') || title.includes('walkaround') || page === 'video-studio') {
    return 'video'
  }
  if (type.startsWith('email') || type.startsWith('sms') || type.includes('automation') || type.includes('campaign') || type.includes('replied') || type.includes('10dlc') || title.includes('sms') || title.includes('email') || title.includes('automation') || title.includes('campaign') || page === 'automation-builder' || page === 'email-marketing') {
    return 'email_sms'
  }
  if (type.startsWith('web') || type.includes('form_lead') || type.includes('domain') || type.includes('ssl') || type.includes('publishing') || title.includes('website') || title.includes('form submission') || title.includes('domain') || title.includes('ssl') || page === 'website' || page === 'blog') {
    return 'website'
  }
  if (type.startsWith('ai') || type.includes('chat') || type.includes('human_requested') || title.includes('chat') || title.includes('human rep') || page === 'ai-home' || page === 'ai-inbox') {
    return 'ai_chatbot'
  }
  if (type.startsWith('studio') || type.includes('design_studio') || type.includes('post_') || type.includes('social') || title.includes('graphic') || title.includes('flyer') || title.includes('social') || page === 'studio' || page === 'marketing-studio') {
    return 'design_studio'
  }
  if (type.startsWith('seo') || type.includes('indexing') || type.includes('competitor') || type.includes('keyword') || type.includes('console') || title.includes('seo') || title.includes('search console') || title.includes('keyword') || page === 'seo') {
    return 'seo'
  }
  return 'dealer_os'
}

function normalizeProductKey(p) {
  if (!p) return ''
  const s = String(p).toLowerCase().trim()
  if (s.includes('facebook') || s === 'fb' || s === 'facebook_dealer' || s === 'facebook_solo' || s === 'facebook_autoposter') return 'facebook'
  if (s.includes('video') || s === 'marketsync_video') return 'video'
  if (s.includes('email') || s.includes('sms') || s.includes('automation') || s === 'marketsync_email' || s === 'campaigns-email-sms' || s === 'campaigns_email_sms') return 'email_sms'
  if (s.includes('website') || s === 'marketsync_website' || s === 'dealer_website' || s === 'dealer-website') return 'website'
  if (s.includes('chatbot') || s === 'ai' || s === 'ai_dealer' || s === 'marketsync_ai' || s === 'ai_chatbot') return 'ai_chatbot'
  if (s.includes('studio') || s === 'design_studio') return 'design_studio'
  if (s.includes('seo') || s === 'marketsync_seo') return 'seo'
  return s
}

// Realistic product-scoped demo fixtures
const DEMO_PRODUCT_NOTIFICATIONS = {
  facebook: [
    { id: 'demo-fb-1', product: 'facebook', type: 'sold_vehicle', title: 'Sold Vehicle: 2022 Chevrolet Silverado 1500', body: 'Vehicle marked Sold in website feed. Facebook Marketplace listing removal required within 24 hours.', severity: 'action_required', status: 'open', needs_action: true, action_label: 'Remove Listing', action_page: 'inventory', action_filter: 'Silverado', read: false, created_at: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: 'demo-fb-2', product: 'facebook', type: 'pending_sale', title: 'Pending Sale: 2023 Ford F-150 Lariat', body: 'Deposit placed on unit. Auto-hold active: listing flagged to avoid duplicate inquiries.', severity: 'warning', status: 'open', needs_action: true, action_label: 'View Listing', action_page: 'inventory', action_filter: 'F-150', read: false, created_at: new Date(Date.now() - 90 * 60000).toISOString() },
    { id: 'demo-fb-3', product: 'facebook', type: 'missing_source_alert', title: 'Missing from Source: 2021 GMC Sierra 1500', body: 'Vehicle no longer detected on dealership inventory URL. 3-day hold countdown initiated before auto-archive.', severity: 'warning', status: 'open', needs_action: true, action_label: 'Check Unit', action_page: 'inventory', action_filter: 'Sierra', read: false, created_at: new Date(Date.now() - 180 * 60000).toISOString() },
    { id: 'demo-fb-4', product: 'facebook', type: 'extension_disconnected', title: 'Chrome Extension Session Active', body: 'MarketSync AutoPoster Chrome extension is connected and ready for 1-click posting.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'Extension Settings', action_url: 'https://chromewebstore.google.com/detail/marketsync/mfoaodaoipaalloccolophjhblgikada', read: true, created_at: new Date(Date.now() - 240 * 60000).toISOString() },
    { id: 'demo-fb-5', product: 'facebook', type: 'inventory_sync', title: 'Inventory Source Synced: apexmotors.ca/inventory', body: '84 active vehicles synced from website inventory URL. All frontline units up to date.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'Review Inventory', action_page: 'inventory', read: true, created_at: new Date(Date.now() - 480 * 60000).toISOString() }
  ],
  video: [
    { id: 'demo-vid-1', product: 'video', type: 'video_viewed', title: 'Customer Watched Video Walkaround', body: 'Sarah Jenkins watched 100% of 2024 Honda CR-V video walkaround and clicked Call Dealership.', severity: 'info', status: 'open', needs_action: true, action_label: 'View Analytics', action_page: 'video-studio', read: false, created_at: new Date(Date.now() - 25 * 60000).toISOString() },
    { id: 'demo-vid-2', product: 'video', type: 'video_failed', title: 'Video Send Delivery Failed', body: 'SMS delivery failed for customer Michael Vance (+1 555-0192). Invalid phone carrier format.', severity: 'action_required', status: 'open', needs_action: true, action_label: 'Resend Video', action_page: 'video-studio', read: false, created_at: new Date(Date.now() - 110 * 60000).toISOString() },
    { id: 'demo-vid-3', product: 'video', type: 'link_expired', title: 'Walkaround Link Expiring Soon', body: 'Customer video link for 2023 Jeep Grand Cherokee expires in 24 hours.', severity: 'warning', status: 'acknowledged', needs_action: false, action_label: 'Extend Link', action_page: 'video-studio', read: true, created_at: new Date(Date.now() - 360 * 60000).toISOString() }
  ],
  email_sms: [
    { id: 'demo-es-1', product: 'email_sms', type: 'customer_replied', title: 'Inbound SMS Reply: David Miller', body: '"Yes, I am free at 3:00 PM today for a test drive on the Silverado."', severity: 'action_required', status: 'open', needs_action: true, action_label: 'Open Conversation', action_page: 'automation-builder', read: false, created_at: new Date(Date.now() - 10 * 60000).toISOString() },
    { id: 'demo-es-2', product: 'email_sms', type: 'automation_failed', title: 'Day 1 Follow-up Email Bounced', body: 'Permanent bounce detected for lead k.watson@email.com. SMS fallback dispatched.', severity: 'warning', status: 'open', needs_action: true, action_label: 'Review Lead', action_page: 'automation-builder', read: false, created_at: new Date(Date.now() - 75 * 60000).toISOString() },
    { id: 'demo-es-3', product: 'email_sms', type: 'sender_domain', title: '10DLC Brand Campaign Active', body: 'A2P 10DLC automotive messaging campaign approved for 3,000 SMS/minute throughput.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'View Settings', action_page: 'automation-builder', read: true, created_at: new Date(Date.now() - 500 * 60000).toISOString() }
  ],
  website: [
    { id: 'demo-web-1', product: 'website', type: 'form_lead', title: 'New Website Form Submission', body: 'Ava Thompson submitted an online trade appraisal inquiry for 2021 Toyota RAV4.', severity: 'action_required', status: 'open', needs_action: true, action_label: 'Open Lead', action_page: 'website', read: false, created_at: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: 'demo-web-2', product: 'website', type: 'publishing_failed', title: 'Scheduled Page Publish Pending', body: 'Labor Day Specials promotional page is scheduled to go live at midnight.', severity: 'warning', status: 'open', needs_action: true, action_label: 'Preview Page', action_page: 'website', read: false, created_at: new Date(Date.now() - 95 * 60000).toISOString() },
    { id: 'demo-web-3', product: 'website', type: 'ssl_warning', title: 'Custom Domain SSL Verified', body: 'SSL certificate automatically verified and active for www.premierchevy.com.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'Domain Settings', action_page: 'website', read: true, created_at: new Date(Date.now() - 600 * 60000).toISOString() }
  ],
  ai_chatbot: [
    { id: 'demo-ai-1', product: 'ai_chatbot', type: 'human_requested', title: 'Human Sales Rep Requested in Live Chat', body: 'Website visitor on 2024 Sierra page requested human agent for financing questions.', severity: 'critical', status: 'open', needs_action: true, action_label: 'Join Chat', action_page: 'ai-home', read: false, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: 'demo-ai-2', product: 'ai_chatbot', type: 'chat_lead', title: 'AI ChatBot Captured Qualified Lead', body: 'Robert Chen (+1 555-0144) scheduled showroom test drive via AI ChatBot.', severity: 'action_required', status: 'open', needs_action: true, action_label: 'View Lead', action_page: 'ai-home', read: false, created_at: new Date(Date.now() - 40 * 60000).toISOString() },
    { id: 'demo-ai-3', product: 'ai_chatbot', type: 'knowledge_sync', title: 'Knowledge Base Synced', body: 'AI ChatBot knowledge base updated with 52 active lot inventory specifications.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'Knowledge Base', action_page: 'ai-home', read: true, created_at: new Date(Date.now() - 300 * 60000).toISOString() }
  ],
  design_studio: [
    { id: 'demo-ds-1', product: 'design_studio', type: 'scheduled_post_failed', title: 'Social Connection Token Needs Refresh', body: 'Facebook Page authorization token expiring soon for scheduled weekend post.', severity: 'action_required', status: 'open', needs_action: true, action_label: 'Re-authorize', action_page: 'studio', read: false, created_at: new Date(Date.now() - 35 * 60000).toISOString() },
    { id: 'demo-ds-2', product: 'design_studio', type: 'post_published', title: 'Graphic Published to Social Channels', body: 'Weekend Flash Sale graphic published successfully to Facebook & Instagram.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'View Post', action_page: 'studio', read: true, created_at: new Date(Date.now() - 180 * 60000).toISOString() }
  ],
  seo: [
    { id: 'demo-seo-1', product: 'seo', type: 'indexing_issue', title: 'Search Console Indexing Alert', body: 'Google Search Console detected 3 redirect URLs with missing canonical tags.', severity: 'action_required', status: 'open', needs_action: true, action_label: 'Fix Redirects', action_page: 'seo', read: false, created_at: new Date(Date.now() - 50 * 60000).toISOString() },
    { id: 'demo-seo-2', product: 'seo', type: 'competitor_opp', title: 'Keyword Ranking Jump: +18% Impressions', body: 'Dealership jumped to #2 for "Used Trucks Near Me" search query this week.', severity: 'info', status: 'acknowledged', needs_action: false, action_label: 'View SEO Intel', action_page: 'seo', read: true, created_at: new Date(Date.now() - 400 * 60000).toISOString() }
  ]
}

export function registerNotifications(app) {
  // GET /notifications — fetch notifications for current dealership, filtered by product if requested
  app.get('/notifications', requireAuth, async (req, res) => {
    const isDemo = req.user?.email === 'sales@marketsync.link' || req.dealershipId === 'demo-dealership'
    const targetProduct = normalizeProductKey(req.query.product)
    const filterStatus = req.query.status // 'unread' | 'needs_action' | 'all'

    if (isDemo) {
      let list = []
      if (targetProduct && DEMO_PRODUCT_NOTIFICATIONS[targetProduct]) {
        list = [...DEMO_PRODUCT_NOTIFICATIONS[targetProduct]]
      } else if (!targetProduct) {
        Object.values(DEMO_PRODUCT_NOTIFICATIONS).forEach(items => list.push(...items))
      } else {
        list = [...(DEMO_PRODUCT_NOTIFICATIONS.facebook || [])]
      }

      if (filterStatus === 'unread') list = list.filter(n => !n.read)
      else if (filterStatus === 'needs_action') list = list.filter(n => n.needs_action && n.status !== 'action_completed' && n.status !== 'acknowledged')

      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return res.json(list)
    }

    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    let q = supabaseAdmin
      .from('notifications')
      .select('id, type, title, body, link_page, link_filter, link_url, read, created_at')
      .eq('dealership_id', req.dealershipId)
      .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)

    if (!(await hasPermission(req, 'lead.assign'))) q = q.not('type', 'in', managerTypeList)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(80)

    if (error) return res.status(500).json({ error: error.message })

    let list = (data || []).map(n => {
      const prod = classifyNotificationProduct(n)
      const isAction = String(n.type || '').includes('failed') || String(n.type || '').includes('sold') || String(n.type || '').includes('lead')
      return {
        ...n,
        product: prod,
        severity: String(n.type || '').includes('failed') ? 'critical' : isAction ? 'action_required' : 'info',
        needs_action: isAction && !n.read,
        status: n.read ? 'acknowledged' : isAction ? 'open' : 'unread',
        action_label: n.link_page ? 'Review' : n.link_url ? 'Open Link' : 'View'
      }
    })

    if (targetProduct) {
      list = list.filter(n => n.product === targetProduct)
    }

    if (filterStatus === 'unread') {
      list = list.filter(n => !n.read)
    } else if (filterStatus === 'needs_action') {
      list = list.filter(n => n.needs_action && n.status !== 'action_completed' && n.status !== 'acknowledged')
    }

    res.json(list)
  })

  // GET /notifications/unread-count — product-scoped badge count
  app.get('/notifications/unread-count', requireAuth, async (req, res) => {
    const isDemo = req.user?.email === 'sales@marketsync.link' || req.dealershipId === 'demo-dealership'
    const targetProduct = normalizeProductKey(req.query.product)

    if (isDemo) {
      let list = []
      if (targetProduct && DEMO_PRODUCT_NOTIFICATIONS[targetProduct]) {
        list = DEMO_PRODUCT_NOTIFICATIONS[targetProduct]
      } else if (!targetProduct) {
        Object.values(DEMO_PRODUCT_NOTIFICATIONS).forEach(items => list.push(...items))
      } else {
        list = DEMO_PRODUCT_NOTIFICATIONS.facebook || []
      }
      const count = list.filter(n => !n.read || (n.needs_action && n.status === 'open')).length
      return res.json({ count })
    }

    if (!req.dealershipId) return res.json({ count: 0 })

    let q = supabaseAdmin
      .from('notifications')
      .select('id, type, link_page, title, body, read')
      .eq('dealership_id', req.dealershipId)
      .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)
      .eq('read', false)

    if (!(await hasPermission(req, 'lead.assign'))) q = q.not('type', 'in', managerTypeList)
    const { data, error } = await q

    if (error) return res.json({ count: 0 })

    let items = data || []
    if (targetProduct) {
      items = items.filter(n => classifyNotificationProduct(n) === targetProduct)
    }

    res.json({ count: items.length })
  })

  // POST /notifications/:id/read — mark one notification as read
  app.post('/notifications/:id/read', requireAuth, async (req, res) => {
    if (req.params.id?.startsWith('demo-')) return res.json({ ok: true })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
      .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // POST /notifications/:id/acknowledge — resolve an action notification
  app.post('/notifications/:id/acknowledge', requireAuth, async (req, res) => {
    if (req.params.id?.startsWith('demo-')) return res.json({ ok: true, status: 'acknowledged' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
      .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, status: 'acknowledged' })
  })

  // POST /notifications/read-all — mark all as read
  app.post('/notifications/read-all', requireAuth, async (req, res) => {
    if (req.user?.email === 'sales@marketsync.link') return res.json({ ok: true })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('dealership_id', req.dealershipId)
      .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)
      .eq('read', false)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // DELETE /notifications/:id — dismiss a single notification
  app.delete('/notifications/:id', requireAuth, async (req, res) => {
    if (req.params.id?.startsWith('demo-')) return res.json({ ok: true })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
      .or(`target_user_id.is.null,target_user_id.eq.${req.user.id}`)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })
}

