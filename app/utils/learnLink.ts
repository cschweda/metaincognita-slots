// app/utils/learnLink.ts
// Every cabinet points back at the /learn explainer that demystifies it — the
// game→learn half of the teaching loop (the learn→game half lives on the learn
// pages themselves).
import type { MachineDef } from '~/engine'

export interface LearnLink { to: string, label: string }

/** Machines whose own feature has a dedicated deep-dive page. */
const BY_ID: Record<string, LearnLink> = {
  'ruby-of-gargoyle': { to: '/learn/gargoyles-eye', label: 'how the Gargoyle\'s Eye multiplier adds up' },
  'dragons-hoard': { to: '/learn/hold-and-spin', label: 'the hold & spin fill math' },
  'thunder-vault': { to: '/learn/hold-and-spin', label: 'the hold & spin fill math' }
}

const BY_FAMILY: Record<MachineDef['family'], LearnLink> = {
  'stepper': { to: '/learn/telnaes-reels', label: 'how virtual reels build near misses' },
  'video': { to: '/learn/ldw-near-miss', label: 'losses disguised as wins, measured live' },
  'bally-em': { to: '/learn/house-edge', label: 'the house edge, machine by machine' },
  'pachislo': { to: '/learn/pachislo', label: 'the flag lottery behind skill stop' },
  'cascade': { to: '/learn/cascade-tumble', label: 'the tumble math' },
  'blackjack-reel': { to: '/learn/house-edge', label: 'the house edge, machine by machine' },
  'lock-reel': { to: '/learn/hold-and-spin', label: 'the hold & spin fill math' },
  'wheel': { to: '/learn/telnaes-reels', label: 'weighted odds behind equal-looking stops' }
}

export function learnLink(def: MachineDef): LearnLink {
  return BY_ID[def.id] ?? BY_FAMILY[def.family]
}
