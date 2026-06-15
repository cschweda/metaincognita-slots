import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState, MachineSessionState } from '../app/engine/types'
import {
  freshAcc,
  applySymbol,
  bestTotal,
  evaluateHand,
  freshBlackjackState,
  payEntry,
  handPayout,
  dealReels,
  stopReel,
  cashOut
} from '../app/engine/blackjackReel'
import type { EvalCfg } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'
import { initMachineState } from '../app/engine/index'

// Lucky 21: Task 1 — type shape test. Old Hit-or-Bust engine tests removed;
// restored progressively in Tasks 3–5.

// Minimal fixture — only the fields that eval needs.
const fix: EvalCfg = {
  multiplierSymbols: { MX2: 2, MX3: 3 },
  minusSymbols: { MM2: 2, MM3: 3 },
  bustSymbol: 'BUST'
}

describe('lucky-21 hand evaluation', () => {
  it('freshAcc returns zeroed accumulator', () => {
    expect(freshAcc()).toEqual({ hard: 0, aces: 0, multSum: 0 })
  })

  it('applySymbol accumulates a plain card', () => {
    const acc = freshAcc()
    applySymbol(acc, fix, '7C')
    expect(acc.hard).toBe(7)
    expect(acc.aces).toBe(0)
    expect(acc.multSum).toBe(0)
  })

  it('applySymbol counts aces as 1 in hard', () => {
    const acc = freshAcc()
    applySymbol(acc, fix, 'AS')
    expect(acc.hard).toBe(1)
    expect(acc.aces).toBe(1)
  })

  it('applySymbol adds multiplier to multSum, 0 to hard', () => {
    const acc = freshAcc()
    applySymbol(acc, fix, 'MX2')
    expect(acc.multSum).toBe(2)
    expect(acc.hard).toBe(0)
  })

  it('applySymbol subtracts minus from hard, floored at 0', () => {
    const acc = freshAcc()
    acc.hard = 5
    applySymbol(acc, fix, 'MM3')
    expect(acc.hard).toBe(2)
    const acc2 = freshAcc()
    applySymbol(acc2, fix, 'MM3')
    expect(acc2.hard).toBe(0)
  })

  it('bestTotal promotes ace to 11 when it fits', () => {
    expect(bestTotal(7, 1)).toEqual({ total: 17, isSoft: true, softLow: 7 })
  })

  it('bestTotal keeps ace as 1 when 11 would bust', () => {
    expect(bestTotal(12, 1)).toEqual({ total: 12, isSoft: false, softLow: 12 })
  })

  it('bestTotal with no aces is just hard', () => {
    expect(bestTotal(17, 0)).toEqual({ total: 17, isSoft: false, softLow: 17 })
  })

  it('sums hard cards', () => {
    expect(evaluateHand(fix, ['7C', 'KD']).total).toBe(17)
  })

  it('ace soft then hard', () => {
    expect(evaluateHand(fix, ['AS', '7C'])).toMatchObject({ total: 18, isSoft: true })
    expect(evaluateHand(fix, ['AS', '7C', 'KD'])).toMatchObject({ total: 18, isSoft: false })
  })

  it('dual best total: 6 + ace = 7 or 17', () => {
    const e = evaluateHand(fix, ['6C', 'AS'])
    expect(e.total).toBe(17)
    expect(e.softLow).toBe(7)
  })

  it('minus subtracts, floored at 0', () => {
    expect(evaluateHand(fix, ['6C', '8D', 'MM3']).total).toBe(11)
    expect(evaluateHand(fix, ['2C', 'MM3', 'MM3']).total).toBe(0)
  })

  it('multipliers add, contribute 0 to total', () => {
    const e = evaluateHand(fix, ['KD', 'MX2', '7C', 'MX3'])
    expect(e.total).toBe(17)
    expect(e.multSum).toBe(5)
  })

  it('over 21 busts', () => {
    expect(evaluateHand(fix, ['KD', 'KS', '2C']).busted).toBe(true)
  })
})

describe('lucky-21 types', () => {
  it('has the lucky-21 def shape', () => {
    const d: Pick<BlackjackReelMachineDef, 'family' | 'qualifyMin' | 'charlieMultiplier'>
      = { family: 'blackjack-reel', qualifyMin: 15, charlieMultiplier: 3 }
    expect(d.qualifyMin).toBe(15)
  })

  it('has the lucky-21 session state shape', () => {
    const s: BlackjackReelSessionState = {
      phase: 'idle',
      reelStrips: [],
      landed: [null, null, null, null, null],
      idx: 0,
      hand: [],
      hard: 0,
      aces: 0,
      multSum: 0,
      bestTotal: 0,
      natural: false,
      busted: false,
      bustBySymbol: false,
      charlie: false,
      ante: 0
    }
    expect(s.phase).toBe('idle')
    expect(s.landed).toHaveLength(5)
  })
})

