// Browser origin policy is intentionally dependency-free so it can be tested
// without initializing Redis, rate limiting, or any application state.

function configuredOrigins(name) {
  return (process.env[name] || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true) // server-to-server, curl, etc.
  const allowed = [
    'https://marketsync.link',
    'https://www.marketsync.link',
    'https://www.facebook.com',
    'https://facebook.com',
    'https://m.facebook.com'
  ]
  const configuredAppOrigins = configuredOrigins('CORS_ALLOWED_ORIGINS')
  const configuredExtensionOrigins = configuredOrigins('CORS_ALLOWED_EXTENSION_ORIGINS')
  if (allowed.includes(origin) || configuredAppOrigins.includes(origin) || configuredExtensionOrigins.includes(origin)) {
    return callback(null, true)
  }
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true)
    }
  }
  return callback(new Error(`CORS blocked: ${origin}`), false)
}
