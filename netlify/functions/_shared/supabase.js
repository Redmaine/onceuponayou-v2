import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service key — bypasses RLS. This must
// NEVER be imported into frontend code; the service key is a full-access
// credential and lives only in the Netlify function environment.
let cached = null

export function admin() {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
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
