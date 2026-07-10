// app/components/floor/featuredCopy.ts
// Per-machine copy for the FEATURED headliner card. The spotlight REVOLVES by
// curation: point machines/index.ts FEATURED_ID at any id here (one line) —
// past headliners keep their entry so they can return.

export interface FeaturedCopy {
  /** marquee title (the card renders it in the big bulb type) */
  title: string
  tagline: string
  /** decorative reel-window glyphs (aria-hidden) */
  motif: readonly string[]
  facts: readonly string[]
  playLabel: string
  meta: string
}

export const FEATURED_COPY: Record<string, FeaturedCopy> = {
  'wonder-wheel': {
    title: 'WONDER WHEEL',
    tagline: 'The 1996 floor legend reborn: a giant weighted topper wheel — with every wedge weight printed on the glass.',
    motif: ['🎡', '7️⃣', '⭐', '🍒', '💰'],
    facts: [
      '24-wedge topper — armed at MAX COINS only',
      'Wedges drawn equal, weighted unequal — the X-ray shows the true odds',
      'MEGA wedge: 2,500 credits at a published 1-in-55,872',
      '92.49% RTP at max bet · 70.53% under it — the cliff is on the PAR sheet'
    ],
    playLabel: '▼ Play Wonder Wheel',
    meta: '$0.25/credit · wheel arms at max bet · the wedge weights are public'
  },
  'temple-of-gold': {
    title: 'TEMPLE OF GOLD',
    tagline: 'A gaudy Aztec cascade — and the floor\'s honest, free-play trainer. Watch how the machine really works, loss-free.',
    motif: ['🎭', '🐆', '👑', '🪙', '🗿'],
    facts: [
      'Tumbling reels — wins cascade, the multiplier climbs',
      'FREE PLAY — spin forever, lose nothing',
      'A trick-exposer X-rays every single spin',
      'Honest ledger · ~90% RTP shown, taken from no one'
    ],
    playLabel: '▼ Play Temple of Gold',
    meta: '$0.01/credit · free play · the honest machine'
  }
}
