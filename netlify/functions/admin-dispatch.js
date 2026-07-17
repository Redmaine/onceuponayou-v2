import { admin } from './_shared/supabase.js'
import { json, methodNotAllowed, isAdminAuthorised } from './_shared/http.js'
import { sendDispatchNotification } from './_shared/email.js'

// Marks a print order dispatched, records the tracking number, and sends the
// dispatch email (with tracking + the COMEBACK10 loyalty code).
export async function handler(event) {
  if (event.httpMethod !== 'POST') return methodNotAllowed()
  if (!isAdminAuthorised(event)) return json(401, { error: 'Unauthorised' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON' }) }
  const orderRef = body.order_ref
  if (!orderRef) return json(400, { error: 'order_ref required' })

  const db = admin()
  const { data: order } = await db.from('ouay_orders').select('*').eq('order_ref', orderRef).maybeSingle()
  if (!order) return json(404, { error: 'not found' })

  const patch = {
    tracking_number: body.tracking_number || null,
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('ouay_orders').update(patch).eq('id', order.id)
  if (error) return json(500, { error: error.message })

  const dispatched = { ...order, ...patch }
  try {
    await sendDispatchNotification(dispatched)
  } catch (e) {
    console.error(`dispatch email failed for ${orderRef}:`, e.message)
    return json(200, { ok: true, emailWarning: e.message })
  }

  return json(200, { ok: true })
}
