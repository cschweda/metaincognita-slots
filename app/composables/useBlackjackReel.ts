// app/composables/useBlackjackReel.ts
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'

export function useBlackjackReel() {
  const store = useSlotsStore()

  const bj = computed(() => {
    const def = store.currentDef
    const state = store.currentState
    if (def === null || state === null || def.family !== 'blackjack-reel') return null
    return state.blackjackReel
  })

  const phase = computed(() => bj.value?.phase ?? 'idle')

  const canDeal = computed(() => {
    const def = store.currentDef
    if (def === null || def.family !== 'blackjack-reel') return false
    if (store.spinning) return false
    const p = phase.value
    if (p !== 'idle' && p !== 'resolved') return false
    return store.currentBet * def.denominationCents <= store.bankrollCents
  })

  const canHit = computed(() =>
    !store.spinning && phase.value === 'dealt'
  )

  const canStand = computed(() =>
    !store.spinning && phase.value === 'dealt'
  )

  function deal() {
    if (!canDeal.value) return
    store.dealHand()
    store.revealDone()
  }

  function hit() {
    if (!canHit.value) return
    store.hitCard()
    store.revealDone()
  }

  function stand() {
    if (!canStand.value) return
    store.standHand()
    store.revealDone()
  }

  return { bj, phase, canDeal, canHit, canStand, deal, hit, stand }
}
