import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState, MachineSessionState } from '../app/engine/types'
import { evaluateHand, dealHand, hitCard, standHand } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'
// VOID sentinel used by void-in-place bust-save mechanic
const VOID_SYMBOL = 'VOID'

// ---------- Task 1: type smoke tests ----------

describe('blackjack-reel types', () => {
  it('compiles a minimal def shape', () => {
    const def: Pick<BlackjackReelMachineDef, 'family'> = { family: 'blackjack-reel' }
    expect(def.family).toBe('blackjack-reel')
  })

  it('compiles a minimal session state shape', () => {
    const state: BlackjackReelSessionState = {
      phase: 'idle',
      cards: [],
      total: 0,
      isSoft: false,
      multSum: 0,
      saveHeld: false,
      busted: false,
      charlie: false,
      ante: 0
    }
    expect(state.phase).toBe('idle')
  })
})

// ---------- Task 2: evaluateHand ----------

// Minimal fixture cfg — no dependency on the not-yet-existing hit-or-bust.ts
const fix = {
  cardValues: { C2: 2, C7: 7, CK: 10, CA: 11 /* NOTE: aceSymbol is special; this entry is intentionally ignored */ },
  aceSymbol: 'CA',
  multiplierSymbols: { MX2: 2, MX3: 3 },
  bustSaveSymbol: 'SAVE' as string | null
}

describe('evaluateHand', () => {
  it('sums hard cards', () => {
    const r = evaluateHand(fix, ['C7', 'CK'])
    expect(r.total).toBe(17)
    expect(r.isSoft).toBe(false)
    expect(r.busted).toBe(false)
  })

  it('counts an ace as 11 when it fits (soft)', () => {
    const r = evaluateHand(fix, ['CA', 'C7'])
    expect(r.total).toBe(18)
    expect(r.isSoft).toBe(true)
    expect(r.busted).toBe(false)
  })

  it('drops ace to 1 when 11 would bust (hard)', () => {
    // CA=1, C7=7, CK=10 → hard sum = 18, 18+10 > 21 so no promotion
    const r = evaluateHand(fix, ['CA', 'C7', 'CK'])
    expect(r.total).toBe(18)
    expect(r.isSoft).toBe(false)
    expect(r.busted).toBe(false)
  })

  it('ignores multipliers in the total but sums them', () => {
    const r = evaluateHand(fix, ['CK', 'MX2', 'C7', 'SAVE'])
    expect(r.total).toBe(17) // CK=10 + C7=7; MX2 and SAVE contribute 0
    expect(r.multSum).toBe(2)
    expect(r.saveSeen).toBe(true)
    expect(r.busted).toBe(false)
  })

  it('flags bust over 21', () => {
    const r = evaluateHand(fix, ['CK', 'CK', 'C2'])
    expect(r.total).toBe(22)
    expect(r.busted).toBe(true)
  })

  it('multiplier cards do not cause a bust (they add 0 to total)', () => {
    // CK(10) + MX3(0) + MX2(0) → total=10, multSum=5 — never busts from specials
    const r = evaluateHand(fix, ['CK', 'MX3', 'MX2'])
    expect(r.total).toBe(10)
    expect(r.busted).toBe(false)
    expect(r.multSum).toBe(5)
  })

  it('save symbol does not cause a bust', () => {
    const r = evaluateHand(fix, ['CK', 'SAVE'])
    expect(r.total).toBe(10)
    expect(r.busted).toBe(false)
    expect(r.saveSeen).toBe(true)
  })

  it('works with bustSaveSymbol = null', () => {
    const cfg = { ...fix, bustSaveSymbol: null }
    const r = evaluateHand(cfg, ['C7', 'CK'])
    expect(r.saveSeen).toBe(false)
    expect(r.total).toBe(17)
  })

  it('blackjack (ace + king) → soft 21', () => {
    const r = evaluateHand(fix, ['CA', 'CK'])
    expect(r.total).toBe(21)
    expect(r.isSoft).toBe(true)
  })

  it('VOID sentinel contributes 0 to hand total and does not bust', () => {
    // ['CK', 'SAVE', 'C7', 'VOID']: CK=10, SAVE=0, C7=7, VOID=0 → total=17, no bust
    const r = evaluateHand(fix, ['CK', 'SAVE', 'C7', VOID_SYMBOL])
    expect(r.total).toBe(17)
    expect(r.busted).toBe(false)
    expect(r.saveSeen).toBe(true) // SAVE still in hand
  })

  it('VOID sentinel does not affect multiplier sum', () => {
    const r = evaluateHand(fix, ['CK', 'MX2', VOID_SYMBOL])
    expect(r.total).toBe(10)
    expect(r.multSum).toBe(2)
    expect(r.busted).toBe(false)
  })
})

