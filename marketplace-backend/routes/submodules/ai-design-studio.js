/**
 * Design Studio's own AI content generation — copy and template layouts.
 *
 * Deliberately separate from /ai/assistant: that endpoint is the paid AI
 * Assistant concierge (entitled on ai_boost_active/inv_intel_active, with
 * inventory-aware context and tool use). Design Studio's AI panel is a
 * built-in editor feature, not a paid add-on — every account gets it, gated
 * only by a per-dealership rate limit to keep API cost bounded, not by an
 * entitlement check.
 */
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, requireMfa } from '../../middleware.js'
import { rateLimit } from '../../security.js'
import { FAST_MODEL } from '../../aiModels.js'

const STUDIO_TEMPLATE_TOOL = {
  name: 'return_design_template',
  description: 'Return a marketing graphic template as a structured set of layout elements over a background color.',
  input_schema: {
    type: 'object',
    required: ['name', 'background_color', 'elements'],
    properties: {
      name: { type: 'string', description: 'Short template name, e.g. "Weekend Sales Blitz"' },
      background_color: { type: 'string', description: 'Hex color for the canvas background, e.g. #0F172A' },
      elements: {
        type: 'array',
        minItems: 2,
        maxItems: 10,
        items: {
          type: 'object',
          required: ['type', 'x', 'y', 'width', 'height'],
          properties: {
            type: { type: 'string', enum: ['text', 'shape'] },
            shape_type: { type: 'string', enum: ['rect'], description: 'Required when type is "shape"' },
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            text: { type: 'string', description: 'Required when type is "text"' },
            font_size: { type: 'number' },
            font_weight: { type: 'string', enum: ['400', '600', '700', '800', '900'] },
            fill: { type: 'string', description: 'Hex color for shape fill or text color' },
            corner_radius: { type: 'number', description: 'Only meaningful for shapes' },
            name: { type: 'string', description: 'Short label for this layer, e.g. "Headline"' },
          },
        },
      },
    },
  },
}

export function registerAiDesignStudioRoutes(app) {
  // Marketing copy for the canvas — a much lighter, purpose-built ask than the
  // AI Assistant's inventory-aware chat, so it gets its own small system prompt
  // rather than reusing /ai/assistant's heavier context-gathering.
  app.post('/ai/studio-copy', requireAuth, requireMfa, rateLimit('studio-ai-copy', 30, 60 * 60 * 1000, { dealership: true }), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured.' })
    const prompt = String(req.body?.prompt || '').trim().slice(0, 500)
    if (!prompt) return res.status(400).json({ error: 'Describe the content you want first.' })
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await anthropic.messages.create({
        model: FAST_MODEL, max_tokens: 300,
        messages: [{ role: 'user', content: `Create concise marketing copy for a visual design. Follow this request: ${prompt}. Return only the finished copy, without commentary, headings, markdown, or quotation marks.` }],
      })
      const copy = (message.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
      if (!copy) return res.status(502).json({ error: 'No content returned' })
      res.json({ copy })
    } catch (e) {
      res.status(500).json({ error: e.message || 'AI content could not be generated' })
    }
  })

  // A full template layout from one prompt — Claude picks the layers via tool
  // use (structured output), the server clamps everything to the canvas and
  // assigns ids/z-order, so a malformed or out-of-bounds response never reaches
  // the canvas as-is.
  app.post('/ai/studio-template', requireAuth, requireMfa, rateLimit('studio-ai-template', 20, 60 * 60 * 1000, { dealership: true }), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured.' })
    const prompt = String(req.body?.prompt || '').trim().slice(0, 500)
    if (!prompt) return res.status(400).json({ error: 'Describe the template you want first.' })
    const width = Math.min(2000, Math.max(200, Number(req.body?.width) || 1080))
    const height = Math.min(2000, Math.max(200, Number(req.body?.height) || 1080))
    const formatKey = String(req.body?.format_key || 'square')

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await anthropic.messages.create({
        model: FAST_MODEL, max_tokens: 1200,
        tools: [STUDIO_TEMPLATE_TOOL],
        tool_choice: { type: 'tool', name: 'return_design_template' },
        messages: [{
          role: 'user',
          content: `Design a car dealership marketing graphic template, ${width}x${height} pixels. Request: ${prompt}. Use {{vehicle.year}}, {{vehicle.make}}, {{vehicle.model}}, {{vehicle.trim}}, {{vehicle.price}}, {{vehicle.mileage}}, {{dealership.name}}, {{dealership.phone}} as placeholder text where a real value would normally go — never invent a specific price, phone number, or vehicle. Keep every element's x/y/width/height within 0-${width} and 0-${height}. Favor bold, readable text sizes (28-72px) and a small number of high-impact layers over a busy layout.`,
        }],
      })
      const toolUse = (message.content || []).find(b => b.type === 'tool_use')
      const input = toolUse?.input
      if (!input || !Array.isArray(input.elements) || !input.elements.length) {
        return res.status(502).json({ error: 'No template returned' })
      }

      const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
      const elements = input.elements.slice(0, 10).map((el, i) => {
        const w = clamp(el.width, 20, width)
        const h = clamp(el.height, 20, height)
        const base = {
          id: `el-ai-${i + 1}`,
          type: el.type === 'shape' ? 'shape' : 'text',
          x: clamp(el.x, 0, width - w),
          y: clamp(el.y, 0, height - h),
          width: w, height: h,
          opacity: 1, z: i + 1,
          name: String(el.name || (el.type === 'shape' ? 'Shape' : 'Text')).slice(0, 60),
        }
        if (base.type === 'shape') {
          return { ...base, shapeType: 'rect', fill: /^#[0-9a-f]{3,8}$/i.test(el.fill || '') ? el.fill : '#4F46E5', rx: clamp(el.corner_radius, 0, 60) }
        }
        return {
          ...base,
          text: String(el.text || '').slice(0, 200) || 'Text',
          fontSize: clamp(el.font_size, 12, 120),
          fontWeight: ['400', '600', '700', '800', '900'].includes(el.font_weight) ? el.font_weight : '700',
          fill: /^#[0-9a-f]{3,8}$/i.test(el.fill || '') ? el.fill : '#F8FAFC',
        }
      })

      const scene = {
        version: 1,
        format_key: formatKey,
        width, height,
        background: { color: /^#[0-9a-f]{3,8}$/i.test(input.background_color || '') ? input.background_color : '#0F172A' },
        elements,
      }
      res.json({ name: String(input.name || 'AI Template').slice(0, 80), scene })
    } catch (e) {
      res.status(500).json({ error: e.message || 'Template could not be generated' })
    }
  })

  // Image generation via OpenAI's image API. Returns a clear, honest 503 (not a
  // fake placeholder image) when no key is configured for this server.
  app.post('/ai/studio-image', requireAuth, requireMfa, rateLimit('studio-ai-image', 15, 60 * 60 * 1000, { dealership: true }), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI image generation is not configured yet for this server.' })
    const prompt = String(req.body?.prompt || '').trim().slice(0, 500)
    if (!prompt) return res.status(400).json({ error: 'Describe the image you want first.' })
    try {
      const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt: `Marketing photo for a car dealership design. ${prompt}`, size: '1024x1024', n: 1 }),
      })
      const data = await openaiRes.json()
      if (!openaiRes.ok) return res.status(502).json({ error: data?.error?.message || 'Image could not be generated' })
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) return res.status(502).json({ error: 'No image returned' })
      res.json({ url: `data:image/png;base64,${b64}` })
    } catch (e) {
      res.status(500).json({ error: e.message || 'Image could not be generated' })
    }
  })
}
