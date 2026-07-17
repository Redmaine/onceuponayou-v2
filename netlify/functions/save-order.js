import { admin, uploadPublic } from './_shared/supabase.js'
import { json, methodNotAllowed, makeOrderRef } from './_shared/http.js'
import { PRODUCTS, isPrintProduct, priceInPence } from '../../src/lib/products.js'

// Saves an order (status 'new', unpaid) and returns the Stripe checkout URL to
// redirect to. The frontend calls this last, just before redirecting to
// Stripe. A photo, if provided, is uploaded to the ouay-images bucket here.
export async function handler(event) {
  if (event.httpMethod !== 'POST') return methodNotAllowed()

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const product = PRODUCTS[payload.product_type]
  if (!product) return json(400, { error: 'Unknown product_type' })
  if (!['adventure', 'love', 'growing'].includes(payload.story_type)) {
    return json(400, { error: 'Invalid story_type' })
  }
  if (!payload.hero_name || !String(payload.hero_name).trim()) {
    return json(400, { error: 'hero_name is required' })
  }
  const age = Number(payload.hero_age)
  if (!Number.isInteger(age) || age < 1 || age > 10) {
    return json(400, { error: 'hero_age must be a whole number 1–10' })
  }
  if (!['boy', 'girl', 'child'].includes(payload.hero_gender)) {
    return json(400, { error: 'hero_gender must be boy, girl or child' })
  }

  const printProduct = isPrintProduct(payload.product_type)
  const hasPhoto = !!payload.photo_base64
  if (printProduct && !hasPhoto) {
    return json(400, { error: 'A photo is required for printed books' })
  }
  if (hasPhoto && payload.photo_consent !== true) {
    return json(400, { error: 'Photo consent is required to upload a photo' })
  }
  if (printProduct) {
    const a = payload.delivery_address || {}
    if (!a.line1 || !a.town || !a.postcode) {
      return json(400, { error: 'Delivery address (line1, town, postcode) is required for printed books' })
    }
  }

  const orderRef = makeOrderRef()

  // Upload the photo first (if any) so hero_photo_url is set on insert.
  let heroPhotoUrl = null
  if (hasPhoto) {
    try {
      const ct = payload.photo_content_type || 'image/jpeg'
      const ext = ct.includes('png') ? 'png' : 'jpg'
      const bytes = Buffer.from(String(payload.photo_base64).replace(/^data:[^,]+,/, ''), 'base64')
      heroPhotoUrl = await uploadPublic('ouay-images', `${orderRef}/photo.${ext}`, bytes, ct)
    } catch (e) {
      return json(500, { error: `Photo upload failed: ${e.message}` })
    }
  }

  const row = {
    order_ref: orderRef,
    hero_name: String(payload.hero_name).trim(),
    hero_age: age,
    hero_gender: payload.hero_gender,
    hero_hair: payload.hero_hair || null,
    hero_skin: payload.hero_skin || null,
    hero_features: payload.hero_features || null,
    hero_photo_url: heroPhotoUrl,
    story_type: payload.story_type,
    theme: payload.theme || null,
    theme2: payload.theme2 || null,
    theme3: payload.theme3 || null,
    dedication: payload.dedication || null,
    product_type: payload.product_type,
    amount_paid: priceInPence(payload.product_type),
    delivery_name: printProduct ? (payload.delivery_name || null) : null,
    delivery_address: printProduct ? (payload.delivery_address || null) : null,
    status: 'new',
  }

  const db = admin()
  const { error } = await db.from('ouay_orders').insert(row)
  if (error) return json(500, { error: `Could not save order: ${error.message}` })

  // Stripe Payment Link with client_reference_id so the webhook can match the
  // completed checkout back to this order.
  const checkoutUrl = `${product.stripeLink}?client_reference_id=${encodeURIComponent(orderRef)}`

  return json(200, { order_ref: orderRef, checkout_url: checkoutUrl })
}
