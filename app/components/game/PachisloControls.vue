<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { usePachisloPress } from '~/composables/usePachisloPress'
import { exactRtp } from '~/engine'
import { formatPercent } from '~/utils/format'
import type { PachisloMachineDef } from '~/engine'

const store = useSlotsStore()
const { armed, pressed, arm, press, pressForMe, canArm } = usePachisloPress()
const def = computed(() => store.currentDef as PachisloMachineDef | null)

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const target = e.target as HTMLElement | null
  if (target !== null && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  // Don't leak stops to the reels behind any open dialog (PAR sheet, operator key).
  if (typeof document !== 'undefined' && document.querySelector('[role="dialog"][data-state="open"]') !== null) return
  if (e.key === '1') press(0)
  if (e.key === '2') press(1)
  if (e.key === '3') press(2)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const inBonus = computed(() => {
  const ps = store.currentState?.pachislo ?? null
  return ps !== null && ps.bonus !== null
})
const idle = computed(() => {
  const ps = store.currentState?.pachislo ?? null
  return !store.spinning && !armed.value && ps !== null && ps.bonus === null
})

const keyOpen = ref(false)
// The operator key is idle-only; if the machine leaves idle while the modal is
// open (e.g. a queued bonus starts), close it so its level buttons can't throw.
watch(idle, (v) => {
  if (!v) keyOpen.value = false
})
const levels = computed(() => {
  if (!keyOpen.value) return []
  const d = def.value
  if (d === null) return []
  return d.oddsLevels.map((_, i) => ({
    level: i + 1,
    rtp: exactRtp(d, { oddsLevel: i + 1 }).rtpPerCoin
  }))
})
function setLevel(level: number) {
  try {
    store.setOddsLevel(level)
  } catch {
    // setOddsLevel throws if the machine raced out of idle; swallow and close.
  }
  keyOpen.value = false
}
</script>

<template>
  <div
    v-if="def"
    class="flex items-center gap-2"
  >
    <UButton
      data-test="arm"
      color="primary"
      size="lg"
      icon="i-lucide-coins"
      :disabled="!canArm"
      @click="arm"
    >
      {{ inBonus ? 'Play bonus game' : 'Insert 3 & spin' }}
    </UButton>
    <UButton
      v-for="reel in 3"
      :key="reel"
      :data-test="`stop-${reel}`"
      color="neutral"
      :variant="armed && pressed[reel - 1] === null ? 'solid' : 'outline'"
      size="lg"
      :disabled="!armed || pressed[reel - 1] !== null"
      :class="armed && pressed[reel - 1] === null ? 'ring-1 ring-amber-400/60' : ''"
      :aria-label="`Stop reel ${reel} (key ${reel})`"
      @click="press((reel - 1) as 0 | 1 | 2)"
    >
      {{ reel }}
    </UButton>
    <UButton
      data-test="press-for-me"
      color="neutral"
      variant="ghost"
      size="xs"
      :disabled="!armed"
      @click="pressForMe"
    >
      Press for me
    </UButton>
    <UButton
      data-test="operator-key"
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-key-round"
      :disabled="!idle"
      aria-label="Operator key — odds level"
      @click="keyOpen = true"
    />
    <UModal
      v-model:open="keyOpen"
      title="Operator key — odds level"
    >
      <template #body>
        <div class="space-y-2">
          <p class="text-xs text-neutral-400">
            Six settings straight from the service manual. Every RTP below is computed from the def — never asserted.
          </p>
          <button
            v-for="row in levels"
            :key="row.level"
            :data-test="`level-${row.level}`"
            :disabled="!idle"
            class="w-full flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="store.currentState?.pachislo?.oddsLevel === row.level
              ? 'border-amber-500 bg-amber-500/10 text-amber-300'
              : 'border-neutral-800 hover:border-neutral-600 text-neutral-300'"
            @click="setLevel(row.level)"
          >
            <span>Level {{ row.level }}</span>
            <span :class="row.rtp >= 1 ? 'text-emerald-400' : ''">{{ formatPercent(row.rtp, 4) }}</span>
          </button>
        </div>
      </template>
    </UModal>
  </div>
</template>
