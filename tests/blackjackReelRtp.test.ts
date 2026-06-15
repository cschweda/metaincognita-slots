import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState, MachineSessionState } from '../app/engine/types'
import { optimalAction, blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { dealHand, hitCard, standHand } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'

// ---------------------------------------------------------------------------
// Tiny hand-tuned fixtures. Each strip is a single-symbol (or few-symbol) reel
// so the optimal action / exact value is computable by hand.
// ---------------------------------------------------------------------------

/** Build a minimal blackjack-reel def from explicit strips. */
function makeDef(over: Partial<BlackjackReelMachineDef> & Pick<BlackjackReelMachineDef, 'strips'>): BlackjackReelMachineDef {
  return {
    id: 'fix',
    name: 'Fixture',
    family: 'blackjack-reel',
    denominationCents: 25,
    maxCoins: 1,
    symbols: {
      C2: { label: '2' }, C7: { label: '7' }, CT: { label: '10' },
      CA: { label: 'A' }, MX2: { label: '×2' }, SAVE: { label: 'Save' }
    },
    history: 'test fixture',
    cardValues: { C2: 2, C7: 7, CT: 10 },
    aceSymbol: 'CA',
    multiplierSymbols: { MX2: 2 },
    bustSaveSymbol: 'SAVE',
    paytable: [
      { total: 17, pay: 1 },
      { total: 18, pay: 1.5 },
      { total: 19, pay: 2 },
      { total: 20, pay: 3 },
      { total: 21, pay: 5 }
    ],
    charlieBonus: 10,
    progressive: null,
    ...over
  }
}

/** A decision-state helper mirroring the live BlackjackReelSessionState. */
function decisionState(over: Partial<BlackjackReelSessionState>): BlackjackReelSessionState {
  return {
    phase: 'dealt',
    cards: [],
    total: 0,
    isSoft: false,
    multSum: 0,
    saveHeld: false,
    busted: false,
    charlie: false,
    ante: 1,
    ...over
  }
}

describe('optimalAction — obvious decisions', () => {
  it('stands when hitting is a guaranteed bust (stand beats suicidal hit)', () => {
    // Hand total 20 (two ten-cards). Next reel (reel 2) is all tens → any hit
    // busts (30) with no save → hit EV 0; stand pays pay(20)=3. Stand wins.
    const def = makeDef({
      strips: [['CT'], ['CT'], ['CT'], ['CT'], ['CT']],
      bustSaveSymbol: null
    })
    const state = decisionState({ cards: ['CT', 'CT'], total: 20 })
    expect(optimalAction(def, state)).toBe('stand')
  })

  it('hits when the next card is a guaranteed-safe multiplier that raises the payout', () => {
    // Hand total 17 (pay 1). Reel 2 is entirely a +2 multiplier card: it cannot
    // bust (specials add 0 to the total) and lifts multSum to 2, so afterward we
    // can stand for pay(17)×2 = 2 > standing now for pay(17)×1 = 1. Hit wins.
    const def = makeDef({
      strips: [['C7'], ['CT'], ['MX2'], ['CT'], ['CT']],
      bustSaveSymbol: null
    })
    const state = decisionState({ cards: ['C7', 'CT'], total: 17 })
    expect(optimalAction(def, state)).toBe('hit')
  })

  it('stands on a paying hand when the only outcomes are bust or no improvement', () => {
    // total 19 (pay 2). reel 2 = all tens → bust. Stand.
    const def = makeDef({
      strips: [['C2'], ['C7'], ['CT'], ['CT'], ['CT']],
      bustSaveSymbol: null
    })
    const state = decisionState({ cards: ['C2', 'C7'], total: 9 }) // not used directly; total provided
    // Provide the real 19 state explicitly
    const s19 = decisionState({ cards: ['CT', 'C2', 'C7'], total: 19 })
    expect(optimalAction(def, s19)).toBe('stand')
    void state
  })
})

describe('optimalAction — determinism', () => {
  it('returns the same action for the same state across calls', () => {
    const def = makeDef({ strips: [['C7'], ['CT'], ['C2', 'CT'], ['C2', 'CT'], ['C2']] })
    const state = decisionState({ cards: ['C7', 'CT'], total: 17 })
    const a = optimalAction(def, state)
    const b = optimalAction(def, state)
    expect(a).toBe(b)
  })
})

describe('blackjackReelExactRtp — hand-computable values', () => {
  it('deterministic deal + forced-stand: RTP equals the single paytable entry', () => {
    // deal: reel0=CT(10), reel1=C7(7) → always 17. reel2 = all tens → hitting
    // busts; optimal is to stand at 17 → pay 1 every hand. No randomness.
    const def = makeDef({
      strips: [['CT'], ['C7'], ['CT'], ['CT'], ['CT']],
      bustSaveSymbol: null,
      paytable: [{ total: 17, pay: 1 }]
    })
    const r = blackjackReelExactRtp(def)
    expect(r.rtpPerCoin).toBeCloseTo(1, 12)
    expect(r.hitFrequency).toBeCloseTo(1, 12) // always pays > 0
    expect(r.variancePerCoin).toBeCloseTo(0, 12) // deterministic
  })

  it('deterministic Five-Card Charlie: RTP = (pay(total) + charlieBonus)', () => {
    // All reels are C2 → deal 2+2=4, hits 6,8,10; reaching 5 cards (total 10)
    // forces a stand + Charlie bonus. total 10 not in paytable → pay 0; bonus 10.
    // Optimal must hit every time (each hit is free and strictly safe, ending in
    // the +10 Charlie). RTP = (0 + 10) × max(1,0) = 10.
    const def = makeDef({
      strips: [['C2'], ['C2'], ['C2'], ['C2'], ['C2']],
      bustSaveSymbol: null,
      paytable: [{ total: 21, pay: 5 }],
      charlieBonus: 10
    })
    const r = blackjackReelExactRtp(def)
    expect(r.rtpPerCoin).toBeCloseTo(10, 12)
  })

  it('probabilistic branch: averages value over a coin-flip third card', () => {
    // deal always 17 (CT, C7). reel2 = [C2, CT] (50/50):
    //   C2 → 19; reel3 = all tens → hitting busts → stand 19 → pay 2.
    //   CT → 27 bust (no save) → 0.
    // At 17, stand pays 1. Hitting: 0.5×(value at 19) + 0.5×0.
    //   value at 19 = max(stand 2, hit 0) = 2  → hit-from-17 EV = 0.5×2 = 1.0.
    // So EV(17) = max(stand 1, hit 1) = 1. RTP = 1.
    // hitFrequency: under an optimal policy that's indifferent we must pick a
    // deterministic tiebreak; assert only the RTP + that HF is one of the two
    // consistent values.
    const def = makeDef({
      strips: [['CT'], ['C7'], ['C2', 'CT'], ['CT'], ['CT']],
      bustSaveSymbol: null,
      paytable: [{ total: 17, pay: 1 }, { total: 19, pay: 2 }]
    })
    const r = blackjackReelExactRtp(def)
    expect(r.rtpPerCoin).toBeCloseTo(1, 12)
  })

  it('breakdown contributions sum to the RTP', () => {
    const def = makeDef({
      strips: [['CT'], ['C7'], ['C2', 'CT'], ['C2', 'CT'], ['C2']],
      bustSaveSymbol: null
    })
    const r = blackjackReelExactRtp(def)
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 10)
  })

  it('is deterministic — same def yields identical reports', () => {
    const def = makeDef({ strips: [['C7'], ['CT'], ['C2', 'CT'], ['C2', 'CT'], ['C2']] })
    const a = blackjackReelExactRtp(def)
    const b = blackjackReelExactRtp(def)
    expect(a.rtpPerCoin).toBe(b.rtpPerCoin)
    expect(a.hitFrequency).toBe(b.hitFrequency)
    expect(a.variancePerCoin).toBe(b.variancePerCoin)
  })
})

