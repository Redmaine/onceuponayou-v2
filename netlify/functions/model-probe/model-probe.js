// TEMPORARY read-only diagnostic — checks the real Anthropic response for
// STORY_MODEL using the real production ANTHROPIC_API_KEY. No order data
// touched. Deleted after use.
export async function handler(event) {
  const secret = event.headers?.['x-admin-secret'] || event.headers?.['X-Admin-Secret']
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorised' }) }
  }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { statusCode: 200, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Say OK.' }],
    }),
  })
  const body = await r.json()
  return { statusCode: 200, body: JSON.stringify({ status: r.status, body }, null, 2) }
}
