import { describe, it, expect } from 'vitest'
import { spinVideo } from '../app/engine/video'
import { initMachineState } from '../app/engine'
import type { RandomFn } from '../app/engine/rng'
import type { VideoMachineDef } from '../app/engine/types'

/** RandomFn replaying a fixed list of raws (throws if over-consumed). */
function scripted(vals: number[]): RandomFn {
  let i = 0
  return () => {
    if (i >= vals.length) throw new Error(`rng over-consumed at draw ${i}`)
    return vals[i++]!
  }
}
/** raw that makes floor(raw * range) === idx */
const at = (idx: number, range: number) => (idx + 0.5) / range

// 6-cell lines machine: line 1 = center. Strips put a DR run across the
// center when every reel stops at 0; reel 2 cell 1 is WD; scatters on
// reels 1/2/4 at cell 3 (visible from stops 1,2,3).
const LINES_DEF = {
  id: 'test-lines',
  name: 'Test Lines',
  family: 'video',
  denominationCents: 1,
  maxCoins: 3,
  symbols: {
    DR: { label: 'Dragon' }, KK: { label: 'King' }, QQ: { label: 'Queen' },
    WD: { label: 'Wild' }, SC: { label: 'Scatter' }
  },
  strips: [
    ['KK', 'DR', 'KK', 'SC', 'QQ', 'QQ'],
    ['QQ', 'DR', 'KK', 'SC', 'QQ', 'WD'],
    ['KK', 'DR', 'QQ', 'KK', 'QQ', 'KK'],
    ['QQ', 'DR', 'KK', 'SC', 'QQ', 'KK'],
    ['KK', 'DR', 'QQ', 'KK', 'QQ', 'QQ']
  ],
  betMode: {
    kind: 'lines',
    lines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2]]
  },
  fixedBet: false,
  wildSymbol: 'WD',
  scatter: { symbol: 'SC', pays: { 3: 2 }, triggerCount: 3 },
  freeSpins: { count: 10, multiplier: 2, retrigger: false },
  holdAndSpin: null,
  paytable: [
    { id: 'dr3', symbol: 'DR', length: 3, pay: 20 },
    { id: 'dr4', symbol: 'DR', length: 4, pay: 60 },
    { id: 'dr5', symbol: 'DR', length: 5, pay: 250 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 5 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 10 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 25 }
  ],
  progressive: null,
  history: 'test'
} as unknown as VideoMachineDef

