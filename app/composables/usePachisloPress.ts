import { computed, ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { nextSpinCost } from '~/engine'
import { unlockAudio } from '~/utils/audio'
import { voiceFor } from '~/utils/soundBank'

const REV_MS = 750 // one reel revolution — 21 stops at ~35.7 ms/stop, like the hardware

const armed = ref(false)
const positions = ref<[number, number, number]>([0, 7, 14])
const pressed = ref<[number | null, number | null, number | null]>([null, null, null])
let rafId: number | null = null
let lastT = 0

export function usePachisloPress() {
  const store = useSlotsStore()
  const reduced = useReducedMotion()

  function tick(t: number) {
    const dt = lastT === 0 ? 0 : Math.min(t - lastT, 100)
    lastT = t
    const step = (dt / REV_MS) * 21
    positions.value = positions.value.map((p, i) =>
      pressed.value[i] !== null ? p : (p + step) % 21) as [number, number, number]
    if (armed.value) rafId = requestAnimationFrame(tick)
  }

  function randomPresses(): [number, number, number] {
    return [0, 1, 2].map(() => Math.floor(Math.random() * 21)) as [number, number, number]
  }

  function arm() {
    const def = store.currentDef
    const state = store.currentState
    if (def === null || state === null || def.family !== 'pachislo' || armed.value || store.spinning) return
    const cost = nextSpinCost(def, state, store.currentBet) * def.denominationCents
    if (cost > store.bankrollCents) return
    unlockAudio() // arm IS the user gesture — wake the AudioContext here
    pressed.value = [null, null, null]
    armed.value = true
    store.liveAnnouncement = 'Reels spinning — stop them with buttons one, two, three.'
    if (reduced.value) {
      // timing skill needs motion; the math, provably, does not
      resolveWith(randomPresses())
      return
    }
    voiceFor('pachislo').spinStart()
    lastT = 0
    rafId = requestAnimationFrame(tick)
  }

  function press(reel: 0 | 1 | 2) {
    if (!armed.value || pressed.value[reel] !== null) return
    pressed.value[reel] = Math.floor(positions.value[reel]!) % 21
    pressed.value = [...pressed.value] as typeof pressed.value
    voiceFor('pachislo').reelStop(reel, 3)
    if (pressed.value.every(p => p !== null)) {
      resolveWith(pressed.value as [number, number, number])
    }
  }

  function pressForMe() {
    if (!armed.value) return
    const filled = pressed.value.map(p => p ?? Math.floor(Math.random() * 21)) as [number, number, number]
    resolveWith(filled)
  }

  function resolveWith(presses: [number, number, number]) {
    armed.value = false
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    const prev = store.lastOutcome
    store.spinOnce(presses)
    const def = store.currentDef
    // Only voice a FRESH outcome — spinOnce bails (announcement only) when the
    // bankroll can't cover the game, and a stale reveal would replay old news.
    if (def !== null && store.lastOutcome !== null && store.lastOutcome !== prev) {
      voiceFor('pachislo').reveal(def, store.lastOutcome)
    }
    store.revealDone() // the pachislo "reveal" is the slip annotation; no async animation gate
  }

  /** stop the loop on navigation; safe to call any time */
  function cancelPress() {
    armed.value = false
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    // also clear reel state so re-entering the floor doesn't flash stale stops
    pressed.value = [null, null, null]
    positions.value = [0, 7, 14]
  }

  const canArm = computed(() => {
    const def = store.currentDef
    const state = store.currentState
    if (def === null || state === null || def.family !== 'pachislo' || armed.value || store.spinning) return false
    return nextSpinCost(def, state, store.currentBet) * def.denominationCents <= store.bankrollCents
  })

  return { armed, positions, pressed, arm, press, pressForMe, cancelPress, canArm }
}
