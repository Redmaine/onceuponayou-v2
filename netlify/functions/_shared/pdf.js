import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// PDF assembly with pdf-lib. Three outputs:
//   buildBookPdf   — the interior (and the ebook, same layout): cover page,
//                    20 illustrated story pages, back-cover blurb page.
//   buildCoverPdf  — the separate full-bleed print cover for BookVault.
//
// Page size is the 216mm x 216mm square used by both print SKUs.
// NOTE: BookVault's exact cover template (bleed margin + spine width per SKU)
// should be confirmed against their spec sheet — buildCoverPdf uses a sensible
// nominal bleed/spine and is flagged in the README launch checklist.

const MM = 2.834645669 // points per millimetre
const PAGE = Math.round(216 * MM) // ~612pt square
const GREEN = rgb(0.12, 0.30, 0.23)
const GOLD = rgb(0.79, 0.64, 0.15)
const INK = rgb(0.17, 0.17, 0.17)

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

// Our page images are stored as PNG; fall back to JPG just in case.
async function embedImage(doc, url) {
  const bytes = await fetchBytes(url)
  try {
    return await doc.embedPng(bytes)
  } catch {
    return await doc.embedJpg(bytes)
  }
}

// Greedy word-wrap to a max width at a given font size.
function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCentred(page, text, font, size, y, colour, maxWidth) {
  const lines = wrapText(text, font, size, maxWidth)
  let cursor = y
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size)
    page.drawText(line, { x: (PAGE - w) / 2, y: cursor, size, font, color: colour })
    cursor -= size * 1.35
  }
  return cursor
}

// imagesFor(storyId) must return { cover, back, pages: { [n]: url } }.
async function renderStory(doc, order, story, images, serif, serifBold) {
  const theme = story.theme || order.theme || ''

  // ── Cover page: title, hero name, theme, cover illustration behind ────────
  {
    const page = doc.addPage([PAGE, PAGE])
    if (images.cover) {
      try {
        const img = await embedImage(doc, images.cover)
        page.drawImage(img, { x: 0, y: 0, width: PAGE, height: PAGE })
        // Soft band behind the title for legibility.
        page.drawRectangle({ x: 0, y: PAGE - 190, width: PAGE, height: 190, color: rgb(1, 1, 1), opacity: 0.72 })
      } catch { /* cover image missing — text-only cover */ }
    }
    drawCentred(page, story.title || `${order.hero_name}'s Story`, serifBold, 30, PAGE - 70, GREEN, PAGE - 100)
    drawCentred(page, order.hero_name || '', serif, 18, PAGE - 130, GOLD, PAGE - 120)
    if (theme) drawCentred(page, theme, serif, 12, PAGE - 158, INK, PAGE - 120)
    if (order.dedication) drawCentred(page, order.dedication, serif, 11, 70, INK, PAGE - 120)
  }

  // ── 20 story pages: illustration top 60%, text bottom 40% ─────────────────
  const pages = Array.isArray(story.pages) ? story.pages : []
  for (let n = 1; n <= 20; n++) {
    const page = doc.addPage([PAGE, PAGE])
    const imgUrl = images.pages?.[n]
    const textBlockHeight = PAGE * 0.4
    if (imgUrl) {
      try {
        const img = await embedImage(doc, imgUrl)
        page.drawImage(img, { x: 0, y: textBlockHeight, width: PAGE, height: PAGE - textBlockHeight })
      } catch { /* page image missing — leave the top blank */ }
    }
    const pageData = pages.find((p) => Number(p.page_number) === n)
    const text = String(pageData?.text || '')
    // Vertically centre the text within the bottom 40% block.
    const size = 16
    const lines = wrapText(text, serif, size, PAGE - 90)
    const blockH = lines.length * size * 1.4
    let cursor = textBlockHeight / 2 + blockH / 2 - size
    for (const line of lines) {
      const w = serif.widthOfTextAtSize(line, size)
      page.drawText(line, { x: (PAGE - w) / 2, y: cursor, size, font: serif, color: INK })
      cursor -= size * 1.4
    }
  }

  // ── Back-cover blurb page ─────────────────────────────────────────────────
  {
    const page = doc.addPage([PAGE, PAGE])
    if (images.back) {
      try {
        const img = await embedImage(doc, images.back)
        page.drawImage(img, { x: 0, y: 0, width: PAGE, height: PAGE })
        page.drawRectangle({ x: 40, y: PAGE / 2 - 120, width: PAGE - 80, height: 240, color: rgb(1, 1, 1), opacity: 0.8 })
      } catch { /* no back image */ }
    }
    drawCentred(page, story.back_cover_blurb || '', serif, 15, PAGE / 2 + 70, INK, PAGE - 130)
  }
}

