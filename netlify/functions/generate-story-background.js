import { admin } from './_shared/supabase.js'
import { json } from './_shared/http.js'
import { generateStory } from './_shared/story.js'
import { ensureCharacterReference, queueStoryImageJobs } from './_shared/imageJobs.js'
import { PRODUCTS, isHardcoverProduct } from '../../src/lib/products.js'
import { STORY_TYPES, randomEbookThemes } from '../../src/lib/themes.js'

// Fixed sequence for the hardcover family's 3-story collection: adventure,
// love, growing (STORY_TYPES' natural order) — every hardcover binds one of
// each rather than the customer picking a single story type.
const HARDCOVER_STORY_TYPES = STORY_TYPES.map((t) => t.id)

// Background function (filename ends -background → up to 15 min runtime).
// Orchestrates: story text → sense check → save stories → character reference
// → queue 22 image jobs per story. Triggered by the Stripe webhook.
export async function handler(event) {
  // Simple internal gate — only the webhook (which passes INTERNAL_SECRET)
  // and admin tools may trigger generation.
  const secret = event.headers?.['x-admin-secret'] || event.headers?.['X-Admin-Secret']
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return json(401, { error: 'Unauthorised' })
  }

  let orderRef
  try { orderRef = JSON.parse(event.body || '{}').order_ref } catch { /* ignore */ }
  if (!orderRef) return json(400, { error: 'order_ref required' })

  const db = admin()
  const { data: order } = await db.from('ouay_orders').select('*').eq('order_ref', orderRef).maybeSingle()
  if (!order) return json(404, { error: `no order ${orderRef}` })

  // Only generate for a freshly-paid order (or a retry of one still generating).
  if (!['paid', 'generating'].includes(order.status)) {
    return json(200, { skipped: true, status: order.status })
  }
  await db.from('ouay_orders').update({ status: 'generating', updated_at: new Date().toISOString() }).eq('id', order.id)

  const product = PRODUCTS[order.product_type]
  if (!product) return json(400, { error: `unknown product_type ${order.product_type}` })
  const hardcoverFamily = isHardcoverProduct(order.product_type)

  // ── Resolve the theme + story type for each story ──────────────────────────
  // Print story uses the customer's chosen theme. Ebook themes: for an
  // ebook-only product the customer picked them (theme/theme2/theme3); for a
  // bundle the system randomises them, excluding the print theme.
  //
  // story_type is order.story_type for every story UNLESS this is a hardcover
  // product, in which case each story gets the next entry in the fixed
  // adventure/love/growing sequence — the print stories first, then any bonus
  // ebook stories continuing the same cycle.
  const planned = []
  for (let i = 0; i < product.printCount; i++) {
    planned.push({
      theme: order.theme || 'Enchanted Forest',
      story_type: hardcoverFamily ? HARDCOVER_STORY_TYPES[i % HARDCOVER_STORY_TYPES.length] : order.story_type,
      is_ebook: false,
    })
  }
  if (product.ebookCount > 0) {
    let ebookThemes
    if (product.printCount === 0) {
      const chosen = [order.theme, order.theme2, order.theme3].filter(Boolean)
      ebookThemes = []
      for (let i = 0; i < product.ebookCount; i++) {
        ebookThemes.push(chosen[i] || randomEbookThemes(1, chosen.concat(ebookThemes))[0])
      }
    } else {
      ebookThemes = randomEbookThemes(product.ebookCount, [order.theme])
    }
    ebookThemes.forEach((theme, i) => {
      planned.push({
        theme,
        story_type: hardcoverFamily ? HARDCOVER_STORY_TYPES[i % HARDCOVER_STORY_TYPES.length] : order.story_type,
        is_ebook: true,
      })
    })
  }

  try {
    // ── Generate + save each story ──────────────────────────────────────────
    const savedStories = []
    let storyNumber = 1
    for (const plan of planned) {
      const { story, senseCheckPassed, senseCheckErrors } = await generateStory(order, plan.theme, plan.story_type)
      const { data: inserted, error } = await db
        .from('ouay_stories')
        .insert({
          order_id: order.id,
          story_number: storyNumber,
          hero_name: order.hero_name,
          theme: plan.theme,
          story_type: plan.story_type,
          title: story.title,
          pages: story.pages,
          back_cover_blurb: story.back_cover_blurb,
          sense_check_passed: senseCheckPassed,
          sense_check_errors: senseCheckErrors.length ? senseCheckErrors : null,
          is_ebook: plan.is_ebook,
          status: 'text_complete',
        })
        .select('*')
        .single()
      if (error) throw new Error(`failed to save story ${storyNumber}: ${error.message}`)
      savedStories.push(inserted)
      storyNumber++
    }

    // ── Character reference (once), then queue all image jobs ────────────────
    await ensureCharacterReference(order)
    for (const story of savedStories) {
      await queueStoryImageJobs(order, story)
    }

    await db.from('ouay_orders').update({ status: 'images_pending', updated_at: new Date().toISOString() }).eq('id', order.id)
    return json(200, { ok: true, stories: savedStories.length })
  } catch (e) {
    console.error(`generate-story failed for ${orderRef}:`, e.message)
    await db.from('ouay_orders').update({ status: 'generation_failed', updated_at: new Date().toISOString() }).eq('id', order.id)
    return json(500, { error: e.message })
  }
}
