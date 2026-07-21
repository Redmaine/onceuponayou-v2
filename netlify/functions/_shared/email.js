import { Resend } from 'resend'
import { PRODUCTS } from '../../../src/lib/products.js'
import { storyTypeLabel } from '../../../src/lib/themes.js'

// All transactional email for Once Upon A You. Every message is best-effort at
// the call site — an email failing must never roll back an order, a dispatch,
// or a print job — but each sender still throws on failure so the caller can
// log it.

const FROM = 'Once Upon A You <hello@onceuponayou.co.uk>'
const ADMIN_EMAIL = 'hello@onceuponayou.co.uk'
const BRAND_GREEN = '#1f4d3a'
const BRAND_GOLD = '#c9a227'

function resend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not set')
  return new Resend(key)
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Shared branded shell so every email looks like one family.
function shell(innerHtml) {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#2b2b2b">
    <div style="background:${BRAND_GREEN};padding:24px;text-align:center;border-radius:12px 12px 0 0">
      <div style="color:${BRAND_GOLD};font-size:22px;font-weight:700;letter-spacing:0.5px">Once Upon A You</div>
      <div style="color:#e9e4d6;font-size:12px;margin-top:4px">Every child, the hero of their own story</div>
    </div>
    <div style="background:#fbf8f1;padding:28px 26px;border:1px solid #ece5d6;border-top:none">
      ${innerHtml}
    </div>
    <div style="text-align:center;color:#9a9384;font-size:11px;padding:16px">
      Once Upon A You &middot; hello@onceuponayou.co.uk
    </div>
  </div>`
}

async function send({ to, subject, html, attachments }) {
  const payload = { from: FROM, to, subject, html }
  if (attachments?.length) payload.attachments = attachments
  const { error } = await resend().emails.send(payload)
  if (error) throw new Error(`Resend failed: ${error.message || JSON.stringify(error)}`)
}

// 1. Order confirmation — immediately after payment.
export async function sendOrderConfirmation(order) {
  const product = PRODUCTS[order.product_type]
  const hero = esc(order.hero_name)
  const isPrint = product && product.printCount > 0
  const timeline = isPrint
    ? 'Your printed book will be lovingly made and posted within 5–7 days.'
    : 'Your ebook will land in your inbox as soon as it is ready — usually within a day.'
  const html = shell(`
    <p style="font-size:16px">Wonderful news — <strong>${hero}</strong>'s book is on its way to becoming real.</p>
    <p>We've received your order and our storytellers are getting to work.</p>
    <table style="width:100%;font-size:14px;margin:18px 0;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b6455">Order</td><td style="text-align:right"><strong>${esc(order.order_ref)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#6b6455">Book</td><td style="text-align:right">${esc(product?.label || order.product_type)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6455">Hero</td><td style="text-align:right">${hero}</td></tr>
    </table>
    <p style="background:#f2ecdd;border-radius:8px;padding:12px 14px;font-size:14px">${timeline}</p>
    <p style="font-size:14px;color:#6b6455">Thank you for letting us tell ${hero}'s story.</p>
  `)
  await send({ to: order.customer_email, subject: `Your magical book is being made, ${order.hero_name}!`, html })
}

// 2. Ebook delivery — when the ebook PDF is ready. pdfBytes is a Buffer.
export async function sendEbookDelivery(order, downloadUrl, pdfBytes) {
  const hero = esc(order.hero_name)
  const html = shell(`
    <p style="font-size:16px"><strong>${hero}</strong>'s story is ready to read!</p>
    <p>Your personalised ebook is attached to this email, and you can also download it any time:</p>
    <p style="text-align:center;margin:22px 0">
      <a href="${esc(downloadUrl)}" style="background:${BRAND_GREEN};color:${BRAND_GOLD};text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Download ${hero}'s book</a>
    </p>
    <p style="font-size:14px;color:#6b6455">We hope it becomes a bedtime favourite.</p>
  `)
  const attachments = pdfBytes
    ? [{ filename: `${order.hero_name || 'story'}-once-upon-a-you.pdf`, content: Buffer.from(pdfBytes).toString('base64') }]
    : undefined
  await send({ to: order.customer_email, subject: `${order.hero_name}'s story is ready to read!`, html, attachments })
}

// 3. Dispatch notification — when a print order is marked dispatched.
export async function sendDispatchNotification(order) {
  const hero = esc(order.hero_name)
  const tracking = order.tracking_number
    ? `<p style="font-size:14px">Your tracking number is <strong>${esc(order.tracking_number)}</strong>.</p>`
    : ''
  const html = shell(`
    <p style="font-size:16px"><strong>${hero}</strong>'s book is on its way!</p>
    <p>It has left our printers and is heading to your door.</p>
    ${tracking}
    <p style="background:#f2ecdd;border-radius:8px;padding:12px 14px;font-size:14px">
      A little thank-you: use code <strong>COMEBACK10</strong> for 10% off your next magical book.
    </p>
  `)
  await send({ to: order.customer_email, subject: `${order.hero_name}'s book is on its way!`, html })
}

// 4. Admin notification — to us, on every new paid order.
export async function sendAdminNewOrder(order) {
  const product = PRODUCTS[order.product_type]
  const addr = order.delivery_address || {}
  const html = shell(`
    <p style="font-size:16px">New order: <strong>${esc(order.order_ref)}</strong></p>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <tr><td style="padding:4px 0;color:#6b6455">Product</td><td style="text-align:right">${esc(product?.label || order.product_type)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b6455">Amount</td><td style="text-align:right">£${((order.amount_paid || 0) / 100).toFixed(2)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b6455">Customer</td><td style="text-align:right">${esc(order.customer_name)} &lt;${esc(order.customer_email)}&gt;</td></tr>
      <tr><td style="padding:4px 0;color:#6b6455">Hero</td><td style="text-align:right">${esc(order.hero_name)}, age ${esc(order.hero_age)}, ${esc(order.hero_gender)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b6455">Story type</td><td style="text-align:right">${esc(storyTypeLabel(order.story_type))}</td></tr>
      <tr><td style="padding:4px 0;color:#6b6455">Themes</td><td style="text-align:right">${[order.theme, order.theme2, order.theme3].filter(Boolean).map(esc).join(', ') || '—'}</td></tr>
      <tr><td style="padding:4px 0;color:#6b6455;vertical-align:top">Delivery</td><td style="text-align:right">${[addr.line1, addr.line2, addr.town, addr.county, addr.postcode, addr.country].filter(Boolean).map(esc).join(', ') || '— (ebook)'}</td></tr>
    </table>
  `)
  await send({ to: ADMIN_EMAIL, subject: `New OUAY order: ${order.order_ref} — ${order.product_type}`, html })
}
