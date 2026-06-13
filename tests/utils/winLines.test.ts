import { describe, expect, it } from 'vitest'
import { pluralize, summariseWins } from '../../app/utils/winLines'
import { CANAL_ROYALE } from '../../app/machines/canal-royale'
import { DRAGONS_HOARD } from '../../app/machines/dragons-hoard'
import { DIAMOND_DOUBLER } from '../../app/machines/diamond-doubler'
import { SERIES_E_3LINE } from '../../app/machines/series-e-3line'

describe('pluralize', () => {
  it.each([
    ['King', 'Kings'], ['Cherry', 'Cherries'], ['Winged Lion', 'Winged Lions'],
    ['Seven', 'Sevens'], ['Carnival Mask', 'Carnival Masks'], ['Ten', 'Tens']
  ])('%s -> %s', (a, b) => expect(pluralize(a)).toBe(b))
})

describe('summariseWins', () => {
  it('returns empty for null / no wins', () => {
    expect(summariseWins(CANAL_ROYALE, null)).toEqual([])
    expect(summariseWins(CANAL_ROYALE, { machineId: 'canal-royale', wins: [] } as never)).toEqual([])
  })

  it('summarises a line win with count, plural name, pattern, colour, and cells', () => {
    // line-1 is LINES25[0] = [1,1,1,1,1]; 4 Kings from the left
    const outcome = {
      machineId: 'canal-royale',
      wins: [{ line: 'line-1', entryId: 'kk4', symbols: ['KK', 'KK', 'KK', 'KK'], payCredits: 30, wildCount: 0, progressive: false }]
    } as never
    const [w] = summariseWins(CANAL_ROYALE, outcome)
    expect(w!.lineNumber).toBe(1)
    expect(w!.count).toBe(4)
    expect(w!.pluralName).toBe('Kings')
    expect(w!.pattern).toEqual([1, 1, 1, 1, 1])
    expect(w!.kind).toBe('line')
    expect(w!.cells).toEqual([
      { reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }
    ])
    expect(typeof w!.color).toBe('string')
  })

  it('derives the matched RUN from full-line cells (video fills all 5 reels)', () => {
    // The engine reports the whole payline in `symbols`; only 3 match here.
    // line-3 = LINES25[2] = [2,2,2,2,2]; AA, WD, WD then LI breaks -> 3 Aces.
    const outcome = {
      machineId: 'canal-royale',
      wins: [{ line: 'line-3', entryId: 'aa3', symbols: ['AA', 'WD', 'WD', 'LI', 'TT'], payCredits: 12, wildCount: 2, progressive: false }]
    } as never
    const [w] = summariseWins(CANAL_ROYALE, outcome)
    expect(w!.count).toBe(3)
    expect(w!.symbolId).toBe('AA')
    expect(w!.pluralName).toBe('Aces')
    expect(w!.cells).toEqual([{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 2 }])
    expect(w!.pattern).toEqual([2, 2, 2, 2, 2]) // full payline kept for drawing the line
  })

  it('names the paying symbol, not the wild, on a wild-led line', () => {
    const outcome = {
      machineId: 'canal-royale',
      wins: [{ line: 'line-2', entryId: 'ma4', symbols: ['WD', 'MA', 'MA', 'MA', 'TT'], payCredits: 120, wildCount: 1, progressive: false }]
    } as never
    const [w] = summariseWins(CANAL_ROYALE, outcome)
    expect(w!.count).toBe(4)
    expect(w!.symbolId).toBe('MA')
    expect(w!.pluralName).toBe('Carnival Masks')
  })

  it('skips feature payouts with empty symbols, keeps co-occurring line wins (H2a)', () => {
    // hold-and-spin / grand carry symbols:[] — they belong to the gross WIN total,
    // not a per-line chip. They must NOT produce a garbled count:0 WinLine.
    const outcome = {
      machineId: 'canal-royale',
      grid: [],
      wins: [
        { line: 'hold-and-spin', entryId: 'hold-and-spin', symbols: [], payCredits: 500, wildCount: 0, progressive: false },
        { line: 'line-1', entryId: 'kk4', symbols: ['KK', 'KK', 'KK', 'KK'], payCredits: 30, wildCount: 0, progressive: false }
      ]
    } as never
    const rows = summariseWins(CANAL_ROYALE, outcome)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lineNumber).toBe(1)
    expect(rows[0]!.count).toBe(4)
    expect(rows[0]!.pluralName).toBe('Kings')
  })

  it('scatter win glows every scatter cell anywhere on the grid, no wild sub (H2b)', () => {
    // SC is canal-royale's scatter; it pays from any reel/any row and is NOT
    // wild-substituted. WD (wild) on reel 1 must not count as a scatter.
    const grid = [
      ['SC', 'AA', 'KK'],
      ['AA', 'WD', 'QQ'],
      ['JJ', 'SC', 'TT'],
      ['KK', 'QQ', 'AA'],
      ['SC', 'TT', 'JJ']
    ]
    const outcome = {
      machineId: 'canal-royale',
      grid,
      wins: [{ line: 'scatter', entryId: 'sc3', symbols: ['SC', 'SC', 'SC'], payCredits: 50, wildCount: 0, progressive: false }]
    } as never
    const [w] = summariseWins(CANAL_ROYALE, outcome)
    expect(w!.kind).toBe('ways') // PaylineOverlay draws no line for scatters
    expect(w!.count).toBe(3)
    expect(w!.pluralName).toBe('Gondola Scatters')
    expect(w!.cells).toEqual([{ reel: 0, row: 0 }, { reel: 2, row: 1 }, { reel: 4, row: 0 }])
    expect(w!.cells).not.toContainEqual({ reel: 1, row: 1 }) // the wild is not a scatter
  })
})