// ---------- Task 3: step functions ----------

/**
 * Minimal def for step-function tests. Strips are designed so that
 * with a seeded mulberry32 we can predict which cards come out.
 *
 * strips[0] = ['C7']             → always C7
 * strips[1] = ['CK']             → always CK
 * strips[2] = ['C2', 'CK', 'C7']
 * strips[3] = ['C2', 'CK']
 * strips[4] = ['C2']             → always C2
 */
const fixDef: BlackjackReelMachineDef = {
  id: 'test-bj',
  name: 'Test BJ',
  family: 'blackjack-reel',
  denominationCents: 25,
  maxCoins: 3,
  symbols: {
    C2: { label: '2' }, C7: { label: '7' }, CK: { label: 'K' },
    CA: { label: 'A' }, MX2: { label: '×2' }, SAVE: { label: 'Save' },
    BUST: { label: 'Bust' }
  },
  history: 'test fixture',
  strips: [
    ['C7'], // reel 0
    ['CK'], // reel 1
    ['C2', 'CK', 'C7'], // reel 2
    ['C2', 'CK'], // reel 3
    ['C2'] // reel 4
  ],
  cardValues: { C2: 2, C7: 7, CK: 10 },
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
  progressive: null
}

function freshState(): MachineSessionState {
  return {
    progressive: null,
    videoFeature: null,
    pachislo: null,
    blackjackReel: null
  }
}

// Reel 2 strip: ['C2', 'CK', 'C7'] (length 3)
// mulberry32(seed) first draw is 0.something. We know:
//   strip[0]='C2', strip[1]='CK', strip[2]='C7'
// For deal: reel0='C7' (len 1 → idx 0), reel1='CK' (len 1 → idx 0)

describe('dealHand', () => {
  it('resets any prior state, sets ante, phase=dealt, returns 2 cards', () => {
    const state = freshState()
    // Set some prior state to confirm it's reset
    state.blackjackReel = {
      phase: 'resolved', cards: ['C2', 'C7'], total: 9,
      isSoft: false, multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 5
    }
    const rand = mulberry32(42)
    const out = dealHand(fixDef, state, 3, rand)

    expect(out.gameKind).toBe('base')
    expect(out.coinsIn).toBe(3)
    expect(out.totalPayout).toBe(0)
    expect(out.family).toBe('blackjack-reel')
    expect(out.featureEvents).toHaveLength(1)
    expect(out.featureEvents[0]!.type).toBe('cards-dealt')

    const bj = state.blackjackReel!
    expect(bj.phase).toBe('dealt')
    expect(bj.ante).toBe(3)
    expect(bj.cards).toHaveLength(2)
    // reel0 strip is ['C7'] → must be C7; reel1 strip is ['CK'] → must be CK
    expect(bj.cards[0]).toBe('C7')
    expect(bj.cards[1]).toBe('CK')
    expect(bj.total).toBe(17) // C7=7 + CK=10
    expect(bj.charlie).toBe(false)
    expect(bj.busted).toBe(false)
  })

  it('grid has one column per dealt card', () => {
    const state = freshState()
    const out = dealHand(fixDef, state, 1, mulberry32(1))
    expect(out.grid).toHaveLength(2) // 2 cards → 2 grid columns
    for (const col of out.grid) expect(col).toHaveLength(1)
  })

  it('stops records the strip indices drawn', () => {
    const state = freshState()
    const out = dealHand(fixDef, state, 1, mulberry32(1))
    expect(out.stops).toHaveLength(2)
    // reel0 strip length 1 → idx always 0; reel1 strip length 1 → idx always 0
    expect(out.stops[0]).toBe(0)
    expect(out.stops[1]).toBe(0)
  })
})

