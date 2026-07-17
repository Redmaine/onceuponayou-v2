// Fixed adventure theme list + story-type definitions. Shared by the order
// form (theme picker, story-type step) and referenced server-side for the
// randomised-ebook-theme rule on bundle products.

export const ADVENTURE_THEMES = [
  'Enchanted Forest',
  'Fairy Garden',
  'Under the Sea',
  'Space Adventure',
  'Dinosaur Land',
  'Pirate Quest',
  'Dragon Kingdom',
  'Rainbow Valley',
  'Secret Garden',
  'Arctic Explorer',
  'Jungle Safari',
  'Castle Adventure',
]

export const STORY_TYPES = [
  {
    id: 'adventure',
    label: 'Adventure',
    tagline: 'A quest with your child as the hero',
    description:
      'Your child sets off on a quest, faces a real obstacle, and finds their own way through it — a triumphant journey home where they solved it themselves.',
  },
  {
    id: 'love',
    label: 'Love & Connection',
    tagline: 'A single shared day, love shown not told',
    description:
      'A gentle story about one shared day, where love shows up in small, specific, ordinary moments — never stated outright, always felt.',
  },
  {
    id: 'growing',
    label: 'Growing & Becoming',
    tagline: 'Discovering the strength was inside all along',
    description:
      'Your child discovers the courage or kindness they needed was inside them the whole time — a warm, open ending, a door opening rather than closing.',
  },
]

export function storyTypeLabel(id) {
  return STORY_TYPES.find((t) => t.id === id)?.label || id
}

// Pick `count` ebook themes at random, excluding any print themes already
// chosen. Used server-side for bundle products (system randomises the ebook
// themes) so a bundle's ebook doesn't repeat the printed book's theme.
export function randomEbookThemes(count, excludeThemes = []) {
  const exclude = new Set(excludeThemes.filter(Boolean))
  const pool = ADVENTURE_THEMES.filter((t) => !exclude.has(t))
  const picked = []
  const working = [...pool]
  for (let i = 0; i < count && working.length; i++) {
    const idx = Math.floor(Math.random() * working.length)
    picked.push(working.splice(idx, 1)[0])
  }
  return picked
}