describe('summariseWins cells for ways and single', () => {
  it('ways win glows every grid cell matching the symbol or wild', () => {
    // DR is the dragon symbol; build a tiny grid with DR in a few spots + a wild
    const def = DRAGONS_HOARD
    const wild = (def as { wildSymbol?: string }).wildSymbol! // pearl wild id
    const grid = [
      ['DR', 'AA', 'KK'],
      ['AA', 'DR', 'QQ'],
      [wild, 'JJ', 'DR'],
      ['TT', 'KK', 'AA'],
      ['DR', 'AA', 'KK']
    ]
    const outcome = { machineId: def.id, grid, wins: [{ line: 'ways-1', entryId: 'dr', symbols: ['DR', 'DR', 'DR'], payCredits: 50, wildCount: 1, progressive: false }] } as never
    const [w] = summariseWins(def, outcome)
    expect(w!.kind).toBe('ways')
    // only the winning run glows: scan just the first `symbols.length` (3) reels
    expect(w!.cells).toContainEqual({ reel: 0, row: 0 })
    expect(w!.cells).toContainEqual({ reel: 1, row: 1 })
    expect(w!.cells).toContainEqual({ reel: 2, row: 0 }) // the wild
    expect(w!.cells).toContainEqual({ reel: 2, row: 2 }) // DR on reel 2
    // the matching DR on reel 4 sits AFTER the 3-run, so it must NOT glow (M3)
    expect(w!.cells).not.toContainEqual({ reel: 4, row: 0 })
    expect(w!.cells.every(c => c.reel <= 2)).toBe(true)
  })

  it('single payline maps label to a row across the matched reels', () => {
    const def = DRAGONS_HOARD // any def works; we only exercise the single branch
    const mk = (line: string) => summariseWins(def, { machineId: def.id, grid: [], wins: [{ line, entryId: 'x', symbols: ['S7', 'S7', 'S7'], payCredits: 10, wildCount: 0, progressive: false }] } as never)[0]!
    expect(mk('center').cells).toEqual([{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }])
    expect(mk('top').cells).toEqual([{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }])
    expect(mk('bottom').cells).toEqual([{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 2 }])
  })

  it('stepper count win (cherries) reports the real n, not the full line', () => {
    // diamond-doubler ch1 = count CH n:1; full line is [CH, BL, S7] -> 1 Cherry
    const w1 = summariseWins(DIAMOND_DOUBLER, { machineId: 'diamond-doubler', grid: [], wins: [{ line: 'payline', entryId: 'ch1', symbols: ['CH', 'BL', 'S7'], payCredits: 2, wildCount: 0, progressive: false }] } as never)[0]!
    expect(w1.count).toBe(1)
    expect(w1.pluralName).toBe('Cherries')
    expect(w1.cells).toEqual([{ reel: 0, row: 1 }])

    // ch2 = count CH n:2; [CH, BL, CH] -> 2 Cherries at reels 0 and 2
    const w2 = summariseWins(DIAMOND_DOUBLER, { machineId: 'diamond-doubler', grid: [], wins: [{ line: 'payline', entryId: 'ch2', symbols: ['CH', 'BL', 'CH'], payCredits: 5, wildCount: 0, progressive: false }] } as never)[0]!
    expect(w2.count).toBe(2)
    expect(w2.cells).toEqual([{ reel: 0, row: 1 }, { reel: 2, row: 1 }])
  })

  it('stepper count win excludes a wild on the line (count is literal-symbol only)', () => {
    // diamond-doubler ch1 = count CH n:1; DW is the wild. The engine tallies
    // literal cherries only (awards.ts does NOT wild-substitute count awards),
    // so [CH, DW, B3] is 1 Cherry and the wild cell must not glow. Regression
    // for the count branch wrongly adding `|| s === wild` (final-audit fix).
    const wild = (DIAMOND_DOUBLER as { wildSymbol?: string }).wildSymbol!
    const w = summariseWins(DIAMOND_DOUBLER, { machineId: 'diamond-doubler', grid: [], wins: [{ line: 'payline', entryId: 'ch1', symbols: ['CH', wild, 'B3'], payCredits: 2, wildCount: 0, progressive: false }] } as never)[0]!
    expect(w.count).toBe(1)
    expect(w.pluralName).toBe('Cherries')
    expect(w.cells).toEqual([{ reel: 0, row: 1 }])
  })

  it('stepper allSame win names the symbol and glows the whole line', () => {
    const w = summariseWins(DIAMOND_DOUBLER, { machineId: 'diamond-doubler', grid: [], wins: [{ line: 'payline', entryId: '3s7', symbols: ['S7', 'S7', 'S7'], payCredits: 80, wildCount: 0, progressive: false }] } as never)[0]!
    expect(w.count).toBe(3)
    expect(w.pluralName).toBe('Sevens')
    expect(w.cells).toHaveLength(3)
  })

  it('stepper anyOf (any bars) names the shared category, not the first bar', () => {
    const w = summariseWins(DIAMOND_DOUBLER, { machineId: 'diamond-doubler', grid: [], wins: [{ line: 'payline', entryId: 'anybar', symbols: ['B3', 'B1', 'B2'], payCredits: 5, wildCount: 0, progressive: false }] } as never)[0]!
    expect(w.count).toBe(3)
    expect(w.pluralName).toBe('Bars')
  })

  it('bally run win uses the left-anchored length, not the full line', () => {
    // series-e chx2 = run CH length 2; full line [CH, CH, BL, S7, S7] -> 2 Cherries
    const w = summariseWins(SERIES_E_3LINE, { machineId: 'series-e-3line', grid: [], wins: [{ line: 'center', entryId: 'chx2', symbols: ['CH', 'CH', 'BL', 'S7', 'S7'], payCredits: 5, wildCount: 0, progressive: false }] } as never)[0]!
    expect(w.count).toBe(2)
    expect(w.pluralName).toBe('Cherries')
    expect(w.cells).toEqual([{ reel: 0, row: 1 }, { reel: 1, row: 1 }])
  })
})
