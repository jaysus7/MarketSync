import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { requireProduct } from '../access.js'

const BLOG_COLS = 'id, slug, title, excerpt, content_html, cover_image_url, author, category, tags, status, seo_title, seo_description, scheduled_at, published_at, created_at, updated_at'
const BLOG_COLS_MIN = 'id, slug, title, excerpt, content_html, cover_image_url, author, tags, status, seo_title, seo_description, published_at, created_at, updated_at'

function missingColumn(error) {
  return /column/i.test(String(error && error.message || '')) && /dealer_blog_posts/i.test(String(error && error.message || ''))
}

export function registerSiteBlogCompat(app) {
  app.get('/dealership/blog', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    let result = await req.supabase.from('dealer_blog_posts').select(BLOG_COLS).eq('dealership_id', req.dealershipId).order('updated_at', { ascending: false })
    if (result.error && missingColumn(result.error)) {
      result = await req.supabase.from('dealer_blog_posts').select(BLOG_COLS_MIN).eq('dealership_id', req.dealershipId).order('updated_at', { ascending: false })
      if (Array.isArray(result.data)) {
        result.data = result.data.map(post => Object.assign({ category: 'General', scheduled_at: null }, post))
      }
    }
    if (result.error) return res.status(500).json({ error: result.error.message })
    res.json({ posts: result.data || [] })
  })
}
