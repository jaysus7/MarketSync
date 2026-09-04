import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } })

async function removeBg(bufferOrUrl) {
  const key = process.env.REMOVEBG_API_KEY
  if (!key) return { error: 'Background removal is not configured on this server' }
  const form = new FormData()
  if (Buffer.isBuffer(bufferOrUrl)) form.append('image_file', new Blob([bufferOrUrl]), 'photo.jpg')
  else form.append('image_url', String(bufferOrUrl))
  form.append('size', 'auto')
  form.append('format', 'png')
  const r = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: form,
    signal: AbortSignal.timeout(30000)
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    return { error: 'Remove.bg ' + r.status + ' ' + text.slice(0, 160) }
  }
  return { buffer: Buffer.from(await r.arrayBuffer()) }
}

export function registerStudioMedia(app) {
  app.get('/dealership/photo-background', requireAuth, async (req, res) => {
    const { data } = await supabaseAdmin.from('dealerships').select('photo_background_url').eq('id', req.dealershipId).single()
    res.json({ url: data?.photo_background_url || null })
  })

  app.post('/dealership/photo-background', requireAuth, upload.single('background'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' })
    const path = req.dealershipId + '/_background/bg-' + Date.now() + '-' + (req.file.originalname || 'bg').replace(/[^a-zA-Z0-9.]+/g, '-')
    const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos').upload(path, req.file.buffer, { contentType: req.file.mimetype || 'image/jpeg', upsert: true })
    if (upErr) return res.status(500).json({ error: upErr.message })
    const { data: pub } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
    const url = pub?.publicUrl
    await supabaseAdmin.from('dealerships').update({ photo_background_url: url }).eq('id', req.dealershipId)
    res.json({ ok: true, url })
  })

  app.post('/studio/remove-background', requireAuth, upload.single('image'), async (req, res) => {
    const src = req.file?.buffer || req.body?.image_url || req.body?.url
    if (!src) return res.status(400).json({ error: 'Upload an image or pass image_url' })
    const cut = await removeBg(src)
    if (cut.error) return res.status(502).json({ error: cut.error })
    const path = (req.dealershipId || 'studio') + '/_cutout/cut-' + Date.now() + '.png'
    const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos').upload(path, cut.buffer, { contentType: 'image/png', upsert: true })
    if (upErr) return res.status(500).json({ error: upErr.message })
    const { data: pub } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
    res.json({ ok: true, url: pub?.publicUrl })
  })
}
