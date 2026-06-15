import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { simulateMachine } from '../app/engine'
import { HIT_OR_BUST } from '../app/machines/hit-or-bust'

// ---------------------------------------------------------------------------
// Hit or Bust — machine definition integrity + frozen calibration
//
// Frozen figures (blackjackReelExactRtp, optimal stopping, 2026-06-14):
//   rtpPerCoin      ≈ 0.8999774891774895  (90.00%)
//   hitFrequency    ≈ 0.5022662337662339  (50.23%)
//   variancePerCoin ≈ 2.18608640641967
//   bustRate        ≈ 0.497733766233766   (49.77%)
//   charlieRate     ≈ 0.11606493506493502 (11.61%)
//
// Paytable: 18→1, 19→1, 20→1, 21→2   (all integers — no fractional credits)
// charlieBonus: 1                       (integer)
//
// Integer-money invariant: pay × max(1,multSum) × coins is always an integer
// number of credits because all three factors are integers. The bug that
// produced fractional credits (e.g. 0.5 × 1 × 3 = 1.5) cannot recur.
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

  it('paytable has 4 entries covering 18–21, all pays positive integers', () => {
    expect(HIT_OR_BUST.paytable).toHaveLength(4)
    const totals = HIT_OR_BUST.paytable.map(e => e.total).sort((a, b) => a - b)
    expect(totals).toEqual([18, 19, 20, 21])
    for (const e of HIT_OR_BUST.paytable) {
      expect(e.pay).toBeGreaterThan(0)
      // Integer-money invariant: pay must be a whole number
      expect(Number.isInteger(e.pay)).toBe(true)
    }
  })

  it('paytable pays are non-decreasing with total (higher totals pay at least as much)', () => {
    // Non-decreasing (not strictly increasing) allows equal pays for adjacent totals.
    // This is the correct invariant for "higher totals pay more or equal" with
    // integer pays, where the pay(21) premium is the main differentiator.
    const sorted = [...HIT_OR_BUST.paytable].sort((a, b) => a.total - b.total)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.pay).toBeGreaterThanOrEqual(sorted[i - 1]!.pay)
    }
  })

  it('charlieBonus is a positive integer', () => {
    expect(HIT_OR_BUST.charlieBonus).toBeGreaterThan(0)
    // Integer-money invariant: charlieBonus must be a whole number
    expect(Number.isInteger(HIT_OR_BUST.charlieBonus)).toBe(true)
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
    // Reel 0: 20 stops — 6 tens (2×C10,2×CJ,1×CQ,1×CK), 1 ace, 11 lows (C2×2,C3×2,C4×2,C5–C9×1), 1 MX2, 1 SAVE
    expect(counts[0]).toEqual({
      C10: 2, CJ: 2, CQ: 1, CK: 1, CA: 1,
      C2: 2, C3: 2, C4: 2, C5: 1, C6: 1, C7: 1, C8: 1, C9: 1,
      MX2: 1, SAVE: 1
    })
    // Reel 1: same as reel 0
    expect(counts[1]).toEqual(counts[0])
    // Reel 2: 22 stops — 17 tens (5×C10,4×CJ,4×CQ,4×CK), 1 ace, 1 low, MX2+MX3+SAVE
    expect(counts[2]).toEqual({
      C10: 5, CJ: 4, CQ: 4, CK: 4, CA: 1,
      C2: 1,
      MX2: 1, MX3: 1, SAVE: 1
    })
    // Reel 3: 21 stops — 15 tens (4×C10,4×CJ,4×CQ,3×CK), 1 ace, 2 lows, MX2+MX3+SAVE
    expect(counts[3]).toEqual({
      C10: 4, CJ: 4, CQ: 4, CK: 3, CA: 1,
      C2: 1, C3: 1,
      MX2: 1, MX3: 1, SAVE: 1
    })
    // Reel 4: 25 stops — 20 tens (5 each), 2 aces, 0 lows, MX2+MX3+SAVE
    expect(counts[4]).toEqual({
      C10: 5, CJ: 5, CQ: 5, CK: 5, CA: 2,
      MX2: 1, MX3: 1, SAVE: 1
    })
  })
})

