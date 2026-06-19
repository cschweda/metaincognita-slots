// app/composables/useLockReel.ts
// Stop & Lock 777 — the "big daddy" cash-collect composable. Wraps the store,
// derives the display values (the 5×4 grid cells, the three vault-7 meter
// states, the collect $, the bet chips, a live message) and exposes
// deal/stop/reset/playAgain/sameBet wrapping the store's lock actions.
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import type { LockReelMachineDef } from '~/engine'
import type { SymbolId } from '~/engine/types'

/** One displayed grid cell (row-major: row r, column c → grid[c][r]). */
export interface CellView {
  /** 'empty' (still spinning) | 'cash' | 'prize' | 'seven' | 'blank' */
  kind: 'empty' | 'cash' | 'prize' | 'seven' | 'blank'
  /** the symbol id once locked (null while the column spins) */
  symbol: SymbolId | null
  /** the label to render: a $ amount, a prize name, '7', or '' */
  text: string
  /** true once the column has been stopped (cell is locked in place) */
  locked: boolean
}

/** One of the three vault-7 meter lamps. */
export interface SevenLamp {
  /** this lamp is lit (a 7 banked toward it) */
  lit: boolean
  /** this is the next, still-chasing lamp — spins while the round is live */
  next: boolean
}

export interface LockResult {
  kind: 'collect' | 'grand'
  title: string
  amountDollars: string
  sub: string
}

const BET_CHIPS = [1, 5, 10, 15, 20] as const

