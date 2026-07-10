<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useExactRtp } from '~/composables/useExactRtp'
import { intelFromReport } from '~/utils/floorIntel'
import { payTag } from '~/utils/payTag'
import { formatCents, formatOdds, formatPercent } from '~/utils/format'
import type { MachineDef } from '~/engine'

const props = defineProps<{ def: MachineDef }>()
const store = useSlotsStore()

const FAMILY_LABEL: Record<MachineDef['family'], string> = {
  'video': 'Video', 'stepper': 'Stepper', 'bally-em': 'Vintage Bally', 'pachislo': 'Pachislo', 'blackjack-reel': 'Crash reel', 'lock-reel': 'Stop & Lock', 'cascade': 'Cascade', 'wheel': 'Wheel bonus'
}

// Per-family neon accent colors — drives the bulb trim, glyph glow, and border
const FAMILY_COLOR: Record<MachineDef['family'], string> = {
  'video': '#6366f1',
  'stepper': '#f59e0b',
  'bally-em': '#ec4899',
  'pachislo': '#22d3ee',
  'blackjack-reel': '#ff7d4a',
  'lock-reel': '#fbbf24',
  'cascade': '#ffd24a',
  'wheel': '#a855f7'
}

// Per-family decorative glyph (pure text, no external assets, CSP-clean)
const FAMILY_GLYPH: Record<MachineDef['family'], string> = {
  'video': '🎰',
  'stepper': '⚙',
  'bally-em': '★',
  'pachislo': '◎',
  'blackjack-reel': '🚀',
  'lock-reel': '7',
  'wheel': '🎡',
  'cascade': '🗿'
}

// Floor-card payline / ways signpost
const tag = computed(() => payTag(props.def))

const jackpotCents = computed<number | null>(() => {
  const state = store.machineStates[props.def.id]
  const prog = state?.progressive ?? null
  if (props.def.progressive === null) return null
  if (prog === null) {
    const cfg = props.def.progressive
    const reset = cfg.kind === 'percent' ? cfg.reset : cfg.kind === 'single' ? cfg.meter.reset : cfg.upper.reset
    return reset * props.def.denominationCents
  }
  const value = prog.kind === 'percent' ? prog.value : prog.kind === 'single' ? prog.value : prog.live === 'upper' ? prog.upper : prog.lower
  return Math.floor(value) * props.def.denominationCents
})

// Floor xray headline: report at the bet dialed in for this machine (defaults
// to maxCoins) so the per-spin hit frequency/volatility match the in-game
// sidebar for 'lines' machines. Computed OFF-thread: a null def while X-ray
// is off gates the work entirely; a video machine fills in when the worker
// answers instead of freezing the floor for ~1s apiece.
const rtpReport = useExactRtp(
  () => store.settings.xray ? props.def : null,
  () => ({ coins: store.settings.betsByMachine[props.def.id] ?? props.def.maxCoins })
)
const intel = computed(() =>
  rtpReport.value === null ? null : intelFromReport(props.def, rtpReport.value))

function play() {
  store.selectMachine(props.def.id)
  navigateTo('/game')
}
</script>