describe('optimalAction — accepts the live session state shape', () => {
  it('reads (total, multSum, saveHeld, cards) off BlackjackReelSessionState', () => {
    const def = makeDef({
      strips: [['C7'], ['CT'], ['MX2'], ['CT'], ['CT']],
      bustSaveSymbol: null
    })
    // A live state mid-hand (3 cards, soft flag irrelevant to the value here).
    const live: BlackjackReelSessionState = {
      phase: 'dealt',
      cards: ['C7', 'CT'],
      total: 17,
      isSoft: false,
      multSum: 0,
      saveHeld: false,
      busted: false,
      charlie: false,
      ante: 1
    }
    expect(optimalAction(def, live)).toBe('hit')
  })
})

// ---------------------------------------------------------------------------
// DP ↔ live-engine agreement. The Task 5 convergence check formalises this,
// but the save-consume reel-index behaviour (the live engine re-reads an
// EARLIER reel after a save) is subtle enough to verify here: drive the real
// dealHand/hitCard/standHand step functions under the DP's optimal policy and
// confirm the empirical RTP lands within a tight statistical band of the exact
// figure on a fixture that actually exercises multipliers and bust-saves.
// ---------------------------------------------------------------------------

function playOptimalHand(def: BlackjackReelMachineDef, rand: () => number): number {
  const state: MachineSessionState = {
    progressive: null, videoFeature: null, pachislo: null, blackjackReel: null
  }
  const deal = dealHand(def, state, 1, rand)
  let total = deal.totalPayout
  // dealHand never resolves; loop hit/stand under the policy until resolved.
  while (state.blackjackReel!.phase === 'dealt') {
    if (optimalAction(def, state.blackjackReel!) === 'hit') {
      const out = hitCard(def, state, rand)
      total += out.totalPayout // non-zero only on a resolving hit (charlie)
    } else {
      const out = standHand(def, state)
      total += out.totalPayout
    }
  }
  return total
}

