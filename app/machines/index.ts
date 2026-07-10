import type { MachineDef } from '../engine/types'
import { CANAL_ROYALE } from './canal-royale'
import { DRAGONS_HOARD } from './dragons-hoard'
import { THUNDER_VAULT } from './thunder-vault'
import { RUBY_OF_GARGOYLE } from './ruby-of-gargoyle'
import { DIAMOND_DOUBLER } from './diamond-doubler'
import { SEVENS_ABLAZE } from './sevens-ablaze'
import { SERIES_E_3LINE } from './series-e-3line'
import { SERIES_E_MULTIPLIER } from './series-e-multiplier'
import { STOCK_RUSH } from './stock-rush'
import { FLAMEOUT_21 } from './flameout-21'
import { STOP_AND_LOCK_777 } from './stop-and-lock-777'
import { TEMPLE_OF_GOLD } from './temple-of-gold'
import { WONDER_WHEEL } from './wonder-wheel'

/**
 * The FEATURED headliner — the big card above the selection grid. CURATED on
 * purpose (not date-rotated): revolving the spotlight is a one-line change
 * here plus a copy entry in components/floor/featuredCopy.ts. Past headliners
 * keep their copy so they can return.
 */
export const FEATURED_ID = 'wonder-wheel'

// The floor — the machines shown on the selection screen (and the ones the Sim Lab
// lists and `verify` checks).
export const FLOOR: MachineDef[] = [
  WONDER_WHEEL, // ★ Featured — the 1996 wheel archetype, wedge weights on the glass
  TEMPLE_OF_GOLD, // former Featured — the free-play cascade trainer
  CANAL_ROYALE,
  DRAGONS_HOARD,
  THUNDER_VAULT,
  RUBY_OF_GARGOYLE,
  DIAMOND_DOUBLER,
  SEVENS_ABLAZE,
  SERIES_E_3LINE,
  SERIES_E_MULTIPLIER,
  STOCK_RUSH
]

// Parked machines — kept in the codebase (and resolvable + tested) but OFF the
// floor. Flameout 21 (blackjack-meets-crash) was a good exercise but isn't fun as a
// slot: a risk-free cashable launch at a real (sub-100%) RTP forces low payoff for
// high risk. Its full rework is preserved on the `flameout-21-parked` branch.
//
// Stop & Lock 777 (the lock-reel hold-and-spin) shipped, but the owner found it
// still didn't feel fun — even a technically-sound stop-the-reels + collecting
// payoff is a hard sell at a real house edge. A spins-economy redesign (3-reel,
// $1/spin, free-spin snowball, 777 luck multiplier) was explored on the
// `lock-reel-kitsch` branch but also didn't land. The shipped def stays here so its
// engine family, components, and tests keep working for a possible future revisit.
export const PARKED: MachineDef[] = [FLAMEOUT_21, STOP_AND_LOCK_777]

// Every machine the store can resolve (floor + parked). The floor screen, Sim Lab,
// and `verify` iterate FLOOR; the store resolves ALL_MACHINES so a parked game can
// still be loaded directly (and stays covered by its tests).
export const ALL_MACHINES: MachineDef[] = [...FLOOR, ...PARKED]
