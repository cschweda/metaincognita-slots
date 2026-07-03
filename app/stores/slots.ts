import { defineStore } from 'pinia'
import { feedProgressive, freshBlackjackState, freshLockState, initMachineState, nextSpinCost, spin, validateMachineDef } from '~/engine'
import type { BlackjackReelMachineDef, LockReelMachineDef, MachineDef, MachineSessionState, PachisloFlag, PachisloBonusState, SpinOutcome, SymbolId } from '~/engine'
import { spinPachislo } from '~/engine/pachislo'
import { dealReels, stopReel, cashOut as bjCashOut } from '~/engine/blackjackReel'
import { dealStart as lockDealStart, stopReel as lockStopReel, bonusStop as lockBonusStop } from '~/engine/lockReel'
import { ALL_MACHINES } from '~/machines'
import { liveRand } from '~/utils/liveRand'

export const STORAGE_KEY = 'slots-simulator-session'
const STORAGE_VERSION = 1
const HISTORY_LIMIT = 1000
const SPARKLINE_EVERY = 10
const SPARKLINE_LIMIT = 120

export interface SpinRecord {
  id: number
  machineId: string
  gameKind: string
  coins: number
  coinsInCents: number
  payoutCents: number
  entryIds: string[]
  t: number
}

interface SessionStats {
  spins: number
  totalInCents: number
  totalOutCents: number
  netPeakCents: number
  maxDrawdownCents: number
}

interface MachineTotals {
  inCents: number
  outCents: number
  cycles: number
  /** session RTP samples (every SPARKLINE_EVERY cycles, last SPARKLINE_LIMIT) */
  samples: number[]
}

interface SlotsSettings {
  xray: boolean
  betsByMachine: Record<string, number>
}

// Resolve every machine (floor + parked) so a parked game can still be loaded.
const MACHINES = new Map<string, MachineDef>(ALL_MACHINES.map(def => [def.id, def]))

function emptyStats(): SessionStats {
  return { spins: 0, totalInCents: 0, totalOutCents: 0, netPeakCents: 0, maxDrawdownCents: 0 }
}

function defaultSettings(): SlotsSettings {
  return {
    xray: false,
    betsByMachine: Object.fromEntries(ALL_MACHINES.map(def =>
      // blackjack-reel and lock-reel are small-bet, big-payout cabinets: default
      // to a 1-coin pull (the demo's stance), not the machine's max.
      [def.id, def.family === 'blackjack-reel' || def.family === 'lock-reel' ? 1 : def.maxCoins]))
  }
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNonNegativeInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : fallback
}

const PACHISLO_FLAGS: PachisloFlag[] = [
  'cherry-top', 'cherry-mid', 'cherry-bot', 'watermelon', 'bell', 'replay', 'reg', 'big'
]

/** The only gameKind values the engine emits — anything else loads as 'base'. */
const GAME_KINDS = new Set(['base', 'normal', 'free-spin', 'respin', 'jac', 'interlude', 'deal'])

/** Coerce a persisted machine state to a VALID one for this def, else fresh. */
function sanitizeMachineState(def: MachineDef, raw: unknown): MachineSessionState {
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
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
    const SUITS = ['S', 'H', 'D', 'C']
    const deckIds = new Set<string>()
    for (const suit of SUITS) for (const rank of RANKS) deckIds.add(`${rank}${suit}`)
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

  return fresh
}

