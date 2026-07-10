<!-- app/components/game/ReelWheelGame.vue -->
<script setup lang="ts">
// Wonder Wheel cabinet surface: a stepper-style 3-reel window (same
// GameReelColumn + fit-scale treatment as the Telnaes machines) crowned by an
// ambient mini-wheel marquee. When the topper arms, the WheelOverlay takes
// the whole window — mounted while the wheel is pending OR while an
// unacknowledged wheel-landed outcome is animating (pending clears the moment
// the engine draws; store.spinning holds the stage until revealDone).
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
import { useFitScale } from '~/composables/useFitScale'
import { useReelSymbols } from '~/composables/useReelSymbols'
import { summariseWins } from '~/utils/winLines'
import type { WheelMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as WheelMachineDef | null)
const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id && out.grid.length === 3) return out.grid
  return d.physicalStrips.map(s => [s[s.length - 1]!, s[0]!, s[1]!])
})
const fillerIds = computed(() => Object.keys(def.value?.symbols ?? {}))
const { strips, offsetY, blur, durationMs, revealed } = useReelSpin({
  reelCount: () => 3,
  visibleRows: 3,
  grid: () => grid.value,
  filler: () => fillerIds.value
})

const WINDOW_W = 3 * REEL_CELL_PX + 2 * REEL_GAP_PX
const WINDOW_H = REEL_CELL_PX * 3 + REEL_GAP_PX * 2
const { host: fitHost, scale: fitScale } = useFitScale(WINDOW_W)

const wins = computed(() => def.value && revealed.value >= 3 ? summariseWins(def.value, store.lastOutcome) : [])
const glow = computed(() => {
  const m = new Map<string, string>()
  for (const w of wins.value) {
    for (const c of w.cells) m.set(`${c.reel}:${c.row}`, w.color)
  }
  return m
})
const paylineWin = computed(() => wins.value.length > 0)
const { iconFor, labelFor } = useReelSymbols(def)

const wheelPending = computed(() => store.currentState?.wheel?.pending === true)
const wheelResolving = computed(() => {
  const out = store.lastOutcome
  return store.spinning && out !== null && out.machineId === def.value?.id
    && out.featureEvents.some(e => e.type === 'wheel-landed')
})
const overlayActive = computed(() => wheelPending.value || wheelResolving.value)

const wasted = computed(() => {
  const out = store.lastOutcome
  return out !== null && out.machineId === def.value?.id
    && out.featureEvents.some(e => e.type === 'wheel-wasted')
    && revealed.value >= 3
})
const atMax = computed(() => def.value !== null && store.currentBet === def.value.maxCoins)
</script>

<template>
  <div
    v-if="def"
    class="relative rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3 ww-cab"
  >
    <!-- marquee: ambient mini wheel + bulb title -->
    <div class="flex items-center justify-between text-[11px] font-mono">
      <div class="flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          class="w-7 h-7 ww-mini"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#fbbf24"
          />
          <g class="ww-mini-rotor">
            <path
              d="M12 2a10 10 0 0 1 7.07 2.93L12 12z"
              fill="#e11d48"
            /><path
              d="M22 12a10 10 0 0 1-2.93 7.07L12 12z"
              fill="#06b6d4"
            /><path
              d="M12 22a10 10 0 0 1-7.07-2.93L12 12z"
              fill="#8b5cf6"
            /><path
              d="M2 12a10 10 0 0 1 2.93-7.07L12 12z"
              fill="#ec4899"
            />
          </g>
          <circle
            cx="12"
            cy="12"
            r="3"
            fill="#1c1207"
          />
        </svg>
        <span class="ww-title tracking-[0.3em]">WONDER WHEEL</span>
      </div>
      <span
        class="uppercase tracking-widest"
        :class="atMax ? 'text-amber-300' : 'text-rose-300'"
        data-test="wheel-gate"
      >
        {{ atMax ? 'wheel ARMED at this bet' : 'wheel needs MAX COINS' }}
      </span>
    </div>

    <div
      ref="fitHost"
      class="overflow-hidden"
      :style="{ height: fitScale < 1 ? WINDOW_H * fitScale + 'px' : undefined }"
    >
      <div
        class="relative mx-auto"
        :style="{
          width: WINDOW_W + 'px',
          transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
          transformOrigin: 'top left'
        }"
      >
        <div
          class="pointer-events-none absolute inset-x-0 z-10 rounded border transition-colors"
          :style="{ top: (REEL_CELL_PX + REEL_GAP_PX) + 'px', height: REEL_CELL_PX + 'px' }"
          :class="paylineWin ? 'border-amber-400/80 bg-amber-400/5' : 'border-amber-500/25'"
        />
        <div
          class="flex"
          :style="{ gap: REEL_GAP_PX + 'px' }"
        >
          <GameReelColumn
            v-for="(strip, r) in strips"
            :key="r"
            :reel="r"
            :strip="strip"
            :offset-y="offsetY[r] ?? 0"
            :blur="blur[r] ?? 0"
            :duration-ms="durationMs[r] ?? 0"
            :revealed="revealed"
            :reel-count="3"
            :glow="glow"
            :icon-for="iconFor"
            :label-for="labelFor"
          />
        </div>
      </div>
    </div>

    <p
      v-if="wasted"
      class="text-xs text-rose-300"
      data-test="wheel-wasted"
    >
      The WHEEL landed — but only max coins arms it. A real cabinet would have
      kept that quiet.
    </p>

    <GameWheelOverlay v-if="overlayActive" />
  </div>
</template>

<style scoped>
.ww-cab {
  background:
    radial-gradient(120% 100% at 50% 0%, rgba(124, 58, 237, 0.16) 0%, rgba(23, 23, 23, 1) 55%);
}
.ww-title {
  font-weight: 800;
  background: linear-gradient(90deg, #f472b6, #fbbf24, #22d3ee);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.ww-mini-rotor {
  transform-origin: 12px 12px;
  animation: ww-idle 14s linear infinite;
}
@keyframes ww-idle {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .ww-mini-rotor { animation: none; }
}
</style>