// ---------- Task 4 fixture ----------
//
// A minimal BlackjackReelMachineDef with KNOWN reel compositions so test
// outcomes are assertable. Each reel has exactly one slot so stopReel
// always lands on a predictable symbol (the single-element strip index
// floor(rand()*1) === 0 regardless of rand's value).

const PAYTABLE = [
  { total: 15, pay: 1 },
  { total: 16, pay: 1 },
  { total: 17, pay: 2 },
  { total: 18, pay: 3 },
  { total: 19, pay: 4 },
  { total: 20, pay: 5 },
  { total: 21, pay: 8 }
]

/** Build a fixture def with given reel token arrays (one or more tokens each). */
function mkDef(reels: string[][]): BlackjackReelMachineDef {
  return {
    id: 'lucky-21-test',
    name: 'Lucky 21 Test',
    family: 'blackjack-reel',
    denominationCents: 25,
    maxCoins: 5,
    history: '',
    symbols: {
      CARD: { label: 'Card' },
      BUST: { label: 'Bust' },
      MX2: { label: '×2' },
      MX5: { label: '×5' },
      MM2: { label: '-2' }
    },
    reels,
    multiplierSymbols: { MX2: 2, MX5: 5 },
    minusSymbols: { MM2: 2 },
    bustSymbol: 'BUST',
    paytable: PAYTABLE,
    qualifyMin: 15,
    naturalPay: 12,
    charlieMultiplier: 3,
    progressive: null
  }
}

function mkState(def: BlackjackReelMachineDef): MachineSessionState {
  return initMachineState(def)
}

// A seeded rand that always returns 0 — forces strip[0] to be selected.
const zeroRand = () => 0

