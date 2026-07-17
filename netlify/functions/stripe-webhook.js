import Stripe from 'stripe'
import { admin } from './_shared/supabase.js'
import { json } from './_shared/http.js'
import { sendOrderConfirmation, sendAdminNewOrder } from './_shared/email.js'

// Stripe webhook. On checkout.session.completed it marks the order paid, sends
// the confirmation + admin emails, and auto-triggers story generation. This
// auto-trigger is the step that was broken in the old build — it fires here,
// unconditionally, on every successful payment.
export async function handler(event) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature']

  // Stripe signature verification needs the exact raw body.
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (e) {
    return json(400, { error: `Webhook signature verification failed: ${e.message}` })
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return json(200, { received: true, ignored: stripeEvent.type })
  }

  const session = stripeEvent.data.object
  const orderRef = session.client_reference_id
  if (!orderRef) return json(200, { received: true, warning: 'no client_reference_id on session' })

  const db = admin()
  const { data: order } = await db.from('ouay_orders').select('*').eq('order_ref', orderRef).maybeSingle()
  if (!order) return json(200, { received: true, warning: `no order for ${orderRef}` })

  // Idempotency: Stripe retries webhooks. Only act the first time.
  if (order.status && order.status !== 'new') {
    return json(200, { received: true, alreadyProcessed: true })
  }

  const updated = {
    stripe_payment_id: session.payment_intent || session.id,
    customer_name: session.customer_details?.name || order.customer_name,
    customer_email: session.customer_details?.email || order.customer_email,
    status: 'paid',
    updated_at: new Date().toISOString(),
  }
  await db.from('ouay_orders').update(updated).eq('id', order.id)
  const paidOrder = { ...order, ...updated }

  // Emails are best-effort — a failed email must not fail the webhook (which
  // would make Stripe retry and risk double-generation).
  try { await sendOrderConfirmation(paidOrder) } catch (e) { console.error('confirmation email failed:', e.message) }
  try { await sendAdminNewOrder(paidOrder) } catch (e) { console.error('admin email failed:', e.message) }

  // Auto-trigger story generation (background function — returns 202 fast).
  try {
    const base = process.env.URL || process.env.DEPLOY_URL || ''
    await fetch(`${base}/.netlify/functions/generate-story-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.INTERNAL_SECRET || '' },
      body: JSON.stringify({ order_ref: orderRef }),
    })
  } catch (e) {
    console.error('failed to trigger story generation:', e.message)
  }

  return json(200, { received: true })
}
