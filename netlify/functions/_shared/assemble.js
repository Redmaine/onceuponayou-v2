import { admin, uploadPublic } from './supabase.js'
import { buildBookPdf, buildCoverPdf } from './pdf.js'
import { PRODUCTS } from '../../../src/lib/products.js'

// Loads all image URLs for a story from ouay_image_jobs and shapes them the
// way pdf.js expects: { cover, back, pages: { [n]: url } }.
async function imagesForStory(storyId) {
  const db = admin()
  const { data } = await db
    .from('ouay_image_jobs')
    .select('job_key, page_number, image_url, status')
    .eq('story_id', storyId)
  const out = { cover: null, back: null, pages: {} }
  for (const row of data || []) {
    if (!row.image_url) continue
    if (row.page_number === 0) out.cover = row.image_url
    else if (row.page_number === 99) out.back = row.image_url
    else out.pages[row.page_number] = row.image_url
  }
  return out
}

// Assembles every PDF an order needs, uploads them to ouay-pdfs, writes the
// URLs back onto the order, and returns them (plus the ebook bytes so the
// caller can attach the ebook to the delivery email without re-fetching).
export async function assembleOrderPdfs(order) {
  const db = admin()
  const product = PRODUCTS[order.product_type]
  if (!product) throw new Error(`unknown product_type ${order.product_type}`)

  const { data: stories, error } = await db
    .from('ouay_stories')
    .select('*')
    .eq('order_id', order.id)
    .order('story_number', { ascending: true })
  if (error) throw new Error(`failed to load stories: ${error.message}`)

  const printStories = (stories || []).filter((s) => !s.is_ebook)
  const ebookStories = (stories || []).filter((s) => s.is_ebook)

  const result = { interior_pdf_url: null, cover_pdf_url: null, ebook_pdf_url: null, ebookBytes: null }
  const patch = { updated_at: new Date().toISOString() }

  // ── Print interior + cover ────────────────────────────────────────────────
  if (product.printCount > 0 && printStories.length) {
    const interiorBytes = await buildBookPdf(order, printStories, imagesForStory)
    result.interior_pdf_url = await uploadPublic('ouay-pdfs', `${order.id}/interior.pdf`, interiorBytes, 'application/pdf')
    patch.interior_pdf_url = result.interior_pdf_url

    const coverBytes = await buildCoverPdf(order, printStories[0], imagesForStory)
    result.cover_pdf_url = await uploadPublic('ouay-pdfs', `${order.id}/cover.pdf`, coverBytes, 'application/pdf')
    patch.cover_pdf_url = result.cover_pdf_url
  }

  // ── Ebook (all ebook stories combined into one PDF) ───────────────────────
  if (product.ebookCount > 0 && ebookStories.length) {
    const ebookBytes = await buildBookPdf(order, ebookStories, imagesForStory)
    result.ebookBytes = ebookBytes
    result.ebook_pdf_url = await uploadPublic('ouay-pdfs', `${order.id}/ebook.pdf`, ebookBytes, 'application/pdf')
    patch.ebook_pdf_url = result.ebook_pdf_url
  }

  const { error: updErr } = await db.from('ouay_orders').update(patch).eq('id', order.id)
  if (updErr) throw new Error(`failed to save PDF urls: ${updErr.message}`)

  return result
}