describe('hitCard', () => {
  it('adds a card and stays dealt when not bust and < 5 cards', () => {
    const state = freshState()
    // deal: C7 + CK = 17
    dealHand(fixDef, state, 2, mulberry32(99))
    // hit from strips[2] = ['C2','CK','C7'] — rand pick one of them
    const out = hitCard(fixDef, state, mulberry32(99))

    expect(out.coinsIn).toBe(0)
    const bj = state.blackjackReel!
    expect(bj.cards).toHaveLength(3)
    expect(bj.phase).toBe('dealt') // still in play
    expect(out.featureEvents[0]!.type).toBe('hit')
  })

  it('throws if called when phase is not dealt', () => {
    const state = freshState()
    state.blackjackReel = {
      phase: 'resolved', cards: ['C7', 'CK'], total: 17,
      isSoft: false, multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 1
    }
    expect(() => hitCard(fixDef, state, mulberry32(1))).toThrow('phase \'resolved\'')
  })

  it('bust with no save → phase=resolved, payout=0, featureEvent bust', () => {
    // Craft a hand that will bust on the next hit.
    // Load state manually: C7(7) + CK(10) + CK(10) = 27 (would be bust already,
    // so let's load C7 + CK + C2 = 19, then hit CK to get 29)
    // Manually put the state in C7+CK+CK position (total 27 is already bust)
    // Better: start from C7+CK (17) and make strips[2] return CK to get 27.
    // strips[2] = ['C2','CK','C7'], length 3.
    // We need rand() * 3 → floor to 1 to pick 'CK'.
    // mulberry32 draws: we'll craft a composite rand that always returns 1/3 (idx=1→CK).

    const state = freshState()
    dealHand(fixDef, state, 1, mulberry32(99)) // C7 + CK = 17

    // Force strips[2] idx=1 → 'CK', giving 17+10=27 (bust)
    const rawForIdx1 = (1 + 0.5) / 3 // 0.5 → Math.floor(0.5*3)=1
    const out = hitCard(fixDef, state, () => rawForIdx1)

    expect(out.totalPayout).toBe(0)
    expect(out.featureEvents[0]!.type).toBe('bust')
    const bj = state.blackjackReel!
    expect(bj.phase).toBe('resolved')
    expect(bj.busted).toBe(true)
  })

  it('bust with save held → busting card replaced with VOID in-place, reel index advances, phase stays dealt', () => {
    // NEW semantics (void-in-place): when a hit busts and saveHeld is true,
    // the drawn busting card is replaced with VOID in the cards array — the slot
    // is consumed but contributes 0. cards.length stays the same (increases by 1
    // vs before the draw), reel index keeps advancing monotonically. saveHeld is
    // set false via explicit state (not re-derived from saveSeen).
    //
    // Initial manual state: CK(10)+SAVE+C7(7) = total 17, saveHeld=true, 3 cards.
    // Hit from strips[3]=['C2','CK'] (cards.length=3 → reel 3).
    // raw=0.75 → idx=Math.floor(0.75*2)=1 → CK.
    // CK would give total 27 (bust). Save is held → VOID the drawn slot in-place.
    // Result: ['CK','SAVE','C7','VOID'], length=4, total=17, saveHeld=false, phase='dealt'.
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt',
      cards: ['CK', 'SAVE', 'C7'],
      total: 17,
      isSoft: false,
      multSum: 0,
      saveHeld: true,
      busted: false,
      charlie: false,
      ante: 1
    }
    // strips[3]=['C2','CK'] (cards.length=3 → reel 3); raw=0.75 → idx=1 → CK
    const rawForIdx1of2 = 0.75 // Math.floor(0.75*2)=1
    const out = hitCard(fixDef, state, () => rawForIdx1of2)

    expect(out.featureEvents[0]!.type).toBe('bust-saved')
    if (out.featureEvents[0]!.type === 'bust-saved') {
      expect(out.featureEvents[0].voidedCard).toBe('CK')
    }
    const bj = state.blackjackReel!
    expect(bj.phase).toBe('dealt') // not resolved — save kept us in play
    expect(bj.busted).toBe(false)
    expect(bj.saveHeld).toBe(false) // save consumed via explicit state

    // Void-in-place: the drawn slot is now VOID_SYMBOL, SAVE still in hand record
    // (but saveHeld=false ensures it can't re-grant). Length advances from 3→4.
    expect(bj.cards).toHaveLength(4) // reel index is now 4 (monotonic)
    expect(bj.cards[3]).toBe(VOID_SYMBOL) // busting card voided in-place
    expect(bj.total).toBe(17) // CK(10)+SAVE(0)+C7(7)+VOID(0)=17
  })

  it('reel index is strictly monotonic — a saved bust never re-reads an earlier reel', () => {
    // After a bust-save, cards.length is 4 (not 2 as in old behavior).
    // The next hit must draw from strips[4], not strips[2].
    // Start: 3 cards ['CK','SAVE','C7'], saveHeld=true.
    // Hit strips[3] → CK → bust → VOID in-place → cards length=4.
    // Second hit draws from strips[4]=['C2'] (always safe).
    // If reel index were wrong (rewound to 2), it would draw from strips[2] and
    // the test would be reading the wrong card. strips[4]=['C2']=2, total=19.
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt',
      cards: ['CK', 'SAVE', 'C7'],
      total: 17,
      isSoft: false,
      multSum: 0,
      saveHeld: true,
      busted: false,
      charlie: false,
      ante: 1
    }
    // First hit: draw from reel 3, bust, save triggers VOID
    hitCard(fixDef, state, () => 0.75) // idx=1 → CK, bust, void

    const bj = state.blackjackReel!
    // Now cards.length must be 4; next hit must use strips[4]=['C2']
    expect(bj.cards).toHaveLength(4)

    // Second hit: strips[4]=['C2'], always idx=0 → C2=2. Total becomes 17+2=19.
    const out2 = hitCard(fixDef, state, () => 0.1)
    // If reel index rewound to 2, we'd draw from strips[2]=['C2','CK','C7'] — also could be CK=bust.
    // But with idx=0 (raw=0.1 → floor(0.1*1)=0 for a len-1 strip), strips[4][0]='C2'.
    // Confirm cards now has 5 entries (charlie or resolved at 5).
    expect(state.blackjackReel!.cards).toHaveLength(5)
    // With ['CK','SAVE','C7','VOID','C2']: CK(10)+SAVE(0)+C7(7)+VOID(0)+C2(2)=19; 5 cards → charlie
    expect(out2.featureEvents[0]!.type).toBe('charlie')
    expect(state.blackjackReel!.charlie).toBe(true)
  })

  it('hand never exceeds 5 cards even with a save-voided slot', () => {
    // Build a 4-card hand including a VOID (from a prior bust-save), then hit the 5th.
    // cards=['CK','SAVE','C7','VOID'], saveHeld=false, length=4, total=17.
    // strips[4]=['C2'] → C2(2) → total=19, 5 cards → charlie.
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt',
      cards: ['CK', 'SAVE', 'C7', VOID_SYMBOL],
      total: 17,
      isSoft: false,
      multSum: 0,
      saveHeld: false,
      busted: false,
      charlie: false,
      ante: 2
    }
    // strips[4]=['C2'] (cards.length=4 → reel 4); always C2
    const out = hitCard(fixDef, state, () => 0.1)
    const bj = state.blackjackReel!
    expect(bj.cards).toHaveLength(5) // exactly 5 — never 6
    expect(bj.phase).toBe('resolved') // charlie auto-resolves
    expect(bj.charlie).toBe(true)
    expect(out.featureEvents[0]!.type).toBe('charlie')
    // payout: total=19, pay=2; charlieBonus=10; mult=1; ante=2 → (2+10)×1×2=24
    expect(out.totalPayout).toBe(24)
  })

  it('SAVE left in cards does not re-grant saveHeld after save is consumed', () => {
    // After void-in-place: cards=['CK','SAVE','C7','VOID'], saveHeld=false.
    // The SAVE card is still visible in cards, but saveHeld must stay false — it
    // must NOT be re-derived from saveSeen on the next hitCard call.
    // Draw strips[4]=['C2'] → C2(2) → total=19, 5 cards, no bust → charlie.
    // (This is safe regardless, but confirms SAVE does not re-grant before charlie.)
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt',
      cards: ['CK', 'SAVE', 'C7', VOID_SYMBOL],
      total: 17,
      isSoft: false,
      multSum: 0,
      saveHeld: false, // explicitly false — SAVE in cards must not re-grant
      busted: false,
      charlie: false,
      ante: 1
    }
    hitCard(fixDef, state, () => 0.1) // draws strips[4]=['C2'] → C2, charlie
    // After the hit, saveHeld must still be false (not re-granted by SAVE in cards)
    expect(state.blackjackReel!.saveHeld).toBe(false)
  })

  it('bust-save on the 5th reel slot fires charlie immediately (survive-all-five)', () => {
    // When the busting card is the 5th reel slot AND a save is held, voiding it
    // in-place fills all 5 slots → charlie must trigger immediately (not leave
    // the hand in phase=dealt for the caller to stand manually).
    //
    // State: 4 cards ['CK','SAVE','CK','MX2'], total=20, saveHeld=true.
    // fixDef strips[4]=['C2']. C2(2) → 20+2=22 bust → save fires → VOID slot 4.
    // cards=['CK','SAVE','CK','MX2','VOID'], length=5 → charlie.
    // payout: total=20, pay=3; charlieBonus=10; multSum=2→mult=2; ante=1 → (3+10)×2=26.
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt',
      cards: ['CK', 'SAVE', 'CK', 'MX2'],
      total: 20,
      isSoft: false,
      multSum: 2,
      saveHeld: true,
      busted: false,
      charlie: false,
      ante: 1
    }
    // strips[4]=['C2'] always → idx=0 with any raw; C2(2) + 20 = 22 bust → save → VOID
    const out = hitCard(fixDef, state, () => 0.1)
    const bj = state.blackjackReel!
    expect(bj.cards).toHaveLength(5)
    expect(bj.cards[4]).toBe(VOID_SYMBOL)
    expect(bj.charlie).toBe(true)
    expect(bj.phase).toBe('resolved')
    expect(bj.saveHeld).toBe(false)
    // Must emit bust-saved AND charlie events
    expect(out.featureEvents[0]!.type).toBe('bust-saved')
    expect(out.featureEvents[1]!.type).toBe('charlie')
    // payout: (3+10)×2×1 = 26
    expect(out.totalPayout).toBe(26)
  })

  it('bust save is spent: second bust on same hand resolves to bust', () => {
    // After a save is consumed (void-in-place), cards=['CK','SAVE','C7','VOID'] (4 cards).
    // A subsequent hit from strips[4] that busts has no save available → phase='resolved'.
    //
    // New state: 4 cards with VOID, saveHeld=false.
    // strips[4] only has 'C2'=2 → total becomes 19, not a bust.
    // So we use a different state that can still bust: 4 cards summing to 20.
    // ['CK','CK','VOID','VOID'] = 20, saveHeld=false.
    // strips[4]=['C2'] = 2 → total=22 bust, no save → resolved.
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt',
      cards: ['CK', 'CK', VOID_SYMBOL, VOID_SYMBOL],
      total: 20,
      isSoft: false,
      multSum: 0,
      saveHeld: false, // already spent
      busted: false,
      charlie: false,
      ante: 1
    }
    // fixDef strips[4]=['C2'] len=1, raw=0.1 → idx=0 → 'C2', 20+2=22 bust, no save
    const out = hitCard(fixDef, state, () => 0.1)
    expect(out.featureEvents[0]!.type).toBe('bust')
    expect(state.blackjackReel!.phase).toBe('resolved')
    expect(state.blackjackReel!.busted).toBe(true)
  })

  it('five cards without bust → charlie, auto-resolves with payout', () => {
    // Build a hand of 4 non-busting cards, then hit the 5th.
    // C2+C2+C2+C2 = 8; hit C2 → 10, charlie.
    const charlieFixDef: BlackjackReelMachineDef = {
      ...fixDef,
      strips: [
        ['C2'], ['C2'], ['C2'], ['C2'], ['C2'] // always C2=2
      ]
    }
    const state = freshState()
    dealHand(charlieFixDef, state, 2, mulberry32(1)) // C2+C2=4
    hitCard(charlieFixDef, state, mulberry32(2)) // C2 → 6
    hitCard(charlieFixDef, state, mulberry32(3)) // C2 → 8

    // 4 cards now, hit the 5th
    const out = hitCard(charlieFixDef, state, mulberry32(4)) // C2 → 10, charlie!

    expect(out.featureEvents[0]!.type).toBe('charlie')
    const bj = state.blackjackReel!
    expect(bj.charlie).toBe(true)
    expect(bj.phase).toBe('resolved')
    // total=10, no paytable entry → payEntry=0; charlieBonus=10, multSum=0→mult=1, ante=2
    // payout = (0 + 10) * 1 * 2 = 20
    expect(out.totalPayout).toBe(20)
  })
})

