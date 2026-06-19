<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'
import { useLockReel } from '~/composables/useLockReel'

const store = useSlotsStore()
const route = useRoute()
const parOpen = ref(false)
const { phase, canStop, canCash, stop, cashOut, playAgain } = useBlackjackReel()
const lock = useLockReel()

function onKeydown(e: KeyboardEvent) {
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
  store.spinOnce()
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
  // Temple of Gold is FREE PLAY — it never touches the bankroll, so it's a
  // walk-up machine: playable without a started session. The betting machines
  // still require one.
  const freePlay = store.currentDef?.family === 'cascade'
  if (!freePlay && (store.phase !== 'playing' || store.currentMachineId === null)) navigateTo('/')
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  store.revealDone() // never leave the session locked
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- ── Temple of Gold (cascade): the Featured free-play tumble cabinet ── -->
  <div
    v-if="store.currentDef && store.currentDef.family === 'cascade'"
    class="tg-page"
  >
    <div class="tg-page-grid">
      <div class="tg-page-main">
        <GameReelCascade :key="store.currentMachineId ?? ''" />
      </div>
      <aside class="tg-page-side">
        <div class="tg-side-tools">
          <UButton
            :color="store.settings.xray ? 'primary' : 'neutral'"
            :variant="store.settings.xray ? 'solid' : 'outline'"
            :aria-pressed="store.settings.xray"
            size="xs"
            icon="i-lucide-scan-line"
            @click="store.setXray(!store.settings.xray)"
          >
            X-ray
          </UButton>
        </div>
        <GameCascadeXray />
      </aside>
    </div>
  </div>

  <!-- ── Stop & Lock 777 (lock-reel): the "big daddy" cash-collect cabinet ── -->
  <div
    v-else-if="store.currentDef && store.currentDef.family === 'lock-reel'"
    class="sl-page"
  >
    <div class="sl-page-grid">
      <div class="sl-page-main">
        <GameReelLockReel :key="store.currentMachineId ?? ''" />
      </div>
      <aside class="sl-page-side">
        <div class="sl-side-tools">
          <UButton
            :color="store.settings.xray ? 'primary' : 'neutral'"
            :variant="store.settings.xray ? 'solid' : 'outline'"
            :aria-pressed="store.settings.xray"
            size="xs"
            icon="i-lucide-scan-line"
            @click="store.setXray(!store.settings.xray)"
          >
            X-ray
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-file-spreadsheet"
            @click="parOpen = true"
          >
            PAR sheet
          </UButton>
          <GameParSheetModal v-model:open="parOpen" />
        </div>
        <GameSessionSidebar />
        <GameXrayPanel />
      </aside>
    </div>
  </div>

  <!-- ── Flameout 21 (blackjack-reel): dedicated demo-faithful crash page ── -->
  <div
    v-else-if="store.currentDef && store.currentDef.family === 'blackjack-reel'"
    class="l21-page"
  >
    <GameChromeFlameoutChrome side="left" />
    <GameChromeFlameoutChrome side="right" />
    <div class="l21-page-grid">
      <div class="l21-page-main">
        <GameReelBlackjackReel :key="store.currentMachineId ?? ''" />
      </div>
      <aside class="l21-page-side">
        <div class="l21-side-tools">
          <UButton
            :color="store.settings.xray ? 'primary' : 'neutral'"
            :variant="store.settings.xray ? 'solid' : 'outline'"
            :aria-pressed="store.settings.xray"
            size="xs"
            icon="i-lucide-scan-line"
            @click="store.setXray(!store.settings.xray)"
          >
            X-ray
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-file-spreadsheet"
            @click="parOpen = true"
          >
            PAR sheet
          </UButton>
          <GameParSheetModal v-model:open="parOpen" />
        </div>
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
    <div class="flex items-center justify-end">
      <div class="flex items-center gap-2">
        <UButton
          :color="store.settings.xray ? 'primary' : 'neutral'"
          :variant="store.settings.xray ? 'solid' : 'outline'"
          :aria-pressed="store.settings.xray"
          size="xs"
          icon="i-lucide-scan-line"
          @click="store.setXray(!store.settings.xray)"
        >
          X-ray
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-file-spreadsheet"
          @click="parOpen = true"
        >
          PAR sheet
        </UButton>
        <GameParSheetModal v-model:open="parOpen" />
      </div>
    </div>

    <GameCreditPanel />

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
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
      <aside class="space-y-3">
        <GameSessionSidebar />
        <GameXrayPanel />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Temple of Gold — full-bleed Featured page (Aztec-gold temple backdrop) */
.tg-page {
  position: relative;
  min-height: 100%;
  padding: 24px 14px 40px;
  background: radial-gradient(120% 90% at 50% 0%, #4a3410 0%, #2a1c06 40%, #0c0802 100%);
}
.tg-page-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 1024px) {
  .tg-page-grid { grid-template-columns: minmax(0, 1fr) 320px; }
}
.tg-page-main { min-width: 0; }
.tg-page-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tg-side-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

/* Stop & Lock 777 — full-bleed "big daddy" page (steel-room backdrop) */
.sl-page {
  position: relative;
  min-height: 100%;
  padding: 24px 14px 40px;
  background: radial-gradient(120% 90% at 50% 0%, #3a4250 0%, #20252e 42%, #0c0f15 100%);
}
.sl-page-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 1024px) {
  .sl-page-grid { grid-template-columns: minmax(0, 1fr) 300px; }
}
.sl-page-main { min-width: 0; }
.sl-page-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sl-side-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

/* Flameout 21 — full-bleed crash page (the demo's body background) */
.l21-page {
  position: relative;
  min-height: 100%;
  padding: 24px 14px 40px;
  background: radial-gradient(120% 90% at 50% 0%, #15725a 0%, #0c4a37 38%, #04221a 100%);
}
.l21-page-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 1024px) {
  .l21-page-grid { grid-template-columns: minmax(0, 1fr) 300px; }
}
.l21-page-main { min-width: 0; }
.l21-page-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.l21-side-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
</style>