<template>
  <button
    class="mc-card rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 p-4 text-left space-y-2"
    :style="{ '--mc-accent': FAMILY_COLOR[def.family] }"
    :aria-label="`Play ${def.name}`"
    @click="play"
  >
    <!-- Per-family top accent rail -->
    <div
      class="mc-rail"
      aria-hidden="true"
    />
    <!-- Chase-light bulb strip -->
    <div
      class="mc-bulbs"
      aria-hidden="true"
    >
      <span
        v-for="b in 9"
        :key="b"
        class="mc-bulb"
      />
    </div>
    <!-- Big decorative family glyph -->
    <div
      class="mc-glyph"
      aria-hidden="true"
    >
      {{ FAMILY_GLYPH[def.family] }}
    </div>
    <div class="flex items-start justify-between gap-2">
      <div>
        <div class="font-bold text-neutral-100">
          {{ def.name }}
        </div>
        <div class="text-[10px] uppercase tracking-wider text-neutral-400">
          {{ FAMILY_LABEL[def.family] }} · {{ formatCents(def.denominationCents) }}/credit
        </div>
      </div>
      <span
        class="mc-paytag"
        :data-test="`paytag-${def.id}`"
      >{{ tag }}</span>
    </div>
    <div
      v-if="jackpotCents !== null"
      class="text-sm"
    >
      <span class="text-neutral-400">Jackpot </span>
      <span class="text-amber-400 font-mono">{{ formatCents(jackpotCents) }}</span>
    </div>
    <div
      v-if="intel"
      class="pt-2 border-t border-neutral-800/70 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono"
    >
      <span
        class="text-neutral-400"
        title="Return to player — the share of all wagers this machine pays back over the long run"
      >RTP</span><span class="text-emerald-400 text-right">{{ formatPercent(intel.rtp, 4) }}</span>
      <span
        class="text-neutral-400"
        title="How often a spin pays anything at all — including 'wins' smaller than the bet"
      >Hit freq</span><span class="text-neutral-300 text-right">{{ formatPercent(intel.hitFrequency) }}</span>
      <span
        class="text-neutral-400"
        title="How wild the ride is at the same RTP — standard deviation per coin bet"
      >Volatility</span><span class="text-neutral-300 text-right">{{ intel.sdPerCoin.toFixed(2) }} sd/coin</span>
      <template v-if="intel.topAwardProbability !== null">
        <span
          class="text-neutral-400"
          title="Odds of this machine's biggest prize at the current bet"
        >Top award</span><span class="text-neutral-300 text-right">{{ formatOdds(intel.topAwardProbability) }}</span>
      </template>
    </div>
    <div
      v-else-if="store.settings.xray"
      class="pt-2 border-t border-neutral-800/70 text-[11px] font-mono text-neutral-500"
    >
      computing exact odds…
    </div>
  </button>
</template>

<style scoped>
/* ── Machine card chrome (Vegas kitsch) ── */
.mc-card {
  --mc-accent: #6366f1; /* fallback; overridden per-family via inline style */
  position: relative;
  overflow: hidden;
  border: 2px solid color-mix(in srgb, var(--mc-accent) 55%, #1e293b);
  background: linear-gradient(160deg, #0b1220, #060912);
  box-shadow: 0 1px 4px rgba(0,0,0,.45);
  transition: transform .14s, box-shadow .18s, border-color .18s;
}
.mc-card:hover, .mc-card:focus-within {
  transform: translateY(-4px);
  border-color: var(--mc-accent);
  box-shadow: 0 0 0 1px var(--mc-accent), 0 0 26px color-mix(in srgb, var(--mc-accent) 60%, transparent);
}

/* Thin top accent rail tinted per machine family */
.mc-rail {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--mc-accent, #6366f1), transparent 80%);
  opacity: .7;
  border-radius: 12px 12px 0 0;
  pointer-events: none;
}

/* Chase-light bulb strip */
.mc-bulbs {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 6px 0 2px;
}
.mc-bulb {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff, var(--mc-accent) 55%, transparent);
  box-shadow: 0 0 6px var(--mc-accent);
  animation: mc-tw 1.3s infinite alternate;
}
.mc-bulb:nth-child(2n) { animation-delay: .35s; }
.mc-bulb:nth-child(3n) { animation-delay: .7s; }
@keyframes mc-tw {
  from { opacity: .35; }
  to   { opacity: 1; }
}

/* Big decorative family glyph */
.mc-glyph {
  text-align: center;
  font-size: 34px;
  line-height: 1;
  margin: 2px 0 4px;
  user-select: none;
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--mc-accent) 70%, transparent));
}

/* Paylines / ways badge */
.mc-paytag {
  display: inline-block;
  flex-shrink: 0;
  font-family: 'Orbitron', monospace;
  font-weight: 800;
  font-size: 10px;
  letter-spacing: 1px;
  padding: 3px 8px;
  border-radius: 999px;
  color: #fff;
  white-space: nowrap;
  background: color-mix(in srgb, var(--mc-accent) 22%, #0b1220);
  border: 1px solid color-mix(in srgb, var(--mc-accent) 60%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .mc-bulb { animation: none !important; }
  .mc-card { transition: box-shadow .18s, border-color .18s; }
  .mc-card:hover, .mc-card:focus-within { transform: none; }
}
</style>
