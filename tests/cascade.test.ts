import { describe, it, expect } from 'vitest'
import { spinCascade, tierPay, ladderMult, countSymbols } from '../app/engine/cascade'
import { initMachineState, simulateMachine } from '../app/engine'
import { cascadeExactRtp } from '../app/engine/cascadeRtp'
import { validateMachineDef } from '../app/engine/validate'
import type { CascadeMachineDef } from '../app/engine/types'
import type { RandomFn } from '../app/engine/rng'

/**
 * A tiny, structurally-valid cascade def for deterministic engine tests.
 * 2×2 grid, minMatch 3, two paying symbols (A, B) + a non-paying idol (I), all
 * equal weight so a scripted RNG maps cleanly: with entries [A, B, I] and
 * total 3, rand < 1/3 → A, < 2/3 → B, else → I. Use 0.0 → A, 0.4 → B, 0.8 → I.
 */
function tiny(): CascadeMachineDef {
  return {
    id: 'tiny-cascade',
    name: 'Tiny Cascade',
    family: 'cascade',
    denominationCents: 1,
    maxCoins: 1,
    cols: 2,
    rows: 2,
    minMatch: 3,
    weights: { A: 1, B: 1, I: 1 },
    paytable: {
      A: [{ countAtLeast: 3, pay: 2 }, { countAtLeast: 4, pay: 5 }],
      B: [{ countAtLeast: 3, pay: 1 }]
    },
    multiplierLadder: [1, 3, 5],
    maxTumbles: 10,
    idolSymbol: 'I',
    grandTrigger: 3,
    progressive: { kind: 'percent', reset: 100, max: 1000, feedRate: 0.01 },
    symbols: { A: { label: 'A' }, B: { label: 'B' }, I: { label: 'Idol' } },
    history: 'test'
  }
}

/** Deterministic RNG: replays a fixed sequence, then 0 forever. */
function scriptRand(seq: number[]): RandomFn {
  let i = 0
  return () => (i < seq.length ? seq[i++]! : 0)
}

describe('cascade helpers', () => {
  it('tierPay picks the highest matching tier, null below the floor', () => {
    const tiers = [{ countAtLeast: 3, pay: 2 }, { countAtLeast: 4, pay: 5 }]
    expect(tierPay(tiers, 2)).toBeNull()
    expect(tierPay(tiers, 3)).toBe(2)
    expect(tierPay(tiers, 4)).toBe(5)
    expect(tierPay(tiers, 9)).toBe(5)
  })

  it('ladderMult is 1-based and clamps to the last rung', () => {
    const def = tiny()
    expect(ladderMult(def, 1)).toBe(1)
    expect(ladderMult(def, 2)).toBe(3)
    expect(ladderMult(def, 3)).toBe(5)
    expect(ladderMult(def, 9)).toBe(5)
  })

  it('countSymbols counts across the whole grid', () => {
    const counts = countSymbols([['A', 'A'], ['A', 'B']])
    expect(counts.get('A')).toBe(3)
    expect(counts.get('B')).toBe(1)
  })
})

