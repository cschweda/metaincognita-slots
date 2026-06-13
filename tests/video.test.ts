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
