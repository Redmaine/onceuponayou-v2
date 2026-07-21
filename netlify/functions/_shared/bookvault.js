import { PDFDocument } from 'pdf-lib'
import { PRODUCTS } from '../../../src/lib/products.js'

// BookVault print fulfilment — Transient Order API.
//
// The SKU is taken from PRODUCTS[product_type].bookvaultSku (softcover =
// 150CWGPB216H216W, hardcover = 150CWGHB216H216W). We deliberately drive the
// SKU off product_type, never off a "binding" field.
//
// IMPORTANT: confirm the exact endpoint URL and auth header against BookVault's
// current API docs before launch (flagged in the README). The request shape
// below sends the fields the integration needs — interior + cover PDF URLs,
// the delivery address, customer name, SKU, quantity and page count — but
// BookVault's exact field names (particularly page_count) may differ.
// BOOKVAULT_API_URL can override the default endpoint via env without a code
// change.
const DEFAULT_BOOKVAULT_URL = 'https://api.bookvault.app/v1/orders/transient'

export function skuForProduct(productType) {
  return PRODUCTS[productType]?.bookvaultSku || null
}

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

// Returns { skipped: true } for ebook-only products (nothing to print), else
// submits the print order and returns { ok, bookvaultOrderId, raw }.
export async function sendToBookVault(order) {
  const product = PRODUCTS[order.product_type]
  if (!product || product.printCount < 1) {
    return { skipped: true, reason: 'ebook-only product — nothing to print' }
  }

  const sku = skuForProduct(order.product_type)
  if (!sku) throw new Error(`no BookVault SKU for product_type ${order.product_type}`)
  if (!order.interior_pdf_url || !order.cover_pdf_url) {
    throw new Error('interior_pdf_url and cover_pdf_url must be set before sending to print')
  }

  const apiKey = process.env.BOOKVAULT_API_KEY
  if (!apiKey) throw new Error('BOOKVAULT_API_KEY not set')

  // Page count must reflect the actual assembled interior PDF, not an
  // estimate — the hardcover now binds 3 stories into one book (~66 pages)
  // while softcover binds 1 (~22), and BookVault needs the real count for
  // whichever one this order produced.
  const interiorBytes = await fetchBytes(order.interior_pdf_url)
  const interiorDoc = await PDFDocument.load(interiorBytes)
  const pageCount = interiorDoc.getPageCount()

  const addr = order.delivery_address || {}
  const url = process.env.BOOKVAULT_API_URL || DEFAULT_BOOKVAULT_URL

  const body = {
    reference: order.order_ref,
    items: [
      {
        sku,
        // Always one bound physical book per order — product.printCount is
        // the number of stories bound INSIDE it (1 for softcover, 3 for
        // hardcover), not a book quantity. Using printCount here would order
        // 3 separate hardcover copies instead of 1 book with 3 stories.
        quantity: 1,
        page_count: pageCount,
        interior_url: order.interior_pdf_url,
        cover_url: order.cover_pdf_url,
      },
    ],
    shipping: {
      name: order.delivery_name || order.customer_name,
      address_line_1: addr.line1 || '',
      address_line_2: addr.line2 || '',
      city: addr.town || '',
      county: addr.county || '',
      postcode: addr.postcode || '',
      country: addr.country || 'GB',
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`BookVault ${res.status}: ${raw.slice(0, 400)}`)

  let parsed = null
  try { parsed = JSON.parse(raw) } catch { /* non-JSON success body */ }
  return { ok: true, bookvaultOrderId: parsed?.id || parsed?.order_id || null, raw }
}
