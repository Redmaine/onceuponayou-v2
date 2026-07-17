// Single source of truth for the 7 products. Imported by BOTH the React
// frontend (order form, homepage) and the Netlify functions (save-order,
// stripe-webhook, assemble-pdf, send-to-print) — Netlify's esbuild bundler
// resolves this relative import into each function bundle. Keep it pure data
// with no imports so it's safe on both sides.

export const PRODUCTS = {
  ebook_single: {
    label: 'Ebook — 1 Story',
    price: 2.99,
    stripeLink: 'https://buy.stripe.com/eVqbJ2c2Yf0W9Gt8JM73G02',
    printCount: 0,
    ebookCount: 1,
    delivery: 'email',
  },
  ebook_triple: {
    label: 'Ebook — 3 Stories',
    price: 6.99,
    stripeLink: 'https://buy.stripe.com/cNi8wQc2YdWS7ylf8a73G03',
    printCount: 0,
    ebookCount: 3,
    delivery: 'email',
  },
  softcover: {
    label: 'Softcover Book',
    price: 14.99,
    stripeLink: 'https://buy.stripe.com/28EdRa7MI9GCcSF3ps73G00',
    printCount: 1,
    ebookCount: 0,
    delivery: 'print',
    bookvaultSku: '150CWGPB216H216W',
  },
  bundle_soft: {
    label: 'Softcover + Ebook',
    price: 17.99,
    stripeLink: 'https://buy.stripe.com/3cI8wQaYU1a63i55xA73G04',
    printCount: 1,
    ebookCount: 1,
    delivery: 'both',
    bookvaultSku: '150CWGPB216H216W',
  },
  hardcover: {
    label: 'Hardcover Book',
    price: 19.99,
    stripeLink: 'https://buy.stripe.com/cNi3cw6IEg502e16BE73G01',
    printCount: 1,
    ebookCount: 0,
    delivery: 'print',
    bookvaultSku: '150CWGHB216H216W',
  },
  bundle_hard_one: {
    label: 'Hardcover + Ebook (1 story)',
    price: 22.99,
    stripeLink: 'https://buy.stripe.com/5kQdRa5EAbOK8Cp7FI73G05',
    printCount: 1,
    ebookCount: 1,
    delivery: 'both',
    bookvaultSku: '150CWGHB216H216W',
  },
  bundle_hard_three: {
    label: 'Hardcover + Ebook (3 stories)',
    price: 24.99,
    stripeLink: 'https://buy.stripe.com/9B6cN6aYU2ea3i58JM73G06',
    printCount: 1,
    ebookCount: 3,
    delivery: 'both',
    bookvaultSku: '150CWGHB216H216W',
  },
}

// Short marketing descriptions for the homepage + order form product step.
export const PRODUCT_DESCRIPTIONS = {
  ebook_single: 'One personalised story, delivered as a beautiful PDF to your inbox.',
  ebook_triple: 'Three personalised stories in one ebook — three adventures for your child.',
  softcover: 'A keepsake softcover picture book, printed and posted to your door.',
  bundle_soft: 'The softcover book plus the ebook, so you can read it anywhere.',
  hardcover: 'A premium hardcover picture book — the heirloom edition.',
  bundle_hard_one: 'The hardcover book plus a matching single-story ebook.',
  bundle_hard_three: 'The hardcover book plus a three-story ebook bundle.',
}

// Products in the order they should be shown to customers.
export const PRODUCT_ORDER = [
  'ebook_single',
  'ebook_triple',
  'softcover',
  'bundle_soft',
  'hardcover',
  'bundle_hard_one',
  'bundle_hard_three',
]

export function getProduct(productType) {
  return PRODUCTS[productType] || null
}

export function isPrintProduct(productType) {
  const p = PRODUCTS[productType]
  return !!p && p.printCount > 0
}

export function isEbookProduct(productType) {
  const p = PRODUCTS[productType]
  return !!p && p.ebookCount > 0
}

// Amount in pence, for storing on the order and comparing against Stripe.
export function priceInPence(productType) {
  const p = PRODUCTS[productType]
  return p ? Math.round(p.price * 100) : 0
}