describe('standHand', () => {
  it('throws if phase is not dealt', () => {
    const state = freshState()
    state.blackjackReel = {
      phase: 'idle', cards: [], total: 0,
      isSoft: false, multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 1
    }
    expect(() => standHand(fixDef, state)).toThrow('phase \'idle\'')
  })

  it('resolves with payout from paytable × ante', () => {
    const state = freshState()
    dealHand(fixDef, state, 3, mulberry32(99)) // C7+CK=17, ante=3
    const out = standHand(fixDef, state)

    // total=17 → pay=1; mult=max(1,0)=1; ante=3 → payout=1×1×3=3
    expect(out.totalPayout).toBe(3)
    expect(out.coinsIn).toBe(0)
    expect(out.featureEvents[0]!.type).toBe('stand')
    expect(state.blackjackReel!.phase).toBe('resolved')
  })

  it('payout=0 for unlisted totals (< 17)', () => {
    const state = freshState()
    // Manual low-total state
    state.blackjackReel = {
      phase: 'dealt', cards: ['C7', 'C2'], total: 9,
      isSoft: false, multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 2
    }
    const out = standHand(fixDef, state)
    expect(out.totalPayout).toBe(0)
    expect(out.wins).toHaveLength(0)
  })

  it('multiplier sums correctly scale the payout', () => {
    const state = freshState()
    // total=17, multSum=2 → mult=max(1,2)=2; pay=1; ante=3 → payout=1×2×3=6
    state.blackjackReel = {
      phase: 'dealt', cards: ['C7', 'CK', 'MX2'], total: 17,
      isSoft: false, multSum: 2, saveHeld: false, busted: false, charlie: false, ante: 3
    }
    const out = standHand(fixDef, state)
    expect(out.totalPayout).toBe(6)
  })

  it('stand on 21 pays top paytable entry × ante', () => {
    const state = freshState()
    state.blackjackReel = {
      phase: 'dealt', cards: ['CA', 'CK'], total: 21,
      isSoft: true, multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 3
    }
    // total=21 → pay=5; mult=1; ante=3 → payout=15
    const out = standHand(fixDef, state)
    expect(out.totalPayout).toBe(15)
  })
})