export const useSlotsStore = defineStore('slots', {
  state: () => ({
    phase: 'floor' as 'floor' | 'playing',
    bankrollCents: 0,
    currentMachineId: null as string | null,
    machineStates: {} as Record<string, MachineSessionState>,
    history: [] as SpinRecord[],
    nextRecordId: 1,
    stats: emptyStats(),
    perMachine: {} as Record<string, MachineTotals>,
    settings: defaultSettings(),
    spinning: false,
    lastOutcome: null as SpinOutcome | null,
    liveAnnouncement: ''
  }),

  getters: {
    currentDef(state): MachineDef | null {
      return state.currentMachineId === null ? null : MACHINES.get(state.currentMachineId) ?? null
    },
    currentState(state): MachineSessionState | null {
      return state.currentMachineId === null ? null : state.machineStates[state.currentMachineId] ?? null
    },
    currentBet(state): number {
      const def = state.currentMachineId === null ? null : MACHINES.get(state.currentMachineId)
      if (!def) return 0
      return state.settings.betsByMachine[def.id] ?? def.maxCoins
    },
    creditBalance(state): number {
      const def = state.currentMachineId === null ? null : MACHINES.get(state.currentMachineId)
      if (!def) return 0
      return Math.floor(state.bankrollCents / def.denominationCents)
    }
  },

  actions: {
    startSession(bankrollCents: number) {
      this.$reset()
      this.bankrollCents = Math.max(0, Math.floor(bankrollCents))
      this.phase = 'playing'
      this.saveToLocalStorage()
    },

    resetSession() {
      this.$reset()
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch { /* storage unavailable */ }
    },

    selectMachine(id: string) {
      const def = MACHINES.get(id)
      if (def === undefined) throw new Error(`unknown machine "${id}"`)
      if (this.machineStates[id] === undefined) {
        validateMachineDef(def)
        this.machineStates[id] = initMachineState(def)
      }
      if (this.perMachine[id] === undefined) {
        this.perMachine[id] = { inCents: 0, outCents: 0, cycles: 0, samples: [] }
      }
      this.currentMachineId = id
      this.lastOutcome = null
      this.saveToLocalStorage()
    },

    leaveMachine() {
      this.currentMachineId = null
      this.lastOutcome = null
      this.saveToLocalStorage()
    },

    setBet(coins: number) {
      const def = this.currentDef
      if (def === null || this.spinning) return
      const clamped = def.family === 'video' && def.fixedBet
        ? def.maxCoins
        : def.family === 'pachislo'
          ? def.maxCoins
          : Math.min(Math.max(Math.floor(coins), 1), def.maxCoins)
      this.settings.betsByMachine[def.id] = clamped
      this.saveToLocalStorage()
    },

    setXray(on: boolean) {
      this.settings.xray = on
      this.saveToLocalStorage()
    },

    saveToLocalStorage() {
      try {
        const data = {
          v: STORAGE_VERSION,
          bankrollCents: this.bankrollCents,
          currentMachineId: this.currentMachineId,
          machineStates: this.machineStates,
          history: this.history,
          stats: this.stats,
          perMachine: this.perMachine,
          settings: this.settings,
          phase: this.phase,
          nextRecordId: this.nextRecordId
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch { /* storage unavailable — play on without persistence */ }
    },

    loadFromLocalStorage(): boolean {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return false
        const data = JSON.parse(raw) as Record<string, unknown>
        if (data === null || typeof data !== 'object' || data.v !== STORAGE_VERSION) return false

        this.bankrollCents = Math.max(0, Math.floor(asFiniteNumber(data.bankrollCents, 0)))
        this.phase = data.phase === 'playing' ? 'playing' : 'floor'

        const states: Record<string, MachineSessionState> = {}
        const rawStates = (data.machineStates ?? {}) as Record<string, unknown>
        for (const [id, candidate] of Object.entries(rawStates)) {
          // defense-in-depth: never let a hostile key (__proto__/constructor/
          // prototype) index an object, though the MACHINES whitelist below
          // already excludes it and `states` is a fresh literal
          if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue
          const def = MACHINES.get(id)
          if (def !== undefined) states[id] = sanitizeMachineState(def, candidate)
        }
        this.machineStates = states

        const wantId = typeof data.currentMachineId === 'string' ? data.currentMachineId : null
        this.currentMachineId = wantId !== null && MACHINES.has(wantId) ? wantId : null
        if (this.currentMachineId !== null && this.machineStates[this.currentMachineId] === undefined) {
          this.machineStates[this.currentMachineId] = initMachineState(MACHINES.get(this.currentMachineId)!)
        }

        this.history = Array.isArray(data.history)
          ? (data.history as unknown[]).flatMap((entry): SpinRecord[] => {
              if (entry === null || typeof entry !== 'object') return []
              const e = entry as Record<string, unknown>
              if (typeof e.machineId !== 'string' || !MACHINES.has(e.machineId)) return []
              return [{
                id: asNonNegativeInt(e.id, 0),
                machineId: e.machineId,
                gameKind: typeof e.gameKind === 'string' && GAME_KINDS.has(e.gameKind) ? e.gameKind : 'base',
                coins: asNonNegativeInt(e.coins, 1),
                coinsInCents: asNonNegativeInt(e.coinsInCents, 0),
                payoutCents: asNonNegativeInt(e.payoutCents, 0),
                entryIds: Array.isArray(e.entryIds) ? (e.entryIds as unknown[]).filter(x => typeof x === 'string') as string[] : [],
                t: asNonNegativeInt(e.t, 0)
              }]
            }).slice(-HISTORY_LIMIT)
          : []

        // Keep new ids past every restored one so a corrupt/missing counter
        // can't mint a SpinRecord id that collides with restored history.
        const maxHistoryId = this.history.reduce((m, r) => Math.max(m, r.id), 0)
        this.nextRecordId = Math.max(asNonNegativeInt(data.nextRecordId, 1), maxHistoryId + 1, 1)

        const rawStats = (data.stats ?? {}) as Record<string, unknown>
        this.stats = {
          spins: asNonNegativeInt(rawStats.spins, 0),
          totalInCents: asNonNegativeInt(rawStats.totalInCents, 0),
          totalOutCents: asNonNegativeInt(rawStats.totalOutCents, 0),
          netPeakCents: Math.max(0, asFiniteNumber(rawStats.netPeakCents, 0)),
          maxDrawdownCents: asNonNegativeInt(rawStats.maxDrawdownCents, 0)
        }

        const totals: Record<string, MachineTotals> = {}
        const rawTotals = (data.perMachine ?? {}) as Record<string, unknown>
        for (const [id, t] of Object.entries(rawTotals)) {
          if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue
          if (!MACHINES.has(id) || t === null || typeof t !== 'object') continue
          const tt = t as Record<string, unknown>
          totals[id] = {
            inCents: asNonNegativeInt(tt.inCents, 0),
            outCents: asNonNegativeInt(tt.outCents, 0),
            cycles: asNonNegativeInt(tt.cycles, 0),
            samples: Array.isArray(tt.samples)
              ? (tt.samples as unknown[]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).slice(-SPARKLINE_LIMIT)
              : []
          }
        }
        this.perMachine = totals

        const rawSettings = (data.settings ?? {}) as Record<string, unknown>
        const bets = defaultSettings().betsByMachine
        const rawBets = (rawSettings.betsByMachine ?? {}) as Record<string, unknown>
        for (const def of ALL_MACHINES) {
          if (def.family === 'pachislo' || (def.family === 'video' && def.fixedBet)) continue
          const candidate = rawBets[def.id]
          if (Number.isInteger(candidate) && (candidate as number) >= 1 && (candidate as number) <= def.maxCoins) {
            bets[def.id] = candidate as number
          }
        }
        this.settings = { xray: rawSettings.xray === true, betsByMachine: bets }
        return true
      } catch {
        return false
      }
    },

    resume(): boolean {
      return this.loadFromLocalStorage()
    },

    spinOnce(presses?: readonly [number, number, number]) {
      const def = this.currentDef
      const state = this.currentState
      if (def === null || state === null || this.phase !== 'playing' || this.spinning) return

      // blackjack-reel and lock-reel are interactive — they use their own
      // deal/stop/cashOut (bj) or lockDeal/lockStop (lock-reel) actions, not spinOnce.
      // cascade (Temple of Gold) is FREE PLAY — it runs the engine via useCascade
      // and never debits the bankroll, so it never goes through spinOnce either.
      if (def.family === 'blackjack-reel' || def.family === 'lock-reel' || def.family === 'cascade') return

      if (presses !== undefined) {
        for (const q of presses) {
          if (!Number.isInteger(q) || q < 0 || q > 20) {
            this.liveAnnouncement = 'Press timing glitch — try again.'
            return
          }
        }
      }

      const coins = this.currentBet
      const costCoins = nextSpinCost(def, state, coins)
      const costCents = costCoins * def.denominationCents
      if (costCents > this.bankrollCents) {
        const inBonus = state.pachislo !== null && state.pachislo.bonus !== null
        this.liveAnnouncement = inBonus
          ? 'Out of credits mid-bonus — play another machine to rebuild your bankroll, or end the session.'
          : 'Out of credits — play another machine to rebuild your bankroll, or end the session.'
        return
      }

      this.spinning = true

      feedProgressive(def, state.progressive, 'before', coins)

      const out = def.family === 'pachislo'
        ? spinPachislo(def, state, coins, liveRand, presses)
        : spin(def, state, coins, liveRand)

      feedProgressive(def, state.progressive, 'after', out.coinsIn)

      if (out.coinsIn !== costCoins) {
        throw new Error(`${def.id}: nextSpinCost predicted ${costCoins} but spin charged ${out.coinsIn}`)
      }

      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.liveAnnouncement = this.describeOutcome(def, out)
      this.saveToLocalStorage()
    },

    revealDone() {
      this.spinning = false
    },

    /**
     * Shared bookkeeping for a resolved SpinOutcome: apply credits, push a
     * history record, update session + per-machine stats, and persist.
     * Used by spinOnce AND the blackjack-reel interactive actions so the
     * accounting is exactly identical across all families.
     */
    bookOutcome(def: MachineDef, out: SpinOutcome): void {
      const inCents = Math.round(out.coinsIn * def.denominationCents)
      const outCents = Math.round(out.totalPayout * def.denominationCents)
      this.bankrollCents += outCents - inCents

      this.history.push({
        id: this.nextRecordId++,
        machineId: def.id,
        gameKind: out.gameKind,
        coins: out.coins,
        coinsInCents: inCents,
        payoutCents: outCents,
        entryIds: out.wins.map(w => w.entryId),
        t: Date.now()
      })
      if (this.history.length > HISTORY_LIMIT) this.history.splice(0, this.history.length - HISTORY_LIMIT)

      this.stats.totalInCents += inCents
      this.stats.totalOutCents += outCents
      const net = this.stats.totalOutCents - this.stats.totalInCents
      if (net > this.stats.netPeakCents) this.stats.netPeakCents = net
      const drawdown = this.stats.netPeakCents - net
      if (drawdown > this.stats.maxDrawdownCents) this.stats.maxDrawdownCents = drawdown

      const totals = this.perMachine[def.id] ?? (this.perMachine[def.id] = { inCents: 0, outCents: 0, cycles: 0, samples: [] })
      totals.inCents += inCents
      totals.outCents += outCents
      if (out.gameKind === 'base' || out.gameKind === 'normal') {
        this.stats.spins += 1
        totals.cycles += 1
        if (totals.cycles % SPARKLINE_EVERY === 0 && totals.inCents > 0) {
          totals.samples.push(totals.outCents / totals.inCents)
          if (totals.samples.length > SPARKLINE_LIMIT) totals.samples.splice(0, totals.samples.length - SPARKLINE_LIMIT)
        }
      }
    },

    // ── Flameout 21 interactive actions ───────────────────────────────────

    /**
     * Deal two cards for the current blackjack-reel machine. Only fires when:
     *   - current machine is blackjack-reel
     *   - phase is 'idle' or 'resolved' (ready for a new hand)
     *   - bankroll covers the ante (= currentBet coins)
     *
     * Charges the ante up-front via bookOutcome (coinsIn = currentBet, payout = 0),
     * updates wagered stats, saves, and sets the spinning gate.
     */
    deal(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
      ) return

      const bj = state.blackjackReel
      if (bj.phase !== 'idle' && bj.phase !== 'resolved') return

      const coins = this.currentBet
      const costCents = coins * def.denominationCents
      if (costCents > this.bankrollCents) {
        this.liveAnnouncement = 'Out of credits — play another machine to rebuild your bankroll, or end the session.'
        return
      }

      this.spinning = true
      const out = dealReels(def as BlackjackReelMachineDef, state, coins, liveRand)

      // Charge the ante now (payout = 0); the hand result is booked later at resolve.
      // bookOutcome debits coinsIn and credits totalPayout, here: debit coins, credit 0.
      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.saveToLocalStorage()
    },

    /**
     * Stop the next reel for the current in-progress hand. Only fires when
     * phase === 'spinning'. Free (coinsIn = 0). If the stop resolves the hand
     * (a CRASH, or topping out after the fifth reel) the payout is booked
     * immediately; a surviving climb stays spinning with no record.
     */
    stop(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'spinning'
      ) return

      this.spinning = true
      const out = stopReel(def as BlackjackReelMachineDef, state, liveRand)
      this.lastOutcome = out

      // stopReel may mutate bj.phase to 'resolved' (crash or topped out)
      const bjPhase: string = state.blackjackReel!.phase
      if (bjPhase === 'resolved') {
        // Hand ended (crash or topped out): book the payout now.
        this.bookOutcome(def, out)
        this.liveAnnouncement = this.describeOutcome(def, out)
      }
      this.saveToLocalStorage()
    },

    /**
     * Cash out: bank bet × multiplier at the current climb. Only fires when
     * phase === 'spinning' and the first card has landed (idx >= 1). Free
     * (coinsIn = 0). Books the payout.
     */
    cashOut(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'spinning'
        || state.blackjackReel.idx < 1
      ) return

      this.spinning = true
      const out = bjCashOut(def as BlackjackReelMachineDef, state)
      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.liveAnnouncement = this.describeOutcome(def, out)
      this.saveToLocalStorage()
    },

    /**
     * Return a resolved Flameout 21 hand to idle (the attract spin), ready for
     * a fresh deal — powers the result card's "Play Again". No charge: the next
     * STOP deals and charges the ante (matches the demo's reset()).
     */
    resetHand(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'resolved'
      ) return
      state.blackjackReel = freshBlackjackState()
      this.saveToLocalStorage()
    },

    // ── Stop & Lock 777 (lock-reel) interactive actions ───────────────────
    //
    // One round = lockDeal (charge the ante once) → five lockStop calls to lock
    // the reels left-to-right → on the fifth stop, either the collect is booked
    // or the 777 bonus opens. In the bonus, each lockStop steps one respin until
    // the feature resolves and the full collect is booked. lockReset returns a
    // resolved round to idle for "play again" (the next lockDeal re-charges).
    //
    // A single lockStop drives BOTH the base stops and the bonus respins: to the
    // player it is one STOP button, and the engine dispatches stopReel vs
    // bonusStop by phase. Gated exactly like the blackjack-reel actions (no
    // double-charge, the spinning/reveal lock, act only in the right phase).

    /**
     * Begin a Stop & Lock 777 round: charge the ante up-front (coinsIn =
     * currentBet, payout = 0) via bookOutcome, start the reels spinning. Only
     * fires when the current machine is lock-reel, phase is 'idle'/'resolved',
     * the gate is down, and the bankroll covers the ante.
     */
    lockDeal(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'lock-reel'
        || state.lockReel === null
      ) return

      const lr = state.lockReel
      if (lr.phase !== 'idle' && lr.phase !== 'resolved') return

      const coins = this.currentBet
      const costCents = coins * def.denominationCents
      if (costCents > this.bankrollCents) {
        this.liveAnnouncement = 'Out of credits — play another machine to rebuild your bankroll, or end the session.'
        return
      }

      this.spinning = true
      const out = lockDealStart(def as LockReelMachineDef, state, coins, liveRand)
      // Charge the ante now (payout = 0); the collect is booked later at resolve.
      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.saveToLocalStorage()
    },

    /**
     * Step the round one stop: in 'spinning' lock the next reel (the fifth stop
     * resolves → collect or bonus); in 'bonus' play one respin (auto-ending the
     * feature when it resolves). Free (coinsIn = 0). The collect is booked only
     * on the call that lands the round in 'resolved'. No-op outside those phases.
     */
    lockStop(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'lock-reel'
        || state.lockReel === null
      ) return

      const phase = state.lockReel.phase
      if (phase !== 'spinning' && phase !== 'bonus') return

      this.spinning = true
      const out = phase === 'spinning'
        ? lockStopReel(def as LockReelMachineDef, state, liveRand)
        : lockBonusStop(def as LockReelMachineDef, state, liveRand)
      this.lastOutcome = out

      // stopReel/bonusStop may move the round to 'resolved' (collect ready);
      // 'spinning'/'bonus' continue with no record. A bonus TRIGGER (phase moved
      // spinning → bonus on the fifth stop) pays nothing yet, so it is not booked.
      if (state.lockReel!.phase === 'resolved') {
        this.bookOutcome(def, out)
        this.liveAnnouncement = this.describeOutcome(def, out)
      }
      this.saveToLocalStorage()
    },

    /**
     * Return a resolved Stop & Lock 777 round to idle (the attract spin), ready
     * for a fresh lockDeal — powers the result card's "Play Again". No charge:
     * the next lockDeal deals and charges the ante.
     */
    lockReset(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'lock-reel'
        || state.lockReel === null
        || state.lockReel.phase !== 'resolved'
      ) return
      state.lockReel = freshLockState(def as LockReelMachineDef)
      this.saveToLocalStorage()
    },

    describeOutcome(def: MachineDef, out: SpinOutcome): string {
      if (def.family === 'lock-reel') {
        // Spoken at resolve: the GRAND (grid fill) flag, then the collect, then
        // the banked dollars + balance. A bonus TRIGGER would carry no collect
        // (it pays at the bonus's own resolve), so a 0-payout outcome just reports
        // the lock activity.
        const dollars = (credits: number): string => `$${(credits * def.denominationCents / 100).toFixed(2)}`
        const grand = out.featureEvents.some(e => e.type === 'grand')
        const collect = out.featureEvents.find(e => e.type === 'collect')
        const bonus = out.featureEvents.some(e => e.type === 'bonus-triggered')
        const parts: string[] = []
        if (grand) parts.push('GRAND — filled the grid!')
        if (bonus && collect === undefined) parts.push('Three 7s — 777 BONUS!')
        if (collect !== undefined) {
          parts.push(collect.credits > 0
            ? `Collected ${collect.credits.toLocaleString('en-US')} credits${out.totalPayout > 0 ? ` — banked ${dollars(out.totalPayout)}.` : '.'}`
            : 'No cash locked — collected nothing.')
        }
        if (parts.length === 0) parts.push('Locked.')
        parts.push(`Balance ${Math.floor(this.bankrollCents / def.denominationCents).toLocaleString('en-US')} credits.`)
        return parts.join(' ')
      }
      if (def.family === 'blackjack-reel') {
        const dollars = (credits: number): string => `$${(credits * def.denominationCents / 100).toFixed(2)}`
        for (const e of out.featureEvents) {
          if (e.type === 'crash') return `Flamed out on reel ${e.reel + 1} at ×${e.multiplier.toFixed(2)} — lost the bet. Balance ${dollars(this.bankrollCents / def.denominationCents)}.`
          if (e.type === 'cash-out') return `Cashed out at ×${e.multiplier.toFixed(2)} — banked ${dollars(out.totalPayout)}. Balance ${dollars(this.bankrollCents / def.denominationCents)}.`
          if (e.type === 'topped-out') return `Topped out at ×${e.multiplier.toFixed(2)} — banked ${dollars(out.totalPayout)}! Balance ${dollars(this.bankrollCents / def.denominationCents)}.`
        }
        return 'Dealt.'
      }
      const parts: string[] = []
      if (out.totalPayout > 0) {
        parts.push(`Won ${out.totalPayout.toLocaleString('en-US')} credits.`)
      } else {
        parts.push('No win.')
      }
      // Speak the honest result too: a win under the bet is a net loss (LDW).
      const net = out.totalPayout - out.coinsIn
      if (net > 0) parts.push(`Net up ${net.toLocaleString('en-US')}.`)
      else if (net < 0) parts.push(`Net down ${(-net).toLocaleString('en-US')}.`)
      else parts.push('Net even.')
      for (const e of out.featureEvents) {
        if (e.type === 'free-spins-triggered') parts.push(`${e.count} free spins at ${e.multiplier}x.`)
        if (e.type === 'free-spin-consumed') parts.push(`Free spins: ${e.remaining} remaining.`)
        if (e.type === 'free-spins-retriggered') parts.push(`Retrigger! ${e.remaining} free spins.`)
        if (e.type === 'orbs-locked') parts.push(`${e.cells.length} orbs locked.`)
        if (e.type === 'mult-orbs-locked') parts.push(`${e.mults.map(m => `times ${m}`).join(' ')} multiplier locked.`)
        if (e.type === 'hold-and-spin-ended') parts.push(`Hold and spin pays ${e.totalCredits.toLocaleString('en-US')} credits${e.filled ? ' — GRAND!' : '.'}`)
        if (e.type === 'flag-stocked') parts.push(`${e.flag} stocked.`)
        if (e.type === 'bonus-started') parts.push(`${e.bonus.toUpperCase()} bonus!`)
        if (e.type === 'interlude-started') parts.push('Bonus interlude.')
        if (e.type === 'bonus-ended') parts.push('Bonus complete.')
        if (e.type === 'replay-granted') parts.push('Replay — next game free.')
      }
      for (const p of out.progressiveEvents) {
        parts.push(`PROGRESSIVE: ${p.amountCredits.toLocaleString('en-US')} credits!`)
      }
      parts.push(`Balance ${Math.floor(this.bankrollCents / def.denominationCents).toLocaleString('en-US')} credits.`)
      return parts.join(' ')
    },

    setOddsLevel(level: number) {
      const def = this.currentDef
      const state = this.currentState
      if (def === null || state === null || def.family !== 'pachislo' || state.pachislo === null) return
      if (this.spinning || state.pachislo.bonus !== null) {
        throw new Error('operator key works only while the machine is idle')
      }
      if (!Number.isInteger(level) || level < 1 || level > def.oddsLevels.length) {
        throw new Error(`oddsLevel ${level} out of range 1..${def.oddsLevels.length}`)
      }
      state.pachislo.oddsLevel = level
      this.saveToLocalStorage()
    },

    /** True when valid-looking session data exists, WITHOUT loading it. */
    peekSavedSession(): boolean {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return false
        const data = JSON.parse(raw) as { v?: unknown }
        return data !== null && typeof data === 'object' && data.v === STORAGE_VERSION
      } catch {
        return false
      }
    },

    exportHistory(): string {
      const lines = this.history.map(r =>
        `#${r.id}\t${new Date(r.t).toISOString()}\t${r.machineId}\t${r.gameKind}\tbet ${r.coinsInCents}c\twin ${r.payoutCents}c\t${r.entryIds.join(',') || '-'}`)
      const net = this.stats.totalOutCents - this.stats.totalInCents
      return [
        'metaincognita-slots session log',
        ...lines,
        '',
        `Session totals: in ${this.stats.totalInCents}c out ${this.stats.totalOutCents}c net ${net}c over ${this.stats.spins} games`
      ].join('\n')
    }
  }
})
