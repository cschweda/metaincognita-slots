// localStorage-restore sanitizers — pure def-driven validation, no framework
// imports. Each family block coerces a persisted machine state to a VALID one
// for its def (clamped to def-derived ranges, phase/grid coherence enforced),
// else falls back to fresh. Lives beside the engines so a family's restore
// rules evolve with its engine, not inside the store.
import type {
  BlackjackReelMachineDef,
  LockReelMachineDef,
  MachineDef,
  MachineSessionState,
  PachisloBonusState,
  PachisloFlag,
  SymbolId
} from './types'
import { initMachineState } from './index'
import { freshBlackjackState } from './blackjackReel'
import { freshLockState } from './lockReel'
import { buildDeck } from './deck'

export function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function asNonNegativeInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : fallback
}

const PACHISLO_FLAGS: PachisloFlag[] = [
  'cherry-top', 'cherry-mid', 'cherry-bot', 'watermelon', 'bell', 'replay', 'reg', 'big'
]

/** Coerce a persisted machine state to a VALID one for this def, else fresh. */
export function sanitizeMachineState(def: MachineDef, raw: unknown): MachineSessionState {
  const fresh = initMachineState(def)
  if (raw === null || typeof raw !== 'object') return fresh
  const r = raw as Record<string, unknown>

  // progressive: kind must match the def's config; numbers clamped to [reset, max]
  if (fresh.progressive !== null && r.progressive !== null && typeof r.progressive === 'object') {
    const p = r.progressive as Record<string, unknown>
    if (def.progressive?.kind === 'percent' && p.kind === 'percent') {
      const v = asFiniteNumber(p.value, def.progressive.reset)
      fresh.progressive = {
        kind: 'percent',
        value: Math.min(Math.max(v, def.progressive.reset), def.progressive.max)
      }
    } else if (def.progressive?.kind === 'single' && p.kind === 'single') {
      const cfg = def.progressive.meter
      fresh.progressive = {
        kind: 'single',
        value: Math.min(Math.max(asFiniteNumber(p.value, cfg.reset), cfg.reset), cfg.max),
        coins: asNonNegativeInt(p.coins, 0)
      }
    } else if (def.progressive?.kind === 'dual' && p.kind === 'dual') {
      const u = def.progressive.upper
      const l = def.progressive.lower
      fresh.progressive = {
        kind: 'dual',
        upper: Math.min(Math.max(asFiniteNumber(p.upper, u.reset), u.reset), u.max),
        lower: Math.min(Math.max(asFiniteNumber(p.lower, l.reset), l.reset), l.max),
        live: p.live === 'lower' ? 'lower' : 'upper',
        coinsTowardToggle: asNonNegativeInt(p.coinsTowardToggle, 0),
        upperCoins: asNonNegativeInt(p.upperCoins, 0),
        lowerCoins: asNonNegativeInt(p.lowerCoins, 0)
      }
    }
  }

  // video feature
  if (def.family === 'video' && r.videoFeature !== null && typeof r.videoFeature === 'object') {
    const f = r.videoFeature as Record<string, unknown>
    if (
      f.kind === 'freeSpins' && def.freeSpins !== null
      && Number.isInteger(f.remaining) && (f.remaining as number) >= 1 && (f.remaining as number) <= 10_000
      && Number.isInteger(f.coins) && (f.coins as number) >= 1 && (f.coins as number) <= def.maxCoins
    ) {
      fresh.videoFeature = {
        kind: 'freeSpins',
        remaining: f.remaining as number,
        multiplier: def.freeSpins.multiplier,
        coins: f.coins as number
      }
    } else if (f.kind === 'holdAndSpin' && def.holdAndSpin !== null && Array.isArray(f.locked)) {
      const locked = (f.locked as unknown[]).slice(0, 15).map((cell) => {
        if (cell === null || typeof cell !== 'object') return null
        const c = cell as Record<string, unknown>
        if (Number.isInteger(c.mult) && (c.mult as number) >= 2) return { mult: c.mult as number }
        if (!Number.isInteger(c.credits) || (c.credits as number) <= 0) return null
        const label = c.label === 'mini' || c.label === 'minor' || c.label === 'major'
          ? c.label as 'mini' | 'minor' | 'major'
          : undefined
        return label === undefined ? { credits: c.credits as number } : { credits: c.credits as number, label }
      })
      while (locked.length < 15) locked.push(null)
      const respins = Number.isInteger(f.respins) && (f.respins as number) >= 1
        && (f.respins as number) <= def.holdAndSpin.respins
        ? f.respins as number
        : def.holdAndSpin.respins
      if (locked.some(c => c !== null)) {
        fresh.videoFeature = { kind: 'holdAndSpin', locked, respins, coins: def.maxCoins }
      }
    }
  }

  // pachislo
  if (def.family === 'pachislo' && fresh.pachislo !== null && r.pachislo !== null && typeof r.pachislo === 'object') {
    const p = r.pachislo as Record<string, unknown>
    const level = Number.isInteger(p.oddsLevel) && (p.oddsLevel as number) >= 1
      && (p.oddsLevel as number) <= def.oddsLevels.length
      ? p.oddsLevel as number
      : def.defaultOddsLevel
    const smalls = Array.isArray(p.smallQueue)
      ? (p.smallQueue as unknown[]).filter((f): f is PachisloFlag =>
          PACHISLO_FLAGS.includes(f as PachisloFlag) && f !== 'reg' && f !== 'big')
      : []
    const bonuses = Array.isArray(p.bonusQueue)
      ? (p.bonusQueue as unknown[]).filter((f): f is 'reg' | 'big' => f === 'reg' || f === 'big')
      : []
    let bonus: PachisloBonusState | null = null
    if (p.bonus !== null && p.bonus !== undefined && typeof p.bonus === 'object') {
      const b = p.bonus as Record<string, unknown>
      const type = b.type === 'reg' || b.type === 'big' ? b.type : null
      const round = Number.isInteger(b.round) ? b.round as number : -1
      const jacLeft = Number.isInteger(b.jacLeft) ? b.jacLeft as number : -1
      const rawInterlude = b.interlude ?? null
      if (type !== null) {
        if (rawInterlude === null) {
          // between JAC games: the engine only persists jacLeft >= 1 here
          const roundOk = round >= 1 && round <= def.bigRounds && (type === 'big' || round === 1)
          if (roundOk && jacLeft >= 1 && jacLeft <= def.jac.perRound) {
            bonus = { type, round, jacLeft, interlude: null }
          }
        } else if (typeof rawInterlude === 'object' && type === 'big' && jacLeft === 0) {
          const i = rawInterlude as Record<string, unknown>
          const indexOk = i.index === 1 || i.index === 2
          const bellsOk = Number.isInteger(i.bells)
            && (i.bells as number) >= 0 && (i.bells as number) < def.interlude.maxBells
          if (indexOk && bellsOk && round >= 1 && round <= def.bigRounds - 1) {
            bonus = { type, round, jacLeft: 0, interlude: { index: i.index as 1 | 2, bells: i.bells as number } }
          }
        }
      }
    }
    fresh.pachislo = {
      oddsLevel: level,
      smallQueue: smalls,
      bonusQueue: bonuses,
      replayNext: p.replayNext === true,
      bonus
    }
  }

  // blackjack-reel (Flameout 21 crash): validate and restore a persisted state
  if (def.family === 'blackjack-reel' && r.blackjackReel !== null && typeof r.blackjackReel === 'object') {
    const bj = r.blackjackReel as Record<string, unknown>
    const bjDef = def as BlackjackReelMachineDef
    const deckIds = new Set<string>(buildDeck())
    const reelSyms = new Set<string>([bjDef.climbSymbol, bjDef.crashSymbol])
    const isCard = (s: unknown): s is string => typeof s === 'string' && deckIds.has(s)
    const isReelSym = (s: unknown): s is string => isCard(s) || (typeof s === 'string' && reelSyms.has(s))
    const bad = (): MachineSessionState => {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    const phase = bj.phase
    if (phase !== 'idle' && phase !== 'spinning' && phase !== 'resolved') return bad()

    let reelStrips: string[][] = []
    if (phase !== 'idle') {
      if (!Array.isArray(bj.reelStrips)) return bad()
      const mapped = (bj.reelStrips as unknown[]).map((strip) => {
        if (!Array.isArray(strip)) return null
        const v = (strip as unknown[]).filter(isReelSym)
        return v.length === (strip as unknown[]).length ? v : null
      })
      if (mapped.some(s => s === null)) return bad()
      reelStrips = mapped as string[][]
    }

    if (!Array.isArray(bj.landed) || (bj.landed as unknown[]).length !== 5) return bad()
    const landed = (bj.landed as unknown[]).map(s => (s === null ? null : isReelSym(s) ? s : 'INVALID'))
    if (landed.some(s => s === 'INVALID')) return bad()

    const idx = bj.idx
    if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) > 5) return bad()
    if (!Array.isArray(bj.hand) || !(bj.hand as unknown[]).every(isCard)) return bad()

    const velocity = asFiniteNumber(bj.velocity, -1)
    const multiplier = asFiniteNumber(bj.multiplier, -1)
    const ante = asFiniteNumber(bj.ante, -1)
    if (velocity < 0 || multiplier < 0 || !Number.isInteger(ante) || ante < 0 || ante > bjDef.maxCoins) return bad()
    if (typeof bj.crashed !== 'boolean' || typeof bj.natural !== 'boolean') return bad()

    fresh.blackjackReel = {
      phase: phase as 'idle' | 'spinning' | 'resolved',
      reelStrips,
      landed: landed as (string | null)[],
      idx: idx as number,
      hand: bj.hand as string[],
      velocity,
      multiplier,
      crashed: bj.crashed as boolean,
      natural: bj.natural as boolean,
      ante
    }
  }

  // lock-reel (Stop & Lock 777 cash-collect): validate and restore a persisted
  // session — the grid is 5 × rows, every cell is null or a known symbol id, and
  // phase/idx/counters are mutually coherent; anything off returns a fresh idle.
  if (def.family === 'lock-reel' && r.lockReel !== null && typeof r.lockReel === 'object') {
    const lr = r.lockReel as Record<string, unknown>
    const lrDef = def as LockReelMachineDef
    const symbolIds = new Set<string>(Object.keys(lrDef.symbols))
    const isSym = (s: unknown): s is string => typeof s === 'string' && symbolIds.has(s)
    const bad = (): MachineSessionState => {
      fresh.lockReel = freshLockState(lrDef)
      return fresh
    }

    const phase = lr.phase
    if (phase !== 'idle' && phase !== 'spinning' && phase !== 'bonus' && phase !== 'resolved') return bad()

    const idx = lr.idx
    if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) > 5) return bad()
    const sevenCount = lr.sevenCount
    if (!Number.isInteger(sevenCount) || (sevenCount as number) < 0) return bad()
    const collectCredits = lr.collectCredits
    if (!Number.isInteger(collectCredits) || (collectCredits as number) < 0) return bad()
    const respinsLeft = lr.respinsLeft
    if (!Number.isInteger(respinsLeft) || (respinsLeft as number) < 0) return bad()
    const ante = lr.ante
    if (!Number.isInteger(ante) || (ante as number) < 0 || (ante as number) > lrDef.maxCoins) return bad()

    // grid: exactly 5 columns of exactly `rows` cells; each cell null or a known id.
    if (!Array.isArray(lr.grid) || (lr.grid as unknown[]).length !== 5) return bad()
    const grid: (SymbolId | null)[][] = []
    for (const colRaw of lr.grid as unknown[]) {
      if (!Array.isArray(colRaw) || (colRaw as unknown[]).length !== lrDef.rows) return bad()
      const col: (SymbolId | null)[] = []
      for (const cell of colRaw as unknown[]) {
        if (cell === null) col.push(null)
        else if (isSym(cell)) col.push(cell)
        else return bad()
      }
      grid.push(col)
    }

    // phase ↔ idx / grid-fill coherence:
    //  - idle: untouched (the fresh empty grid). Restore a fresh state.
    //  - spinning: idx in 0..4 (idx 5 would already have resolved); the first
    //    `idx` columns are stopped (no null), the rest are fully null.
    //  - bonus/resolved: every reel is stopped (idx === 5) and no cell is null
    //    (the five window draws fill the grid; bonus respins only overwrite BLANKs).
    //    bonus additionally requires the 3-seven trigger.
    const colStopped = (c: (SymbolId | null)[]): boolean => c.every(x => x !== null)
    const colEmpty = (c: (SymbolId | null)[]): boolean => c.every(x => x === null)
    if (phase === 'idle') return bad()
    if (phase === 'spinning') {
      const i = idx as number
      if (i > 4) return bad()
      for (let c = 0; c < 5; c++) {
        if (c < i ? !colStopped(grid[c]!) : !colEmpty(grid[c]!)) return bad()
      }
    } else {
      // bonus or resolved
      if ((idx as number) !== 5 || grid.some(c => !colStopped(c))) return bad()
      if (phase === 'bonus' && (sevenCount as number) < 3) return bad()
    }

    fresh.lockReel = {
      phase: phase as 'idle' | 'spinning' | 'bonus' | 'resolved',
      grid,
      idx: idx as number,
      sevenCount: sevenCount as number,
      collectCredits: collectCredits as number,
      respinsLeft: respinsLeft as number,
      ante: ante as number
    }
  }

  // wheel: the only state is whether a free topper spin is owed. Anything
  // malformed restores as pending=false — the wedge draw hadn't happened yet,
  // so nothing owed is lost except a reload mid-arm animation.
  if (def.family === 'wheel' && r.wheel !== null && typeof r.wheel === 'object') {
    fresh.wheel = { pending: (r.wheel as Record<string, unknown>).pending === true }
  }

  return fresh
}