// Builds a complete book PDF (interior or ebook) covering one or more stories.
export async function buildBookPdf(order, stories, imagesFor) {
  const doc = await PDFDocument.create()
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  for (const story of stories) {
    const images = await imagesFor(story.id)
    await renderStory(doc, order, story, images, serif, serifBold)
  }
  return await doc.save()
}

// Full-bleed print cover for BookVault: back (left) | spine | front (right).
export async function buildCoverPdf(order, story, imagesFor) {
  const doc = await PDFDocument.create()
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const bleed = Math.round(3 * MM)
  const spine = Math.round(8 * MM) // nominal — confirm against BookVault SKU spec
  const width = PAGE * 2 + spine + bleed * 2
  const height = PAGE + bleed * 2
  const page = doc.addPage([width, height])
  page.drawRectangle({ x: 0, y: 0, width, height, color: GREEN })

  const images = await imagesFor(story.id)

  // Front (right panel) — cover illustration + title.
  const frontX = bleed + PAGE + spine
  if (images.cover) {
    try {
      const img = await embedImage(doc, images.cover)
      page.drawImage(img, { x: frontX, y: bleed, width: PAGE, height: PAGE })
    } catch { /* text-only front */ }
  }
  page.drawRectangle({ x: frontX, y: bleed + PAGE - 150, width: PAGE, height: 150, color: rgb(1, 1, 1), opacity: 0.72 })
  {
    const title = story.title || `${order.hero_name}'s Story`
    const size = 26
    const lines = wrapText(title, serifBold, size, PAGE - 60)
    let cursor = bleed + PAGE - 46
    for (const line of lines) {
      const w = serifBold.widthOfTextAtSize(line, size)
      page.drawText(line, { x: frontX + (PAGE - w) / 2, y: cursor, size, font: serifBold, color: GREEN })
      cursor -= size * 1.25
    }
    const hero = order.hero_name || ''
    const hw = serif.widthOfTextAtSize(hero, 15)
    page.drawText(hero, { x: frontX + (PAGE - hw) / 2, y: cursor, size: 15, font: serif, color: GOLD })
  }

  // Spine — title, rotated.
  {
    const title = story.title || 'Once Upon A You'
    page.drawText(title.slice(0, 40), {
      x: bleed + PAGE + spine / 2 + 5,
      y: bleed + 40,
      size: 12,
      font: serifBold,
      color: GOLD,
      rotate: { type: 'degrees', angle: 90 },
    })
  }

  // Back (left panel) — blurb.
  {
    const size = 14
    const lines = wrapText(story.back_cover_blurb || '', serif, size, PAGE - 100)
    let cursor = height / 2 + (lines.length * size * 1.4) / 2
    for (const line of lines) {
      const w = serif.widthOfTextAtSize(line, size)
      page.drawText(line, { x: bleed + (PAGE - w) / 2, y: cursor, size, font: serif, color: rgb(0.95, 0.93, 0.85) })
      cursor -= size * 1.4
    }
  }

  return await doc.save()
}
