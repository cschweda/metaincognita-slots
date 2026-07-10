// app/composables/useBlackjackReel.ts
// Flameout 21 — crash composable. Wraps the store, derives the display values
// (multiplier, velocity, cash-out $, altitude marks) and exposes deal/stop/cashOut.
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCentsExact } from '~/utils/format'
import { handTotal } from '~/engine/blackjackReel'
import type { BlackjackReelMachineDef } from '~/engine'
import type { SymbolId } from '~/engine/types'

export interface ResultOutcome {
  kind: 'cash' | 'topped' | 'crash'
  title: string
  amountDollars: string
  multiplier: number
  sub: string
}

const BET_CHIPS = [1, 5, 10, 15, 20] as const

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
  const multiplier = computed(() => bjState.value?.multiplier ?? 1)
  const velocity = computed(() => bjState.value?.velocity ?? 0)
  const natural = computed(() => bjState.value?.natural ?? false)
  const crashed = computed(() => bjState.value?.crashed ?? false)
  const ante = computed(() => bjState.value?.ante ?? 0)

  const multiplierDisplay = computed(() => `×${multiplier.value.toFixed(2)}`)
  const velocityDisplay = computed(() => (idx.value < 2 ? '—' : `×${velocity.value.toFixed(2)}/reel`))

  const handText = computed((): string => {
    const bj = bjState.value
    if (bj === null || bj.hand.length === 0) return 'deal your hand'
    const labels = bj.hand.map(c => c.slice(0, -1)).join(' ')
    return bj.hand.length >= 2 ? `${labels} = ${handTotal(bj.hand)}` : labels
  })

  // coins on the line: the locked ante once dealt, else the selected bet
  const betCoins = computed(() => (ante.value > 0 ? ante.value : store.currentBet))
  const cashValueCents = computed((): number => {
    const d = def.value
    return d === null ? 0 : Math.round(betCoins.value * multiplier.value * d.denominationCents)
  })
  const cashValueDollars = computed(() => formatCentsExact(cashValueCents.value))
  const anteDollars = computed((): string => {
    const d = def.value
    return d === null ? '$0.00' : formatCentsExact(betCoins.value * d.denominationCents)
  })

  // Projected-altitude ladder for the climb reels (3,4,5) — the rocket marks.
  // base = the multiplier at the deal (idx 2) = current / velocity^(climbs done).
  const altitudeMarks = computed((): { reel: number, multiplier: number, dollars: string, reached: boolean }[] => {
    const d = def.value
    const bj = bjState.value
    if (d === null || bj === null || bj.velocity <= 0) return []
    const climbsDone = Math.max(0, bj.idx - 2)
    const base = bj.multiplier / Math.pow(bj.velocity, climbsDone)
    const out: { reel: number, multiplier: number, dollars: string, reached: boolean }[] = []
    for (let k = 0; k < 3; k++) {
      const m = base * Math.pow(bj.velocity, k + 1)
      out.push({
        reel: 3 + k,
        multiplier: m,
        dollars: formatCentsExact(betCoins.value * m * d.denominationCents),
        reached: climbsDone >= k + 1
      })
    }
    return out
  })

  const betChips = computed(() => BET_CHIPS.map(c => ({ coins: c, dollars: `$${c}`, active: store.currentBet === c })))
  function selectBet(coins: number): void {
    store.setBet(coins)
  }

  const stopHint = computed((): string => {
    const i = idx.value
    if (i >= 5) return '—'
    return i < 2 ? `deal ${i + 1}` : `climb reel ${i + 1}`
  })

  const message = computed((): { text: string, tone: '' | 'good' | 'bad' | 'gold' | 'cyan' } => {
    const bj = bjState.value
    if (bj === null || bj.phase !== 'spinning') return { text: 'Press STOP — the climb begins on reel 1', tone: '' }
    const last = bj.idx - 1
    if (last < 0) return { text: 'Press STOP — the climb begins on reel 1', tone: '' }
    const cash = cashValueDollars.value
    if (last === 0) return { text: `First card → ×${bj.multiplier.toFixed(2)} · one more to set your hand`, tone: 'good' }
    if (last === 1) {
      return bj.natural
        ? { text: `BLACKJACK ×${bj.multiplier.toFixed(0)}! steep ×${bj.velocity.toFixed(2)}/reel — cash ${cash} or push`, tone: 'gold' }
        : { text: `Hand ${handTotal(bj.hand)} → ×${bj.multiplier.toFixed(2)} · ×${bj.velocity.toFixed(2)}/reel — cash ${cash} or push`, tone: 'cyan' }
    }
    return { text: `Climbed to ×${bj.multiplier.toFixed(2)} — cash ${cash} or push?`, tone: 'good' }
  })

  // idle attract strips (reels spin showing representative cards + CLIMB/CRASH)
  const attractStrips = computed((): SymbolId[][] => {
    const d = def.value
    if (d === null) return [[], [], [], [], []]
    const cards: SymbolId[] = ['AS', 'KH', 'QD', 'JC', 'TS', '9H', '8D', '7C']
    let ci = 0
    return d.reels.map(slots => slots.map(tok => (tok === 'CARD' ? cards[ci++ % cards.length]! : tok)))
  })

  const canDeal = computed(() => {
    const d = def.value
    if (d === null || store.spinning) return false
    const p = phase.value
    if (p !== 'idle' && p !== 'resolved') return false
    return store.currentBet * d.denominationCents <= store.bankrollCents
  })
  const canStop = computed(() => {
    if (store.spinning) return false
    return phase.value === 'idle' ? canDeal.value : phase.value === 'spinning'
  })
  const canCash = computed(() => !store.spinning && phase.value === 'spinning' && idx.value >= 1)

  function deal(): void {
    if (!canDeal.value) return
    store.deal()
    store.revealDone()
  }
  function stop(): void {
    if (!canStop.value) return
    if (phase.value === 'idle') {
      store.deal()
      store.revealDone()
      store.stop()
      store.revealDone()
    } else {
      store.stop()
      store.revealDone()
    }
  }
  function cashOut(): void {
    if (!canCash.value) return
    store.cashOut()
    store.revealDone()
  }
  function playAgain(): void {
    store.resetHand()
    store.revealDone()
  }
  // "Same Bet": deal a fresh hand at the current bet — works from idle OR a
  // resolved result (store.deal() accepts both phases and resets the state).
  function sameBet(): void {
    if (!canDeal.value) return
    store.deal()
    store.revealDone()
    store.stop()
    store.revealDone()
  }

  const resultOutcome = computed((): ResultOutcome | null => {
    const bj = bjState.value
    if (bj === null || bj.phase !== 'resolved') return null
    if (bj.crashed) {
      return {
        kind: 'crash',
        title: 'CRASH!',
        amountDollars: '$0',
        multiplier: bj.multiplier,
        sub: `reel ${bj.idx + 1} crashed at ×${bj.multiplier.toFixed(2)} — the climb is gone`
      }
    }
    const topped = bj.idx >= 5
    const climbs = Math.max(0, bj.idx - 2)
    return {
      kind: topped ? 'topped' : 'cash',
      title: topped ? 'TOPPED OUT!' : 'CASHED OUT',
      amountDollars: cashValueDollars.value,
      multiplier: bj.multiplier,
      sub: topped
        ? `survived all five at ×${bj.multiplier.toFixed(2)} on a ${anteDollars.value} bet`
        : `locked ×${bj.multiplier.toFixed(2)} after ${climbs} climb${climbs === 1 ? '' : 's'} on a ${anteDollars.value} bet`
    }
  })

  return {
    bjState, phase, reelStrips, landed, idx, multiplier, velocity, natural, crashed,
    multiplierDisplay, velocityDisplay, handText, cashValueCents, cashValueDollars, anteDollars,
    altitudeMarks, betChips, selectBet, message, stopHint, attractStrips,
    canDeal, canStop, canCash, deal, stop, cashOut, playAgain, sameBet, resultOutcome
  }
}
