import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

import {
  extractStoragePath,
  shareLinkState,
  getSignedPlaybackUrl,
  watchSummary,
} from '../routes/sales-video.js'
import { supabaseAdmin } from '../shared.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const migration = read('migrations/2026-08-20-secure-sales-videos-bucket.sql')
const route = strip(read('routes/sales-video.js'))

// ── 1. Migration: Private Bucket & Storage RLS ──────────────────────────────

test('migration makes sales-videos bucket private and enforces storage RLS', () => {
  assert.match(migration, /UPDATE\s+storage\.buckets\s+SET\s+public\s*=\s*false\s+WHERE\s+id\s*=\s*'sales-videos'/i,
    'sales-videos bucket must be updated to public = false')
  assert.match(migration, /ALTER\s+TABLE\s+public\.sales_videos\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+revoked_at\s+timestamptz/i,
    'sales_videos table must have revoked_at column')
  assert.match(migration, /ALTER\s+TABLE\s+storage\.objects\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    'storage.objects must have RLS enabled')
  assert.match(migration, /CREATE\s+POLICY\s+"sales_videos_authenticated_select"\s+ON\s+storage\.objects/i,
    'authenticated select policy must exist')
  assert.match(migration, /authz\.belongs_to_dealership\(authz\.storage_path_dealership\(name\)\)/i,
    'storage policy must isolate by dealership ID using tenant authorization')
  
  // Guardrail: must NOT touch public vehicle media buckets
  assert.doesNotMatch(migration, /vehicle-photos/i, 'must not modify vehicle-photos')
  assert.doesNotMatch(migration, /vehicle-pdfs/i, 'must not modify vehicle-pdfs')
})

// ── 2. Canonical Storage Path Extraction & Legacy Backward Compatibility ────

test('extractStoragePath extracts from storage_path and legacy public_url', () => {
  const withPath = { storage_path: 'dealer-123/user-456/123456789-token.mp4', public_url: '' }
  assert.equal(extractStoragePath(withPath), 'dealer-123/user-456/123456789-token.mp4')

  const legacy = {
    storage_path: null,
    public_url: 'https://test-project.supabase.co/storage/v1/object/public/sales-videos/dealer-999/user-888/video-legacy.mp4',
  }
  assert.equal(extractStoragePath(legacy), 'dealer-999/user-888/video-legacy.mp4')

  assert.equal(extractStoragePath({}), null)
  assert.equal(extractStoragePath(null), null)
})

// ── 3. Share Link Expiration & Revocation State ─────────────────────────────

test('shareLinkState enforces revoked_at, deleted_at, and expires_at', () => {
  const active = { expires_at: new Date(Date.now() + 86400000).toISOString() }
  assert.equal(shareLinkState(active).ok, true)

  const revoked = {
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    revoked_at: new Date(Date.now() - 10000).toISOString(),
  }
  assert.equal(shareLinkState(revoked).ok, false)
  assert.match(shareLinkState(revoked).reason, /no longer available/i)

  const deleted = {
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    deleted_at: new Date(Date.now() - 10000).toISOString(),
  }
  assert.equal(shareLinkState(deleted).ok, false)
  assert.match(shareLinkState(deleted).reason, /no longer available/i)

  const expired = {
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  }
  assert.equal(shareLinkState(expired).ok, false)
  assert.match(shareLinkState(expired).reason, /expired/i)
})

// ── 4. Signed Playback URL Helper ───────────────────────────────────────────

test('getSignedPlaybackUrl requests a signed URL from private sales-videos bucket', async () => {
  let requestedBucket = null
  let requestedPath = null
  let requestedExpiry = null

  supabaseAdmin.storage = {
    from: (bucket) => {
      requestedBucket = bucket
      return {
        createSignedUrl: async (path, expiresIn) => {
          requestedPath = path
          requestedExpiry = expiresIn
          return { data: { signedUrl: `https://storage.supabase.co/signed/${bucket}/${path}?token=sig123` }, error: null }
        },
      }
    },
  }

  const url = await getSignedPlaybackUrl('d1/u1/vid.mp4', 900)
  assert.equal(requestedBucket, 'sales-videos')
  assert.equal(requestedPath, 'd1/u1/vid.mp4')
  assert.equal(requestedExpiry, 900)
  assert.ok(url.includes('token=sig123'))

  assert.equal(await getSignedPlaybackUrl(null), null)
})

// ── 5. Endpoints & Route Hardening Verification ─────────────────────────────

test('authenticated dealership playback endpoint enforces tenant isolation and generates signed URL', () => {
  const playbackRoute = route.match(/app\.get\('\/sales-videos\/:id\/playback'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(playbackRoute, 'playback route must exist')
  assert.match(playbackRoute, /requireAuth,\s*canView/)
  assert.match(playbackRoute, /\.eq\('dealership_id',\s*req\.dealershipId\)/, 'must isolate by dealership_id')
  assert.match(playbackRoute, /extractStoragePath\(video\)/)
  assert.match(playbackRoute, /getSignedPlaybackUrl\(path,\s*3600\)/)
  assert.match(playbackRoute, /Cache-Control.*private,\s*no-store/i)
})

test('share link revocation and regeneration endpoints exist and update revoked_at', () => {
  const revokeRoute = route.match(/app\.post\('\/sales-videos\/:id\/revoke'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(revokeRoute, 'revoke route must exist')
  assert.match(revokeRoute, /requireAuth,\s*canEdit/)
  assert.match(revokeRoute, /revoked_at:\s*now/)
  assert.match(revokeRoute, /\.eq\('dealership_id',\s*req\.dealershipId\)/)

  const regenRoute = route.match(/app\.post\('\/sales-videos\/:id\/share-token'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(regenRoute, 'share-token regenerate route must exist')
  assert.match(regenRoute, /requireAuth,\s*canEdit/)
  assert.match(regenRoute, /share_token:\s*token/)
  assert.match(regenRoute, /revoked_at:\s*null/)
})

test('video deletion soft-deletes and removes object from private bucket', () => {
  const deleteRoute = route.match(/app\.delete\('\/sales-videos\/:id'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(deleteRoute, 'delete route must exist')
  assert.match(deleteRoute, /requireAuth,\s*canEdit/)
  assert.match(deleteRoute, /deleted_at:\s*now/)
  assert.match(deleteRoute, /storage\.from\('sales-videos'\)\.remove\(\[path\]\)/)
})

test('customer watch endpoint resolves token, generates short-lived signed URL, and sets private no-store headers', () => {
  const watchRoute = route.match(/app\.get\('\/v\/:token'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(watchRoute, 'customer watch route must exist')
  assert.match(watchRoute, /rateLimit\('sales_video_watch'/)
  assert.match(watchRoute, /shareLinkState\(video\)/)
  assert.match(watchRoute, /getSignedPlaybackUrl\(storagePath,\s*900\)/, 'must issue 15-minute signed URL')
  assert.match(watchRoute, /Cache-Control.*private,\s*no-store/i)
  assert.match(watchRoute, /url:\s*signedUrl/, 'must return signed URL, not permanent public URL')
})
