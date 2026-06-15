<!-- app/components/game/ReelBlackjackReel.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSymbols } from '~/composables/useReelSymbols'
import { VOID_CARD } from '~/engine/blackjackReel'
import type { BlackjackReelMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as BlackjackReelMachineDef | null)
const bj = computed(() => store.currentState?.blackjackReel ?? null)

const { iconFor, labelFor } = useReelSymbols(def)

/** Up-to-5 card slots; null = not yet drawn, VOID_CARD = bust-saved placeholder */
const slots = computed<(string | null)[]>(() => {
  const cards = bj.value?.cards ?? []
  const result: (string | null)[] = []
  for (let i = 0; i < 5; i++) {
    result.push(cards[i] ?? null)
  }
  return result
})

const totalDisplay = computed(() => {
  const state = bj.value
  if (state === null || state.phase === 'idle') return null
  if (state.busted) return 'BUST'
  if (state.isSoft && state.total <= 21) {
    const hard = state.total - 10
    return `${hard} / ${state.total}`
  }
  return String(state.total)
})

const multiplierDisplay = computed(() => {
  const state = bj.value
  if (state === null || state.multSum <= 0) return null
  return `×${state.multSum + 1}`
})
</script>

<template>
  <div
    v-if="def && bj"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <!-- Status badges row -->
    <div class="flex items-center justify-between text-[11px] font-mono min-h-[20px]">
      <div class="flex items-center gap-2">
        <span
          v-if="bj.saveHeld"
          class="rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 px-2 py-0.5"
          data-test="bust-save-badge"
        >
          BUST SAVE HELD
        </span>
        <span
          v-if="multiplierDisplay"
          class="rounded-full border border-violet-500/50 bg-violet-500/10 text-violet-300 px-2 py-0.5"
          data-test="multiplier-badge"
        >
          MULT {{ multiplierDisplay }}
        </span>
        <span
          v-if="bj.charlie"
          class="rounded-full border border-amber-500/50 bg-amber-500/10 text-amber-300 px-2 py-0.5 motion-safe:animate-pulse"
          data-test="charlie-badge"
        >
          FIVE-CARD CHARLIE!
        </span>
      </div>
      <span
        v-if="totalDisplay && !bj.busted"
        class="text-neutral-400"
      >
        Total: <span class="text-neutral-100">{{ totalDisplay }}</span>
      </span>
    </div>

    <!-- Card slots row -->
    <div
      class="flex gap-2 justify-center"
      role="group"
      aria-label="Hand cards"
    >
      <div
        v-for="(card, i) in slots"
        :key="i"
        role="img"
        class="h-20 w-16 rounded-lg border flex items-center justify-center"
        :class="[
          card === null
            ? 'border-neutral-800 bg-neutral-950 text-neutral-700'
            : card === VOID_CARD
              ? 'border-neutral-700 bg-neutral-950/50 opacity-40'
              : (bj.busted && i === bj.cards.length - 1)
                ? 'border-red-500/60 bg-red-500/10'
                : 'border-neutral-600 bg-neutral-950'
        ]"
        :aria-label="card === null ? `Card slot ${i + 1} — not yet drawn` : card === VOID_CARD ? 'Bust saved — voided card' : labelFor(card)"
      >
        <GameSymbolIcon
          v-if="card !== null && card !== VOID_CARD"
          :icon="iconFor(card)"
          :label="labelFor(card)"
          :size="52"
        />
        <span
          v-else-if="card === VOID_CARD"
          class="text-neutral-600 text-xs font-mono"
          aria-hidden="true"
        >VOID</span>
        <span
          v-else
          class="text-neutral-700 text-xl"
          aria-hidden="true"
        >·</span>
      </div>
    </div>

    <!-- Bust overlay -->
    <div
      v-if="bj.busted"
      class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-sm text-red-300 text-center"
      data-test="bust-panel"
    >
      BUST — hand lost
    </div>

    <!-- Win total when resolved and not busted -->
    <div
      v-if="bj.phase === 'resolved' && !bj.busted"
      class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-sm text-emerald-200 text-center"
      data-test="win-panel"
    >
      <template v-if="bj.charlie">
        Five-Card Charlie — Total {{ totalDisplay }}
        <template v-if="multiplierDisplay">
          {{ multiplierDisplay }}
        </template>
      </template>
      <template v-else>
        Stand at {{ totalDisplay }}
        <template v-if="multiplierDisplay">
          {{ multiplierDisplay }}
        </template>
      </template>
    </div>
  </div>
</template>
