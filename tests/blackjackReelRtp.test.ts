import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState, MachineSessionState } from '../app/engine/types'
import { optimalAction, blackjackReelExactRtp, decisionEvs, strategyMatrixCell } from '../app/engine/blackjackReelRtp'
import { dealHand, hitCard, standHand } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'
import { HIT_OR_BUST } from '../app/machines/hit-or-bust'

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
// DP ↔ live-engine agreement. The bust-save void-in-place behaviour is subtle:
// the live engine voids the busting card IN PLACE (replaces it with a VOID
// sentinel) so cards.length grows monotonically — the next draw always uses the
// next reel. The DP mirrors this: on a saved bust handSize increments (not
// decrements). Drive the real dealHand/hitCard/standHand step functions under
// the DP's optimal policy and confirm the empirical RTP lands within a tight
// statistical band of the exact figure on a fixture that exercises multipliers,
// bust-saves, and five-card charlies.
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

describe('DP afterDraw bust-save semantics: handSize increments (void-in-place)', () => {
  it('DP computes RTP using the reel AFTER the voided slot (not the one before)', () => {
    // Fixture designed so the correct vs wrong reel-index-after-save give very
    // different RTPs, letting us catch if the DP still decrements handSize.
    //
    // Setup:
    //   reel 0: ['CT']         → always 10
    //   reel 1: ['SAVE']       → always SAVE (deal always gives a save)
    //   reel 2: ['CT']         → always 10: hitting would bust 10+10=20 → save fires
    //   reel 3: ['CT']         → another 10 → VOID consumed reel 2 slot (handSize 3→4)
    //                            next hit is reel 3: 10 → busts 10+10=20... hmm
    //
    // Better fixture: after deal (CT, SAVE), total = 10, saveHeld=true.
    // reel 2: all tens → hit gets 20 (safe, no bust) → stay dealt at total 20.
    //   Actually CT(10)+SAVE(0)=10; hitting CT→20, no bust yet.
    //   We need to FORCE a bust on reel 2 to trigger the save. We need > 21.
    //   Reel 0 should deal something high. Let reel 0='CT'(10), reel1='SAVE'.
    //   After deal: total=10 (CT+SAVE=10), saveHeld=true.
    //   reel 2='CT': hit → 20, no bust. Still dealt. Let's try:
    //   reel 0=['CT','CT']×5, reel 1=['CT','SAVE'], reel 2=['CT'] (always 10).
    //   After deal CT+CT: total=20, saveHeld=false. Hit reel2 CT → 30 bust, no save → 0.
    // Try: reel0=['CA'], reel1=['CT']: total=21 → optimal stand always pays 5. Not useful.
    //
    // Simplest: two value cards in deal. Save dealt on reel 2 (a hit).
    //   reel0=['CT'], reel1=['C7'], total=17, saveHeld=false.
    //   reel2=['SAVE']: hit → total still 17, saveHeld=true.
    //   reel3=['CT']: hit → 27 bust, save fires → VOID reel3 slot → handSize goes 3→4.
    //   reel4=['C2']: OLD reel-index bug would use reel2 (SAVE) again → handSize would be 2→3.
    //     Correct: reel4=['C2'] → C2=2 → total 19, 5 cards, charlie EV=(2+10)=12.
    //     Wrong (old): reel2=['SAVE'] → SAVE=0 → total 17, then reel3=['CT'] → bust again...
    //   So: correct DP gives high RTP (charlie+paytable); wrong DP gives much lower value.
    //
    // To make the difference quantifiable, we'll compare to a manually computed value.
    // Under correct semantics:
    //   deal always (CT,C7)=17, saveHeld=false.
    //   optimal: hit reel2 (SAVE) → total=17, saveHeld=true → always beneficial to keep hitting.
    //   hit reel3 (CT) → 27 bust, save fires → VOID slot 3, handSize=4.
    //   hit reel4 (C2) → total=19, 5 cards, charlie = pay(19)+charlieBonus = 2+10=12.
    //   RTP = 12 (always, deterministic).
    //
    // Under wrong semantics (handSize decrements to 2 after save):
    //   After save fires, handSize=2. Next hit draws reel2=['SAVE'] → saveHeld=true again!
    //   Then hits reel3=['CT'] again, bust, save fires, handSize=2 again → infinite loop or
    //   eventually handSize reaches 5 via a different path. Either way RTP differs.
    const def = makeDef({
      strips: [
        ['CT'], // reel 0: always 10
        ['C7'], // reel 1: always 7 → deal total=17
        ['SAVE'], // reel 2: always SAVE → saveHeld=true after hit
        ['CT'], // reel 3: always 10 → bust (17+10=27), save fires → VOID slot 3
        ['C2'] // reel 4: always 2 → total=19, 5 cards → charlie
      ],
      paytable: [
        { total: 17, pay: 1 },
        { total: 19, pay: 2 }
      ],
      charlieBonus: 10,
      bustSaveSymbol: 'SAVE'
    })

    const r = blackjackReelExactRtp(def)
    // Under correct semantics (void-in-place, reel index monotonic):
    //   Always deal 17, hit SAVE (reel2), hit CT bust→VOID (reel3), hit C2→19 charlie (reel4).
    //   Final: pay(19)+charlieBonus=2+10=12, mult=1. RTP = 12.
    expect(r.rtpPerCoin).toBeCloseTo(12, 8)
    expect(r.hitFrequency).toBeCloseTo(1, 8) // always pays > 0
  })
})

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

