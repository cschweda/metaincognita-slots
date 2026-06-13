import { describe, it, expect } from 'vitest'
import { spinPachislo } from '../app/engine/pachislo'
import { initMachineState, mulberry32, spin } from '../app/engine'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import type { MachineSessionState, PachisloFlag, SpinOutcome } from '../app/engine/types'
import type { RandomFn } from '../app/engine/rng'

const D = 16384

/** scripted raws first, then a seeded stream (presses etc.) */
function composite(script: number[], seed: number): RandomFn {
  const tail = mulberry32(seed)
  let i = 0
  return () => (i < script.length ? script[i++]! : tail())
}
const rawFor = (idx: number, range: number) => (idx + 0.5) / range

// level-4 lottery layout (cumulative /16384):
// cherry-top [0,167) cherry-mid [167,334) cherry-bot [334,501) wm [501,757)
// bell [757,1128) replay [1128,3373) reg [3373,3420) big [3420,3479) none [3479,...)
const LOT = {
  cherryTop: rawFor(0, D),
  wm: rawFor(600, D),
  bell: rawFor(800, D),
  replay: rawFor(2000, D),
  reg: rawFor(3400, D),
  big: rawFor(3450, D),
  none: rawFor(10000, D)
}

function freshState(): MachineSessionState {
  return initMachineState(STOCK_RUSH)
}

/** spin normal games (none-lottery after the first) until the wanted flag realizes */
function spinUntilRealized(state: MachineSessionState, firstLottery: number, flag: PachisloFlag, tokens = 3): SpinOutcome {
  let out = spinPachislo(STOCK_RUSH, state, tokens, composite([firstLottery], 1))
  let guard = 0
  for (;;) {
    const realized = out.featureEvents.find(e => e.type === 'flag-realized')
    if (realized !== undefined) {
      expect((realized as { flag: PachisloFlag }).flag).toBe(flag)
      return out
    }
    expect(out.featureEvents.some(e => e.type === 'flag-stocked')).toBe(true)
    guard++
    expect(guard).toBeLessThan(60) // P(60 misses) is astronomically small for every service rate
    out = spinPachislo(STOCK_RUSH, state, tokens, composite([LOT.none], 1000 + guard))
  }
}

describe('normal games', () => {
  it('a no-flag game never pays and consumes 3 tokens', () => {
    const state = freshState()
    const out = spinPachislo(STOCK_RUSH, state, 3, composite([LOT.none], 7))
    expect(out.gameKind).toBe('normal')
    expect(out.coinsIn).toBe(3)
    expect(out.totalPayout).toBe(0)
    expect(out.wins).toHaveLength(0)
    expect(out.featureEvents.some(e => e.type === 'flag-drawn')).toBe(false)
    expect(out.trace.presses).toHaveLength(3)
    for (const p of out.trace.presses!) {
      expect(p.slipUsed).toBeGreaterThanOrEqual(0)
      expect(p.slipUsed).toBeLessThanOrEqual(4)
      expect(p.stop).toBe((p.press + p.slipUsed) % 21)
    }
  })

  it('a bell flag pays 15 when it lands — and stocks until it does', () => {
    const state = freshState()
    const out = spinUntilRealized(state, LOT.bell, 'bell')
    expect(out.totalPayout).toBe(15)
    expect(out.wins[0]!.entryId).toBe('bell')
    expect(state.pachislo!.smallQueue).toHaveLength(0)
  })

  it('watermelon pays 8', () => {
    const state = freshState()
    const out = spinUntilRealized(state, LOT.wm, 'watermelon')
    expect(out.totalPayout).toBe(8)
  })

  it('replay grants the next game free', () => {
    const state = freshState()
    spinUntilRealized(state, LOT.replay, 'replay')
    expect(state.pachislo!.replayNext).toBe(true)
    const free = spinPachislo(STOCK_RUSH, state, 3, composite([LOT.none], 99))
    expect(free.coinsIn).toBe(0)
    expect(free.gameKind).toBe('normal')
    expect(state.pachislo!.replayNext).toBe(false)
  })

  it('cherry pay depends on the flagged row: corners 4, middle 2 (row luck at full bet)', () => {
    const corner = freshState()
    const outTop = spinUntilRealized(corner, LOT.cherryTop, 'cherry-top', 3)
    expect(outTop.totalPayout).toBe(4)
    const middle = freshState()
    // cherry-mid raw: rows are 167-wide bands: cherry-mid begins at 167
    const outMid = spinUntilRealized(middle, rawFor(200, D), 'cherry-mid', 3)
    expect(outMid.totalPayout).toBe(2)
  })

  it('rejects anything but the full 3-token bet', () => {
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 0, composite([], 1))).toThrow(/exactly 3 tokens/)
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 1, composite([], 1))).toThrow(/exactly 3 tokens/)
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 2, composite([], 1))).toThrow(/exactly 3 tokens/)
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 4, composite([], 1))).toThrow(/exactly 3 tokens/)
  })
})

describe('REG bonus', () => {
  it('plays 8 guaranteed JAC games at 1 token in / 15 out', () => {
    const state = freshState()
    spinUntilRealized(state, LOT.reg, 'reg')
    expect(state.pachislo!.bonus).toEqual({ type: 'reg', round: 1, jacLeft: 8, interlude: null })
    for (let i = 0; i < 8; i++) {
      const out = spinPachislo(STOCK_RUSH, state, 3, composite([], 200 + i))
      expect(out.gameKind).toBe('jac')
      expect(out.coinsIn).toBe(1)
      expect(out.totalPayout).toBe(15)
      expect(out.wins[0]!.entryId).toBe('jac')
    }
    expect(state.pachislo!.bonus).toBeNull()
  })
})

