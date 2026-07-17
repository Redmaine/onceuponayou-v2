import { admin } from './_shared/supabase.js'
import { json, methodNotAllowed, isAdminAuthorised } from './_shared/http.js'

// Read API for the /admin dashboard. Everything server-side and secret-gated,
// so the service key never reaches the browser.
//   ?action=list[&status=paid]      → order list + revenue + needs-review count
//   ?action=order&order_ref=OAY-xxx → one order with its stories and images
export async function handler(event) {
  if (event.httpMethod !== 'GET') return methodNotAllowed()
  if (!isAdminAuthorised(event)) return json(401, { error: 'Unauthorised' })

  const db = admin()
  const params = event.queryStringParameters || {}
  const action = params.action || 'list'

  if (action === 'list') {
    let query = db
      .from('ouay_orders')
      .select('id, order_ref, status, product_type, amount_paid, customer_name, hero_name, created_at, tracking_number')
      .order('created_at', { ascending: false })
    if (params.status) query = query.eq('status', params.status)
    const { data: orders, error } = await query
    if (error) return json(500, { error: error.message })

    // Revenue + needs-review computed across ALL orders, not just the filter.
    const { data: allForStats } = await db.from('ouay_orders').select('status, amount_paid')
    const revenuePence = (allForStats || [])
      .filter((o) => !['new', 'generation_failed'].includes(o.status))
      .reduce((s, o) => s + (o.amount_paid || 0), 0)
    const needsReview = (allForStats || []).filter((o) => o.status === 'images_complete').length

    return json(200, { orders: orders || [], revenuePence, needsReview })
  }

  if (action === 'order') {
    const ref = params.order_ref
    if (!ref) return json(400, { error: 'order_ref required' })
    const { data: order, error } = await db.from('ouay_orders').select('*').eq('order_ref', ref).maybeSingle()
    if (error) return json(500, { error: error.message })
    if (!order) return json(404, { error: 'not found' })

    const { data: stories } = await db
      .from('ouay_stories')
      .select('*')
      .eq('order_id', order.id)
      .order('story_number', { ascending: true })

    const { data: jobs } = await db
      .from('ouay_image_jobs')
      .select('story_id, job_key, page_number, image_url, status')
      .eq('order_id', order.id)

    // Group images by story for the dashboard grid.
    const imagesByStory = {}
    for (const j of jobs || []) {
      ;(imagesByStory[j.story_id] ||= []).push(j)
    }
    for (const k of Object.keys(imagesByStory)) {
      imagesByStory[k].sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0))
    }

    return json(200, { order, stories: stories || [], imagesByStory })
  }

  return json(400, { error: 'unknown action' })
}
