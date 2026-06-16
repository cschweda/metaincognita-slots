import { defineStore } from 'pinia'
import { addCoinToProgressive, freshBlackjackState, initMachineState, nextSpinCost, spin, validateMachineDef } from '~/engine'
import type { BlackjackReelMachineDef, MachineDef, MachineSessionState, PachisloFlag, PachisloBonusState, SpinOutcome } from '~/engine'
import { spinPachislo } from '~/engine/pachislo'
import { dealReels, stopReel, cashOut as bjCashOut, gambleStop as bjGambleStop, gambleCashOut as bjGambleCashOut, GAMBLE_CAP } from '~/engine/blackjackReel'
import { FLOOR } from '~/machines'
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

  // blackjack-reel: validate and restore a persisted BlackjackReelSessionState
  if (def.family === 'blackjack-reel' && r.blackjackReel !== null && typeof r.blackjackReel === 'object') {
    const bj = r.blackjackReel as Record<string, unknown>
    const bjDef = def as BlackjackReelMachineDef

    // Build the complete set of valid symbol ids for this def (deck cards + specials)
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
    const SUITS = ['S', 'H', 'D', 'C']
    const deckIds = new Set<string>()
    for (const suit of SUITS) for (const rank of RANKS) deckIds.add(`${rank}${suit}`)
    const specialIds = new Set<string>(Object.keys(bjDef.symbols))
    const isValidSym = (s: unknown): s is string =>
      typeof s === 'string' && (deckIds.has(s) || specialIds.has(s))

    const phase = bj.phase
    if (phase !== 'idle' && phase !== 'spinning' && phase !== 'resolved' && phase !== 'gamble') {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    // reelStrips: array of valid symbol id arrays (or empty [] for idle phase)
    const rawStrips = bj.reelStrips
    let reelStrips: string[][] = []
    if (phase !== 'idle') {
      if (!Array.isArray(rawStrips)) {
        fresh.blackjackReel = freshBlackjackState()
        return fresh
      }
      const mapped: (string[] | null)[] = (rawStrips as unknown[]).map((strip) => {
        if (!Array.isArray(strip)) return null
        const validated = (strip as unknown[]).filter(isValidSym)
        return validated.length === (strip as unknown[]).length ? validated : null
      })
      if (mapped.some(s => s === null)) {
        fresh.blackjackReel = freshBlackjackState()
        return fresh
      }
      reelStrips = mapped as string[][]
    }

    // landed: array of 5 (valid SymbolId or null)
    const rawLanded = bj.landed
    if (!Array.isArray(rawLanded) || rawLanded.length !== 5) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }
    const landed = (rawLanded as unknown[]).map((s) => {
      if (s === null) return null
      return isValidSym(s) ? s : 'INVALID'
    })
    if (landed.some(s => s === 'INVALID')) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    // idx: integer 0..5
    const idx = bj.idx
    if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) > 5) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    // hand: array of valid symbol ids
    const rawHand = bj.hand
    if (!Array.isArray(rawHand)) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }
    const hand = rawHand as unknown[]
    if (!hand.every(isValidSym)) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    // numeric fields
    const hard = asFiniteNumber(bj.hard, -1)
    const aces = asFiniteNumber(bj.aces, -1)
    const multSum = asFiniteNumber(bj.multSum, -1)
    const bt = asFiniteNumber(bj.bestTotal, -1)
    const ante = asFiniteNumber(bj.ante, -1)
    if (
      !Number.isInteger(hard) || hard < 0
      || !Number.isInteger(aces) || aces < 0
      || !Number.isInteger(multSum) || multSum < 0
      || !Number.isInteger(bt) || bt < 0
      || !Number.isInteger(ante) || ante < 0 || ante > bjDef.maxCoins
    ) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    // booleans
    if (
      typeof bj.natural !== 'boolean'
      || typeof bj.busted !== 'boolean'
      || typeof bj.bustBySymbol !== 'boolean'
      || typeof bj.charlie !== 'boolean'
    ) {
      fresh.blackjackReel = freshBlackjackState()
      return fresh
    }

    fresh.blackjackReel = {
      phase: phase as 'idle' | 'spinning' | 'resolved' | 'gamble',
      reelStrips: reelStrips as string[][],
      landed: landed as (string | null)[],
      idx: idx as number,
      hand: hand as string[],
      hard: hard,
      aces: aces,
      multSum: multSum,
      bestTotal: bt,
      natural: bj.natural as boolean,
      busted: bj.busted as boolean,
      bustBySymbol: bj.bustBySymbol as boolean,
      charlie: bj.charlie as boolean,
      ante: ante,
      gambleAmount: asNonNegativeInt(bj.gambleAmount, 0),
      gambleCount: Math.min(asNonNegativeInt(bj.gambleCount, 0), GAMBLE_CAP)
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
    },

    spinOnce(presses?: readonly [number, number, number]) {
      const def = this.currentDef
      const state = this.currentState
      if (def === null || state === null || this.phase !== 'playing' || this.spinning) return

      // blackjack-reel is interactive — it uses dealHand/hitCard/standHand, not spinOnce
      if (def.family === 'blackjack-reel') return

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

      if (
        (def.family === 'stepper' || def.family === 'bally-em')
        && def.progressive !== null && state.progressive !== null
      ) {
        for (let c = 0; c < coins; c++) addCoinToProgressive(state.progressive, def.progressive)
      }

      const out = def.family === 'pachislo'
        ? spinPachislo(def, state, coins, liveRand, presses)
        : spin(def, state, coins, liveRand)

      if (
        def.family === 'video' && def.progressive !== null && state.progressive !== null
      ) {
        for (let c = 0; c < out.coinsIn; c++) addCoinToProgressive(state.progressive, def.progressive)
      }

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
      const inCents = out.coinsIn * def.denominationCents
      const outCents = out.totalPayout * def.denominationCents
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

    // ── Hit or Bust interactive actions ──────────────────────────────────────

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
     * (bust or Five-Card Charlie) the payout is booked immediately.
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

      // stopReel may mutate bj.phase to 'resolved' (bust or charlie)
      const bjPhase: string = state.blackjackReel!.phase
      if (bjPhase === 'resolved') {
        // Hand ended (bust or charlie): book the payout now.
        this.bookOutcome(def, out)
        this.liveAnnouncement = this.describeOutcome(def, out)
      }
      this.saveToLocalStorage()
    },

    /**
     * Cash out: resolve the hand at its current best total. Only fires when
     * phase === 'spinning'. Free (coinsIn = 0). Books the payout.
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
      ) return

      this.spinning = true
      const out = bjCashOut(def as BlackjackReelMachineDef, state)
      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.liveAnnouncement = this.describeOutcome(def, out)
      this.saveToLocalStorage()
    },

    /** Blackjack-bonus: STOP the double-or-nothing reel (fair 50/50). */
    gambleStop(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'gamble'
        || state.blackjackReel.gambleCount >= GAMBLE_CAP
      ) return
      this.spinning = true
      const out = bjGambleStop(def as BlackjackReelMachineDef, state, liveRand)
      this.lastOutcome = out
      const bjPhaseAfterGamble: string = state.blackjackReel!.phase
      if (bjPhaseAfterGamble === 'resolved') {
        this.bookOutcome(def, out)
        this.liveAnnouncement = this.describeOutcome(def, out)
      }
      this.saveToLocalStorage()
    },

    /** Blackjack-bonus: keep the guaranteed amount without spinning. */
    gambleCashOut(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'gamble'
      ) return
      this.spinning = true
      const out = bjGambleCashOut(def as BlackjackReelMachineDef, state)
      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.liveAnnouncement = this.describeOutcome(def, out)
      this.saveToLocalStorage()
    },

    /**
     * Return a resolved Lucky 21 hand to idle (the attract spin), ready for a
     * fresh deal — powers the result modal's "Play Again". No charge: the next
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

    describeOutcome(def: MachineDef, out: SpinOutcome): string {
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
