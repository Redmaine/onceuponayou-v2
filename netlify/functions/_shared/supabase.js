import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

// Server-only Supabase client using the service key — bypasses RLS. This must
// NEVER be imported into frontend code; the service key is a full-access
// credential and lives only in the Netlify function environment.
let cached = null

// Real bug, 31 Aug 2026 — found live during end-to-end testing, not a
// hypothetical: every call to admin() threw "Node.js detected but native
// WebSocket not found" before any storage/db call ever ran. Root cause is
// eager, not lazy — @supabase/supabase-js's createClient() constructs a
// RealtimeClient internally regardless of whether realtime is ever used
// (confirmed: this codebase has zero .channel()/.on() calls anywhere), and
// RealtimeClient's own constructor calls WebSocketFactory.getWebSocketConstructor()
// synchronously (node_modules/@supabase/realtime-js .../websocket-factory.js)
// unless a transport is already supplied. Native WebSocket only exists
// globally in Node 22+; this site's Netlify functions run on Node 20
// (netlify.toml). Fixed with the library's own suggested alternative to a
// platform-wide Node upgrade: pass a real WebSocket implementation via the
// transport option. Scoped to this one client rather than bumping
// NODE_VERSION, which would touch the build, esbuild bundling and every
// other function for a capability (realtime) nothing here actually uses.
export function admin() {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  })
  return cached
}

// Uploads a Buffer/Uint8Array to a public bucket and returns its public URL.
// upsert:true so a retried job overwrites cleanly rather than 409-ing.
export async function uploadPublic(bucket, path, bytes, contentType) {
  const db = admin()
  const { error } = await db.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`storage upload failed (${bucket}/${path}): ${error.message}`)
  const { data } = db.storage.from(bucket).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error(`no public URL returned for ${bucket}/${path}`)
  return data.publicUrl
}
