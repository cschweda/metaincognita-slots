// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'
import { symbolArt } from '../../app/components/game/symbols/registry'

describe('icon coverage', () => {
  it('every machine symbol icon id resolves to registry art', () => {
    for (const def of FLOOR) {
      for (const [id, meta] of Object.entries(def.symbols)) {
        const icon = (meta as { icon?: string }).icon
        expect(symbolArt(icon), `${def.id}:${id} (${icon})`).not.toBeNull()
      }
    }
  })

  it('returns null for unknown, undefined, and inherited keys', () => {
    expect(symbolArt(undefined)).toBeNull()
    expect(symbolArt('not-a-real-icon')).toBeNull()
    expect(symbolArt('__proto__')).toBeNull() // no prototype-chain leakage
    expect(symbolArt('hasOwnProperty')).toBeNull()
  })

  it('resolves the Ruby of Gargoyle gem icons', () => {
    for (const id of ['gargoyle', 'ruby', 'chalice', 'crown', 'gargoyle-eye']) {
      expect(symbolArt(id), id).not.toBeNull()
    }
  })
})
