// Replicate — FLUX Kontext Pro (black-forest-labs/flux-kontext-pro).
//
// Kontext Pro is an image-editing model: pass an input_image and it keeps that
// subject consistent while re-composing to the prompt. That's exactly how we
// hold the child hero constant across all 22 pages — every page is generated
// with the character reference as input_image. The character reference itself
// is generated either from the uploaded photo (image-to-image) or from the
// text description alone (text-to-image, no input_image).

const KONTEXT_PRO_URL =
  'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions'

function token() {
  const t = process.env.REPLICATE_API_TOKEN
  if (!t) throw new Error('REPLICATE_API_TOKEN not set')
  return t
}

// Submits a prediction and returns the raw prediction object (includes id and
// status). inputImageUrl is optional — omit it for pure text-to-image.
export async function submitKontext(prompt, inputImageUrl) {
  const input = {
    prompt,
    aspect_ratio: '1:1',
    output_format: 'png',
    safety_tolerance: 2,
  }
  if (inputImageUrl) input.input_image = inputImageUrl

  const res = await fetch(KONTEXT_PRO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Replicate submit ${res.status}: ${detail.slice(0, 300)}`)
  }
  return await res.json()
}

// Fetches a prediction's current state by id.
export async function getPrediction(predictionId) {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Replicate poll ${res.status}: ${detail.slice(0, 300)}`)
  }
  return await res.json()
}

// The output of flux-kontext-pro is a single image URL (sometimes wrapped in a
// one-element array). Normalise it.
export function predictionImageUrl(prediction) {
  const out = prediction?.output
  if (!out) return null
  return Array.isArray(out) ? out[0] : out
}

// Submits and polls to completion — only for the single, synchronous
// character-reference image (in a background function with a long timeout).
// Page images are NOT generated this way; they go through the async queue.
export async function generateAndWait(prompt, inputImageUrl, timeoutMs = 180000) {
  const submitted = await submitKontext(prompt, inputImageUrl)
  const deadline = Date.now() + timeoutMs
  let id = submitted.id
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const p = await getPrediction(id)
    if (p.status === 'succeeded') {
      const url = predictionImageUrl(p)
      if (!url) throw new Error('Replicate succeeded but returned no image URL')
      return url
    }
    if (p.status === 'failed' || p.status === 'canceled') {
      throw new Error(`Replicate ${p.status}: ${p.error || 'unknown'}`)
    }
  }
  throw new Error('Replicate prediction timed out')
}
