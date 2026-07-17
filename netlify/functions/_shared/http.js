// Small helpers shared by every Netlify function: JSON responses, method
// guards, and the admin-secret gate.

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function methodNotAllowed() {
  return json(405, { error: 'Method not allowed' })
}

// Admin endpoints are gated by a shared secret (INTERNAL_SECRET), sent as a
// bearer token or x-admin-secret header from the /admin dashboard. This is a
// simple internal gate, not per-user auth — the dashboard is single-operator.
export function isAdminAuthorised(event) {
  const secret = process.env.INTERNAL_SECRET
  if (!secret) return false
  const header = event.headers?.authorization || event.headers?.Authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const alt = event.headers?.['x-admin-secret'] || event.headers?.['X-Admin-Secret'] || ''
  return bearer === secret || alt === secret
}

// Generates a human-readable, unique order reference: OAY-<timestamp><rand>.
export function makeOrderRef() {
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `OAY-${Date.now()}${rand}`
}