export function useLockReel() {
  const store = useSlotsStore()

  const lockState = computed(() => {
    const def = store.currentDef
    const state = store.currentState
    if (def === null || state === null || def.family !== 'lock-reel') return null
    return state.lockReel
  })
  const def = computed(() => {
    const d = store.currentDef
    return d?.family === 'lock-reel' ? (d as LockReelMachineDef) : null
  })

  const phase = computed(() => lockState.value?.phase ?? 'idle')
  const idx = computed(() => lockState.value?.idx ?? 0)
  const sevenCount = computed(() => lockState.value?.sevenCount ?? 0)
  const respinsLeft = computed(() => lockState.value?.respinsLeft ?? 0)
  const ante = computed(() => lockState.value?.ante ?? 0)
  const rows = computed(() => def.value?.rows ?? 4)
  const isBonus = computed(() => phase.value === 'bonus')
  const isLive = computed(() => phase.value === 'spinning' || phase.value === 'bonus')

  // coins on the line: the locked ante once dealt, else the selected bet
  const betCoins = computed(() => (ante.value > 0 ? ante.value : store.currentBet))

  /** Dollar value of a per-coin credit amount at the current bet. */
  function creditsToDollars(credits: number): string {
    const d = def.value
    if (d === null || credits <= 0) return ''
    return `$${(credits * betCoins.value * d.denominationCents / 100).toFixed(0)}`
  }

  /** Classify a locked symbol into a renderable cell. */
  function classify(sym: SymbolId): CellView {
    const d = def.value
    if (d === null) return { kind: 'blank', symbol: sym, text: '', locked: true }
    if (sym === d.sevenSymbol) return { kind: 'seven', symbol: sym, text: '7', locked: true }
    if (sym === d.blankSymbol) return { kind: 'blank', symbol: sym, text: '', locked: true }
    if (d.cashValues[sym] !== undefined) {
      return { kind: 'cash', symbol: sym, text: creditsToDollars(d.cashValues[sym]!), locked: true }
    }
    if (d.prizes[sym] !== undefined) {
      return { kind: 'prize', symbol: sym, text: d.symbols[sym]?.label ?? sym, locked: true }
    }
    return { kind: 'blank', symbol: sym, text: '', locked: true }
  }

  /**
   * The 5×4 display grid as rows of cells (row r, columns 0..4). A column that
   * has not been stopped yet shows `empty` cells (the reel spins); a stopped
   * column shows its locked symbols. The store grid is [reel][row].
   */
  const gridRows = computed((): CellView[][] => {
    const d = def.value
    const lr = lockState.value
    const out: CellView[][] = []
    for (let r = 0; r < rows.value; r++) {
      const rowCells: CellView[] = []
      for (let c = 0; c < 5; c++) {
        const cell = d === null || lr === null ? null : lr.grid[c]?.[r] ?? null
        rowCells.push(cell === null
          ? { kind: 'empty', symbol: null, text: '', locked: false }
          : classify(cell))
      }
      out.push(rowCells)
    }
    return out
  })

  /** Whether reel column `c` is currently locked (stopped). */
  function columnLocked(c: number): boolean {
    return c < idx.value
  }

  /**
   * The three vault-7 lamps. `lit` = a 7 banked toward it (capped at 3); the
   * single `next` (first unlit) lamp chases — it spins while the round is live.
   */
  const sevenLamps = computed((): SevenLamp[] => {
    const lit = Math.min(sevenCount.value, 3)
    const out: SevenLamp[] = []
    for (let i = 0; i < 3; i++) {
      out.push({ lit: i < lit, next: i === lit && isLive.value })
    }
    return out
  })

  // running collect (per coin) → dollars at the current bet
  const collectCredits = computed(() => lockState.value?.collectCredits ?? 0)
  const collectDollars = computed((): string => {
    const d = def.value
    if (d === null) return '$0'
    return `$${(collectCredits.value * betCoins.value * d.denominationCents / 100).toFixed(0)}`
  })
  const betDollars = computed((): string => {
    const d = def.value
    if (d === null) return '$0.00'
    return `$${(betCoins.value * d.denominationCents / 100).toFixed(2)}`
  })
  const minDollars = computed((): string => {
    const d = def.value
    if (d === null) return '—'
    const c = d.denominationCents
    return c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`
  })

  const betChips = computed(() => BET_CHIPS.map(c => ({ coins: c, dollars: `$${c}`, active: store.currentBet === c })))
  function selectBet(coins: number): void {
    store.setBet(coins)
  }

  /**
   * Which reel-column STOP key is "live" (hot + clickable), 0..4, or -1 when no
   * base key is actionable (the bonus uses its own RESPIN key). From idle/resolved
   * the first key is the deal trigger; while spinning it tracks the next reel.
   */
  const liveReel = computed(() => {
    if (phase.value === 'spinning') return idx.value < 5 ? idx.value : -1
    if (phase.value === 'bonus') return -1
    return canDeal.value ? 0 : -1
  })

  /** Hint under the STOP key. */
  const stopHint = computed((): string => {
    if (phase.value === 'idle' || phase.value === 'resolved') return 'spin to play'
    if (phase.value === 'bonus') return `respin · ${respinsLeft.value} left`
    return idx.value < 5 ? `lock reel ${idx.value + 1}` : 'collect'
  })

  const message = computed((): { text: string, tone: '' | 'good' | 'gold' | 'big' } => {
    const lr = lockState.value
    if (lr === null || lr.phase === 'idle') {
      return { text: 'Spin — then STOP each reel to lock the cash', tone: '' }
    }
    if (lr.phase === 'resolved') {
      if (lr.sevenCount >= 3 && collectCredits.value > 0) {
        return { text: `Collected ${collectDollars.value}`, tone: 'gold' }
      }
      return collectCredits.value > 0
        ? { text: `Collected ${collectDollars.value}`, tone: 'good' }
        : { text: 'No cash locked this round', tone: '' }
    }
    if (lr.phase === 'bonus') {
      return { text: '777 — BONUS! locked cash stays, every empty cell respins', tone: 'gold' }
    }
    // spinning
    const lit = Math.min(lr.sevenCount, 3)
    if (lit >= 2 && lr.idx < 5) return { text: 'ONE MORE 7 → BONUS!', tone: 'big' }
    if (lr.idx === 0) return { text: 'Stop the reels — lock each one left to right', tone: '' }
    return { text: `Locked ${collectDollars.value} so far — keep stopping`, tone: 'good' }
  })

  const canDeal = computed(() => {
    const d = def.value
    if (d === null || store.spinning) return false
    const p = phase.value
    if (p !== 'idle' && p !== 'resolved') return false
    return store.currentBet * d.denominationCents <= store.bankrollCents
  })
  // A single STOP key drives both the base stops and the bonus respins.
  const canStop = computed(() => {
    if (store.spinning) return false
    const p = phase.value
    return p === 'idle' ? canDeal.value : p === 'spinning' || p === 'bonus'
  })
  const canBonusStop = computed(() => !store.spinning && phase.value === 'bonus')

  function deal(): void {
    if (!canDeal.value) return
    store.lockDeal()
    store.revealDone()
  }
  // STOP from idle deals + locks the first reel in one press; otherwise steps
  // one stop (a base reel lock or one bonus respin).
  function stop(): void {
    if (!canStop.value) return
    if (phase.value === 'idle') {
      store.lockDeal()
      store.revealDone()
      store.lockStop()
      store.revealDone()
    } else {
      store.lockStop()
      store.revealDone()
    }
  }
  function reset(): void {
    store.lockReset()
    store.revealDone()
  }
  function playAgain(): void {
    store.lockReset()
    store.revealDone()
  }
  // "Same Bet": from a resolved round (or idle) deal + lock the first reel.
  function sameBet(): void {
    if (!canDeal.value) return
    store.lockReset()
    store.lockDeal()
    store.revealDone()
    store.lockStop()
    store.revealDone()
  }

  const resultOutcome = computed((): LockResult | null => {
    const lr = lockState.value
    const d = def.value
    if (lr === null || d === null || lr.phase !== 'resolved') return null
    const filled = lr.grid.every(col => col.every(c => c !== null && c !== d.blankSymbol))
    const banked = `$${(lr.collectCredits * lr.ante * d.denominationCents / 100).toFixed(0)}`
    if (filled) {
      return {
        kind: 'grand',
        title: 'GRAND!',
        amountDollars: banked,
        sub: `filled all ${5 * d.rows} cells — the GRAND on a ${betDollars.value} bet`
      }
    }
    const bonused = lr.sevenCount >= 3
    return {
      kind: 'collect',
      title: bonused ? 'BONUS COLLECT' : 'COLLECT',
      amountDollars: lr.collectCredits > 0 ? banked : '$0',
      sub: lr.collectCredits > 0
        ? `${bonused ? 'three 7s cracked the vault — ' : ''}banked on a ${betDollars.value} bet`
        : `no cash landed on a ${betDollars.value} bet`
    }
  })

  return {
    lockState, def, phase, idx, sevenCount, respinsLeft, ante, rows, isBonus, isLive,
    gridRows, columnLocked, sevenLamps, collectCredits, collectDollars, betDollars,
    minDollars, betChips, selectBet, liveReel, stopHint, message,
    canDeal, canStop, canBonusStop, deal, stop, reset, playAgain, sameBet, resultOutcome
  }
}
