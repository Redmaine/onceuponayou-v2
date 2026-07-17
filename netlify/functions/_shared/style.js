// The single art-style lock + character-consistency machinery. Every image
// prompt in the pipeline BEGINS with STYLE_LOCK, then the hero clause, then
// the scene — leading text carries the most weight with the image model, so
// locking it is what keeps all 22 pages of a book reading as one consistent
// painterly picture book.

export const STYLE_LOCK =
  "warm soft painterly children's book illustration, like a premium picture " +
  'book, gentle brush strokes, rich vibrant colours, soft golden lighting, ' +
  'no photorealism, no cartoon flat style, no 3D render, no anime — ' +
  'painterly picture book only'

// A written description of the child, built from the order fields. Used both
// in the character-reference prompt and (via heroClause) on every page.
export function characterDescription(order) {
  const age = order.hero_age || 5
  let gender = String(order.hero_gender || 'child').toLowerCase()
  if (gender !== 'boy' && gender !== 'girl') gender = 'child'

  const bits = [`a ${age}-year-old ${gender}`]
  if (order.hero_hair && String(order.hero_hair).trim()) {
    bits.push(`with ${String(order.hero_hair).trim()} hair`)
  }
  if (order.hero_skin && String(order.hero_skin).trim()) {
    bits.push(`${String(order.hero_skin).trim()} skin`)
  }
  if (order.hero_features && String(order.hero_features).trim()) {
    bits.push(String(order.hero_features).trim())
  }
  return bits.join(', ')
}

// The character-reference portrait prompt. Generated ONCE per order into
// hero_ref_url, then reused as the input image on every page.
export function characterReferencePrompt(order) {
  const desc = characterDescription(order)
  return (
    `${STYLE_LOCK}. illustrated storybook character portrait, front-facing, ` +
    `${desc}, warm friendly expression, clean simple background, ` +
    `full body visible, children's book illustration style`
  )
}

// Prepended to EVERY page prompt, unconditionally, so the model is told to
// hold the character constant and to lean on the reference image.
export function heroClause(order) {
  const desc = characterDescription(order)
  return (
    `The child hero is ${desc}. Use the provided reference image to maintain ` +
    'exact visual consistency for this character throughout. Same face, ' +
    'same hair, same clothing on every page.'
  )
}

// Full page prompt = STYLE LOCK + hero clause + this page's scene text.
export function pagePrompt(order, sceneText) {
  return `${STYLE_LOCK}. ${heroClause(order)} ${String(sceneText || '').trim()}`
}
