import { admin } from './_shared/supabase.js'
import { json, methodNotAllowed, isAdminAuthorised } from './_shared/http.js'
import { assembleOrderPdfs } from './_shared/assemble.js'

// Standalone PDF assembly endpoint (admin-gated). The main approve flow uses
// admin-approve-background, which calls the same assembleOrderPdfs module
// in-process; this endpoint exists for manual re-assembly of a single order.
// Note: assembling fetches every page image, so this can run close to the
// synchronous function timeout — prefer admin-approve-background for the live
// flow.
export async function handler(event) {
  if (event.httpMethod !== 'POST') return methodNotAllowed()
  if (!isAdminAuthorised(event)) return json(401, { error: 'Unauthorised' })

  let orderRef
  try { orderRef = JSON.parse(event.body || '{}').order_ref } catch { return json(400, { error: 'Invalid JSON' }) }
  if (!orderRef) return json(400, { error: 'order_ref required' })

  const db = admin()
  const { data: order } = await db.from('ouay_orders').select('*').eq('order_ref', orderRef).maybeSingle()
  if (!order) return json(404, { error: 'not found' })

  try {
    const pdfs = await assembleOrderPdfs(order)
    return json(200, {
      ok: true,
      interior_pdf_url: pdfs.interior_pdf_url,
      cover_pdf_url: pdfs.cover_pdf_url,
      ebook_pdf_url: pdfs.ebook_pdf_url,
    })
  } catch (e) {
    return json(500, { error: e.message })
  }
}
