import { admin } from './_shared/supabase.js'
import { json, isAdminAuthorised } from './_shared/http.js'
import { assembleOrderPdfs } from './_shared/assemble.js'
import { sendToBookVault } from './_shared/bookvault.js'
import { sendEbookDelivery } from './_shared/email.js'
import { PRODUCTS } from '../../src/lib/products.js'

// Background function: the admin "Approve" action. Assembles the PDFs, then
// branches by product_type — print → BookVault, ebook → email, bundle → both.
// Runs async (up to 15 min) because PDF assembly fetches every page image.
// The dashboard polls order status to see the outcome.
export async function handler(event) {
  if (!isAdminAuthorised(event)) return json(401, { error: 'Unauthorised' })

  let orderRef
  try { orderRef = JSON.parse(event.body || '{}').order_ref } catch { /* ignore */ }
  if (!orderRef) return json(400, { error: 'order_ref required' })

  const db = admin()
  const { data: order } = await db.from('ouay_orders').select('*').eq('order_ref', orderRef).maybeSingle()
  if (!order) return json(404, { error: 'not found' })

  const product = PRODUCTS[order.product_type]
  if (!product) return json(400, { error: `unknown product_type ${order.product_type}` })

  await db.from('ouay_orders').update({ status: 'assembling', updated_at: new Date().toISOString() }).eq('id', order.id)

  try {
    const pdfs = await assembleOrderPdfs(order)
    const fresh = { ...order, ...pdfs }

    const wantsEbook = product.ebookCount > 0
    const wantsPrint = product.printCount > 0

    if (wantsEbook) {
      try {
        await sendEbookDelivery(fresh, pdfs.ebook_pdf_url, pdfs.ebookBytes)
      } catch (e) {
        console.error(`ebook email failed for ${orderRef}:`, e.message)
      }
    }

    let finalStatus
    if (wantsPrint) {
      await sendToBookVault(fresh)
      finalStatus = 'printing'
    } else {
      finalStatus = 'complete'
    }

    await db.from('ouay_orders').update({ status: finalStatus, updated_at: new Date().toISOString() }).eq('id', order.id)
    return json(200, { ok: true, status: finalStatus })
  } catch (e) {
    console.error(`approve failed for ${orderRef}:`, e.message)
    await db.from('ouay_orders').update({ status: 'approve_failed', updated_at: new Date().toISOString() }).eq('id', order.id)
    return json(500, { error: e.message })
  }
}
