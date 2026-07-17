import { admin } from './_shared/supabase.js'
import { json, methodNotAllowed, isAdminAuthorised } from './_shared/http.js'
import { sendToBookVault } from './_shared/bookvault.js'

// Standalone BookVault submission endpoint (admin-gated). Requires the order's
// interior_pdf_url and cover_pdf_url to already be set (run assemble-pdf, or
// approve, first). Skips ebook-only products. The main approve flow calls the
// same bookvault module in-process; this exists for manual re-submission.
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
    const result = await sendToBookVault(order)
    if (result.skipped) return json(200, { skipped: true, reason: result.reason })
    await db.from('ouay_orders').update({ status: 'printing', updated_at: new Date().toISOString() }).eq('id', order.id)
    return json(200, { ok: true, bookvaultOrderId: result.bookvaultOrderId })
  } catch (e) {
    return json(500, { error: e.message })
  }
}
