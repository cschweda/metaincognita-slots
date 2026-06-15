<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const store = useSlotsStore()
const route = useRoute()
const parOpen = ref(false)
const { canDeal, canHit, canStand, deal, hit, stand } = useBlackjackReel()

function onKeydown(e: KeyboardEvent) {
  if (e.repeat) return
  const isSpace = e.code === 'Space'
  const isEnter = e.code === 'Enter'
  if (!isSpace && !isEnter) return
  const target = e.target as HTMLElement | null
  if (target !== null && ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (store.currentDef?.family === 'pachislo') return // pachislo spins via its own controls
  if (store.currentDef?.family === 'blackjack-reel') {
    e.preventDefault()
    if (isEnter && canStand.value) stand()
    else if (canHit.value) hit()
    else if (canDeal.value) deal()
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
  if (store.phase !== 'playing' || store.currentMachineId === null) navigateTo('/')
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  store.revealDone() // never leave the session locked
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="store.currentDef"
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
          <GameReelBlackjackReel
            v-else-if="store.currentDef?.family === 'blackjack-reel'"
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
          <template
            v-if="store.currentDef?.family === 'blackjack-reel'"
            #blackjack-controls
          >
            <GameBlackjackControls />
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
