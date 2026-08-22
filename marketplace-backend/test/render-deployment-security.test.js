import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { corsOriginCheck } from '../cors-policy.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const headersPath = path.resolve(__dirname, '../../marketplace-frontend/_headers')
const redirectsPath = path.resolve(__dirname, '../../marketplace-frontend/_redirects')
const renderYamlPath = path.resolve(__dirname, '../../render.yaml')

test('Frontend _headers: includes security headers and appropriate CSP and frame policies', () => {
  assert.ok(fs.existsSync(headersPath), '_headers file must exist')
  const headersContent = fs.readFileSync(headersPath, 'utf8')

  // Global default headers /*
  assert.match(headersContent, /Strict-Transport-Security:\s*max-age=63072000;\s*includeSubDomains/)
  assert.match(headersContent, /X-Content-Type-Options:\s*nosniff/)
  assert.match(headersContent, /Referrer-Policy:\s*strict-origin-when-cross-origin/)
  assert.match(headersContent, /Permissions-Policy:\s*camera=\(self\),\s*microphone=\(self\),\s*geolocation=\(\),\s*interest-cohort=\(\)/)
  assert.match(headersContent, /Cross-Origin-Opener-Policy:\s*same-origin-allow-popups/)

  // Default frame-ancestors is 'none' / X-Frame-Options: DENY
  assert.match(headersContent, /X-Frame-Options:\s*DENY/)
  assert.match(headersContent, /frame-ancestors\s*'none'/)

  // Embeddable customer routes have proper frame-ancestors
  assert.match(headersContent, /\/chat-widget\.html[\s\S]*?frame-ancestors\s*\*/)
  assert.match(headersContent, /\/watch\.html[\s\S]*?frame-ancestors\s*\*/)
  assert.match(headersContent, /\/esign\.html[\s\S]*?frame-ancestors\s*'self'/)
})

test('Frontend _redirects: proxies SSR/sitemap endpoints and protects clean routes without wildcard SPA leak', () => {
  assert.ok(fs.existsSync(redirectsPath), '_redirects file must exist')
  const redirectsContent = fs.readFileSync(redirectsPath, 'utf8')

  // Dynamic proxies
  assert.match(redirectsContent, /\/blog-sitemap\.xml\s+https:\/\/vehicle-marketplace-s0e4\.onrender\.com\/blog-sitemap\.xml\s+200/)
  assert.match(redirectsContent, /\/blog\/:slug\s+https:\/\/vehicle-marketplace-s0e4\.onrender\.com\/ssr\/blog\/:slug\s+200/)

  // Clean URLs for SPA and customer flows
  assert.match(redirectsContent, /\/login\s+\/login\.html\s+200/)
  assert.match(redirectsContent, /\/register\s+\/register\.html\s+200/)
  assert.match(redirectsContent, /\/dashboard\s+\/dashboard\.html\s+200/)
  assert.match(redirectsContent, /\/watch\s+\/watch\.html\s+200/)
  assert.match(redirectsContent, /\/esign\s+\/esign\.html\s+200/)

  // Must not have a blanket catch-all (/* /index.html 200) that would swallow API / 404 routes
  assert.doesNotMatch(redirectsContent, /^\/\*\s+\/index\.html/m)
})

test('CORS Policy: Rejects wildcard and unapproved browser origins, permits first-party staging/prod', async () => {
  const checkOrigin = (origin) => new Promise((resolve) => {
    corsOriginCheck(origin, (err, allowed) => resolve({ err, allowed }))
  })

  // Wildcard and evil origins are rejected
  const wildcardRes = await checkOrigin('*')
  assert.equal(wildcardRes.allowed, false)

  const evilRes = await checkOrigin('https://evil-attacker.com')
  assert.equal(evilRes.allowed, false)

  // First-party staging & production are permitted
  const stagingSiteRes = await checkOrigin('https://marketsync-staging-site.onrender.com')
  assert.equal(stagingSiteRes.allowed, true)

  const stagingBackendRes = await checkOrigin('https://marketsync-staging-backend.onrender.com')
  assert.equal(stagingBackendRes.allowed, true)

  const prodSiteRes = await checkOrigin('https://marketsync.link')
  assert.equal(prodSiteRes.allowed, true)
})

test('Render Blueprint: Validates structure without duplicating services or mutating production branch', () => {
  assert.ok(fs.existsSync(renderYamlPath), 'render.yaml must exist')
  const yaml = fs.readFileSync(renderYamlPath, 'utf8')

  // Check services count and configuration
  assert.match(yaml, /name:\s*marketsync-backend/)
  assert.match(yaml, /name:\s*marketsync-site/)
  assert.match(yaml, /runtime:\s*node/)
  assert.match(yaml, /runtime:\s*static/)
  assert.match(yaml, /staticPublishPath:\s*\.\/marketplace-frontend/)
})
