import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'

describe('symbol icon metadata', () => {
  it('every symbol on every machine declares an icon id', () => {
    for (const def of FLOOR) {
      for (const [id, meta] of Object.entries(def.symbols)) {
        expect(typeof (meta as { icon?: string }).icon, `${def.id}:${id}`).toBe('string')
        expect((meta as { icon?: string }).icon!.length, `${def.id}:${id}`).toBeGreaterThan(0)
      }
    }
  })
})