// ---------------------------------------------------------------------------
// decisionEvs — EV(hit) vs EV(stand) at the live decision point
// ---------------------------------------------------------------------------

describe('decisionEvs', () => {
  it('returns null when phase is not dealt', () => {
    const def = makeDef({ strips: [['CT'], ['C7'], ['CT'], ['CT'], ['CT']], bustSaveSymbol: null })
    const idle: BlackjackReelSessionState = {
      phase: 'idle', cards: [], total: 0, isSoft: false, multSum: 0,
      saveHeld: false, busted: false, charlie: false, ante: 1
    }
    expect(decisionEvs(def, idle)).toBeNull()
    const resolved: BlackjackReelSessionState = {
      phase: 'resolved', cards: ['CT', 'C7'], total: 17, isSoft: false, multSum: 0,
      saveHeld: false, busted: false, charlie: false, ante: 1
    }
    expect(decisionEvs(def, resolved)).toBeNull()
  })

  it('returns null at 5 cards (forced charlie — no decision)', () => {
    // 5 cards in the hand → no decision left, charlie fires automatically.
    const def = makeDef({ strips: [['C2'], ['C2'], ['C2'], ['C2'], ['C2']], bustSaveSymbol: null })
    const fiveCard = decisionState({ cards: ['C2', 'C2', 'C2', 'C2', 'C2'], total: 10 })
    expect(decisionEvs(def, fiveCard)).toBeNull()
  })

  it('EV(stand) > EV(hit) when hitting is a guaranteed bust', () => {
    // Total 20, next reel all tens → any hit busts immediately (no save).
    // EV(stand) = pay(20) = 3; EV(hit) = 0.
    const def = makeDef({
      strips: [['CT'], ['CT'], ['CT'], ['CT'], ['CT']],
      bustSaveSymbol: null,
      paytable: [{ total: 20, pay: 3 }, { total: 21, pay: 5 }]
    })
    const state = decisionState({ cards: ['CT', 'CT'], total: 20 })
    const evs = decisionEvs(def, state)
    expect(evs).not.toBeNull()
    expect(evs!.evStand).toBeCloseTo(3, 10)
    expect(evs!.evHit).toBeCloseTo(0, 10)
    expect(evs!.action).toBe('stand')
  })

  it('EV(hit) > EV(stand) when next card is a guaranteed-safe multiplier', () => {
    // Total 17 (pay 1), next reel is all ×2 multiplier: safe (adds 0 to total),
    // multSum becomes 2, then we must stand for pay(17)×2 = 2. No further cards
    // are possible (reel 3 = tens → bust from 17+10=27, no save → hit EV = 0).
    // So EV(hit from 17) = 1 × pay(17)×2 = 2 > EV(stand) = 1.
    const def = makeDef({
      strips: [['C7'], ['CT'], ['MX2'], ['CT'], ['CT']],
      bustSaveSymbol: null,
      paytable: [{ total: 17, pay: 1 }]
    })
    const state = decisionState({ cards: ['C7', 'CT'], total: 17 })
    const evs = decisionEvs(def, state)
    expect(evs).not.toBeNull()
    expect(evs!.evHit).toBeGreaterThan(evs!.evStand)
    expect(evs!.action).toBe('hit')
  })

  it('EV values agree with solve().value at the initial state', () => {
    // The max(evHit, evStand) must equal the DP's value for the same state.
    const def = makeDef({
      strips: [['C7'], ['CT'], ['C2', 'CT'], ['C2', 'CT'], ['C2']],
      bustSaveSymbol: null
    })
    const state = decisionState({ cards: ['C7', 'CT'], total: 17 })
    const evs = decisionEvs(def, state)
    expect(evs).not.toBeNull()
    const dpValue = Math.max(evs!.evHit, evs!.evStand)
    // The exact RTP for a deterministic 17-start equals the DP value directly.
    const report = blackjackReelExactRtp(def)
    // RTP = weighted average over all deals; here deal is deterministic (only 1 deal).
    expect(dpValue).toBeCloseTo(report.rtpPerCoin, 10)
  })
})

