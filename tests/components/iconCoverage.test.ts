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
})
