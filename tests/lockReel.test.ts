import { describe, it, expect } from 'vitest'
import {
  freshLockState,
  dealStart,
  stopReel,
  bonusStop,
  teaseAvailable,
  lockGridFull
} from '../app/engine/lockReel'
import { mulberry32 } from '../app/engine'
import type { LockReelMachineDef, MachineSessionState } from '../app/engine/types'

// ── helpers ──────────────────────────────────────────────────────────────────

/** A RandomFn that replays a fixed sequence (then returns 0). Mirrors blackjackReel.test. */
function seq(values: number[]): () => number {
  let i = 0
  return () => (i < values.length ? values[i++]! : 0)
}

/** A RandomFn that always returns the same raw value. */
function constRand(v: number): () => number {
  return () => v
}

function emptyState(): MachineSessionState {
  return { progressive: null, videoFeature: null, pachislo: null, blackjackReel: null, lockReel: null }
}

/**
 * Rich fixture: 5 strips, length 4, rows 2. A 7 is reachable on every reel so
 * windows can be steered with the RNG. `start = floor(rand()*4)`:
 *   rand 0    -> start 0 -> [s0,s1]
 *   rand 0.25 -> start 1 -> [s1,s2]
 *   rand 0.5  -> start 2 -> [s2,s3]
 *   rand 0.75 -> start 3 -> [s3,s0] (wrap)
 */
function fixture(overrides: Partial<LockReelMachineDef> = {}): LockReelMachineDef {
  return {
    id: 'lock-fixture',
    name: 'Lock Fixture',
    family: 'lock-reel',
    denominationCents: 25,
    maxCoins: 10,
    history: 'test fixture',
    rows: 2,
    reels: [
      ['C5', 'C5', 'SEVEN', 'BLANK'],
      ['SEVEN', 'C10', 'BLANK', 'BLANK'],
      ['SEVEN', 'C10', 'BLANK', 'BLANK'],
      ['SEVEN', 'BLANK', 'MINI', 'BLANK'],
      ['SEVEN', 'BLANK', 'BLANK', 'GRAND']
    ],
    // Dedicated bonus strips (cash + SEVEN + BLANK only); bonus tests below
    // override these to steer respins (the base reels drive only the five stops).
    bonusReels: [
      ['C5', 'BLANK', 'C5', 'C10'],
      ['C5', 'BLANK', 'C5', 'C10'],
      ['C5', 'BLANK', 'C5', 'C10'],
      ['C5', 'BLANK', 'C5', 'C10'],
      ['C5', 'BLANK', 'C5', 'C10']
    ],
    symbols: {
      C5: { label: '$5' },
      C10: { label: '$10' },
      SEVEN: { label: '7' },
      BLANK: { label: '—' },
      MINI: { label: 'MINI' },
      MAJOR: { label: 'MAJOR' },
      GRAND: { label: 'GRAND' }
    },
    cashValues: { C5: 5, C10: 10 },
    prizes: { MINI: 50, MAJOR: 200, GRAND: 1000 },
    sevenSymbol: 'SEVEN',
    blankSymbol: 'BLANK',
    bonus: { respins: 3, sevenUpgrade: 7, grandOnFill: 'GRAND' },
    progressive: null,
    ...overrides
  }
}

// ── fresh state ──────────────────────────────────────────────────────────────

describe('freshLockState', () => {
  it('is an idle empty 5xrows grid', () => {
    const def = fixture()
    const s = freshLockState(def)
    expect(s.phase).toBe('idle')
    expect(s.grid).toHaveLength(5)
    expect(s.grid.every(col => col.length === def.rows && col.every(c => c === null))).toBe(true)
    expect(s.idx).toBe(0)
    expect(s.sevenCount).toBe(0)
    expect(s.collectCredits).toBe(0)
    expect(s.respinsLeft).toBe(0)
    expect(s.ante).toBe(0)
  })
})

// ── dealStart ────────────────────────────────────────────────────────────────

