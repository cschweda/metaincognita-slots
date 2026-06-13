import { defineStore } from 'pinia'
import { initMachineState, validateMachineDef } from '~/engine'
import type { MachineDef, MachineSessionState, PachisloFlag, PachisloBonusState, SpinOutcome } from '~/engine'
import { FLOOR } from '~/machines'

export const STORAGE_KEY = 'slots-simulator-session'
const STORAGE_VERSION = 1
const HISTORY_LIMIT = 1000
export const SPARKLINE_EVERY = 10
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

export interface SessionStats {
  spins: number
  totalInCents: number
  totalOutCents: number
  netPeakCents: number
  maxDrawdownCents: number
}

export interface MachineTotals {
  inCents: number
  outCents: number
  cycles: number
  /** session RTP samples (every SPARKLINE_EVERY cycles, last SPARKLINE_LIMIT) */
  samples: number[]
}

export interface SlotsSettings {
  xray: boolean
  betsByMachine: Record<string, number>
}

const MACHINES = new Map<string, MachineDef>(FLOOR.map(def => [def.id, def]))

function emptyStats(): SessionStats {
  return { spins: 0, totalInCents: 0, totalOutCents: 0, netPeakCents: 0, maxDrawdownCents: 0 }
}

function defaultSettings(): SlotsSettings {
  return { xray: false, betsByMachine: Object.fromEntries(FLOOR.map(def => [def.id, def.maxCoins])) }
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
        this.nextRecordId = Math.max(1, asNonNegativeInt(data.nextRecordId, 1))

        const states: Record<string, MachineSessionState> = {}
        const rawStates = (data.machineStates ?? {}) as Record<string, unknown>
        for (const [id, candidate] of Object.entries(rawStates)) {
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
                gameKind: typeof e.gameKind === 'string' ? e.gameKind : 'base',
                coins: asNonNegativeInt(e.coins, 1),
                coinsInCents: asNonNegativeInt(e.coinsInCents, 0),
                payoutCents: asNonNegativeInt(e.payoutCents, 0),
                entryIds: Array.isArray(e.entryIds) ? (e.entryIds as unknown[]).filter(x => typeof x === 'string') as string[] : [],
                t: asNonNegativeInt(e.t, 0)
              }]
            }).slice(-HISTORY_LIMIT)
          : []

        const rawStats = (data.stats ?? {}) as Record<string, unknown>
        this.stats = {
          spins: asNonNegativeInt(rawStats.spins, 0),
          totalInCents: asNonNegativeInt(rawStats.totalInCents, 0),
          totalOutCents: asNonNegativeInt(rawStats.totalOutCents, 0),
          netPeakCents: asFiniteNumber(rawStats.netPeakCents, 0),
          maxDrawdownCents: asNonNegativeInt(rawStats.maxDrawdownCents, 0)
        }

        const totals: Record<string, MachineTotals> = {}
        const rawTotals = (data.perMachine ?? {}) as Record<string, unknown>
        for (const [id, t] of Object.entries(rawTotals)) {
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
        for (const def of FLOOR) {
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
    }
  }
})
