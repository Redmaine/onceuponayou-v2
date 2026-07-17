import { admin, uploadPublic } from './supabase.js'
import { characterReferencePrompt, pagePrompt } from './style.js'
import { generateAndWait } from './replicate.js'

// Fetches a remote image URL into a Buffer.
async function fetchImageBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch image ${url}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// Generates the ONE character reference for an order (once), stores it in the
// ouay-images bucket, writes hero_ref_url back onto the order, and returns it.
// If a photo was uploaded it's used as the input image (image-to-image);
// otherwise the reference is generated from the text description alone. Idempotent:
// returns the existing hero_ref_url if one is already set.
export async function ensureCharacterReference(order) {
  if (order.hero_ref_url) return order.hero_ref_url

  const db = admin()
  const prompt = characterReferencePrompt(order)
  const replicateUrl = await generateAndWait(prompt, order.hero_photo_url || null)
  const bytes = await fetchImageBytes(replicateUrl)
  const publicUrl = await uploadPublic('ouay-images', `${order.id}/character_ref.png`, bytes, 'image/png')

  const { error } = await db
    .from('ouay_orders')
    .update({ hero_ref_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', order.id)
  if (error) throw new Error(`failed to save hero_ref_url: ${error.message}`)

  order.hero_ref_url = publicUrl
  return publicUrl
}

// Builds the 22 image jobs for one story: cover (page 0), pages 1–20, and
// back cover (page 99). Every job carries hero_ref_url so the queue passes it
// as the input image on every single page — no exceptions.
function buildJobsForStory(order, story) {
  const heroRef = order.hero_ref_url
  const theme = story.theme || order.theme || 'a magical storybook world'
  const jobs = []

  jobs.push({
    order_id: order.id,
    story_id: story.id,
    job_key: `${story.id}:cover`,
    page_number: 0,
    prompt: pagePrompt(
      order,
      `Front cover illustration for a children's picture book titled about ${theme}. The child hero stands proudly, full of wonder, in a beautiful ${theme} scene, with gentle open space near the top of the composition.`,
    ),
    hero_ref_url: heroRef,
    status: 'pending',
  })

  const pages = Array.isArray(story.pages) ? story.pages : []
  for (const page of pages) {
    const n = Number(page.page_number)
    if (!Number.isFinite(n) || n < 1 || n > 20) continue
    jobs.push({
      order_id: order.id,
      story_id: story.id,
      job_key: `${story.id}:page_${n}`,
      page_number: n,
      prompt: pagePrompt(order, page.illustration_prompt || page.text || `A ${theme} scene.`),
      hero_ref_url: heroRef,
      status: 'pending',
    })
  }

  jobs.push({
    order_id: order.id,
    story_id: story.id,
    job_key: `${story.id}:back_cover`,
    page_number: 99,
    prompt: pagePrompt(
      order,
      `Back cover illustration: the child hero calm, happy and at peace, bathed in soft golden light, a gentle resolution of a ${theme} adventure.`,
    ),
    hero_ref_url: heroRef,
    status: 'pending',
  })

  return jobs
}

// Inserts all image jobs for a story. Uses upsert on the unique job_key so a
// re-run (e.g. a retried generate-story) never creates duplicate jobs.
export async function queueStoryImageJobs(order, story) {
  const db = admin()
  const jobs = buildJobsForStory(order, story)
  const { error } = await db.from('ouay_image_jobs').upsert(jobs, { onConflict: 'job_key' })
  if (error) throw new Error(`failed to queue image jobs for story ${story.id}: ${error.message}`)
  return jobs.length
}