describe('spinVideo base game', () => {
  it('pays an anchored center-line run with correct grid and trace', () => {
    const state = initMachineState(LINES_DEF)
    // all reels stop at 0: center row = cell 1 = DR on every reel
    const out = spinVideo(LINES_DEF, state, 1, scripted([at(0, 6), at(0, 6), at(0, 6), at(0, 6), at(0, 6)]))
    expect(out.gameKind).toBe('base')
    expect(out.coinsIn).toBe(1)
    expect(out.stops).toEqual([0, 0, 0, 0, 0])
    expect(out.grid[0]).toEqual(['KK', 'DR', 'KK'])
    expect(out.wins).toHaveLength(1)
    expect(out.wins[0]!.entryId).toBe('dr5')
    expect(out.totalPayout).toBe(250)
    expect(out.trace.draws).toHaveLength(5)
    expect(state.videoFeature).toBeNull()
  })

  it('only evaluates active lines (coins = line count)', () => {
    // top row at these stops reads KK,KK,KK,KK,KK -> kk5 on line 2 (top),
    // while the center line shows DR,SC,DR,SC,DR -> run 1, no center win
    const stops = [0, 2, 0, 2, 0]
    const rngFor = () => scripted(stops.map(s => at(s, 6)))
    const one = spinVideo(LINES_DEF, initMachineState(LINES_DEF), 1, rngFor())
    expect(one.wins.find(w => w.line === 'line-2')).toBeUndefined()
    const two = spinVideo(LINES_DEF, initMachineState(LINES_DEF), 2, rngFor())
    const win = two.wins.find(w => w.line === 'line-2')!
    expect(win.entryId).toBe('kk5')
    expect(win.payCredits).toBe(25)
  })

  it('pays scatters x total bet and arms free spins', () => {
    const state = initMachineState(LINES_DEF)
    // stops 1,1,x,1,x put SC (cell 3) in windows of reels 1,2,4
    const out = spinVideo(LINES_DEF, state, 3, scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    const sc = out.wins.find(w => w.line === 'scatter')!
    expect(sc.entryId).toBe('sc3')
    expect(sc.payCredits).toBe(2 * 3)
    expect(out.featureEvents).toContainEqual({ type: 'free-spins-triggered', count: 10, multiplier: 2 })
    expect(state.videoFeature).toEqual({ kind: 'freeSpins', remaining: 10, multiplier: 2, coins: 3 })
  })

  it('rejects out-of-range and fixed-bet-violating coin counts', () => {
    const state = initMachineState(LINES_DEF)
    expect(() => spinVideo(LINES_DEF, state, 0, scripted([]))).toThrow(/out of range/)
    expect(() => spinVideo(LINES_DEF, state, 4, scripted([]))).toThrow(/out of range/)
    const fixed = { ...LINES_DEF, fixedBet: true } as VideoMachineDef
    expect(() => spinVideo(fixed, initMachineState(fixed), 1, scripted([]))).toThrow(/fixed bet/)
  })
})

describe('free spins', () => {
  const trigger = (def: VideoMachineDef, coins: number) => {
    const state = initMachineState(def)
    spinVideo(def, state, coins, scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    expect(state.videoFeature?.kind).toBe('freeSpins')
    return state
  }

  it('replays the triggering bet at cost 0 with the multiplier applied', () => {
    const state = trigger(LINES_DEF, 3)
    // center dr5 again, now during free spins
    const out = spinVideo(LINES_DEF, state, 99 /* ignored during features */,
      scripted([at(0, 6), at(0, 6), at(0, 6), at(0, 6), at(0, 6)]))
    expect(out.gameKind).toBe('free-spin')
    expect(out.coinsIn).toBe(0)
    expect(out.coins).toBe(3)
    expect(out.wins[0]!.payCredits).toBe(250 * 2)
    expect(out.featureEvents).toContainEqual({ type: 'free-spin-consumed', remaining: 9 })
  })

  it('counts down and clears the feature after the last spin', () => {
    const state = trigger(LINES_DEF, 1)
    for (let i = 9; i >= 0; i--) {
      const out = spinVideo(LINES_DEF, state, 1,
        scripted([at(4, 6), at(4, 6), at(4, 6), at(4, 6), at(4, 6)]))
      expect(out.featureEvents).toContainEqual({ type: 'free-spin-consumed', remaining: i })
    }
    expect(state.videoFeature).toBeNull()
  })

  it('does not retrigger when retrigger is false, but pays the scatters', () => {
    const state = trigger(LINES_DEF, 1)
    const out = spinVideo(LINES_DEF, state, 1,
      scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    expect(out.wins.find(w => w.line === 'scatter')!.payCredits).toBe(2 * 1 * 2)
    expect(out.featureEvents.some(e => e.type === 'free-spins-retriggered')).toBe(false)
    expect((state.videoFeature as { remaining: number }).remaining).toBe(9)
  })

  it('retriggers add count when enabled', () => {
    const retrig = {
      ...LINES_DEF,
      freeSpins: { count: 8, multiplier: 1, retrigger: true }
    } as VideoMachineDef
    const state = trigger(retrig, 1)
    const out = spinVideo(retrig, state, 1,
      scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    // retrigger fires BEFORE the consume decrement: 8 + 8 - 1 = 15
    expect(out.featureEvents).toContainEqual({ type: 'free-spins-retriggered', added: 8, remaining: 16 })
    expect(out.featureEvents).toContainEqual({ type: 'free-spin-consumed', remaining: 15 })
  })
})

describe('hold-and-spin', () => {
  const HNS_DEF = {
    id: 'test-hns',
    name: 'Test HNS',
    family: 'video',
    denominationCents: 1,
    maxCoins: 5,
    symbols: { AA: { label: 'Ace' }, OR: { label: 'Orb' }, EM: { label: 'Empty' } },
    strips: [
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA']
    ],
    betMode: {
      kind: 'lines',
      lines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]]
    },
    fixedBet: true,
    wildSymbol: null,
    scatter: null,
    freeSpins: null,
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 6, respins: 3,
      respinOrbNumer: 2, respinOrbDenom: 24,
      orbValues: [{ credits: 25, weight: 1 }],
      emptySymbol: 'EM'
    },
    paytable: [],
    progressive: { kind: 'percent', reset: 5000, max: 50000, feedRate: 0.01 },
    history: 'test'
  } as unknown as VideoMachineDef

  const HIT = 0.01 // floor(0.01 * 24) = 0 < 2 -> orb lands
  const MISS = 0.5 // floor(0.5 * 24) = 12 -> no orb
  const VAL = 0.0 // single-entry value table

  /** trigger with 6 orbs: reels 1-3 stop at 5 -> windows [AA,OR,OR] -> cells 1,2 / 4,5 / 7,8 */
  const trigger = () => {
    const state = initMachineState(HNS_DEF)
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6), VAL, VAL, VAL, VAL, VAL, VAL]
    const out = spinVideo(HNS_DEF, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({
      type: 'orbs-locked', cells: [1, 2, 4, 5, 7, 8], credits: [25, 25, 25, 25, 25, 25]
    })
    expect(out.trace.draws).toHaveLength(11)
    expect(state.videoFeature?.kind).toBe('holdAndSpin')
    return state
  }

  it('locks triggering orbs without paying them in the base game', () => {
    const state = trigger()
    const f = state.videoFeature as { kind: 'holdAndSpin', locked: ({ credits: number } | null)[], respins: number }
    expect(f.respins).toBe(3)
    expect(f.locked.filter(c => c !== null)).toHaveLength(6)
  })

  it('ends after three consecutive missed respins and pays the lump', () => {
    const state = trigger()
    // 9 unlocked cells x 3 respins, all misses
    for (let r = 0; r < 2; r++) {
      const out = spinVideo(HNS_DEF, state, 5, scripted(new Array(9).fill(MISS)))
      expect(out.gameKind).toBe('respin')
      expect(out.coinsIn).toBe(0)
      expect(out.totalPayout).toBe(0)
      expect(out.featureEvents).toContainEqual({ type: 'respin-missed', remaining: 2 - r })
      expect(out.trace.draws).toHaveLength(9)
    }
    const last = spinVideo(HNS_DEF, state, 5, scripted(new Array(9).fill(MISS)))
    expect(last.featureEvents).toContainEqual({ type: 'respin-missed', remaining: 0 })
    expect(last.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 150, filled: false })
    expect(last.totalPayout).toBe(150)
    expect(last.trace.draws).toHaveLength(9)
    expect(state.videoFeature).toBeNull()
  })

  it('a new orb resets the counter to 3', () => {
    const state = trigger()
    // first unlocked cell (0) hits, others miss: draws = HIT, VAL, then 8 misses
    const out = spinVideo(HNS_DEF, state, 5, scripted([HIT, VAL, ...new Array(8).fill(MISS)]))
    expect(out.featureEvents).toContainEqual({ type: 'orbs-locked', cells: [0], credits: [25] })
    expect(out.featureEvents).toContainEqual({ type: 'respins-reset', respins: 3 })
    const f = state.videoFeature as { respins: number }
    expect(f.respins).toBe(3)
  })

  it('filling all 15 pays the Grand from the percent meter and resets it', () => {
    const state = trigger()
    state.progressive = { kind: 'percent', value: 5555.75 }
    // every one of the 9 unlocked cells hits: 9 x (HIT, VAL)
    const draws: number[] = []
    for (let i = 0; i < 9; i++) draws.push(HIT, VAL)
    const out = spinVideo(HNS_DEF, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 375, filled: true })
    expect(out.wins.find(w => w.entryId === 'hold-and-spin')!.payCredits).toBe(375)
    expect(out.wins.find(w => w.entryId === 'grand')!.payCredits).toBe(5555)
    expect(out.progressiveEvents).toEqual([{ type: 'hit', meter: 'percent', amountCredits: 5555 }])
    expect(out.totalPayout).toBe(375 + 5555)
    expect(out.trace.draws).toHaveLength(18)
    expect(state.progressive).toEqual({ kind: 'percent', value: 5000 })
    expect(state.videoFeature).toBeNull()
  })

  it('a respin-added orb joins the lump when the feature later misses out', () => {
    const state = trigger()
    // cell 0 hits, the other 8 unlocked cells miss -> counter back to 3
    let out = spinVideo(HNS_DEF, state, 5, scripted([HIT, VAL, ...new Array(8).fill(MISS)]))
    expect(out.featureEvents).toContainEqual({ type: 'respins-reset', respins: 3 })
    // three consecutive all-miss respins over the remaining 8 cells end it
    for (let r = 2; r >= 0; r--) {
      out = spinVideo(HNS_DEF, state, 5, scripted(new Array(8).fill(MISS)))
      expect(out.featureEvents).toContainEqual({ type: 'respin-missed', remaining: r })
    }
    expect(out.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 175, filled: false })
    expect(out.totalPayout).toBe(175)
    expect(state.videoFeature).toBeNull()
  })
})

