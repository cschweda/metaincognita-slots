// app/composables/useBlackjackReel.ts
// Lucky 21 — stop-the-reels composable. Wraps the store, computes derived
// display values (score, cash-out $, modal breakdown), and exposes the three
// actions: deal / stop / cashOut.
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { bestTotal, handPayout } from '~/engine/blackjackReel'
import type { BlackjackReelMachineDef } from '~/engine'
import type { SymbolId } from '~/engine/types'

export interface ModalOutcome {
  kind: 'win' | 'bust' | 'charlie'
  best: number
  baseDollars: number
  mult: number
  totalDollars: string
  sub: string
  // bust-only
  bustLabel?: string
  bustValue?: string
  bustResult?: string
}

export function useBlackjackReel() {
  const store = useSlotsStore()

  const bjState = computed(() => {
    const def = store.currentDef
    const state = store.currentState
    if (def === null || state === null || def.family !== 'blackjack-reel') return null
    return state.blackjackReel
  })

  const def = computed(() => {
    const d = store.currentDef
    return d?.family === 'blackjack-reel' ? (d as BlackjackReelMachineDef) : null
  })

  const phase = computed(() => bjState.value?.phase ?? 'idle')
  const reelStrips = computed(() => bjState.value?.reelStrips ?? [])
  const landed = computed(() => bjState.value?.landed ?? [null, null, null, null, null])
  const idx = computed(() => bjState.value?.idx ?? 0)

  // ── score (dual display for soft hands) ────────────────────────────────────
  const score = computed((): string => {
    const bj = bjState.value
    const d = def.value
    if (bj === null || d === null || bj.phase === 'idle') return '—'
    if (bj.busted) return String(bj.hard)
    const { total, isSoft, softLow } = bestTotal(bj.hard, bj.aces)
    if (isSoft) return `${softLow} <span class="alt">or ${total}</span>`
    return String(total)
  })

  // ── cash-out value ─────────────────────────────────────────────────────────
  const cashValueCents = computed((): number => {
    const bj = bjState.value
    const d = def.value
    if (bj === null || d === null || bj.phase === 'idle') return 0
    if (bj.busted) return 0
    const pay = handPayout(d, bj)
    return pay * d.denominationCents
  })

  const cashValueDollars = computed((): string => {
    const c = cashValueCents.value
    return `$${(c / 100).toFixed(2)}`
  })

  // ── multSum for display ────────────────────────────────────────────────────
  const multSum = computed(() => bjState.value?.multSum ?? 0)

  // ── best total for logic ───────────────────────────────────────────────────
  const bestTotalVal = computed((): number => bjState.value?.bestTotal ?? 0)

  // ── ante (fixed bet) display ────────────────────────────────────────────────
  const anteDollars = computed((): string => {
    const bj = bjState.value
    const d = def.value
    if (d === null) return '$0.00'
    const coins = (bj !== null && bj.ante > 0) ? bj.ante : store.currentBet
    return `$${(coins * d.denominationCents / 100).toFixed(2)}`
  })

  // ── live message line (mirrors the demo's setMsg states) ────────────────────
  const message = computed((): { text: string, tone: '' | 'good' | 'bad' | 'gold' } => {
    const bj = bjState.value
    const d = def.value
    if (bj === null || d === null || bj.phase === 'idle' || bj.phase === 'resolved') {
      return { text: 'Press STOP to lock reel 1', tone: '' }
    }
    // spinning: describe the reel we just locked
    const lastIdx = bj.idx - 1
    if (lastIdx < 0) return { text: 'Press STOP to lock reel 1', tone: '' }
    const sym = bj.landed[lastIdx] ?? null
    const cash = cashValueDollars.value
    if (sym !== null && sym in d.multiplierSymbols) {
      return { text: `×${d.multiplierSymbols[sym]} multiplier — ${cash}`, tone: 'gold' }
    }
    if (sym !== null && sym in d.minusSymbols) {
      return { text: `−${d.minusSymbols[sym]} safe room (${cash} holds)`, tone: 'good' }
    }
    // a card landed
    if (bj.bestTotal < d.qualifyMin) {
      const { total } = bestTotal(bj.hard, bj.aces)
      return { text: `Score ${total} — reach ${d.qualifyMin} to win`, tone: '' }
    }
    if (cashValueCents.value > 0) return { text: `${cash} on the line — push toward 21`, tone: 'good' }
    return { text: 'No gain — push toward 21', tone: '' }
  })

  // STOP button sub-label: which reel the next STOP locks (demo updateStopLabel).
  const stopHint = computed((): string => (idx.value < 5 ? `spin reel ${idx.value + 1}` : '—'))

  // ── attract strips (idle phase only) ──────────────────────────────────────
  // Build a short strip per reel from the reel composition tokens so the idle
  // attract renders actual cards/specials. 'CARD' tokens are replaced with
  // representative deck cards (cycling through a fixed ordering so the strip
  // is deterministic and bounded). Bounded: max ~16 items * 2 passes = ≤32
  // elements per reel — never thousands.
  const attractStrips = computed((): SymbolId[][] => {
    const d = def.value
    if (d === null) return [[], [], [], [], []]
    // A fixed representative subset of the deck for attract cards (8 cards,
    // covering ranks A/K/Q/J/T/9/8/7 across suits for visual variety).
    const attractDeck: SymbolId[] = ['AS', 'KH', 'QD', 'JC', 'TS', 'AH', '9D', '8C']
    let di = 0
    return d.reels.map((slots): SymbolId[] =>
      slots.map((tok): SymbolId =>
        tok === 'CARD' ? attractDeck[di++ % attractDeck.length]! : tok
      )
    )
  })

  // ── can*/action gates ──────────────────────────────────────────────────────
  const canDeal = computed(() => {
    const d = def.value
    if (d === null || store.spinning) return false
    const p = phase.value
    if (p !== 'idle' && p !== 'resolved') return false
    return store.currentBet * d.denominationCents <= store.bankrollCents
  })

  // STOP is enabled in idle (to start the hand) and spinning (to lock a reel).
  // It is NOT enabled while the store's spinning gate is held (mid-action).
  const canStop = computed(() => {
    if (store.spinning) return false
    const p = phase.value
    if (p === 'idle') return canDeal.value // same bankroll gate
    return p === 'spinning'
  })

  // CASH OUT is only valid once a hand is in progress.
  const canCash = computed(() =>
    !store.spinning && phase.value === 'spinning'
  )

  // ── actions ────────────────────────────────────────────────────────────────
  function deal() {
    if (!canDeal.value) return
    store.deal()
    store.revealDone()
  }

  function stop() {
    if (!canStop.value) return
    if (phase.value === 'idle') {
      // STOP while idle: deal the hand (charges the ante), then immediately
      // lock reel 1. deal() sets spinning=true and the store transitions to
      // phase 'spinning'; revealDone clears the gate; then stop() picks up.
      store.deal()
      store.revealDone()
      // After revealDone the gate is clear and phase is 'spinning' — proceed.
      store.stop()
      store.revealDone()
    } else {
      store.stop()
      store.revealDone()
    }
  }

  function cashOut() {
    if (!canCash.value) return
    store.cashOut()
    store.revealDone()
  }

  // Dismiss the result modal and return to the idle attract, ready to play again.
  function playAgain() {
    store.resetHand()
    store.revealDone()
  }

  // ── modal outcome (only valid when phase === 'resolved') ────────────────────
  const modalOutcome = computed((): ModalOutcome | null => {
    const bj = bjState.value
    const d = def.value
    if (bj === null || d === null || bj.phase !== 'resolved') return null

    const ante = bj.ante
    const anteDollars = (ante * d.denominationCents / 100).toFixed(2)

    if (bj.busted) {
      const bustLabel = bj.bustBySymbol ? 'Drew a' : 'Total'
      const bustValue = bj.bustBySymbol ? 'BUST card' : String(bj.hard)
      const bustResult = bj.bustBySymbol ? 'BUST' : 'OVER 21'
      return {
        kind: 'bust',
        best: 0,
        baseDollars: 0,
        mult: 1,
        totalDollars: '$0.00',
        sub: `your $${anteDollars} bet is gone`,
        bustLabel,
        bustValue,
        bustResult
      }
    }

    const mult = Math.max(1, bj.multSum)
    const pay = handPayout(d, bj)
    const totalCents = pay * d.denominationCents
    const totalDollars = `$${(totalCents / 100).toFixed(2)}`

    // base pay for the best total (before mult × charlie)
    const paytableEntry = d.paytable.find(e => e.total === bj.bestTotal)
    const qualifyEntry = d.paytable.find(e => e.total === d.qualifyMin)
    const basePay = bj.charlie
      ? Math.max(
          paytableEntry?.pay ?? 0,
          qualifyEntry?.pay ?? 0
        )
      : (bj.natural && !bj.charlie && bj.bestTotal === 21)
          ? d.naturalPay
          : (paytableEntry?.pay ?? 0)
    const baseCents = basePay * ante * d.denominationCents
    const baseDollars = baseCents / 100

    const kind = bj.charlie ? 'charlie' : 'win'
    const sub = `cashed ${totalDollars} on a $${anteDollars} bet`

    return {
      kind,
      best: bj.bestTotal,
      baseDollars,
      mult,
      totalDollars,
      sub
    }
  })

  return {
    bjState,
    phase,
    reelStrips,
    attractStrips,
    landed,
    idx,
    score,
    cashValueCents,
    cashValueDollars,
    anteDollars,
    message,
    stopHint,
    multSum,
    bestTotalVal,
    canDeal,
    canStop,
    canCash,
    deal,
    stop,
    cashOut,
    playAgain,
    modalOutcome,
    // backward compat for pages/game.vue key handler
    canHit: canStop,
    canStand: canCash,
    hit: stop,
    stand: cashOut
  }
}
