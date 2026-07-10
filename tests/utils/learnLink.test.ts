import { describe, expect, it } from 'vitest'
import { learnLink } from '../../app/utils/learnLink'
import { ALL_MACHINES } from '../../app/machines'

const LEARN_ROUTES = [
  '/learn/house-edge', '/learn/telnaes-reels', '/learn/gargoyles-eye',
  '/learn/hold-and-spin', '/learn/pachislo', '/learn/cascade-tumble',
  '/learn/ldw-near-miss', '/learn/glossary'
]

describe('learnLink', () => {
  it('maps every machine (floor + parked) to an existing learn page', () => {
    for (const def of ALL_MACHINES) {
      const link = learnLink(def)
      expect(LEARN_ROUTES, `${def.id} → ${link.to}`).toContain(link.to)
      expect(link.label.length).toBeGreaterThan(0)
    }
  })

  it('sends machines with their own deep-dive there first', () => {
    const byId = (id: string) => learnLink(ALL_MACHINES.find(d => d.id === id)!)
    expect(byId('ruby-of-gargoyle').to).toBe('/learn/gargoyles-eye')
    expect(byId('dragons-hoard').to).toBe('/learn/hold-and-spin')
    expect(byId('thunder-vault').to).toBe('/learn/hold-and-spin')
    expect(byId('stock-rush').to).toBe('/learn/pachislo')
    expect(byId('diamond-doubler').to).toBe('/learn/telnaes-reels')
    expect(byId('temple-of-gold').to).toBe('/learn/cascade-tumble')
    expect(byId('canal-royale').to).toBe('/learn/ldw-near-miss')
  })
})