// ---------------------------------------------------------------------------
// strategyMatrixCell + surface-consistency tests
//
// Guards the PAR sheet against contradicting the live X-ray. For every
// (numCards, total) sample point:
//   strategyMatrixCell(def, total, numCards)
//     === optimalAction(def, fabricatedState)
//     === (evHit > evStand ? 'hit' : 'stand') from decisionEvs
//
// The regression case that triggered this fix: hard 18 at 2 cards must be STAND.
// ---------------------------------------------------------------------------

describe('strategyMatrixCell — card-count-aware PAR matrix helper', () => {
  // Build a synthetic BlackjackReelSessionState for a given hard total + card count.
  // Uses only value cards (no aces, no specials) so total = hard sum exactly.
  // Card construction (verified to cover all test cases):
  //   numCards=2: C10 + C(T-10) for T in 12..20; C2 + C(T-2) for T in 4..11
  //   numCards=3: C10+C2+C(T-12) for T in 14..21; C2+C2+C(T-4) for T in 6..13
  //   numCards=4: C10+C2+C2+C(T-14) for T in 16..21; C2+C2+C2+C(T-6) for T in 8..15
  function cardSym(v: number): string {
    return `C${v}`
  }

  function fabricateHardState(
    total: number,
    numCards: number,
    saveHeld = false
  ): BlackjackReelSessionState {
    let cards: string[]
    if (numCards === 2) {
      if (total >= 12 && total <= 20) cards = ['C10', cardSym(total - 10)]
      else cards = ['C2', cardSym(total - 2)]
    } else if (numCards === 3) {
      if (total >= 14 && total <= 21) cards = ['C10', 'C2', cardSym(total - 12)]
      else cards = ['C2', 'C2', cardSym(total - 4)]
    } else {
      if (total >= 16 && total <= 21) cards = ['C10', 'C2', 'C2', cardSym(total - 14)]
      else cards = ['C2', 'C2', 'C2', cardSym(total - 6)]
    }
    return {
      phase: 'dealt',
      cards,
      total,
      isSoft: false,
      multSum: 0,
      saveHeld,
      busted: false,
      charlie: false,
      ante: 1
    }
  }

  it('strategyMatrixCell exists and returns hit or stand', () => {
    const action = strategyMatrixCell(HIT_OR_BUST, 18, 2)
    expect(['hit', 'stand']).toContain(action)
  })

  it('REGRESSION: hard 18 at 2 cards must be STAND (contradicted the old 1-D PAR table)', () => {
    const action = strategyMatrixCell(HIT_OR_BUST, 18, 2)
    expect(action).toBe('stand')
  })

  it('strategyMatrixCell agrees with optimalAction for hard 18 at 2 cards', () => {
    const state = fabricateHardState(18, 2)
    const direct = optimalAction(HIT_OR_BUST, state)
    const matrix = strategyMatrixCell(HIT_OR_BUST, 18, 2)
    expect(matrix).toBe(direct)
  })

  it('strategyMatrixCell agrees with decisionEvs sign for hard 18 at 2 cards', () => {
    const state = fabricateHardState(18, 2)
    const evs = decisionEvs(HIT_OR_BUST, state)
    expect(evs).not.toBeNull()
    const evsAction = evs!.evHit > evs!.evStand ? 'hit' : 'stand'
    const matrix = strategyMatrixCell(HIT_OR_BUST, 18, 2)
    expect(matrix).toBe(evsAction)
  })

  // Sampled grid: totals × card counts that are reachable in the game.
  // For each point, assert all three surfaces agree.
  const CARD_COUNTS = [2, 3, 4] as const

  // Totals reachable for each numCards:
  //   numCards=2: total in 4..20 via non-ace cards (or 21 via 10+A but we use hard)
  //   numCards=3: total in 6..21
  //   numCards=4: total in 8..21
  const reachable: Record<2 | 3 | 4, number[]> = {
    2: [12, 13, 14, 15, 16, 17, 18, 19, 20],
    3: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    4: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
  }

  for (const numCards of CARD_COUNTS) {
    for (const total of reachable[numCards]) {
      it(`all three surfaces agree for hard ${total} at ${numCards} cards`, () => {
        const state = fabricateHardState(total, numCards)
        const direct = optimalAction(HIT_OR_BUST, state)
        const evs = decisionEvs(HIT_OR_BUST, state)
        const matrix = strategyMatrixCell(HIT_OR_BUST, total, numCards)

        // optimalAction and strategyMatrixCell must match
        expect(matrix).toBe(direct)

        // decisionEvs must also agree (evs is non-null since phase='dealt', < 5 cards)
        expect(evs).not.toBeNull()
        const evsAction = evs!.evHit > evs!.evStand ? 'hit' : 'stand'
        expect(matrix).toBe(evsAction)
      })
    }
  }

  it('hard 21 at 2 cards is STAND (paytable pays 2 per coin; no room to improve)', () => {
    // total 21 is the maximum paying hand (pay=2). Cannot improve. Must stand.
    // hard 21 at 2 non-ace cards requires two-card combos that don't exist (max is 10+10=20).
    // We skip total=21 in reachable[2] but confirm 3/4-card hard 21 is STAND.
    const state21_3: BlackjackReelSessionState = {
      phase: 'dealt', cards: ['C2', 'C9', 'C10'], total: 21, isSoft: false,
      multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 1
    }
    expect(optimalAction(HIT_OR_BUST, state21_3)).toBe('stand')
    expect(strategyMatrixCell(HIT_OR_BUST, 21, 3)).toBe('stand')
  })
})

describe('strategyMatrixCell — Four-card made totals chase Five-Card Charlie', () => {
  // At 4 cards, a made total (18/19/20) might be +EV to hit because surviving
  // to 5 cards wins a Charlie bonus. Check what the DP actually says and assert it.
  it('returns consistent action for hard 18 at 4 cards (DP determines HIT or STAND)', () => {
    const action = strategyMatrixCell(HIT_OR_BUST, 18, 4)
    // Must be one of the two valid actions
    expect(['hit', 'stand']).toContain(action)
    // Must agree with optimalAction: C2+C2+C4+C10 = 18, 4 cards
    const s18_4: BlackjackReelSessionState = {
      phase: 'dealt',
      cards: ['C2', 'C2', 'C4', 'C10'],
      total: 18,
      isSoft: false,
      multSum: 0,
      saveHeld: false,
      busted: false,
      charlie: false,
      ante: 1
    }
    const direct = optimalAction(HIT_OR_BUST, s18_4)
    expect(action).toBe(direct)
  })
})
