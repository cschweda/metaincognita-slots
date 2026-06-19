import type { CascadeMachineDef } from '../engine/types'

/**
 * Temple of Gold — the floor's Featured cascade (tumble) machine and its first
 * FREE-PLAY trainer. A symbol landing 8+ times anywhere on the 5×4 grid pays
 * (scatter / pay-anywhere), shatters, and the survivors tumble down while fresh
 * symbols drop in — chaining up the ×1/×2/×3/×5/×8 ladder, all in one bet. Six
 * golden idols light the Grand.
 *
 * The cabinet runs this real engine but never debits a balance: an honest House
 * Ledger shows, in real dollars, exactly what a $1/spin player WOULD have fed,
 * won, and lost (settling toward the true ~90% RTP), and a trick-exposer X-rays
 * every spin. The kitsch and spectacle are the point; the loss is only ever a
 * stated fact, never inflicted.
 *
 * Exact RTP via the absorbing-Markov tumble DP (4 paying symbols + idol keep the
 * state space tractable; minMatch 8 keeps cascades shallow). Frozen math: see
 * tests/machines-cascade.test.ts, verified by exactRtp + pnpm verify.
 */
export const TEMPLE_OF_GOLD: CascadeMachineDef = {
  id: 'temple-of-gold',
  name: 'Temple of Gold',
  family: 'cascade',
  denominationCents: 1,
  maxCoins: 100, // a flat $1.00 bet at 1¢/credit
  cols: 5,
  rows: 4,
  minMatch: 8,
  maxTumbles: 5,
  // Four paying treasures + the rare Golden Idol scatter.
  weights: { MASK: 26, JAGUAR: 25, CROWN: 24, GOLD: 22, IDOL: 3 },
  paytable: {
    MASK: [{ countAtLeast: 8, pay: 0.50 }, { countAtLeast: 10, pay: 1.50 }, { countAtLeast: 12, pay: 5.00 }],
    JAGUAR: [{ countAtLeast: 8, pay: 0.38 }, { countAtLeast: 10, pay: 1.12 }, { countAtLeast: 12, pay: 3.75 }],
    CROWN: [{ countAtLeast: 8, pay: 0.28 }, { countAtLeast: 10, pay: 0.82 }, { countAtLeast: 12, pay: 2.75 }],
    GOLD: [{ countAtLeast: 8, pay: 0.20 }, { countAtLeast: 10, pay: 0.60 }, { countAtLeast: 12, pay: 2.00 }]
  },
  multiplierLadder: [1, 2, 3, 5, 8],
  idolSymbol: 'IDOL',
  grandTrigger: 6,
  progressive: { kind: 'percent', reset: 10_000, max: 100_000, feedRate: 0.01 },
  symbols: {
    MASK: { label: 'Jade Mask', icon: 'mask' },
    JAGUAR: { label: 'Jaguar', icon: 'lion' },
    CROWN: { label: 'Sun Crown', icon: 'crown' },
    GOLD: { label: 'Gold Bar', icon: 'ingot' },
    IDOL: { label: 'Golden Idol', icon: 'grand' }
  },
  history: 'A gaudy Aztec-gold cascade in the lineage of the great tumble machines '
    + '(Gonzo\'s Quest, Sweet Bonanza): winning symbols shatter, survivors fall, '
    + 'fresh ones drop in, and the multiplier climbs — all inside one bet. Here it '
    + 'is rebuilt as the floor\'s honest, free-play trainer: the same maths a real '
    + 'machine runs, but the only thing it ever takes from you is the illusion.'
}
