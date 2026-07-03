import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'
import { floorIntel } from '../../app/utils/floorIntel'

// Regression guard: ruby-of-gargoyle was missing from the old hand-maintained
// TOP_AWARD_ENTRY map, so its floor card silently dropped the "Top award" row.
// The id now lives on each machine def (topAwardEntryId) and must resolve to a
// real breakdown entry with real odds on every floor machine.
describe('floorIntel top award', () => {
  it.each(FLOOR.map(d => [d.id, d] as const))(
    '%s exposes a top award with real odds',
    (_id, def) => {
      const intel = floorIntel(def)
      expect(intel.topAwardId).not.toBeNull()
      expect(intel.topAwardProbability).not.toBeNull()
      expect(intel.topAwardProbability!).toBeGreaterThan(0)
      expect(intel.topAwardProbability!).toBeLessThan(1)
    }
  )
})