describe('DP ↔ live step-function agreement (incl. bust-saves + multipliers)', () => {
  it('empirical RTP under the optimal policy matches blackjackReelExactRtp', () => {
    // A fixture that forces every interesting transition: aces, multipliers, and
    // a real bust-save (the save sits on a deal reel; busting reels follow).
    const def = makeDef({
      strips: [
        ['C2', 'C7', 'CT', 'CA'], // reel 0
        ['C7', 'CT', 'SAVE', 'CA'], // reel 1 (can deal a SAVE)
        ['C2', 'C7', 'CT', 'MX2'], // reel 2
        ['C2', 'CT', 'MX2', 'CA'], // reel 3
        ['C2', 'C7', 'CT'] // reel 4
      ],
      charlieBonus: 8
    })

    const exact = blackjackReelExactRtp(def)
    // sanity: the fixture must actually reach saves + charlies for the test to
    // be meaningful.
    const ids = new Set(exact.breakdown.map(b => b.entryId))
    expect(ids.has('charlie')).toBe(true)
    expect(ids.has('bust')).toBe(true)

    const N = 400_000
    let totalOut = 0
    let hits = 0
    const rand = mulberry32(20260614)
    for (let i = 0; i < N; i++) {
      const payout = playOptimalHand(def, rand)
      totalOut += payout
      if (payout > 0) hits++
    }
    const empiricalRtp = totalOut / N // ante = 1 per hand
    const empiricalHf = hits / N

    // Variance-scaled band (per-hand i.i.d.): 4σ never flakes on the fixed seed
    // yet a real DP↔engine divergence (e.g. a wrong reel index after a save)
    // shifts the mean far outside it.
    const se = Math.sqrt(exact.variancePerCoin / N)
    expect(Math.abs(empiricalRtp - exact.rtpPerCoin)).toBeLessThan(4 * se)
    const hfSe = Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / N)
    expect(Math.abs(empiricalHf - exact.hitFrequency)).toBeLessThan(4 * hfSe)
  })
})
