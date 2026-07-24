// Markdown-file-based blog loader (Vite).
//
// Mirrors the pattern used on the Hormonely / Neuro Decoded sites, adapted for
// Vite: instead of CRA's require.context we use import.meta.glob to pull every
// file in src/blog/ in as raw text at build time. Adding a new src/blog/*.md
// file (which is exactly what the ops platform's publish-approved-blog edge
// function commits on blog approval) triggers a Netlify rebuild and the post
// appears automatically — no code change needed.
//
// Post bodies from the ops pipeline are already HTML (the edge function writes
// the stored content_html straight into the file body), so a body that looks
// like HTML is rendered as-is. A hand-written body in plain markdown is run
// through a small renderer instead, so both authoring styles work.

const files = import.meta.glob('../blog/*.md', { query: '?raw', import: 'default', eager: true })

function parseFrontmatter(raw) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw)
  if (!match) return { meta: {}, body: raw }
  const [, frontmatter, body] = match
  const meta = {}
  frontmatter.split('\n').forEach((line) => {
    const lineMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim())
    if (!lineMatch) return
    let value = lineMatch[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[lineMatch[1]] = value
  })
  return { meta, body: body.trim() }
}

// Heuristic: if the body already contains block-level HTML it came from the ops
// pipeline (content_html) and should be rendered directly.
function looksLikeHtml(body) {
  return /<(p|h[1-6]|ul|ol|li|div|section|article|img|br|blockquote|strong|em|a)\b/i.test(body)
}

function renderInline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

// Small hand-rolled markdown -> HTML renderer for hand-written posts. Supports
// headings, paragraphs, unordered lists, bold, italic and links — enough for a
// lightweight blog without pulling in a full markdown dependency.
function markdownToHtml(markdown) {
  const lines = markdown.split('\n')
  const html = []
  let listBuffer = []
  const flushList = () => {
    if (listBuffer.length) {
      html.push(`<ul>${listBuffer.map((i) => `<li>${renderInline(i)}</li>`).join('')}</ul>`)
      listBuffer = []
    }
  }
  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) { flushList(); return }
    if (line.startsWith('### ')) { flushList(); html.push(`<h3>${renderInline(line.slice(4))}</h3>`) }
    else if (line.startsWith('## ')) { flushList(); html.push(`<h2>${renderInline(line.slice(3))}</h2>`) }
    else if (line.startsWith('# ')) { flushList(); html.push(`<h2>${renderInline(line.slice(2))}</h2>`) }
    else if (line.startsWith('- ')) { listBuffer.push(line.slice(2)) }
    else { flushList(); html.push(`<p>${renderInline(line)}</p>`) }
  })
  flushList()
  return html.join('\n')
}

function toPost(raw) {
  const { meta, body } = parseFrontmatter(raw)
  return {
    slug: meta.slug || '',
    title: meta.title || 'Untitled',
    date: meta.date || '',
    excerpt: meta.excerpt || '',
    brand: meta.brand || '',
    html: looksLikeHtml(body) ? body : markdownToHtml(body),
  }
}

// All posts, newest first. Anything missing a slug is skipped (can't be routed).
export function getAllPosts() {
  return Object.values(files)
    .map(toPost)
    .filter((p) => p.slug)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function getPost(slug) {
  return getAllPosts().find((p) => p.slug === slug) || null
}