describe('hold-and-spin multiplier (Gargoyle\'s Eye)', () => {
  const MULT_DEF = {
    id: 'test-mult', name: 'Test Mult', family: 'video',
    denominationCents: 1, maxCoins: 5,
    symbols: { AA: { label: 'Ace' }, OR: { label: 'Orb' }, EM: { label: 'Empty' } },
    strips: [
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA']
    ],
    betMode: {
      kind: 'lines',
      lines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]]
    },
    fixedBet: true, wildSymbol: null, scatter: null, freeSpins: null,
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 6, respins: 3,
      respinOrbNumer: 2, respinOrbDenom: 24,
      // weight total 2: raw<0.5 -> credits(25), raw>=0.5 -> mult x2
      orbValues: [{ credits: 25, weight: 1 }, { mult: 2, weight: 1 }],
      emptySymbol: 'EM'
    },
    paytable: [],
    progressive: { kind: 'percent', reset: 5000, max: 50000, feedRate: 0.01 },
    history: 'test'
  } as unknown as VideoMachineDef

  const HIT = 0.01 // floor(0.01*24)=0 < 2 -> orb lands
  const MISS = 0.5 // floor(0.5*24)=12 -> no orb
  const CREDIT = 0.25 // floor(0.25*2)=0 -> credit entry
  const MULT = 0.75 // floor(0.75*2)=1 -> multiplier entry

  // reels 1-3 stop at 5 -> windows [AA,OR,OR] -> 6 orbs at cells 1,2,4,5,7,8.
  // values: cells 1,2,4,5,7 credit; cell 8 a x2 multiplier.
  const trigger5c1m = () => {
    const state = initMachineState(MULT_DEF)
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6),
      CREDIT, CREDIT, CREDIT, CREDIT, CREDIT, MULT]
    const out = spinVideo(MULT_DEF, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({ type: 'orbs-locked', cells: [1, 2, 4, 5, 7], credits: [25, 25, 25, 25, 25] })
    expect(out.featureEvents).toContainEqual({ type: 'mult-orbs-locked', cells: [8], mults: [2] })
    return state
  }

  it('additively multiplies the collected credits at collect (x2 of 5 gems)', () => {
    const state = trigger5c1m()
    let out
    for (let r = 0; r < 3; r++) out = spinVideo(MULT_DEF, state, 5, scripted(new Array(9).fill(MISS)))
    // creditSum = 5*25 = 125; multiplier = 2; collected = 250
    expect(out!.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 250, filled: false })
    expect(out!.totalPayout).toBe(250)
    expect(state.videoFeature).toBeNull()
  })

  it('leaves the total unmultiplied (x1) when no multiplier gem is present', () => {
    const state = initMachineState(MULT_DEF)
    // all six triggering orbs are credits
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6),
      CREDIT, CREDIT, CREDIT, CREDIT, CREDIT, CREDIT]
    spinVideo(MULT_DEF, state, 5, scripted(draws))
    let out
    for (let r = 0; r < 3; r++) out = spinVideo(MULT_DEF, state, 5, scripted(new Array(9).fill(MISS)))
    expect(out!.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 150, filled: false })
  })

  it('a multiplier gem landing on a respin resets the counter', () => {
    const state = trigger5c1m()
    // cell 0 lands a multiplier; others miss
    const out = spinVideo(MULT_DEF, state, 5, scripted([HIT, MULT, ...new Array(8).fill(MISS)]))
    expect(out.featureEvents).toContainEqual({ type: 'mult-orbs-locked', cells: [0], mults: [2] })
    expect(out.featureEvents).toContainEqual({ type: 'respins-reset', respins: 3 })
  })

  it('a filled board multiplies the credits and pays a clean Grand', () => {
    const state = trigger5c1m()
    state.progressive = { kind: 'percent', value: 5000 }
    // fill all 9 remaining cells with credit orbs
    const draws: number[] = []
    for (let i = 0; i < 9; i++) draws.push(HIT, CREDIT)
    const out = spinVideo(MULT_DEF, state, 5, scripted(draws))
    // credit cells = 5 + 9 = 14 -> creditSum 350; mult 2 -> collected 700; Grand 5000 clean
    expect(out.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 700, filled: true })
    expect(out.wins.find(w => w.entryId === 'hold-and-spin')!.payCredits).toBe(700)
    expect(out.wins.find(w => w.entryId === 'grand')!.payCredits).toBe(5000)
    expect(out.totalPayout).toBe(700 + 5000)
  })

  it('adds multiplier faces (x2 + x3 = x5, not x6) at collect', () => {
    const def = JSON.parse(JSON.stringify(MULT_DEF)) as VideoMachineDef
    def.holdAndSpin!.orbValues = [{ credits: 25, weight: 1 }, { mult: 2, weight: 1 }, { mult: 3, weight: 1 }]
    const state = initMachineState(def)
    // weight total 3: floor(raw*3) -> 0 credit(25), 1 mult x2, 2 mult x3
    const C = 0.1 // floor(0.1*3)=0 -> credit
    const M2 = 0.5 // floor(0.5*3)=1 -> mult x2
    const M3 = 0.8 // floor(0.8*3)=2 -> mult x3
    // 6 orbs at cells 1,2,4,5,7,8 (ascending cell order); cells 1,2,4,5 credit; 7 -> x2; 8 -> x3
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6), C, C, C, C, M2, M3]
    const out = spinVideo(def, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({ type: 'orbs-locked', cells: [1, 2, 4, 5], credits: [25, 25, 25, 25] })
    expect(out.featureEvents).toContainEqual({ type: 'mult-orbs-locked', cells: [7, 8], mults: [2, 3] })
    let end
    for (let r = 0; r < 3; r++) end = spinVideo(def, state, 5, scripted(new Array(9).fill(0.5)))
    // creditSum = 4*25 = 100; additive multiplier = 2+3 = 5 -> 500 (NOT 100*6 = 600)
    expect(end!.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 500, filled: false })
    expect(end!.totalPayout).toBe(500)
  })
})