describe('spinCascade', () => {
  it('a no-win initial grid pays nothing and records one settle step', () => {
    const def = tiny()
    const state = initMachineState(def)
    // A,B,A,B → counts A=2 B=2, no symbol reaches minMatch 3
    const out = spinCascade(def, state, 1, scriptRand([0, 0.4, 0, 0.4]))
    expect(out.totalPayout).toBe(0)
    expect(out.wins).toHaveLength(0)
    expect(out.gameKind).toBe('base')
    expect(out.coinsIn).toBe(1)
    expect(out.cascadeSteps).toHaveLength(1)
    expect(out.cascadeSteps![0]!.wins).toHaveLength(0)
    expect(out.progressiveEvents).toHaveLength(0)
  })

  it('a single winning chain pays its tier × ladder[0] × coins, then settles', () => {
    const def = tiny()
    const state = initMachineState(def)
    // AAAA (count 4 → tier pay 5) → tumble refills A,B / A,B (no win)
    const out = spinCascade(def, state, 1, scriptRand([0, 0, 0, 0, 0, 0.4, 0, 0.4]))
    expect(out.totalPayout).toBe(5) // 5 × ladder[0]=1 × coins=1
    expect(out.wins).toHaveLength(1)
    expect(out.wins[0]!.entryId).toBe('A')
    expect(out.wins[0]!.payCredits).toBe(5)
    expect(out.cascadeSteps).toHaveLength(2) // chain-1 win + settle
    expect(out.cascadeSteps![0]!.chainMult).toBe(1)
  })

  it('a second chain applies ladder[1] to its pays', () => {
    const def = tiny()
    const state = initMachineState(def)
    // AAAA → refill AAAA (count 4, chain 2 → ×3) → refill A,B/A,B (no win)
    const out = spinCascade(def, state, 1, scriptRand([0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0.4]))
    expect(out.totalPayout).toBe(5 + 5 * 3) // chain1 ×1 + chain2 ×3
    expect(out.wins).toHaveLength(2)
    expect(out.cascadeSteps).toHaveLength(3)
    expect(out.cascadeSteps![1]!.chainMult).toBe(3)
  })

  it('coins scale the payout linearly', () => {
    const def = tiny()
    const state = initMachineState(def)
    const out = spinCascade(def, state, 4, scriptRand([0, 0, 0, 0, 0, 0.4, 0, 0.4]))
    expect(out.totalPayout).toBe(5 * 4)
    expect(out.coins).toBe(4)
  })

  it('grandTrigger idols on the initial grid pay + reset the meter', () => {
    const def = tiny()
    const state = initMachineState(def)
    expect(state.progressive).toEqual({ kind: 'percent', value: 100 })
    // I,I,I,A → 3 idols ≥ grandTrigger 3, A count 1 (no paying win)
    const out = spinCascade(def, state, 1, scriptRand([0.8, 0.8, 0.8, 0.0]))
    expect(out.totalPayout).toBe(100) // floor(meter)=100
    expect(out.progressiveEvents).toHaveLength(1)
    expect(out.progressiveEvents[0]!.amountCredits).toBe(100)
    expect(out.wins.some(w => w.entryId === 'grand')).toBe(true)
    // meter reset back to its reset value
    expect(state.progressive).toEqual({ kind: 'percent', value: 100 })
  })

  it('no Grand without enough idols', () => {
    const def = tiny()
    const state = initMachineState(def)
    // I,I,A,B → 2 idols < grandTrigger 3
    const out = spinCascade(def, state, 1, scriptRand([0.8, 0.8, 0.0, 0.4]))
    expect(out.progressiveEvents).toHaveLength(0)
    expect(out.wins.some(w => w.entryId === 'grand')).toBe(false)
  })
})

describe('cascade exact RTP', () => {
  // A small-but-real cascade (tumbles + Grand) where exact enumeration and a
  // seeded simulation must agree — the core proof that the DP is correct.
  function convDef(): CascadeMachineDef {
    return {
      ...tiny(),
      cols: 3,
      rows: 3,
      minMatch: 4,
      maxTumbles: 6,
      weights: { A: 5, B: 5, I: 2 },
      paytable: {
        A: [{ countAtLeast: 4, pay: 0.5 }, { countAtLeast: 6, pay: 1.5 }],
        B: [{ countAtLeast: 4, pay: 0.4 }]
      },
      grandTrigger: 4,
      progressive: { kind: 'percent', reset: 8, max: 80, feedRate: 0.01 }
    }
  }

  it('the def is valid', () => {
    expect(() => validateMachineDef(convDef())).not.toThrow()
  })

  it('exact RTP, HF and variance match a 2M-spin simulation within 3.5σ', () => {
    const def = convDef()
    const exact = cascadeExactRtp(def, { coins: 1 })
    const spins = 2_000_000
    const sim = simulateMachine(def, { spins, coins: 1, seed: 4242, progressiveMode: 'static' })
    const se = Math.sqrt(exact.variancePerCoin / spins)
    const hfSe = Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / spins)
    expect(se).toBeGreaterThan(0)
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(3.5 * se)
    expect(Math.abs(sim.hitFrequency - exact.hitFrequency)).toBeLessThan(3.5 * hfSe)
  })
})
