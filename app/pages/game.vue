<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, resolveComponent, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'

const store = useSlotsStore()
const route = useRoute()

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
})

onUnmounted(() => {
  store.revealDone() // never leave the session locked
})

/** Placeholder until Tasks 8-10 land the family surfaces. */
const ReelPlaceholder = defineComponent({
  setup() {
    return () => h('div', {
      class: 'flex items-center justify-center h-64 rounded-xl border border-dashed border-neutral-800 text-neutral-600 text-sm'
    }, 'Reel surface lands in a later task')
  }
})

function surfaceFor(name: string) {
  const resolved = resolveComponent(name)
  return typeof resolved === 'string' ? ReelPlaceholder : resolved
}

const surface = computed(() => {
  switch (store.currentDef?.family) {
    case 'video': return surfaceFor('GameReelVideo')
    case 'stepper': return surfaceFor('GameReelStepper')
    case 'bally-em': return surfaceFor('GameReelBally')
    case 'pachislo': return surfaceFor('GameReelPachislo')
    default: return ReelPlaceholder
  }
})

// staging scaffold: real reel surfaces (Tasks 8-10) own revealDone; until then
// the placeholder releases the lockout as soon as an outcome lands
watch(() => store.lastOutcome, () => {
  if (surface.value === ReelPlaceholder && store.spinning) {
    nextTick(() => store.revealDone())
  }
})
</script>

<template>
  <div
    v-if="store.currentDef"
    class="px-4 py-4 max-w-[1100px] mx-auto space-y-3"
  >
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-neutral-100">
        {{ store.currentDef.name }}
        <span class="text-[10px] uppercase tracking-widest text-neutral-500 ml-2">{{ store.currentDef.family }}</span>
      </h1>
      <div class="flex items-center gap-2">
        <UButton
          :color="store.settings.xray ? 'primary' : 'neutral'"
          :variant="store.settings.xray ? 'solid' : 'outline'"
          size="xs"
          icon="i-lucide-scan-line"
          @click="store.setXray(!store.settings.xray)"
        >
          X-ray
        </UButton>
        <!-- ParSheetModal + its button mount here in Task 11 -->
      </div>
    </div>

    <GameCreditPanel />

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
      <div class="relative space-y-3">
        <GameWinBanner />
        <component :is="surface" />
        <GameBetControls />
      </div>
      <aside class="space-y-3">
        <!-- SessionSidebar + XrayPanel land in Task 12 -->
      </aside>
    </div>
  </div>
</template>
