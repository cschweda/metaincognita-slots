import { describe, it, expect } from 'vitest'
import { lockReelExactRtp, reelCashEvs, reelSevenOdds, bonusOdds, bonusEv, lockReelParRows } from '../app/engine/lockReelRtp'
import { exactRtp } from '../app/engine/exactRtp'
import { STOP_AND_LOCK_777 } from '../app/machines/stop-and-lock-777'
import type { LockReelMachineDef } from '../app/engine/types'

/**
 * A compact, fully valid lock-reel fixture for property checks (NOT the shipped
 * calibration). Five lean strips, one prize each on a couple of reels, a GRAND
 * reachable on a fill.
 */
function fixture(over: Partial<LockReelMachineDef> = {}): LockReelMachineDef {
  const r = (...cells: string[]): string[] => cells
  return {
    id: 'lr-rtp-fixture',
    name: 'RTP Fixture',
    family: 'lock-reel',
    denominationCents: 25,
    maxCoins: 10,
    history: 'fixture',
    rows: 4,
    // Each reel carries ONE 7 (so bonus odds stay positive but the bonus is rare
    // enough to keep this fixture's RTP O(1) — the strict breakdown-sum assertions
    // below are absolute-tolerance, so a runaway RTP would defeat them).
    reels: [
      r('C1', 'BLANK', 'SEVEN', 'BLANK', 'C2', 'BLANK', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK'),
      r('C1', 'BLANK', 'BLANK', 'SEVEN', 'C2', 'BLANK', 'BLANK', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK'),
      r('C2', 'BLANK', 'SEVEN', 'BLANK', 'MINI', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK', 'BLANK', 'C1'),
      r('BLANK', 'C2', 'SEVEN', 'BLANK', 'MAJOR', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK', 'BLANK'),
      r('C1', 'BLANK', 'C5', 'SEVEN', 'BLANK', 'GRAND', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK')
    ],
    // Dedicated bonus strips (cash + SEVEN + BLANK only) — denser than the base so
    // respins lock, exercising the bonus chain on the rare round it fires.
    bonusReels: [
      r('C1', 'BLANK', 'BLANK', 'C2', 'BLANK', 'SEVEN', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK'),
      r('C1', 'BLANK', 'BLANK', 'C2', 'BLANK', 'BLANK', 'SEVEN', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK'),
      r('C2', 'BLANK', 'BLANK', 'C1', 'BLANK', 'SEVEN', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK'),
      r('C1', 'BLANK', 'BLANK', 'C2', 'BLANK', 'SEVEN', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK'),
      r('C5', 'BLANK', 'BLANK', 'C1', 'BLANK', 'SEVEN', 'BLANK', 'BLANK', 'C1', 'BLANK', 'BLANK', 'BLANK')
    ],
    symbols: {
      C1: { label: '$1' }, C2: { label: '$2' }, C5: { label: '$5' },
      MINI: { label: 'MINI' }, MAJOR: { label: 'MAJOR' }, GRAND: { label: 'GRAND' },
      SEVEN: { label: '7' }, BLANK: { label: '' }
    },
    cashValues: { C1: 1, C2: 2, C5: 5 },
    prizes: { MINI: 5, MAJOR: 12, GRAND: 30 },
    sevenSymbol: 'SEVEN',
    blankSymbol: 'BLANK',
    bonus: { respins: 3, sevenUpgrade: 4, grandOnFill: 'GRAND' },
    progressive: null,
    ...over
  }
}

describe('lockReelExactRtp — structural properties', () => {
  const def = fixture()
  const rep = lockReelExactRtp(def)

  it('breakdown contributions sum to rtpPerCoin', () => {
    const sum = rep.breakdown.reduce((a, b) => a + b.contribution, 0)
    expect(sum).toBeCloseTo(rep.rtpPerCoin, 10)
  })

  it('hit frequency and variance are finite and in range', () => {
    expect(Number.isFinite(rep.hitFrequency)).toBe(true)
    expect(rep.hitFrequency).toBeGreaterThan(0)
    expect(rep.hitFrequency).toBeLessThanOrEqual(1)
    expect(Number.isFinite(rep.variancePerCoin)).toBe(true)
    expect(rep.variancePerCoin).toBeGreaterThan(0)
  })

  it('no breakdown entry is a negative payout', () => {
    for (const e of rep.breakdown) {
      expect(e.avgPayPerCoin).toBeGreaterThanOrEqual(0)
      expect(e.contribution).toBeGreaterThanOrEqual(0)
      expect(e.probability).toBeGreaterThanOrEqual(0)
    }
  })

  it('rtpPerCoin equals baseCash + bonus contributions exactly', () => {
    const base = rep.breakdown.find(b => b.entryId === 'base-cash')!.contribution
    const bonus = rep.breakdown.filter(b => b.entryId !== 'base-cash').reduce((a, b) => a + b.contribution, 0)
    expect(base + bonus).toBeCloseTo(rep.rtpPerCoin, 12)
  })

  it('is coin-invariant (RTP/coin and var/coin do not depend on the coin level)', () => {
    const a = lockReelExactRtp(def, { coins: 1 })
    const b = lockReelExactRtp(def, { coins: def.maxCoins })
    expect(a.rtpPerCoin).toBeCloseTo(b.rtpPerCoin, 12)
    expect(a.variancePerCoin).toBeCloseTo(b.variancePerCoin, 12)
  })

  it('routes through exactRtp() identically', () => {
    const viaDispatch = exactRtp(def, { coins: def.maxCoins })
    expect(viaDispatch.rtpPerCoin).toBeCloseTo(rep.rtpPerCoin, 12)
    expect(viaDispatch.variancePerCoin).toBeCloseTo(rep.variancePerCoin, 12)
  })

  it('rejects out-of-range coins and a non-positive seven upgrade', () => {
    expect(() => lockReelExactRtp(def, { coins: 0 })).toThrow()
    expect(() => lockReelExactRtp(def, { coins: def.maxCoins + 1 })).toThrow()
    expect(() => lockReelExactRtp(fixture({ bonus: { respins: 3, sevenUpgrade: 0, grandOnFill: 'GRAND' } }))).toThrow()
  })
})

describe('lockReel X-ray / PAR helpers', () => {
  const def = fixture()

  it('reelCashEvs returns a non-negative EV per reel', () => {
    const evs = reelCashEvs(def)
    expect(evs).toHaveLength(5)
    for (const e of evs) expect(e).toBeGreaterThanOrEqual(0)
    // the grand-carrying reel (4) has the richest single cell (C5)
    expect(evs.every(Number.isFinite)).toBe(true)
  })

  it('reelSevenOdds are probabilities in [0,1]', () => {
    const odds = reelSevenOdds(def)
    expect(odds).toHaveLength(5)
    for (const o of odds) {
      expect(o).toBeGreaterThan(0)
      expect(o).toBeLessThanOrEqual(1)
    }
  })

  it('bonusOdds is a probability in (0,1)', () => {
    // This compact fixture is deliberately seven-dense, so its 3-seven odds are
    // high; the shipped machine's ~1-in-96 rate is asserted in its frozen tests.
    const p = bonusOdds(def)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })

  it('bonusEv (given trigger) is positive', () => {
    expect(bonusEv(def)).toBeGreaterThan(0)
  })

  it('the base-cash contribution equals the summed per-reel cash EVs', () => {
    const rep = lockReelExactRtp(def)
    const base = rep.breakdown.find(b => b.entryId === 'base-cash')!.contribution
    const sumReels = reelCashEvs(def).reduce((a, b) => a + b, 0)
    expect(base).toBeCloseTo(sumReels, 12)
  })

  it('lockReelParRows mirror the breakdown contributions', () => {
    const rep = lockReelExactRtp(def)
    const rows = lockReelParRows(def)
    const rowSum = rows.reduce((a, b) => a + b.contribution, 0)
    expect(rowSum).toBeCloseTo(rep.rtpPerCoin, 10)
  })
})

describe('Stop & Lock 777 — frozen exact RTP', () => {
  const rep = lockReelExactRtp(STOP_AND_LOCK_777)

  it('RTP/coin is in the calibrated 0.93..0.96 band', () => {
    expect(rep.rtpPerCoin).toBeGreaterThanOrEqual(0.93)
    expect(rep.rtpPerCoin).toBeLessThanOrEqual(0.96)
  })

  it('breakdown sums to rtpPerCoin and carries the bonus buckets', () => {
    const sum = rep.breakdown.reduce((a, b) => a + b.contribution, 0)
    expect(sum).toBeCloseTo(rep.rtpPerCoin, 10)
    const ids = new Set(rep.breakdown.map(b => b.entryId))
    expect(ids.has('base-cash')).toBe(true)
    expect(ids.has('seven-upgrade')).toBe(true)
  })

  it('hit frequency and variance are finite and positive', () => {
    expect(rep.hitFrequency).toBeGreaterThan(0)
    expect(rep.hitFrequency).toBeLessThanOrEqual(1)
    expect(rep.variancePerCoin).toBeGreaterThan(0)
    expect(Number.isFinite(rep.variancePerCoin)).toBe(true)
  })

  it('the bonus triggers roughly once in 60..120 rounds', () => {
    const p = bonusOdds(STOP_AND_LOCK_777)
    expect(1 / p).toBeGreaterThan(55)
    expect(1 / p).toBeLessThan(130)
  })
})

/**
 * Gold-standard cross-check: the closed-form moment machinery vs a FULL EXACT
 * enumeration of the whole round (the five base windows × the entire bonus chain
 * as a complete distribution, not Monte-Carlo). On tiny fixtures (short strips,
 * small rows) this is cheap and pins E[collect], Var(collect), the hit frequency,
 * and every breakdown bucket to floating-point precision. It is what caught the
 * grid-full-at-bonus-entry GRAND bug; keep it so that can never regress.
 */
describe('lockReelExactRtp — exact enumeration cross-check', () => {
  type Sym = string
  const sc = (def: LockReelMachineDef, s: Sym): number => def.cashValues[s] ?? def.prizes[s] ?? 0
  const empty = (def: LockReelMachineDef, s: Sym | null): boolean => s === null || s === def.blankSymbol

  // Exact bonus distribution from a starting grid: Map `cash:sevens:fill` -> prob,
  // enumerating every empty cell's redraw by its strip composition. Mirrors the
  // engine's bonusStop (reset on any lock, decrement on a pure miss, GRAND on a
  // full grid) exactly.
  function bonusDist(def: LockReelMachineDef, grid: Sym[][]): Map<string, number> {
    const N = def.bonus.respins
    // Respins draw from the DEDICATED bonus strips (mirrors the engine's bonusStop).
    const cellDist = def.bonusReels.map((strip) => {
      const m = new Map<Sym, number>()
      for (const s of strip) m.set(s, (m.get(s) ?? 0) + 1 / strip.length)
      return [...m.entries()]
    })
    const memo = new Map<string, Map<string, number>>()
    const emptyOf = (g: Sym[][]): number[][] => g.map(col => col.map((c, i) => (empty(def, c) ? i : -1)).filter(i => i >= 0))
    const rec = (em: number[][], respins: number): Map<string, number> => {
      const tot = em.reduce((a, rows) => a + rows.length, 0)
      if (tot === 0) return new Map([['0:0:1', 1]])
      const key = em.map(r => r.join('.')).join('|') + '#' + respins
      const hit = memo.get(key)
      if (hit !== undefined) return hit
      const cells: { r: number, opts: [Sym, number][] }[] = []
      for (let r = 0; r < 5; r++) for (const _row of em[r]!) cells.push({ r, opts: cellDist[r]! })
      const out = new Map<string, number>()
      const assign = new Array<Sym>(cells.length)
      const go = (ci: number, p: number): void => {
        if (ci === cells.length) {
          let dCash = 0
          let dSev = 0
          let anyLock = false
          const newEm = em.map(r => [...r])
          let idx = 0
          for (let r = 0; r < 5; r++) {
            for (let j = 0; j < em[r]!.length; j++) {
              const sym = assign[idx]!
              idx++
              if (empty(def, sym)) continue
              anyLock = true
              const row = em[r]![j]!
              newEm[r] = newEm[r]!.filter(x => x !== row)
              if (sym === def.sevenSymbol) dSev += 1
              else dCash += sc(def, sym)
            }
          }
          const remaining = newEm.reduce((a, r) => a + r.length, 0)
          let future: Map<string, number>
          if (remaining === 0) future = new Map([['0:0:1', 1]])
          else if (anyLock) future = rec(newEm, N)
          else if (respins - 1 <= 0) future = new Map([['0:0:0', 1]])
          else future = rec(em, respins - 1)
          for (const [fk, fp] of future) {
            const [fc, fs, ff] = fk.split(':').map(Number)
            const k = `${dCash + fc!}:${dSev + fs!}:${ff}`
            out.set(k, (out.get(k) ?? 0) + p * fp)
          }
          return
        }
        for (const [sym, ps] of cells[ci]!.opts) {
          assign[ci] = sym
          go(ci + 1, p * ps)
        }
      }
      go(0, 1)
      memo.set(key, out)
      return out
    }
    return rec(emptyOf(grid), N)
  }

  // Full exact round moments by enumerating the five base windows.
  function exactRound(def: LockReelMachineDef): { eY: number, eY2: number, pZero: number, base: number, bonusCash: number, up: number, grandEv: number } {
    const u = def.bonus.sevenUpgrade
    const grand = def.prizes[def.bonus.grandOnFill]!
    const wins = def.reels.map((strip) => {
      const out: { cells: Sym[], p: number }[] = []
      for (let s = 0; s < strip.length; s++) {
        const cells: Sym[] = []
        for (let i = 0; i < def.rows; i++) cells.push(strip[(s + i) % strip.length]!)
        out.push({ cells, p: 1 / strip.length })
      }
      return out
    })
    const acc = { eY: 0, eY2: 0, pZero: 0, base: 0, bonusCash: 0, up: 0, grandEv: 0 }
    const sel: Sym[][] = new Array(5)
    const rec = (r: number, p: number): void => {
      if (r === 5) {
        let baseCash = 0
        let baseSev = 0
        const grid: Sym[][] = []
        for (let i = 0; i < 5; i++) {
          grid.push([...sel[i]!])
          for (const c of sel[i]!) {
            if (c === def.sevenSymbol) baseSev += 1
            else baseCash += sc(def, c)
          }
        }
        acc.base += p * baseCash
        if (baseSev < 3) {
          acc.eY += p * baseCash
          acc.eY2 += p * baseCash * baseCash
          if (baseCash === 0) acc.pZero += p
          return
        }
        for (const [k, pk] of bonusDist(def, grid)) {
          const [bc, bs, ff] = k.split(':').map(Number)
          const fill = ff === 1
          const y = baseCash + bc! + (baseSev + bs!) * u + (fill ? grand : 0)
          const pp = p * pk
          acc.eY += pp * y
          acc.eY2 += pp * y * y
          acc.bonusCash += pp * bc!
          acc.up += pp * (baseSev + bs!) * u
          acc.grandEv += pp * (fill ? grand : 0)
        }
        return
      }
      for (const w of wins[r]!) {
        sel[r] = w.cells
        rec(r + 1, p * w.p)
      }
    }
    rec(0, 1)
    return acc
  }

  // Deliberately TINY (short strips, rows 1–2) so the full enumeration — which is
  // exponential in the bonus's empty-cell count — stays fast as a unit test while
  // still exercising the bonus chain and, crucially, the grid-full-at-bonus-entry
  // GRAND case (common at rows 1). The standalone calibration verifier covered
  // larger rows offline; this is the fast permanent regression guard.
  function tiny(over: Partial<LockReelMachineDef> = {}): LockReelMachineDef {
    return {
      id: 'tiny', name: 't', family: 'lock-reel', denominationCents: 25, maxCoins: 5,
      history: 't', rows: 1,
      reels: [
        ['C5', 'SEVEN', 'BLANK', 'C10', 'MINI'],
        ['SEVEN', 'C5', 'BLANK', 'SEVEN', 'C10'],
        ['SEVEN', 'C5', 'MAJOR', 'BLANK', 'SEVEN'],
        ['C5', 'SEVEN', 'BLANK', 'C10', 'SEVEN'],
        ['SEVEN', 'C5', 'GRAND', 'BLANK', 'SEVEN']
      ],
      // Dense bonus strips (cash + SEVEN + BLANK only) — a real hold-and-spin.
      bonusReels: [
        ['C5', 'C10', 'BLANK', 'C5', 'SEVEN'],
        ['C5', 'C5', 'BLANK', 'C10', 'SEVEN'],
        ['C10', 'C5', 'BLANK', 'C5', 'SEVEN'],
        ['C5', 'C10', 'BLANK', 'C5', 'SEVEN'],
        ['C5', 'C5', 'BLANK', 'C10', 'SEVEN']
      ],
      symbols: {
        C5: { label: '$5' }, C10: { label: '$10' },
        MINI: { label: 'MINI' }, MAJOR: { label: 'MAJOR' }, GRAND: { label: 'GRAND' },
        SEVEN: { label: '7' }, BLANK: { label: '' }
      },
      cashValues: { C5: 5, C10: 10 }, prizes: { MINI: 20, MAJOR: 60, GRAND: 200 },
      sevenSymbol: 'SEVEN', blankSymbol: 'BLANK',
      bonus: { respins: 3, sevenUpgrade: 8, grandOnFill: 'GRAND' }, progressive: null,
      ...over
    }
  }

  const cases: [string, LockReelMachineDef][] = [
    ['rows1 (grid can be full at bonus entry — the GRAND-on-entry case)', tiny()],
    ['rows1, mini grand, more respins', tiny({ bonus: { respins: 4, sevenUpgrade: 6, grandOnFill: 'MINI' } })],
    ['rows2', tiny({
      rows: 2,
      reels: [
        ['C5', 'SEVEN', 'BLANK', 'C10'],
        ['SEVEN', 'C5', 'BLANK', 'SEVEN'],
        ['SEVEN', 'MAJOR', 'BLANK', 'SEVEN'],
        ['C5', 'SEVEN', 'BLANK', 'C10'],
        ['SEVEN', 'GRAND', 'BLANK', 'SEVEN']
      ]
    })]
  ]

  for (const [name, def] of cases) {
    it(`closed form matches full enumeration: ${name}`, () => {
      const ex = exactRound(def)
      const rep = lockReelExactRtp(def)
      const find = (id: string): number => rep.breakdown.find(b => b.entryId === id)?.contribution ?? 0
      expect(rep.rtpPerCoin).toBeCloseTo(ex.eY, 9)
      expect(rep.variancePerCoin).toBeCloseTo(ex.eY2 - ex.eY * ex.eY, 6)
      expect(rep.hitFrequency).toBeCloseTo(1 - ex.pZero, 9)
      expect(find('base-cash')).toBeCloseTo(ex.base, 9)
      expect(find('bonus-cash')).toBeCloseTo(ex.bonusCash, 9)
      expect(find('seven-upgrade')).toBeCloseTo(ex.up, 9)
      expect(find('grand')).toBeCloseTo(ex.grandEv, 9)
    })
  }
})