describe('lucky-21 step functions', () => {
  // ── dealReels ──────────────────────────────────────────────────────────────

  it('dealReels: fills reelStrips, phase=spinning, idx=0, cards-dealt event', () => {
    const def = mkDef([['CARD'], ['CARD'], ['CARD'], ['CARD'], ['CARD']])
    const state = mkState(def)
    const rand = mulberry32(42)
    const out = dealReels(def, state, 2, rand)
    const bj = state.blackjackReel!
    expect(bj.phase).toBe('spinning')
    expect(bj.idx).toBe(0)
    expect(bj.ante).toBe(2)
    expect(bj.reelStrips).toHaveLength(5)
    // All 5 slots were CARD so we should have 5 unique card ids
    const allCards = bj.reelStrips.flat()
    expect(allCards).toHaveLength(5)
    // All unique
    expect(new Set(allCards).size).toBe(5)
    // Each is a 2-char string (card id)
    for (const c of allCards) {
      expect(c).toMatch(/^[A2-9TJQK][SHDC]$/)
    }
    expect(out.coinsIn).toBe(2)
    expect(out.family).toBe('blackjack-reel')
    const evt = out.featureEvents[0]
    expect(evt?.type).toBe('cards-dealt')
    if (evt?.type === 'cards-dealt') {
      expect(evt.strips).toHaveLength(5)
    }
  })

  it('dealReels: special tokens pass through unchanged', () => {
    // reel 0 has BUST; reels 1-4 have CARD
    const def = mkDef([['BUST'], ['CARD'], ['CARD'], ['CARD'], ['CARD']])
    const state = mkState(def)
    const out = dealReels(def, state, 1, mulberry32(7))
    const bj = state.blackjackReel!
    expect(bj.reelStrips[0]).toEqual(['BUST'])
    // The other 4 reels are single cards
    for (let r = 1; r < 5; r++) {
      expect(bj.reelStrips[r]).toHaveLength(1)
      expect(bj.reelStrips[r]![0]).toMatch(/^[A2-9TJQK][SHDC]$/)
    }
    expect(out.coinsIn).toBe(1)
  })

  // ── stopReel — plain card ──────────────────────────────────────────────────

  it('stopReel: stops reel, pushes card to hand, advances idx', () => {
    // Single-slot strips, each a fixed card: 9C, 8S, 7D, 6H, 5C
    const def = mkDef([['9C'], ['8S'], ['7D'], ['6H'], ['5C']])
    const state = mkState(def)
    // Pre-deal by injecting state manually (skip rand-based dealReels here)
    const bj = freshBlackjackState()
    bj.ante = 1
    bj.phase = 'spinning'
    bj.reelStrips = [['9C'], ['8S'], ['7D'], ['6H'], ['5C']]
    state.blackjackReel = bj

    const out = stopReel(def, state, zeroRand)
    expect(bj.idx).toBe(1)
    expect(bj.landed[0]).toBe('9C')
    expect(bj.hand).toEqual(['9C'])
    // total is 9, bestTotal updates
    expect(bj.bestTotal).toBe(9)
    expect(bj.phase).toBe('spinning')
    const evt = out.featureEvents[0]
    expect(evt?.type).toBe('reel-stopped')
    if (evt?.type === 'reel-stopped') {
      expect(evt.reel).toBe(0)
      expect(evt.symbol).toBe('9C')
    }
  })

  // ── stopReel — bestTotal ratchet ──────────────────────────────────────────

  it('stopReel: minus card lowers total but bestTotal is unchanged (ratchet)', () => {
    // reel0=9C (total 9, bestTotal=9), reel1=8S (total 17, bestTotal=17),
    // reel2=MM2 (total 15, bestTotal stays 17)
    const def = mkDef([['9C'], ['8S'], ['MM2'], ['5D'], ['2H']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 1
    bj.phase = 'spinning'
    bj.reelStrips = [['9C'], ['8S'], ['MM2'], ['5D'], ['2H']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // reel 0: 9C, total 9, bestTotal 9
    stopReel(def, state, zeroRand) // reel 1: 8S, total 17, bestTotal 17
    expect(bj.bestTotal).toBe(17)
    stopReel(def, state, zeroRand) // reel 2: MM2, total 15, bestTotal STILL 17
    expect(bj.bestTotal).toBe(17)
    expect(bj.hand).toEqual(['9C', '8S', 'MM2'])
  })

  // ── stopReel — multiplier symbol ──────────────────────────────────────────

  it('stopReel: multiplier symbol grows multSum, does not change total', () => {
    const def = mkDef([['9C'], ['MX2'], ['7D'], ['5H'], ['2S']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 1
    bj.phase = 'spinning'
    bj.reelStrips = [['9C'], ['MX2'], ['7D'], ['5H'], ['2S']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // 9C, total 9
    stopReel(def, state, zeroRand) // MX2, total still 9, multSum 2
    expect(bj.multSum).toBe(2)
    expect(bj.bestTotal).toBe(9)
    expect(bj.phase).toBe('spinning')
  })

  // ── stopReel — card bust (over 21) ────────────────────────────────────────

  it('stopReel: card that busts → busted=true, bustBySymbol=false, phase=resolved, payout 0', () => {
    // 10+10+2 = 22 → bust
    const def = mkDef([['TC'], ['TS'], ['2D'], ['5H'], ['3C']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 3
    bj.phase = 'spinning'
    bj.reelStrips = [['TC'], ['TS'], ['2D'], ['5H'], ['3C']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // TC: total 10
    stopReel(def, state, zeroRand) // TS: total 20
    const out = stopReel(def, state, zeroRand) // 2D: total 22 → bust
    expect(bj.busted).toBe(true)
    expect(bj.bustBySymbol).toBe(false)
    expect(bj.phase).toBe('resolved')
    expect(out.totalPayout).toBe(0)
    const evt = out.featureEvents[0]
    expect(evt?.type).toBe('bust')
    if (evt?.type === 'bust') {
      expect(evt.bySymbol).toBe(false)
      expect(evt.reel).toBe(2)
    }
  })

  // ── stopReel — BUST symbol ────────────────────────────────────────────────

  it('stopReel: BUST symbol → busted=true, bustBySymbol=true, phase=resolved, payout 0', () => {
    const def = mkDef([['9C'], ['BUST'], ['7D'], ['5H'], ['2S']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 2
    bj.phase = 'spinning'
    bj.reelStrips = [['9C'], ['BUST'], ['7D'], ['5H'], ['2S']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // 9C
    const out = stopReel(def, state, zeroRand) // BUST
    expect(bj.busted).toBe(true)
    expect(bj.bustBySymbol).toBe(true)
    expect(bj.phase).toBe('resolved')
    expect(out.totalPayout).toBe(0)
    const evt = out.featureEvents[0]
    expect(evt?.type).toBe('bust')
    if (evt?.type === 'bust') {
      expect(evt.bySymbol).toBe(true)
      expect(evt.reel).toBe(1)
    }
  })

  // ── stopReel — Five-Card Charlie ──────────────────────────────────────────

  it('stopReel: 5th reel survived → charlie=true, phase=resolved, payout via handPayout', () => {
    // 5+4+3+2+2 = 16, qualifyMin=15, pays paytable(16)=1*1*charlieMultiplier*ante
    const def = mkDef([['5C'], ['4S'], ['3D'], ['2H'], ['2C']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 2
    bj.phase = 'spinning'
    bj.reelStrips = [['5C'], ['4S'], ['3D'], ['2H'], ['2C']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // 5
    stopReel(def, state, zeroRand) // 9
    stopReel(def, state, zeroRand) // 12
    stopReel(def, state, zeroRand) // 14
    const out = stopReel(def, state, zeroRand) // 16
    expect(bj.charlie).toBe(true)
    expect(bj.phase).toBe('resolved')
    // bestTotal=16, pays paytable(16)=1, mult=max(1,0)=1, charlie=3, ante=2
    // 1 * 1 * 3 * 2 = 6
    expect(out.totalPayout).toBe(6)
    const evt = out.featureEvents[0]
    expect(evt?.type).toBe('charlie')
    if (evt?.type === 'charlie') {
      expect(evt.cards).toEqual(['5C', '4S', '3D', '2H', '2C'])
    }
  })

  // ── cashOut ────────────────────────────────────────────────────────────────

  it('cashOut: resolves hand at current bestTotal, correct payout', () => {
    // Stop 2 reels (total 17), then cash out
    // payEntry(17)=2 * max(1,0)=1 * charlieMultiplier=1 (no charlie) * ante=1 = 2
    const def = mkDef([['9C'], ['8S'], ['5D'], ['3H'], ['2C']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 1
    bj.phase = 'spinning'
    bj.reelStrips = [['9C'], ['8S'], ['5D'], ['3H'], ['2C']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // 9
    stopReel(def, state, zeroRand) // 17
    expect(bj.bestTotal).toBe(17)

    const out = cashOut(def, state)
    expect(bj.phase).toBe('resolved')
    // pay = 2 * 1 * 1 * 1 = 2
    expect(out.totalPayout).toBe(2)
    const evt = out.featureEvents[0]
    expect(evt?.type).toBe('cash-out')
    if (evt?.type === 'cash-out') {
      expect(evt.bestTotal).toBe(17)
      expect(evt.payout).toBe(2)
    }
  })

  // ── natural detection ──────────────────────────────────────────────────────

  it('stopReel: 2-card 21 sets natural=true', () => {
    // AC + KC = 21
    const def = mkDef([['AC'], ['KC'], ['5D'], ['3H'], ['2C']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 1
    bj.phase = 'spinning'
    bj.reelStrips = [['AC'], ['KC'], ['5D'], ['3H'], ['2C']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // AC, total 11
    stopReel(def, state, zeroRand) // KC, total 21 — natural!
    expect(bj.natural).toBe(true)
    expect(bj.bestTotal).toBe(21)
  })

  // ── BUST on 5th reel (reel index 4) — does NOT become a Charlie ───────────

  it('stopReel: BUST on reel 4 → busted, not charlie', () => {
    // Reels 0-3 land safe cards (5+4+3+2 = 14, no bust), reel 4 is BUST symbol.
    const def = mkDef([['5C'], ['4S'], ['3D'], ['2H'], ['BUST']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 2
    bj.phase = 'spinning'
    bj.reelStrips = [['5C'], ['4S'], ['3D'], ['2H'], ['BUST']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // 5C, total 5
    stopReel(def, state, zeroRand) // 4S, total 9
    stopReel(def, state, zeroRand) // 3D, total 12
    stopReel(def, state, zeroRand) // 2H, total 14 — still spinning
    const out = stopReel(def, state, zeroRand) // BUST symbol on reel 4
    expect(bj.busted).toBe(true)
    expect(bj.bustBySymbol).toBe(true)
    expect(bj.charlie).toBe(false)
    expect(out.totalPayout).toBe(0)
  })

  // ── Natural → cashOut pays naturalPay, no Charlie multiplier ──────────────

  it('cashOut after natural (AC+KC) pays naturalPay × ante, not Charlie multiplier', () => {
    // Drive two stopReel calls: AC then KC → 2-card 21, natural=true, charlie=false.
    // cashOut at that point: naturalPay=12, mult=max(1,0)=1, charlieMul=1, ante=1 → 12.
    const def = mkDef([['AC'], ['KC'], ['5D'], ['3H'], ['2C']])
    const state = mkState(def)
    const bj = freshBlackjackState()
    bj.ante = 1
    bj.phase = 'spinning'
    bj.reelStrips = [['AC'], ['KC'], ['5D'], ['3H'], ['2C']]
    state.blackjackReel = bj

    stopReel(def, state, zeroRand) // AC, total 11
    stopReel(def, state, zeroRand) // KC, total 21 — natural=true
    expect(bj.natural).toBe(true)
    expect(bj.charlie).toBe(false)

    const out = cashOut(def, state)
    // naturalPay=12, mult=max(1,0)=1, charlieMul=1 (charlie=false), ante=1 → 12
    expect(out.totalPayout).toBe(12)
    expect(out.totalPayout).toBe(def.naturalPay)
  })
})

// ---------- handPayout unit tests (construct states directly) ----------

describe('lucky-21 handPayout', () => {
  const def = mkDef([['CARD'], ['CARD'], ['CARD'], ['CARD'], ['CARD']])

  function bj(overrides: Partial<BlackjackReelSessionState>): BlackjackReelSessionState {
    return { ...freshBlackjackState(), ...overrides }
  }

  it('busted → 0', () => {
    expect(handPayout(def, bj({ busted: true, bestTotal: 20, ante: 5 }))).toBe(0)
  })

  it('bestTotal below qualifyMin (14), not charlie → 0', () => {
    expect(handPayout(def, bj({ bestTotal: 14, ante: 1 }))).toBe(0)
  })

  it('bestTotal 18, multSum 0, ante 1 → payEntry(18)*1*1*1 = 3', () => {
    // payEntry(18) = 3, max(1,0)=1, charlie=false→1, ante=1
    expect(handPayout(def, bj({ bestTotal: 18, multSum: 0, ante: 1 }))).toBe(3)
  })

  it('bestTotal 20, multSum 5, ante 2 → payEntry(20)*5*1*2 = 50', () => {
    // payEntry(20)=5, max(1,5)=5, charlieMultiplier=1 (no charlie), ante=2
    expect(handPayout(def, bj({ bestTotal: 20, multSum: 5, ante: 2 }))).toBe(50)
  })

  it('natural 2-card 21 → naturalPay * max(1,0) * 1 * ante = 12', () => {
    // naturalPay=12, mult=1, no charlie, ante=1
    expect(handPayout(def, bj({ bestTotal: 21, natural: true, multSum: 0, ante: 1 }))).toBe(12)
  })

  it('natural with multSum 2 → naturalPay * 2 * 1 * ante', () => {
    // naturalPay=12, mult=2, no charlie, ante=1 → 24
    expect(handPayout(def, bj({ bestTotal: 21, natural: true, multSum: 2, ante: 1 }))).toBe(24)
  })

  it('charlie:true, bestTotal 14 (sub-qualify) → payEntry(qualifyMin=15)*1*3*1 = 3', () => {
    // charlie floors base at payEntry(qualifyMin=15)=1; charlieMul=3, mult=1, ante=1
    expect(handPayout(def, bj({ charlie: true, bestTotal: 14, multSum: 0, ante: 1 }))).toBe(3)
  })

  it('charlie:true, bestTotal 20 → payEntry(20)*max(1,0)*charlieMultiplier*ante = 5*1*3*1 = 15', () => {
    expect(handPayout(def, bj({ charlie: true, bestTotal: 20, multSum: 0, ante: 1 }))).toBe(15)
  })

  it('charlie:true, bestTotal 20, multSum 4, ante 2 → 5*4*3*2 = 120', () => {
    expect(handPayout(def, bj({ charlie: true, bestTotal: 20, multSum: 4, ante: 2 }))).toBe(120)
  })

  it('payEntry returns 0 for unknown total', () => {
    expect(payEntry(PAYTABLE, 14)).toBe(0)
    expect(payEntry(PAYTABLE, 0)).toBe(0)
  })

  it('payEntry finds correct pay for known total', () => {
    expect(payEntry(PAYTABLE, 21)).toBe(8)
    expect(payEntry(PAYTABLE, 15)).toBe(1)
  })
})
