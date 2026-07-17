import Anthropic from '@anthropic-ai/sdk'

// Story generation. Uses Claude to write a 20-page personalised picture-book
// story, then runs a deterministic sense check and retries once on failure.
//
// NOTE ON MODEL ID: the brief specified 'claude-sonnet-4-6'. That is kept
// verbatim here as the single STORY_MODEL constant. If the Anthropic account
// returns a 404/model-not-found, update this one line to a current Sonnet id
// (e.g. 'claude-sonnet-5') — flagged in the README's launch checklist.
export const STORY_MODEL = 'claude-sonnet-4-6'

function anthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
}

// Max pages (out of 20) on which the hero's name may appear, by age band.
function nameLimitForAge(age) {
  const a = Number(age) || 5
  if (a <= 3) return 8
  if (a <= 5) return 10
  return 12
}

const STORY_TYPE_RULES = {
  adventure: `STORY TYPE: ADVENTURE.
The child is the hero of a quest. There is a clear obstacle. The child overcomes it THEMSELVES and returns home triumphant.
FORBIDDEN: a passive child; an adult solving the problem; telling instead of showing; generic, interchangeable quest beats.`,
  love: `STORY TYPE: LOVE & CONNECTION.
A single shared day. Love is shown through specific, ordinary moments — never stated. Tonal touchstones: "Owl Babies", "The Invisible String". Do NOT use a "Guess How Much I Love You" escalation structure.
FORBIDDEN: the words "I love you"; any direct statement of love; grand gestures; a parent rescuing the child.`,
  growing: `STORY TYPE: GROWING & BECOMING.
The child discovers the strength was inside them all along. The ending is a door opening, not closing.
FORBIDDEN: an adult handing over the answer; the child failing repeatedly; a closing/final ending; the phrase "and they never forgot".`,
}

function buildSystemPrompt(order) {
  const nameLimit = nameLimitForAge(order.hero_age)
  const typeRules = STORY_TYPE_RULES[order.story_type] || STORY_TYPE_RULES.adventure
  return `You are a master children's picture-book author writing a deeply personal, warm, age-appropriate story for one specific child. Your writing is gentle, specific and emotionally true — never generic, never saccharine, never preachy.

${typeRules}

STRUCTURE (follow exactly):
- Exactly 20 pages of story text.
- Each page: 2 to 3 short sentences maximum, using language appropriate for a ${order.hero_age}-year-old.
- Give the book a title (for the cover) and a back-cover blurb of 3–4 sentences in third person, with no spoilers.
- Use the hero's name NATURALLY and sparingly — not on every page. The name may appear on AT MOST ${nameLimit} of the 20 pages.
- The ending must be warm and OPEN, never a hard "closing" ending. For growing stories especially, end on opening words, not closing ones.
- For every page, also write an "illustration_prompt": a specific, concrete visual scene description for that page (what is happening, where, the mood). Describe the scene only — never mention any text, words or letters appearing in the image.

Return your answer by calling the submit_story tool. Do not include any other commentary.`
}

function buildUserMessage(order, theme) {
  const lines = [
    `Hero's name: ${order.hero_name}`,
    `Age: ${order.hero_age}`,
    `Gender: ${order.hero_gender}`,
  ]
  if (theme) lines.push(`Theme / setting: ${theme}`)
  if (order.dedication) lines.push(`(A dedication will be printed separately; do not include it in the story.)`)
  lines.push('', 'Write this child their story now.')
  return lines.join('\n')
}

const STORY_TOOL = {
  name: 'submit_story',
  description: 'Submit the finished personalised story.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      pages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            page_number: { type: 'integer' },
            text: { type: 'string' },
            illustration_prompt: { type: 'string' },
          },
          required: ['page_number', 'text', 'illustration_prompt'],
        },
      },
      back_cover_blurb: { type: 'string' },
    },
    required: ['title', 'pages', 'back_cover_blurb'],
  },
}

async function callClaudeForStory(order, theme) {
  const client = anthropic()
  const msg = await client.messages.create({
    model: STORY_MODEL,
    max_tokens: 4000,
    system: buildSystemPrompt(order),
    tools: [STORY_TOOL],
    tool_choice: { type: 'tool', name: 'submit_story' },
    messages: [{ role: 'user', content: buildUserMessage(order, theme) }],
  })
  const toolUse = (msg.content || []).find((b) => b.type === 'tool_use')
  if (!toolUse?.input) throw new Error('Claude did not return a submit_story tool call')
  return toolUse.input
}

// Deterministic sense check. Returns { passed, errors: [] }.
export function senseCheck(story, order) {
  const errors = []
  const pages = Array.isArray(story?.pages) ? story.pages : []

  if (pages.length !== 20) {
    errors.push(`Expected exactly 20 pages, got ${pages.length}.`)
  }

  const name = String(order.hero_name || '').trim()
  if (name) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const namePages = pages.filter((p) => re.test(String(p?.text || ''))).length
    const limit = nameLimitForAge(order.hero_age)
    if (namePages > limit) {
      errors.push(`Hero name appears on ${namePages} pages; limit for age ${order.hero_age} is ${limit}.`)
    }
  }

  // Warm, open ending heuristic — flag hard "closing" phrases on the last page.
  const last = String(pages[pages.length - 1]?.text || '').toLowerCase()
  const closingPhrases = ['the end', 'happily ever after', 'never forgot', 'and that was that', 'forever and ever, the end']
  const hit = closingPhrases.find((ph) => last.includes(ph))
  if (hit) errors.push(`Ending uses a closing phrase ("${hit}"); endings must be warm and open.`)

  // Very light inappropriate-content guard.
  const banned = ['kill', 'blood', 'gun', 'dead body', 'hate you']
  const allText = pages.map((p) => String(p?.text || '')).join(' ').toLowerCase()
  const badWord = banned.find((w) => allText.includes(w))
  if (badWord) errors.push(`Possible inappropriate content flagged ("${badWord}") — review manually.`)

  return { passed: errors.length === 0, errors }
}

// Generates one story with a single automatic retry if the sense check fails.
// Always returns a story object plus the sense-check outcome — even a failed
// second attempt is returned (flagged) so the admin can review rather than the
// order silently stalling.
export async function generateStory(order, theme) {
  let story = await callClaudeForStory(order, theme)
  let check = senseCheck(story, order)
  if (!check.passed) {
    try {
      const retry = await callClaudeForStory(order, theme)
      const retryCheck = senseCheck(retry, order)
      // Keep whichever attempt passed; if neither did, keep the retry and
      // surface its errors for manual review.
      if (retryCheck.passed || retryCheck.errors.length <= check.errors.length) {
        story = retry
        check = retryCheck
      }
    } catch {
      // Retry itself failed — keep the first attempt and its errors.
    }
  }
  return { story, senseCheckPassed: check.passed, senseCheckErrors: check.errors }
}