describe('BIG bonus', () => {
  it('runs 3 JAC rounds with interludes that end on a free game', () => {
    const state = freshState()
    const realization = spinUntilRealized(state, LOT.big, 'big')
    expect(realization.totalPayout).toBe(15)
    const playJacRound = (round: number) => {
      for (let i = 0; i < 8; i++) {
        const out = spinPachislo(STOCK_RUSH, state, 3, composite([], 300 + round * 10 + i))
        expect(out.gameKind).toBe('jac')
        expect(out.totalPayout).toBe(15)
      }
    }
    playJacRound(1)
    expect(state.pachislo!.bonus!.interlude).toEqual({ index: 1, bells: 0 })
    // interlude: scripted /16 draws — two bells then the ending free game
    const bellRaw = rawFor(0, 16)
    const endRaw = rawFor(10, 16)
    const noneRaw = rawFor(14, 16)
    let out = spinPachislo(STOCK_RUSH, state, 3, composite([bellRaw], 400))
    expect(out.gameKind).toBe('interlude')
    expect(out.coinsIn).toBe(1)
    expect(out.totalPayout).toBe(15)
    out = spinPachislo(STOCK_RUSH, state, 3, composite([noneRaw], 401))
    expect(out.totalPayout).toBe(0)
    out = spinPachislo(STOCK_RUSH, state, 3, composite([endRaw], 402))
    expect(out.featureEvents).toContainEqual({ type: 'interlude-ended', index: 1, bells: 1 })
    expect(state.pachislo!.bonus).toEqual({ type: 'big', round: 2, jacLeft: 8, interlude: null })
    playJacRound(2)
    // second interlude: cap at 5 bells forces the end without a free game
    for (let i = 0; i < 5; i++) {
      out = spinPachislo(STOCK_RUSH, state, 3, composite([bellRaw], 500 + i))
      expect(out.totalPayout).toBe(15)
    }
    expect(out.featureEvents).toContainEqual({ type: 'interlude-ended', index: 2, bells: 5 })
    playJacRound(3)
    expect(state.pachislo!.bonus).toBeNull()
  })
})

describe('player presses (skill-stop buttons)', () => {
  it('uses the given press positions and draws no press RNG', () => {
    const state = freshState()
    const out = spinPachislo(STOCK_RUSH, state, 3, composite([LOT.none], 21), [4, 9, 13])
    expect(out.trace.draws).toHaveLength(1) // lottery only — no reel press draws
    expect(out.trace.draws[0]!.label).toBe('lottery')
    expect(out.trace.presses!.map(p => p.press)).toEqual([4, 9, 13])
    for (const p of out.trace.presses!) {
      expect(p.slipUsed).toBeGreaterThanOrEqual(0)
      expect(p.slipUsed).toBeLessThanOrEqual(4)
      expect(p.stop).toBe((p.press + p.slipUsed) % 21)
    }
  })

  it('honors presses during bonus games too', () => {
    const state = freshState()
    state.pachislo!.bonus = { type: 'reg', round: 1, jacLeft: 8, interlude: null }
    const out = spinPachislo(STOCK_RUSH, state, 3, composite([], 22), [0, 0, 0])
    expect(out.gameKind).toBe('jac')
    expect(out.trace.presses!.map(p => p.press)).toEqual([0, 0, 0])
    expect(out.trace.draws).toHaveLength(0) // no lottery in JAC, no press draws
  })

  it('honors presses during interlude games too', () => {
    const state = freshState()
    state.pachislo!.bonus = { type: 'big', round: 1, jacLeft: 0, interlude: { index: 1, bells: 0 } }
    const out = spinPachislo(STOCK_RUSH, state, 3, composite([rawFor(14, 16)], 27), [2, 5, 8])
    expect(out.gameKind).toBe('interlude')
    expect(out.trace.draws).toHaveLength(1) // interlude-lottery only — no press draws
    expect(out.trace.draws[0]!.label).toBe('interlude-lottery')
    expect(out.trace.presses!.map(p => p.press)).toEqual([2, 5, 8])
  })

  it('rejects invalid press positions', () => {
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 3, composite([LOT.none], 23), [21, 0, 0]))
      .toThrow(/press/)
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 3, composite([LOT.none], 24), [-1, 0, 0]))
      .toThrow(/press/)
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 3, composite([LOT.none], 25), [1.5, 0, 0]))
      .toThrow(/press/)
  })

  it('the lottery is drawn regardless of presses — timing cannot affect the flag', () => {
    const state = freshState()
    const out = spinPachislo(STOCK_RUSH, state, 3, composite([LOT.bell], 26), [0, 7, 14])
    const drawn = out.featureEvents.find(e => e.type === 'flag-drawn')
    expect(drawn).toEqual({ type: 'flag-drawn', flag: 'bell' })
  })
})

describe('stock conservation (seeded long run)', () => {
  it('every drawn flag is realized exactly once or still queued at the end', () => {
    const state = freshState()
    state.pachislo!.oddsLevel = 6
    const rand = mulberry32(424242)
    let drawn = 0
    let realized = 0
    for (let i = 0; i < 20_000; i++) {
      const out = spin(STOCK_RUSH, state, 3, rand)
      for (const e of out.featureEvents) {
        if (e.type === 'flag-drawn') drawn++
        if (e.type === 'flag-realized') realized++
      }
      if (out.gameKind === 'normal' && out.featureEvents.every(e => e.type !== 'flag-realized')) {
        expect(out.totalPayout).toBe(0) // no win without a realization — ever
      }
    }
    const queued = state.pachislo!.smallQueue.length + state.pachislo!.bonusQueue.length
    expect(drawn).toBe(realized + queued)
    expect(realized).toBeGreaterThan(3000) // sanity: flags actually flow at L6
  })
})
