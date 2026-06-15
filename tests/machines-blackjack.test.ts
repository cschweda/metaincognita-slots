import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { HIT_OR_BUST } from '../app/machines/hit-or-bust'

// ---------------------------------------------------------------------------
// Hit or Bust — machine definition integrity + frozen calibration
//
// Frozen figures (blackjackReelExactRtp, optimal stopping, 2026-06-14):
//   rtpPerCoin      ≈ 0.8999786778089339  (89.998%)
//   hitFrequency    ≈ 0.6259376229830778  (62.59%)
//   variancePerCoin ≈ 1.9888723336949963
//   bustRate        ≈ 0.37406237701692263 (37.41%)
//   charlieRate     ≈ 0.1553207398661945  (15.53%)
//
// Paytable: 18→0.25, 19→0.5, 20→0.75, 21→1.25  (exact IEEE-754)
// charlieBonus: 1.1875 = 19/16                    (exact IEEE-754)
// ---------------------------------------------------------------------------

describe('hit-or-bust — machine definition integrity', () => {
  it('passes validateMachineDef without errors', () => {
    expect(() => validateMachineDef(HIT_OR_BUST)).not.toThrow()
  })

  it('has the correct family, id, and denomination', () => {
    expect(HIT_OR_BUST.id).toBe('hit-or-bust')
    expect(HIT_OR_BUST.family).toBe('blackjack-reel')
    expect(HIT_OR_BUST.denominationCents).toBe(25)
    expect(HIT_OR_BUST.maxCoins).toBe(3)
  })

  it('has exactly 5 strips', () => {
    expect(HIT_OR_BUST.strips).toHaveLength(5)
  })

  it('all strips are non-empty and every symbol is declared', () => {
    const declared = new Set(Object.keys(HIT_OR_BUST.symbols))
    for (let r = 0; r < 5; r++) {
      const strip = HIT_OR_BUST.strips[r]!
      expect(strip.length).toBeGreaterThan(0)
      for (const s of strip) {
        expect(declared.has(s), `reel ${r}: unknown symbol "${s}"`).toBe(true)
      }
    }
  })

  it('aceSymbol is declared in symbols and not in cardValues', () => {
    expect(HIT_OR_BUST.symbols[HIT_OR_BUST.aceSymbol]).toBeTruthy()
    expect(HIT_OR_BUST.cardValues[HIT_OR_BUST.aceSymbol]).toBeUndefined()
  })

  it('multiplierSymbols reference declared symbols and have multiplier >= 2', () => {
    for (const [sym, mult] of Object.entries(HIT_OR_BUST.multiplierSymbols)) {
      expect(HIT_OR_BUST.symbols[sym]).toBeTruthy()
      expect(mult).toBeGreaterThanOrEqual(2)
    }
  })

  it('bustSaveSymbol is declared in symbols', () => {
    expect(HIT_OR_BUST.bustSaveSymbol).not.toBeNull()
    expect(HIT_OR_BUST.symbols[HIT_OR_BUST.bustSaveSymbol!]).toBeTruthy()
  })

  it('paytable has 4 entries covering 18–21, all pays positive', () => {
    expect(HIT_OR_BUST.paytable).toHaveLength(4)
    const totals = HIT_OR_BUST.paytable.map(e => e.total).sort((a, b) => a - b)
    expect(totals).toEqual([18, 19, 20, 21])
    for (const e of HIT_OR_BUST.paytable) {
      expect(e.pay).toBeGreaterThan(0)
    }
  })

  it('paytable pays are monotonically increasing with total', () => {
    const sorted = [...HIT_OR_BUST.paytable].sort((a, b) => a.total - b.total)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.pay).toBeGreaterThan(sorted[i - 1]!.pay)
    }
  })

  it('charlieBonus is positive', () => {
    expect(HIT_OR_BUST.charlieBonus).toBeGreaterThan(0)
  })

  it('progressive is null (no progressive meter on this machine)', () => {
    expect(HIT_OR_BUST.progressive).toBeNull()
  })

  it('strip compositions match the calibrated design', () => {
    const counts = HIT_OR_BUST.strips.map((strip) => {
      const c: Record<string, number> = {}
      strip.forEach((s) => {
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    // Reel 0: 20 stops — 8 tens, 2 aces, 8 low, 1 MX2, 1 SAVE
    expect(counts[0]).toEqual({
      C10: 2, CJ: 2, CQ: 2, CK: 2, CA: 2,
      C2: 1, C3: 1, C4: 1, C5: 1, C6: 1, C7: 1, C8: 1, C9: 1,
      MX2: 1, SAVE: 1
    })
    // Reel 1: same as reel 0
    expect(counts[1]).toEqual(counts[0])
    // Reel 2: 22 stops — 10 tens (3×C10, 3×CJ, 2×CQ, 2×CK), 1 ace, 8 low, MX2+MX3+SAVE
    expect(counts[2]).toEqual({
      C10: 3, CJ: 3, CQ: 2, CK: 2, CA: 1,
      C2: 1, C3: 1, C4: 1, C5: 1, C6: 1, C7: 1, C8: 1, C9: 1,
      MX2: 1, MX3: 1, SAVE: 1
    })
    // Reel 3: 21 stops — 11 tens, 1 ace, 6 low, MX2+MX3+SAVE
    expect(counts[3]).toEqual({
      C10: 3, CJ: 3, CQ: 3, CK: 2, CA: 1,
      C2: 1, C3: 1, C4: 1, C5: 1, C6: 1, C7: 1,
      MX2: 1, MX3: 1, SAVE: 1
    })
    // Reel 4: 22 stops — 13 tens, 2 aces, 4 low, MX2+MX3+SAVE
    expect(counts[4]).toEqual({
      C10: 4, CJ: 3, CQ: 3, CK: 3, CA: 2,
      C2: 1, C3: 1, C4: 1, C5: 1,
      MX2: 1, MX3: 1, SAVE: 1
    })
  })
})

describe('hit-or-bust — frozen calibration', () => {
  it('FROZEN: exact RTP per coin ≈ 89.998% (within [89%, 91%] target band)', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    // Frozen to 6 decimal places (deterministic exact math)
    expect(r.rtpPerCoin).toBeCloseTo(0.8999786778089339, 6)
    expect(r.rtpPerCoin).toBeGreaterThanOrEqual(0.89)
    expect(r.rtpPerCoin).toBeLessThanOrEqual(0.91)
  })

  it('FROZEN: hit frequency ≈ 62.59%', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    expect(r.hitFrequency).toBeCloseTo(0.6259376229830778, 6)
  })

  it('FROZEN: variance per coin', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    expect(r.variancePerCoin).toBeCloseTo(1.9888723336949963, 6)
  })

  it('FROZEN: bust rate ≈ 37.41% and charlie rate ≈ 15.53%', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    const bust = r.breakdown.find(b => b.entryId === 'bust')
    const charlie = r.breakdown.find(b => b.entryId === 'charlie')
    expect(bust).toBeTruthy()
    expect(charlie).toBeTruthy()
    expect(bust!.probability).toBeCloseTo(0.37406237701692263, 6)
    expect(charlie!.probability).toBeCloseTo(0.1553207398661945, 6)
  })

  it('breakdown contributions sum to rtpPerCoin', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 9)
  })

  it('breakdown includes expected outcome labels', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    const ids = new Set(r.breakdown.map(b => b.entryId))
    expect(ids.has('bust')).toBe(true)
    expect(ids.has('charlie')).toBe(true)
    // DP stands at winning totals — all four paid totals must appear
    expect(ids.has('total-18')).toBe(true)
    expect(ids.has('total-19')).toBe(true)
    expect(ids.has('total-20')).toBe(true)
    expect(ids.has('total-21')).toBe(true)
  })
})