describe('dealStart', () => {
  it('charges the ante (coinsIn = coins), starts spinning, fresh grid', () => {
    const def = fixture()
    const state = emptyState()
    const out = dealStart(def, state, 3, seq([0]))
    expect(out.coinsIn).toBe(3)
    expect(out.totalPayout).toBe(0)
    expect(out.family).toBe('lock-reel')
    const lr = state.lockReel!
    expect(lr.phase).toBe('spinning')
    expect(lr.ante).toBe(3)
    expect(lr.idx).toBe(0)
    expect(lr.collectCredits).toBe(0)
    expect(lr.grid.every(col => col.every(c => c === null))).toBe(true)
  })
})

// ── stopReel: uniform window lock + tally ────────────────────────────────────

describe('stopReel', () => {
  it('locks the uniform-drawn window column and tallies cash (per coin)', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // reel 0, start 0 -> [C5, C5] = 10 credits/coin, 0 sevens
    const out = stopReel(def, state, constRand(0))
    const lr = state.lockReel!
    expect(lr.grid[0]).toEqual(['C5', 'C5'])
    expect(lr.collectCredits).toBe(10)
    expect(lr.sevenCount).toBe(0)
    expect(lr.idx).toBe(1)
    const colLocked = out.featureEvents.find(e => e.type === 'column-locked')
    expect(colLocked).toEqual({ type: 'column-locked', reel: 0, locked: ['C5', 'C5'] })
  })

  it('wraps the window around the strip end', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // reel 0, start 3 -> [BLANK, C5] (wrap to s0)
    stopReel(def, state, constRand(0.75))
    expect(state.lockReel!.grid[0]).toEqual(['BLANK', 'C5'])
    expect(state.lockReel!.collectCredits).toBe(5)
  })

  it('increments sevenCount per locked seven', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // reel 0, start 2 -> [SEVEN, BLANK] = 0 cash + 1 seven
    const out = stopReel(def, state, constRand(0.5))
    expect(state.lockReel!.grid[0]).toEqual(['SEVEN', 'BLANK'])
    expect(state.lockReel!.sevenCount).toBe(1)
    expect(state.lockReel!.collectCredits).toBe(0)
    expect(out.featureEvents.some(e => e.type === 'seven-locked')).toBe(true)
  })

  it('scales the payout by the ante at resolve (collect = ante x credits)', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 4, seq([0]))
    // Stop all 5 reels, each at start 0:
    // r0 [C5,C5]=10c/0s, r1 [SEVEN,C10]=10c/1s, r2 [SEVEN,C10]=10c/1s,
    // r3 [SEVEN,BLANK]=0c/1s, r4 [SEVEN,BLANK]=0c/1s
    // -> sevenCount 4 (>=3 => BONUS), credits 30
    stopReel(def, state, constRand(0))
    stopReel(def, state, constRand(0))
    stopReel(def, state, constRand(0))
    stopReel(def, state, constRand(0))
    const out = stopReel(def, state, constRand(0))
    const lr = state.lockReel!
    expect(lr.sevenCount).toBe(4)
    expect(lr.phase).toBe('bonus') // 4 sevens triggers the bonus
    expect(out.featureEvents.some(e => e.type === 'bonus-triggered')).toBe(true)
    expect(lr.respinsLeft).toBe(def.bonus.respins)
  })

  it('resolves and pays the collect when there is no bonus (< 3 sevens)', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 2, seq([0]))
    // Steer windows to avoid 7s where possible:
    // r0 start 0 -> [C5,C5] = 10c/0s
    stopReel(def, state, constRand(0))
    // r1 start 1 -> [C10,BLANK] = 10c/0s
    stopReel(def, state, constRand(0.25))
    // r2 start 1 -> [C10,BLANK] = 10c/0s
    stopReel(def, state, constRand(0.25))
    // r3 start 2 -> [MINI,BLANK] = prize 50/0s
    stopReel(def, state, constRand(0.5))
    // r4 start 1 -> [BLANK,BLANK] = 0c/0s
    const out = stopReel(def, state, constRand(0.25))
    const lr = state.lockReel!
    expect(lr.sevenCount).toBe(0)
    expect(lr.phase).toBe('resolved')
    // credits = 10 + 10 + 10 + 50 = 80; payout = ante(2) * 80 = 160
    expect(lr.collectCredits).toBe(80)
    expect(out.totalPayout).toBe(160)
    expect(out.featureEvents.some(e => e.type === 'collect')).toBe(true)
  })

  it('two sevens makes a tease available (flag-only, no auto re-stop)', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // r0 start 0 [C5,C5] 0s; r1 start 0 [SEVEN,C10] 1s; r2 start 0 [SEVEN,C10] 1s;
    // r3 start 1 [BLANK,MINI] 0s; r4 start 1 [BLANK,BLANK] 0s -> 2 sevens
    stopReel(def, state, constRand(0))
    stopReel(def, state, constRand(0))
    stopReel(def, state, constRand(0))
    stopReel(def, state, constRand(0.25))
    stopReel(def, state, constRand(0.25))
    const lr = state.lockReel!
    expect(lr.sevenCount).toBe(2)
    expect(lr.phase).toBe('resolved')
    expect(teaseAvailable(lr)).toBe(true)
  })
})

