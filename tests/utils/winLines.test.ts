import { describe, expect, it } from 'vitest'
import { pluralize, summariseWins } from '../../app/utils/winLines'
import { CANAL_ROYALE } from '../../app/machines/canal-royale'
import { DRAGONS_HOARD } from '../../app/machines/dragons-hoard'

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
    // every DR plus the wild cell are glowed
    expect(w!.cells).toContainEqual({ reel: 0, row: 0 })
    expect(w!.cells).toContainEqual({ reel: 1, row: 1 })
    expect(w!.cells).toContainEqual({ reel: 2, row: 0 }) // the wild
    expect(w!.cells).toContainEqual({ reel: 4, row: 0 })
  })

  it('single payline maps label to a row across the matched reels', () => {
    const def = DRAGONS_HOARD // any def works; we only exercise the single branch
    const mk = (line: string) => summariseWins(def, { machineId: def.id, grid: [], wins: [{ line, entryId: 'x', symbols: ['S7', 'S7', 'S7'], payCredits: 10, wildCount: 0, progressive: false }] } as never)[0]!
    expect(mk('center').cells).toEqual([{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }])
    expect(mk('top').cells).toEqual([{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }])
    expect(mk('bottom').cells).toEqual([{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 2 }])
  })
})
