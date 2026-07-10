<!-- app/components/game/WheelOverlay.vue -->
<script setup lang="ts">
// The giant topper. Honesty rule #1: the ENGINE draws first (the ordinary
// spin action), and the animation lands on the drawn wedge — the spectacle
// never chooses the outcome. Honesty rule #2: the wedges are DRAWN equal
// (15° each) and WEIGHTED unequal; the X-ray table beside the cabinet prints
// the real odds this overlay's geometry is lying about — that contrast IS the
// lesson. Flash budget: bulbs alternate at 1.25Hz and the landing glow pulses
// at 1.1Hz (both far under WCAG 2.3.1's 3/sec); prefers-reduced-motion snaps
// the wheel straight to the wedge with everything static.
import { computed, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import type { WheelMachineDef } from '~/engine'
import { formatCredits } from '~/utils/format'
import { unlockAudio } from '~/utils/audio'

const store = useSlotsStore()
const def = computed(() => store.currentDef as WheelMachineDef | null)

const WEDGE_PALETTE = ['#e11d48', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#22c55e']
const R = 150
const CX = 160
const CY = 165

interface WedgeGeom { path: string, fill: string, labelX: number, labelY: number, labelRot: number, credits: number, mega: boolean }

const wedges = computed<WedgeGeom[]>(() => {
  const d = def.value
  if (d === null) return []
  return d.wedges.map((w, i) => {
    // wedge i spans [i·15°, (i+1)·15°), measured clockwise from 12 o'clock
    const a0 = (i * 15 - 90) * (Math.PI / 180)
    const a1 = ((i + 1) * 15 - 90) * (Math.PI / 180)
    const x0 = CX + R * Math.cos(a0)
    const y0 = CY + R * Math.sin(a0)
    const x1 = CX + R * Math.cos(a1)
    const y1 = CY + R * Math.sin(a1)
    const mid = (i * 15 + 7.5 - 90) * (Math.PI / 180)
    const lr = R * 0.78
    return {
      path: `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      fill: w.credits === 2500 ? '#fbbf24' : WEDGE_PALETTE[i % 6]!,
      labelX: CX + lr * Math.cos(mid),
      labelY: CY + lr * Math.sin(mid),
      labelRot: i * 15 + 7.5,
      credits: w.credits,
      mega: w.credits === 2500
    }
  })
})

// bulbs on the rim at each wedge boundary
const bulbs = computed(() => Array.from({ length: 24 }, (_, i) => {
  const a = (i * 15 - 90) * (Math.PI / 180)
  return { x: CX + (R + 9) * Math.cos(a), y: CY + (R + 9) * Math.sin(a), odd: i % 2 === 1 }
}))

// ── the spin lifecycle ───────────────────────────────────────────────────────
const phase = ref<'armed' | 'spinning' | 'landed'>('armed')
const rotation = ref(0)
const landedCredits = ref<number | null>(null)
const landedIndex = ref<number | null>(null)
let holdTimer: ReturnType<typeof setTimeout> | null = null

const reduced = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const emit = defineEmits<{ ticker: [], landed: [credits: number] }>()

function pressSpin(): void {
  if (phase.value !== 'armed' || store.spinning) return
  unlockAudio()
  void store.spinOnce() // the ordinary spin action — the engine draws NOW
}

// The outcome arrives through the store; the animation obeys it.
watch(() => store.lastOutcome, (out) => {
  if (out === null || out.machineId !== def.value?.id) return
  const landed = out.featureEvents.find(e => e.type === 'wheel-landed')
  if (landed === undefined || landed.type !== 'wheel-landed') return
  landedIndex.value = landed.wedgeIndex
  landedCredits.value = landed.credits
  // land the drawn wedge's CENTER under the top flapper: 5 full turns plus
  // whatever undoes the wedge's own angle
  const target = 360 * 5 - (landed.wedgeIndex * 15 + 7.5)
  if (reduced) {
    rotation.value = target % 360
    settle()
  } else {
    phase.value = 'spinning'
    emit('ticker')
    requestAnimationFrame(() => {
      rotation.value = target
    })
  }
})

function settle(): void {
  phase.value = 'landed'
  if (landedCredits.value !== null) emit('landed', landedCredits.value)
  holdTimer = setTimeout(() => {
    store.revealDone() // unlock the session; pending is already false
  }, 1600)
}

function onWheelTransitionEnd(): void {
  if (phase.value === 'spinning') settle()
}

watch(() => def.value?.id, () => {
  if (holdTimer !== null) clearTimeout(holdTimer)
})
</script>

<template>
  <div
    v-if="def"
    class="wheel-overlay"
    data-test="wheel-overlay"
    role="dialog"
    aria-label="Wonder Wheel topper"
  >
    <div class="wheel-stage">
      <!-- flapper -->
      <svg
        viewBox="0 0 320 330"
        class="w-full max-w-[420px] mx-auto"
        role="img"
        :aria-label="phase === 'landed' && landedCredits !== null
          ? `The wheel landed on ${landedCredits} credits`
          : 'The wheel is armed — 24 wedges, drawn equal, weighted unequal (true odds in the X-ray)'"
      >
        <!-- rim + bulbs (chase = two groups alternating well under 3 flashes/sec) -->
        <circle
          :cx="CX"
          :cy="CY"
          :r="R + 14"
          fill="#1c1207"
        />
        <circle
          :cx="CX"
          :cy="CY"
          :r="R + 12"
          fill="none"
          stroke="#fbbf24"
          stroke-width="3"
        />
        <g :class="{ 'bulbs-anim': phase === 'spinning' && !reduced }">
          <circle
            v-for="(b, i) in bulbs"
            :key="i"
            :cx="b.x"
            :cy="b.y"
            r="3.4"
            :class="b.odd ? 'bulb bulb-odd' : 'bulb bulb-even'"
          />
        </g>
        <!-- the wheel proper -->
        <g
          data-test="wheel-rotor"
          :data-rotation="rotation"
          :style="{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: phase === 'spinning' ? 'transform 4.2s cubic-bezier(.12,.8,.14,1)' : 'none'
          }"
          @transitionend="onWheelTransitionEnd"
        >
          <g
            v-for="(w, i) in wedges"
            :key="i"
          >
            <path
              :d="w.path"
              :fill="w.fill"
              stroke="#1c1207"
              stroke-width="1.2"
              :class="{ 'wedge-hit': phase === 'landed' && i === landedIndex }"
            />
            <text
              :x="w.labelX"
              :y="w.labelY"
              text-anchor="middle"
              dominant-baseline="middle"
              font-family="ui-monospace, monospace"
              :font-size="w.mega ? 13 : 11"
              font-weight="bold"
              :fill="w.mega ? '#7c2d12' : '#fffbeb'"
              :transform="`rotate(${w.labelRot} ${w.labelX} ${w.labelY})`"
            >{{ w.mega ? 'MEGA' : w.credits }}</text>
          </g>
          <circle
            :cx="CX"
            :cy="CY"
            r="34"
            fill="#1c1207"
          />
          <circle
            :cx="CX"
            :cy="CY"
            r="31"
            fill="#fbbf24"
          />
          <text
            :x="CX"
            :y="CY - 3"
            text-anchor="middle"
            font-family="ui-monospace, monospace"
            font-size="11"
            font-weight="bold"
            fill="#7c2d12"
          >WONDER</text>
          <text
            :x="CX"
            :y="CY + 11"
            text-anchor="middle"
            font-family="ui-monospace, monospace"
            font-size="11"
            font-weight="bold"
            fill="#7c2d12"
          >WHEEL</text>
        </g>
        <!-- top flapper (fixed) -->
        <path
          :d="`M ${CX - 11} 2 L ${CX + 11} 2 L ${CX} 26 Z`"
          fill="#f43f5e"
          stroke="#881337"
          stroke-width="1.5"
        />
      </svg>

      <div class="wheel-cta">
        <button
          v-if="phase === 'armed'"
          type="button"
          class="wheel-button"
          data-test="wheel-spin"
          :disabled="store.spinning"
          @click="pressSpin"
        >
          SPIN THE WHEEL
        </button>
        <div
          v-else-if="phase === 'landed' && landedCredits !== null"
          class="wheel-banner"
          data-test="wheel-banner"
        >
          <span class="text-amber-300 font-bold">{{ landedCredits === 2500 ? 'MEGA! ' : '' }}</span>
          The wheel pays <strong>{{ formatCredits(landedCredits) }} credits</strong>
        </div>
        <div
          v-else
          class="text-neutral-300 text-sm tracking-widest uppercase"
        >
          wheeling…
        </div>
        <p class="text-[10px] text-neutral-400 mt-2">
          24 wedges drawn equal — weighted unequal. The true odds are in the X-ray.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheel-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background:
    radial-gradient(90% 70% at 50% 30%, rgba(124, 58, 237, 0.35) 0%, rgba(12, 6, 24, 0.94) 70%),
    rgba(8, 4, 16, 0.94);
  border-radius: inherit;
}
.wheel-stage { width: 100%; padding: 10px 12px; text-align: center; }
.wheel-cta { margin-top: 4px; }
.wheel-button {
  font-family: ui-monospace, monospace;
  font-weight: 800;
  letter-spacing: 0.14em;
  font-size: 15px;
  color: #1c1207;
  background: linear-gradient(180deg, #fde68a, #f59e0b);
  border: 2px solid #b45309;
  border-radius: 999px;
  padding: 10px 26px;
  cursor: pointer;
  animation: cta-pulse 1.6s ease-in-out infinite;
}
.wheel-button:disabled { opacity: 0.6; cursor: default; animation: none; }
.wheel-banner { font-size: 15px; color: #e7e5e4; }
.bulb { fill: #78350f; }
.bulbs-anim .bulb-even { animation: bulb-blink 0.8s steps(1) infinite; }
.bulbs-anim .bulb-odd { animation: bulb-blink 0.8s steps(1) infinite 0.4s; }
.wedge-hit { animation: wedge-glow 0.9s ease-in-out infinite; }
@keyframes cta-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
  50% { box-shadow: 0 0 22px 6px rgba(251, 191, 36, 0.35); }
}
@keyframes bulb-blink {
  0%, 49% { fill: #fde68a; }
  50%, 100% { fill: #78350f; }
}
@keyframes wedge-glow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.55); }
}
@media (prefers-reduced-motion: reduce) {
  .wheel-button { animation: none; }
  .bulbs-anim .bulb-even, .bulbs-anim .bulb-odd { animation: none; fill: #fde68a; }
  .wedge-hit { animation: none; filter: brightness(1.4); }
}
</style>
