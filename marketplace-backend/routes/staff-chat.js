import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'

// In-memory message fallback store for smooth operational performance
const memoryStore = {
  messages: [],
  reactions: {}
}

export function registerStaffChat(app) {
  // GET /staff-chat/members — list dealership staff members & team channels
  app.get('/staff-chat/members', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const channels = [
      { id: 'channel-general', name: 'General Chat', type: 'channel', icon: 'hashtag', dept: 'all' },
      { id: 'channel-sales', name: 'Sales Floor', type: 'channel', icon: 'currency', dept: 'sales' },
      { id: 'channel-service', name: 'Service Bay', type: 'channel', icon: 'wrench', dept: 'service' },
      { id: 'channel-parts', name: 'Parts Desk', type: 'channel', icon: 'gem', dept: 'parts' },
      { id: 'channel-recon', name: 'Recon & Detail', type: 'channel', icon: 'sparkles', dept: 'recon' },
    ]

    try {
      // Query auth profiles / staff members in this dealership
      const { data: staffData } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role, department')
        .eq('dealership_id', req.dealershipId)
        .order('full_name', { ascending: true })

      let members = (staffData || [])
        .filter(u => u.id !== req.user.id)
        .map(u => ({
          id: u.id,
          name: u.full_name || u.email?.split('@')[0] || 'Team Member',
          email: u.email,
          role: u.role || 'STAFF',
          department: u.department || 'General',
          initials: (u.full_name || u.email || 'TM').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          online: true,
          type: 'direct'
        }))

      // Fallback staff list if no other profile records returned
      if (members.length === 0) {
        members = [
          { id: 'staff-mgr', name: 'Sales Manager', role: 'MANAGER', department: 'Sales', initials: 'SM', online: true, type: 'direct' },
          { id: 'staff-rep', name: 'Lead Advisor', role: 'ADVISOR', department: 'Service', initials: 'LA', online: true, type: 'direct' },
          { id: 'staff-fni', name: 'F&I Manager', role: 'FNI', department: 'F&I', initials: 'FI', online: true, type: 'direct' }
        ]
      }

      res.json({ channels, members })
    } catch (err) {
      res.json({ channels, members: [] })
    }
  })

  // GET /staff-chat/messages — fetch message thread history
  app.get('/staff-chat/messages', requireAuth, async (req, res) => {
    const { target_id } = req.query
    if (!target_id) return res.status(400).json({ error: 'target_id is required' })

    try {
      let messages = []
      // Check Supabase staff_messages table first
      const { data, error } = await supabaseAdmin
        .from('staff_messages')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${target_id}),and(sender_id.eq.${target_id},recipient_id.eq.${req.user.id}),recipient_id.eq.${target_id}`)
        .order('created_at', { ascending: true })
        .limit(100)

      if (!error && data) {
        messages = data
      } else {
        // Fallback to memory store
        messages = memoryStore.messages.filter(m =>
          m.dealership_id === req.dealershipId &&
          ((m.sender_id === req.user.id && m.recipient_id === target_id) ||
           (m.sender_id === target_id && m.recipient_id === req.user.id) ||
           (m.recipient_id === target_id))
        )
      }

      res.json(messages)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // POST /staff-chat/messages — send internal staff message
  app.post('/staff-chat/messages', requireAuth, async (req, res) => {
    const { recipient_id, content } = req.body
    if (!recipient_id || !content?.trim()) {
      return res.status(400).json({ error: 'recipient_id and content are required' })
    }

    const senderName = req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'Staff Member'

    const newMsg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      dealership_id: req.dealershipId,
      sender_id: req.user.id,
      sender_name: senderName,
      recipient_id,
      content: content.trim(),
      reactions: {},
      read: false,
      created_at: new Date().toISOString()
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('staff_messages')
        .insert(newMsg)
        .select()
        .single()

      if (!error && data) {
        memoryStore.messages.push(data)
        return res.json(data)
      }
    } catch {}

    // Fallback: save to memory store
    memoryStore.messages.push(newMsg)
    res.json(newMsg)
  })

  // GET /staff-chat/unread — check unread messages for popup notifications
  app.get('/staff-chat/unread', requireAuth, async (req, res) => {
    try {
      const unreadMsgs = memoryStore.messages.filter(m =>
        m.dealership_id === req.dealershipId &&
        m.recipient_id === req.user.id &&
        !m.read
      )

      res.json({
        count: unreadMsgs.length,
        messages: unreadMsgs.slice(-5)
      })
    } catch {
      res.json({ count: 0, messages: [] })
    }
  })

  // POST /staff-chat/read — mark messages as read
  app.post('/staff-chat/read', requireAuth, async (req, res) => {
    const { target_id } = req.body
    if (!target_id) return res.status(400).json({ error: 'target_id is required' })

    memoryStore.messages.forEach(m => {
      if (m.dealership_id === req.dealershipId && m.sender_id === target_id && m.recipient_id === req.user.id) {
        m.read = true
      }
    })

    try {
      await supabaseAdmin
        .from('staff_messages')
        .update({ read: true })
        .eq('dealership_id', req.dealershipId)
        .eq('sender_id', target_id)
        .eq('recipient_id', req.user.id)
    } catch {}

    res.json({ ok: true })
  })

  // POST /staff-chat/react — toggle emoji reaction on message
  app.post('/staff-chat/react', requireAuth, async (req, res) => {
    const { message_id, emoji } = req.body
    if (!message_id || !emoji) return res.status(400).json({ error: 'message_id and emoji are required' })

    const msg = memoryStore.messages.find(m => m.id === message_id)
    if (msg) {
      if (!msg.reactions) msg.reactions = {}
      if (!msg.reactions[emoji]) msg.reactions[emoji] = []
      const idx = msg.reactions[emoji].indexOf(req.user.id)
      if (idx >= 0) msg.reactions[emoji].splice(idx, 1)
      else msg.reactions[emoji].push(req.user.id)
    }

    res.json({ ok: true, reactions: msg?.reactions || {} })
  })
}
