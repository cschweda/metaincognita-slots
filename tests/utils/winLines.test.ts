import { describe, expect, it } from 'vitest'
import { pluralize, summariseWins } from '../../app/utils/winLines'
import { CANAL_ROYALE } from '../../app/machines/canal-royale'

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