// ── bonus ────────────────────────────────────────────────────────────────────

describe('bonus respins (auto-playable)', () => {
  it('a forced 3-seven round enters bonus and bonusStop auto-loops to resolved', () => {
    const def = fixture()
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // All windows at start 0 -> 4 sevens -> bonus
    for (let i = 0; i < 5; i++) stopReel(def, state, constRand(0))
    const lr = state.lockReel!
    expect(lr.phase).toBe('bonus')
    // Auto-loop the bonus with a seeded RNG until resolved (the simulator's contract)
    const rand = mulberry32(12345)
    let guard = 0
    let lastPayout = 0
    while (lr.phase === 'bonus') {
      const out = bonusStop(def, state, rand)
      lastPayout = out.totalPayout
      if (++guard > 1000) throw new Error('bonus did not resolve')
    }
    expect(lr.phase).toBe('resolved')
    // payout is only delivered on the resolving bonusStop
    expect(lastPayout).toBeGreaterThan(0)
  })

  it('a pure-miss respin decrements respinsLeft, then a new lock resets it', () => {
    // Base reels seat 5 sevens + a BLANK row-1 cell; the RESPINS draw from the
    // dedicated bonus strips. Per-cell draw of bonus strip ['SEVEN','BLANK','C5','C5']:
    //   rand 0.25 -> index 1 = BLANK (miss)   rand 0.5 -> index 2 = C5 (lock)
    const def = fixture({
      reels: [
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5']
      ],
      bonusReels: [
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5']
      ],
      bonus: { respins: 3, sevenUpgrade: 7, grandOnFill: 'GRAND' }
    })
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // start 0 on every reel -> [SEVEN, BLANK]: 5 sevens, all row-1 cells BLANK (empty)
    for (let i = 0; i < 5; i++) stopReel(def, state, constRand(0))
    const lr = state.lockReel!
    expect(lr.phase).toBe('bonus')
    expect(lr.respinsLeft).toBe(3)
    // 1) A pure-miss respin (every empty cell draws BLANK) MUST decrement 3 -> 2.
    bonusStop(def, state, constRand(0.25))
    expect(lr.respinsLeft).toBe(2)
    expect(lr.phase).toBe('bonus')
    // 2) A respin that locks (every empty cell draws C5) MUST reset 2 -> 3.
    const out = bonusStop(def, state, constRand(0.5))
    expect(out.featureEvents.some(e => e.type === 'respin')).toBe(true)
    expect(lr.respinsLeft).toBe(def.bonus.respins) // reset on the new lock
  })

  it('filling the grid over respins awards the GRAND prize and resolves', () => {
    // A REALISTIC fill: the base seats one 7 + one empty (BLANK) per reel, then a
    // dense, all-cash bonus strip locks every empty cell on the respin -> grid
    // fills -> GRAND. (The grid is NOT full at bonus entry: the respins do it.)
    const def = fixture({
      reels: [
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5'],
        ['SEVEN', 'BLANK', 'C5', 'C5']
      ],
      // every draw locks a C5 — the respin can only fill, never miss
      bonusReels: [
        ['C5', 'C5', 'C5', 'C5'],
        ['C5', 'C5', 'C5', 'C5'],
        ['C5', 'C5', 'C5', 'C5'],
        ['C5', 'C5', 'C5', 'C5'],
        ['C5', 'C5', 'C5', 'C5']
      ]
    })
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // start 0 -> [SEVEN, BLANK] on every reel: 5 sevens (bonus), row-0 SEVEN (sticky),
    // row-1 BLANK (one empty per reel). Grid is NOT full at entry.
    for (let i = 0; i < 5; i++) stopReel(def, state, constRand(0))
    const lr = state.lockReel!
    expect(lr.phase).toBe('bonus')
    expect(lockGridFull(def, lr)).toBe(false)
    // one respin: each of the 5 empty cells draws C5 -> all lock -> grid full -> GRAND
    const out = bonusStop(def, state, constRand(0))
    expect(lr.phase).toBe('resolved')
    expect(out.featureEvents.some(e => e.type === 'grand')).toBe(true)
    // collect = bonus cash (5 cells * C5 = 25) + 5 sticky sevens * upgrade(7) = 35
    //           + GRAND(1000) = 1060; payout = ante(1) * 1060
    expect(lr.collectCredits).toBe(25 + 5 * def.bonus.sevenUpgrade + def.prizes.GRAND!)
    expect(out.totalPayout).toBe(lr.collectCredits)
  })

  it('a respin that locks nothing decrements respinsLeft and eventually resolves', () => {
    // Base seats 5 sevens + one empty per reel; the bonus strips are all-BLANK so
    // every respin is a pure miss (the counter only decrements, never resets).
    const def = fixture({
      reels: [
        ['SEVEN', 'BLANK', 'BLANK', 'BLANK'],
        ['SEVEN', 'BLANK', 'BLANK', 'BLANK'],
        ['SEVEN', 'BLANK', 'BLANK', 'BLANK'],
        ['SEVEN', 'BLANK', 'BLANK', 'BLANK'],
        ['SEVEN', 'BLANK', 'BLANK', 'BLANK']
      ],
      bonusReels: [
        ['BLANK', 'BLANK', 'BLANK', 'BLANK'],
        ['BLANK', 'BLANK', 'BLANK', 'BLANK'],
        ['BLANK', 'BLANK', 'BLANK', 'BLANK'],
        ['BLANK', 'BLANK', 'BLANK', 'BLANK'],
        ['BLANK', 'BLANK', 'BLANK', 'BLANK']
      ]
    })
    const state = emptyState()
    dealStart(def, state, 1, seq([0]))
    // start 0 -> [SEVEN, BLANK]: 5 sevens (bonus), one empty (BLANK) per reel
    for (let i = 0; i < 5; i++) stopReel(def, state, constRand(0))
    const lr = state.lockReel!
    expect(lr.phase).toBe('bonus')
    expect(lr.respinsLeft).toBe(3)
    // a per-cell draw of 0.5 -> index 2 = BLANK on every empty cell (pure misses)
    bonusStop(def, state, constRand(0.5))
    expect(lr.respinsLeft).toBe(2)
    bonusStop(def, state, constRand(0.5))
    expect(lr.respinsLeft).toBe(1)
    const out = bonusStop(def, state, constRand(0.5))
    expect(lr.respinsLeft).toBe(0)
    expect(lr.phase).toBe('resolved')
    // no new cash; collect = 0 base cash + 5 sticky sevens * 7 = 35 (grid not full -> no grand)
    expect(lr.collectCredits).toBe(5 * def.bonus.sevenUpgrade)
    expect(out.totalPayout).toBe(35)
    expect(out.featureEvents.some(e => e.type === 'grand')).toBe(false)
  })
})
