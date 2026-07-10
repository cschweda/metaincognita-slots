import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'
import { CANAL_ROYALE } from '../../app/machines/canal-royale'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { STOCK_RUSH } from '../../app/machines/stock-rush'
import { TEMPLE_OF_GOLD } from '../../app/machines/temple-of-gold'
import { entryLabel, gameKindLabel, machineName } from '../../app/utils/entryLabel'

describe('machineName', () => {
  it('resolves floor ids to display names and falls back to the raw id', () => {
    expect(machineName('sevens-ablaze')).toBe('Sevens Ablaze')
    expect(machineName('long-gone-machine')).toBe('long-gone-machine')
  })
})

describe('entryLabel', () => {
  it('humanizes every paytable id on the floor (no raw id leaks)', () => {
    for (const def of FLOOR) {
      // cascade paytables are symbol-keyed objects; their entry ids ARE symbol
      // ids and get covered by the temple assertion below
      if (!('paytable' in def) || !Array.isArray(def.paytable)) continue
      for (const e of def.paytable as { id: string }[]) {
        const label = entryLabel(def, e.id)
        expect(label, `${def.id}/${e.id} must humanize`).not.toBe(e.id)
        expect(label.length).toBeGreaterThan(2)
      }
    }
  })

  it('renders the canonical family shapes', () => {
    expect(entryLabel(CANAL_ROYALE, 'li5')).toBe('5× Winged Lion')
    expect(entryLabel(CANAL_ROYALE, 'sc3')).toBe('3× Gondola Scatter')
    expect(entryLabel(CANAL_ROYALE, 'grand')).toBe('Grand')
    expect(entryLabel(CANAL_ROYALE, 'hold-and-spin')).toBe('Hold & Spin')
    expect(entryLabel(SEVENS_ABLAZE, '3f7')).toBe('3× Flaming Seven')
    expect(entryLabel(SEVENS_ABLAZE, 'mix7')).toBe('Any Flaming Seven / Red Seven')
    expect(entryLabel(STOCK_RUSH, 'big')).toBe('BIG bonus')
    expect(entryLabel(STOCK_RUSH, 'jac')).toBe('JAC win')
    // cascade entry ids are symbol ids
    const sym = Object.keys(TEMPLE_OF_GOLD.symbols)[0]!
    expect(entryLabel(TEMPLE_OF_GOLD, sym)).toContain(TEMPLE_OF_GOLD.symbols[sym]!.label)
  })

  it('never throws: unknown ids and null defs fall back to the raw id', () => {
    expect(entryLabel(CANAL_ROYALE, 'mystery-id')).toBe('mystery-id')
    expect(entryLabel(null, 'li5')).toBe('li5')
  })
})

describe('gameKindLabel', () => {
  it('humanizes the engine game kinds and passes unknowns through', () => {
    expect(gameKindLabel('base')).toBe('Base')
    expect(gameKindLabel('normal')).toBe('Base')
    expect(gameKindLabel('free-spin')).toBe('Free spin')
    expect(gameKindLabel('respin')).toBe('Respin')
    expect(gameKindLabel('jac')).toBe('JAC')
    expect(gameKindLabel('interlude')).toBe('Interlude')
    expect(gameKindLabel('deal')).toBe('Deal')
    expect(gameKindLabel('weird')).toBe('weird')
  })
})

describe('wonder-wheel labels', () => {
  it('humanizes wedge entries and the wheel paytable', async () => {
    const { WONDER_WHEEL } = await import('../../app/machines/wonder-wheel')
    expect(entryLabel(WONDER_WHEEL, 'wedge-2500')).toBe('Wheel: 2,500 credits')
    expect(entryLabel(WONDER_WHEEL, 'wedge-25')).toBe('Wheel: 25 credits')
    expect(entryLabel(WONDER_WHEEL, '3w7')).toBe('3× Neon Seven')
    expect(entryLabel(WONDER_WHEEL, 'anybar')).toContain('Any')
  })
})
