import type { MachineDef } from '~/engine/types'

/**
 * A short, floor-card payline/ways descriptor — a real Vegas signpost.
 * Video lines machines show their active-line count; ways machines the ways
 * count (3 rows ^ reels). Bally lines machines show paylines. Steppers are
 * single-line; pachislo is skill-stop; the crash machine has no paylines.
 *
 * Note on `series-e-3line`: it is a `bally-em` `payMode: 'lines'` machine with
 * `maxCoins: 3` (one coin lights one of its three paylines), so the generic
 * bally-em branch already yields '3 LINES' — matching its real three scoring
 * lines. No special-case is needed here.
 */
export function payTag(def: MachineDef): string {
  switch (def.family) {
    case 'video':
      return def.betMode.kind === 'lines' ? `${def.betMode.lines.length} LINES` : `${3 ** def.strips.length} WAYS`
    case 'bally-em':
      return def.payMode === 'lines' ? `${def.maxCoins} LINES` : 'SINGLE LINE'
    case 'stepper':
      return 'SINGLE LINE'
    case 'pachislo':
      return '3-REEL SKILL'
    case 'blackjack-reel':
      return 'STOP & CLIMB'
    case 'lock-reel':
      return 'STOP & LOCK'
    case 'cascade':
      return 'PAY ANYWHERE'
    case 'wheel':
      return 'LINE + TOPPER'
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled family ${(exhaustive as MachineDef).family}`)
    }
  }
}
