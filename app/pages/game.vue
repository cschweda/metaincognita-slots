<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'
import { useLockReel } from '~/composables/useLockReel'
import { useTheater } from '~/composables/useTheater'
import { unlockAudio } from '~/utils/audio'
import { isFreePlay } from '~/utils/freePlay'

const store = useSlotsStore()
const route = useRoute()
const { phase, canStop, canCash, stop, cashOut, playAgain } = useBlackjackReel()
const lock = useLockReel()
const theater = useTheater()

function onKeydown(e: KeyboardEvent) {
  if (e.code === 'Escape' && theater.active.value) {
    theater.exit()
    return
  }
  if (e.code === 'Backquote' && theater.active.value) {
    e.preventDefault()
    if (!e.repeat) theater.peekPress()
    return
  }
  if (e.repeat) return
  const isSpace = e.code === 'Space'
  const isEnter = e.code === 'Enter'
  if (!isSpace && !isEnter) return
  const target = e.target as HTMLElement | null
  if (target !== null && ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (store.currentDef?.family === 'pachislo') return // pachislo spins via its own controls
  if (store.currentDef?.family === 'cascade') return // cascade spins via its own cabinet
  if (store.currentDef?.family === 'blackjack-reel') {
    e.preventDefault()
    if (phase.value === 'resolved') playAgain()
    else if (isEnter && canCash.value) cashOut()
    else if (canStop.value) stop()
    return
  }
  if (store.currentDef?.family === 'lock-reel') {
    e.preventDefault()
    if (lock.phase.value === 'resolved') lock.playAgain()
    else if (lock.canStop.value) lock.stop()
    return
  }
  if (!isSpace) return
  e.preventDefault()
  unlockAudio() // keyboard spin is a gesture too
  store.spinOnce()
}

function onKeyup(e: KeyboardEvent) {
  if (e.code === 'Backquote') theater.peekRelease()
}

onMounted(() => {
  if (store.phase === 'floor' && store.peekSavedSession()) store.resume()
  const wanted = typeof route.query.m === 'string' ? route.query.m : null
  if (store.currentMachineId === null && wanted !== null) {
    try {
      store.selectMachine(wanted)
    } catch {
      navigateTo('/')
      return
    }
  }
  // Free play is a walk-up machine: playable without a started session. Betting
  // machines still require one — but the floor now opens it for you on entry, so
  // this guard only catches a deep link straight to /game with no session.
  const def = store.currentDef
  const freePlay = def !== null && isFreePlay(def)
  if (!freePlay && (store.phase !== 'playing' || store.currentMachineId === null)) navigateTo('/')
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})

onUnmounted(() => {
  store.revealDone() // never leave the session locked
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  theater.exit() // leaving /game must never strand the browser in fullscreen
})
</script>

<template>
  <!-- ── Temple of Gold (cascade): the Featured free-play tumble cabinet ── -->
  <div
    v-if="store.currentDef && store.currentDef.family === 'cascade'"
    class="cab-page cab-page--tg"
  >
    <div class="cab-page-grid">
      <div class="cab-page-main">
        <GameTheaterStage :narrow="false">
          <GameReelCascade :key="store.currentMachineId ?? ''" />
        </GameTheaterStage>
      </div>
      <aside class="cab-page-side">
        <GameCabinetToolbar />
        <GameCascadeXray />
      </aside>
    </div>
  </div>

  <!-- ── Stop & Lock 777 (lock-reel): the "big daddy" cash-collect cabinet ── -->
  <div
    v-else-if="store.currentDef && store.currentDef.family === 'lock-reel'"
    class="cab-page cab-page--sl"
  >
    <div class="cab-page-grid">
      <div class="cab-page-main">
        <LazyGameReelLockReel :key="store.currentMachineId ?? ''" />
      </div>
      <aside class="cab-page-side">
        <GameCabinetToolbar />
        <GameSessionSidebar />
        <GameXrayPanel />
      </aside>
    </div>
  </div>

  <!-- ── Flameout 21 (blackjack-reel): dedicated demo-faithful crash page ── -->
  <div
    v-else-if="store.currentDef && store.currentDef.family === 'blackjack-reel'"
    class="cab-page cab-page--l21"
  >
    <LazyGameChromeFlameoutChrome side="left" />
    <LazyGameChromeFlameoutChrome side="right" />
    <div class="cab-page-grid">
      <div class="cab-page-main">
        <LazyGameReelBlackjackReel :key="store.currentMachineId ?? ''" />
      </div>
      <aside class="cab-page-side">
        <GameCabinetToolbar />
        <GameSessionSidebar />
        <GameXrayPanel />
      </aside>
    </div>
  </div>

  <!-- ── All other machines: the standard simulator shell ── -->
  <div
    v-else-if="store.currentDef"
    class="px-4 py-4 max-w-[1100px] mx-auto space-y-3"
  >
    <GameMachineMarquee />
    <GameCabinetToolbar />

    <GameCreditPanel />

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
      <GameTheaterStage :narrow="store.currentDef?.family === 'stepper' || store.currentDef?.family === 'bally-em'">
        <div class="space-y-3">
          <GameMachineChrome>
            <GameReelVideo
              v-if="store.currentDef?.family === 'video'"
              :key="store.currentMachineId ?? ''"
            />
            <GameReelStepper
              v-else-if="store.currentDef?.family === 'stepper'"
              :key="store.currentMachineId ?? ''"
            />
            <GameReelBally
              v-else-if="store.currentDef?.family === 'bally-em'"
              :key="store.currentMachineId ?? ''"
            />
            <GameReelPachislo
              v-else-if="store.currentDef?.family === 'pachislo'"
              :key="store.currentMachineId ?? ''"
            />
            <GameReelWheelGame
              v-else-if="store.currentDef?.family === 'wheel'"
              :key="store.currentMachineId ?? ''"
            />
          </GameMachineChrome>
          <GameResultBar />
          <GameBetControls>
            <template
              v-if="store.currentDef?.family === 'pachislo'"
              #pachislo-controls
            >
              <GamePachisloControls />
            </template>
          </GameBetControls>
        </div>
      </GameTheaterStage>
      <aside class="space-y-3">
        <GameSessionSidebar />
        <GameXrayPanel />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* One full-bleed cabinet shell for the three bespoke pages — each modifier
   sets only its backdrop and sidebar width. */
.cab-page {
  position: relative;
  min-height: 100%;
  padding: 24px 14px 40px;
  background: var(--cab-bg);
}
.cab-page-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 1024px) {
  .cab-page-grid { grid-template-columns: minmax(0, 1fr) var(--cab-side, 300px); }
}
.cab-page-main { min-width: 0; }
.cab-page-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Temple of Gold — Aztec-gold temple backdrop */
.cab-page--tg { --cab-bg: radial-gradient(120% 90% at 50% 0%, #4a3410 0%, #2a1c06 40%, #0c0802 100%); --cab-side: 320px; }
/* Stop & Lock 777 — steel-room backdrop */
.cab-page--sl { --cab-bg: radial-gradient(120% 90% at 50% 0%, #3a4250 0%, #20252e 42%, #0c0f15 100%); }
/* Flameout 21 — the demo's green-felt backdrop */
.cab-page--l21 { --cab-bg: radial-gradient(120% 90% at 50% 0%, #15725a 0%, #0c4a37 38%, #04221a 100%); }
</style>