describe('hit-or-bust — integer-money invariant', () => {
  it('every paytable[].pay is Number.isInteger', () => {
    for (const e of HIT_OR_BUST.paytable) {
      expect(Number.isInteger(e.pay),
        `pay(${e.total}) = ${e.pay} is not an integer`
      ).toBe(true)
    }
  })

  it('charlieBonus is Number.isInteger', () => {
    expect(Number.isInteger(HIT_OR_BUST.charlieBonus)).toBe(true)
  })

  it('all pays are >= 1 (no zero-pay entries in the paytable)', () => {
    for (const e of HIT_OR_BUST.paytable) {
      expect(e.pay).toBeGreaterThanOrEqual(1)
    }
  })

  it('pay × max(1,multSum) × coins is always an integer for all bet levels', () => {
    // Enumerate all possible multSum values (0 = no mult; 2,3,4,5,6 from ×2/×3 combos).
    // On 5 reels, the possible multSum values from any combination of MX2 and MX3 symbols:
    // 0 (no mult drawn), 2 (one MX2), 3 (one MX3), 4 (two MX2), 5 (MX2+MX3), 6 (two MX3)
    const possibleMultSums = [0, 2, 3, 4, 5, 6]
    const coinLevels = [1, 2, 3] // 1..maxCoins

    let checkCount = 0
    for (const e of HIT_OR_BUST.paytable) {
      // Also check charlieBonus
      for (const multSum of possibleMultSums) {
        const mult = Math.max(1, multSum)
        for (const coins of coinLevels) {
          // Base payout (stand)
          const basePayout = e.pay * mult * coins
          expect(Number.isInteger(basePayout),
            `pay(${e.total})=${e.pay} × mult=${mult} × coins=${coins} = ${basePayout} is not integer`
          ).toBe(true)
          checkCount++

          // Charlie payout = (pay + charlieBonus) × mult × coins
          const charliePayout = (e.pay + HIT_OR_BUST.charlieBonus) * mult * coins
          expect(Number.isInteger(charliePayout),
            `charlie payout (${e.pay}+${HIT_OR_BUST.charlieBonus}) × mult=${mult} × coins=${coins} = ${charliePayout} is not integer`
          ).toBe(true)
          checkCount++
        }
      }
    }
    expect(checkCount).toBeGreaterThan(0) // ensure the loop ran
  })

  it('simulateMachine produces only whole-credit payouts (no fractional credits)', () => {
    // Run a simulation and check that every payout recorded is an integer.
    // simulateMachine tracks totalOut in credits; if any individual payout were
    // fractional, totalOut would be non-integer after enough hands.
    // We check more directly: assert totalOut × maxCoins is an integer (no fractions).
    const sim = simulateMachine(HIT_OR_BUST, {
      spins: 10_000,
      coins: 3, // the ante that exposed the original bug (0.5 × 1 × 3 = 1.5 credits)
      seed: 20260614,
      progressiveMode: 'static'
    })
    // totalOut is in credits. With integer payouts and integer coins, it must be integer.
    expect(Number.isInteger(sim.totalOut),
      `totalOut=${sim.totalOut} is not an integer — fractional credits leaked`
    ).toBe(true)
    expect(Number.isInteger(sim.totalIn),
      `totalIn=${sim.totalIn} is not an integer`
    ).toBe(true)
  })

  it('simulateMachine at coins=1 also produces integer totalOut', () => {
    const sim = simulateMachine(HIT_OR_BUST, {
      spins: 5_000,
      coins: 1,
      seed: 42,
      progressiveMode: 'static'
    })
    expect(Number.isInteger(sim.totalOut)).toBe(true)
    expect(Number.isInteger(sim.totalIn)).toBe(true)
  })
})

describe('hit-or-bust — frozen calibration', () => {
  it('FROZEN: exact RTP per coin ≈ 90.00% (within [89%, 91%] target band)', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    // Frozen to 6 decimal places (deterministic exact math)
    expect(r.rtpPerCoin).toBeCloseTo(0.8999774891774895, 6)
    expect(r.rtpPerCoin).toBeGreaterThanOrEqual(0.89)
    expect(r.rtpPerCoin).toBeLessThanOrEqual(0.91)
  })

  it('FROZEN: hit frequency ≈ 50.23%', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    expect(r.hitFrequency).toBeCloseTo(0.5022662337662339, 6)
  })

  it('FROZEN: variance per coin', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    expect(r.variancePerCoin).toBeCloseTo(2.18608640641967, 6)
  })

  it('FROZEN: bust rate ≈ 49.77% and charlie rate ≈ 11.61%', () => {
    const r = blackjackReelExactRtp(HIT_OR_BUST)
    const bust = r.breakdown.find(b => b.entryId === 'bust')
    const charlie = r.breakdown.find(b => b.entryId === 'charlie')
    expect(bust).toBeTruthy()
    expect(charlie).toBeTruthy()
    expect(bust!.probability).toBeCloseTo(0.497733766233766, 6)
    expect(charlie!.probability).toBeCloseTo(0.11606493506493502, 6)
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
