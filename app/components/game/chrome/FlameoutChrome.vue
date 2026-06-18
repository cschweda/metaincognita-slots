<!-- app/components/game/chrome/FlameoutChrome.vue -->
<!-- Flameout 21 side rail: a rocket that rises with the multiplier, with per-climb-reel
     altitude marks. Decorative, aria-hidden, CSP-clean, reduced-motion-safe. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

withDefaults(defineProps<{ side?: 'left' | 'right' }>(), { side: 'left' })
const fo = useBlackjackReel()

const topMark = computed(() => {
  const marks = fo.altitudeMarks.value
  const highest = marks.length ? marks[marks.length - 1]!.multiplier : fo.multiplier.value
  return Math.max(highest, fo.multiplier.value, 1.05)
})
const pctOf = (m: number): number => {
  const a = Math.log(Math.max(m, 1)) / Math.log(topMark.value)
  return Math.max(0, Math.min(1, Number.isFinite(a) ? a : 0)) * 100
}
const altitudePct = computed(() => pctOf(fo.multiplier.value))
const exploded = computed(() => fo.resultOutcome.value?.kind === 'crash')
const banked = computed(() => fo.resultOutcome.value?.kind === 'cash' || fo.resultOutcome.value?.kind === 'topped')
const marks = computed(() => fo.altitudeMarks.value.map((mk, i) => ({ ...mk, pct: pctOf(mk.multiplier), tier: i })))
</script>

<template>
  <div
    class="fo-rail"
    :class="`fo-rail-${side}`"
    aria-hidden="true"
  >
    <div class="fo-gauge">
      <div
        v-for="mk in marks"
        :key="mk.reel"
        class="fo-mark"
        :class="[`fo-mark-t${mk.tier}`, { 'fo-mark-reached': mk.reached }]"
        :style="{ bottom: `${mk.pct}%` }"
      >
        <span class="fo-mark-lab">R{{ mk.reel }} · {{ mk.dollars }}</span>
      </div>

      <div
        v-if="!exploded"
        class="fo-rocket"
        :class="{ 'fo-rocket-banked': banked }"
        :style="{ bottom: `${altitudePct}%` }"
      >
        <svg
          viewBox="0 0 24 50"
          width="22"
          height="46"
        >
          <path
            d="M12 0 C18 8 19 20 19 30 L5 30 C5 20 6 8 12 0 Z"
            fill="#e8eef2"
            stroke="#9aa6b2"
            stroke-width="1"
          />
          <circle
            cx="12"
            cy="16"
            r="3.5"
            fill="#38e8ff"
          />
          <path
            d="M5 30 L1 40 L7 33 Z M19 30 L23 40 L17 33 Z"
            fill="#cf1c39"
          />
          <path
            class="fo-flame"
            d="M8 31 Q12 48 16 31 Q12 38 8 31 Z"
            fill="#ffb648"
          />
        </svg>
      </div>
      <div
        v-else
        class="fo-boom"
        :style="{ bottom: `${altitudePct}%` }"
      >
        <svg
          viewBox="0 0 48 48"
          width="42"
          height="42"
        >
          <polygon
            points="24,1 28,16 40,8 34,21 47,24 34,27 40,40 28,32 24,47 20,32 8,40 14,27 1,24 14,21 8,8 20,16"
            fill="#ff7d4a"
          />
          <circle
            cx="24"
            cy="24"
            r="6"
            fill="#7a0f20"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fo-rail {
  position: absolute;
  top: 24px;
  bottom: 40px;
  width: 64px;
  pointer-events: none;
  z-index: 1;
}
.fo-rail-left { left: 6px; }
.fo-rail-right { right: 6px; }
.fo-gauge {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(56, 232, 255, .04), rgba(255, 124, 74, .08));
  box-shadow: inset 0 0 0 1px rgba(255, 210, 74, .18);
}
.fo-rocket {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 50%);
  transition: bottom .35s cubic-bezier(.3, .8, .3, 1);
  filter: drop-shadow(0 0 8px rgba(56, 232, 255, .55));
}
.fo-rocket-banked { filter: drop-shadow(0 0 12px rgba(70, 224, 138, .8)); }
.fo-flame { animation: fo-flicker .25s infinite alternate; transform-origin: center top; }
@keyframes fo-flicker { from { opacity: .55; } to { opacity: 1; } }
.fo-boom { position: absolute; left: 50%; transform: translate(-50%, 50%); }
.fo-mark {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgba(255, 210, 74, .35);
}
.fo-mark-lab {
  position: absolute;
  left: 2px;
  bottom: 1px;
  font-family: 'Orbitron', monospace;
  font-size: 7px;
  letter-spacing: .3px;
  white-space: nowrap;
}
.fo-mark-t0 { border-color: rgba(255, 210, 74, .5); }
.fo-mark-t0 .fo-mark-lab { color: #ffd24a; }
.fo-mark-t1 { border-color: rgba(255, 140, 60, .55); }
.fo-mark-t1 .fo-mark-lab { color: #ff9d4a; }
.fo-mark-t2 { border-color: rgba(255, 70, 90, .6); }
.fo-mark-t2 .fo-mark-lab { color: #ff6478; }
.fo-mark-reached { opacity: .4; }
@media (prefers-reduced-motion: reduce) {
  .fo-rocket { transition: none; }
  .fo-flame { animation: none; }
}
@media (max-width: 760px) {
  .fo-rail { display: none; }
}
</style>
