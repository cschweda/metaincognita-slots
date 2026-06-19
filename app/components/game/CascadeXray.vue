<!-- app/components/game/CascadeXray.vue -->
<!-- Temple of Gold teaching panel: plain-English explainers + instant symbol
     odds always; the exact RTP/HF/volatility/Grand-odds compute (a real ~4s
     enumeration) only when the X-ray toggle is on, deferred so the page never
     janks. "Every number computed, never asserted." -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { floorIntel, type FloorIntel } from '~/utils/floorIntel'
import { formatPercent, formatOdds } from '~/utils/format'
import type { CascadeMachineDef } from '~/engine/types'

const store = useSlotsStore()
const def = computed<CascadeMachineDef | null>(() =>
  store.currentDef?.family === 'cascade' ? store.currentDef : null)

const EMOJI: Record<string, string> = { MASK: '🎭', JAGUAR: '🐆', CROWN: '👑', GOLD: '🪙', IDOL: '🗿' }

const symbolRows = computed(() => {
  const d = def.value
  if (d === null) return []
  const total = Object.values(d.weights).reduce((a, b) => a + b, 0)
  return Object.entries(d.weights).map(([id, w]) => ({
    id,
    label: d.symbols[id]?.label ?? id,
    emoji: EMOJI[id] ?? '◆',
    p: w / total,
    isIdol: id === d.idolSymbol,
    tiers: d.paytable[id] ?? null
  }))
})

// The exact figures are a ~4s enumeration — only run it when the X-ray is opened.
const intel = ref<FloorIntel | null>(null)
const computing = ref(false)
watch([() => store.settings.xray, def], async ([on, d]) => {
  if (on !== true || d === null || intel.value !== null) return
  computing.value = true
  await new Promise(resolve => setTimeout(resolve, 30)) // paint the spinner first
  intel.value = floorIntel(d, { coins: d.maxCoins })
  computing.value = false
}, { immediate: true })
</script>

<template>
  <div
    v-if="def"
    class="cx"
  >
    <section class="cx-card">
      <h3 class="cx-h">
        How it works
      </h3>
      <p><b>Cascade (tumble).</b> Land {{ def.minMatch }}+ of one symbol <i>anywhere</i> on the grid and it pays, shatters, and the symbols above fall into the gaps while fresh ones drop in — which can pay again. Every link climbs the multiplier, all inside one bet. That's the "down, down, down."</p>
      <p><b>Progressive.</b> The Grand is a single prize that climbs a little with every bet on the floor until someone lands {{ def.grandTrigger }} golden idols — then it pays and resets. A rare carrot funded by everyone's play.</p>
      <p><b>Why free play?</b> This machine runs the exact maths a real one would — but it never debits a balance. The House Ledger shows, in real dollars, what it <i>would</i> have taken. You get the spectacle and the lesson; the loss stays hypothetical.</p>
    </section>

    <section class="cx-card">
      <h3 class="cx-h">
        The multiplier ladder
      </h3>
      <div class="cx-ladder">
        <span
          v-for="(m, i) in def.multiplierLadder"
          :key="i"
          class="cx-rung"
        >chain {{ i + 1 }}: ×{{ m }}</span>
      </div>
    </section>

    <section class="cx-card">
      <h3 class="cx-h">
        Symbols &amp; odds <span class="cx-note">per cell</span>
      </h3>
      <ul class="cx-syms">
        <li
          v-for="s in symbolRows"
          :key="s.id"
          class="cx-sym"
        >
          <span class="cx-sym-e">{{ s.emoji }}</span>
          <span class="cx-sym-l">{{ s.label }}<span
            v-if="s.isIdol"
            class="cx-tag"
          >scatter</span></span>
          <span class="cx-sym-p">{{ formatPercent(s.p, 1) }}</span>
          <span class="cx-sym-pay">
            <template v-if="s.tiers">{{ s.tiers.map(t => `${t.countAtLeast}+→×${t.pay}`).join('  ') }}</template>
            <template v-else>lights the Grand</template>
          </span>
        </li>
      </ul>
    </section>

    <section class="cx-card cx-xray">
      <h3 class="cx-h">
        🔬 The exact math <span class="cx-note">X-ray</span>
      </h3>
      <p
        v-if="!store.settings.xray"
        class="cx-dim"
      >
        Flip <b>X-ray</b> on to compute the exact return — a real absorbing-Markov enumeration, not a guess.
      </p>
      <p
        v-else-if="computing"
        class="cx-dim"
      >
        Computing the exact return by enumeration…
      </p>
      <dl
        v-else-if="intel"
        class="cx-stats"
      >
        <div><dt>Return to player</dt><dd>{{ formatPercent(intel.rtp, 2) }}</dd></div>
        <div><dt>Hit frequency</dt><dd>{{ formatPercent(intel.hitFrequency, 1) }} <span class="cx-dim">(~1 in {{ (1 / intel.hitFrequency).toFixed(1) }})</span></dd></div>
        <div><dt>Volatility (σ/bet)</dt><dd>{{ intel.sdPerCoin.toFixed(2) }}</dd></div>
        <div v-if="intel.topAwardProbability">
          <dt>Grand jackpot</dt><dd>{{ formatOdds(intel.topAwardProbability) }}</dd>
        </div>
        <div><dt>House edge</dt><dd>{{ formatPercent(1 - intel.rtp, 2) }}</dd></div>
      </dl>
      <p class="cx-foot">
        Re-checked every build against a 5-million-spin simulation (3.5σ band).
      </p>
    </section>
  </div>
</template>

<style scoped>
.cx { display: flex; flex-direction: column; gap: 12px; }
.cx-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(20, 14, 4, .7);
  border: 1px solid #4a3410;
  color: #e8d6a8;
  font-size: 13px;
  line-height: 1.5;
}
.cx-card p { margin: 0 0 8px; }
.cx-card p:last-child { margin-bottom: 0; }
.cx-h { font-family: 'Bungee', sans-serif; font-size: 14px; color: #ffd24a; margin-bottom: 8px; }
.cx-note { font-family: sans-serif; font-size: 10px; letter-spacing: 1px; color: #b89a58; }
.cx-ladder { display: flex; flex-wrap: wrap; gap: 6px; }
.cx-rung { font-size: 12px; padding: 3px 8px; border-radius: 999px; background: #2a1c06; border: 1px solid #6a4a10; color: #fde6b8; }
.cx-syms { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cx-sym { display: grid; grid-template-columns: 24px 1fr auto; gap: 6px; align-items: baseline; }
.cx-sym-e { font-size: 18px; }
.cx-sym-l { font-weight: 600; color: #fde6b8; }
.cx-tag { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #ffd24a; margin-left: 6px; }
.cx-sym-p { font-family: 'DM Mono', monospace; color: #fff; }
.cx-sym-pay { grid-column: 2 / 4; font-family: 'DM Mono', monospace; font-size: 11px; color: #b89a58; }
.cx-stats { margin: 0; display: flex; flex-direction: column; gap: 5px; }
.cx-stats div { display: flex; justify-content: space-between; gap: 12px; }
.cx-stats dt { margin: 0; color: #cbb37a; }
.cx-stats dd { margin: 0; font-family: 'DM Mono', monospace; color: #fff; }
.cx-dim { color: #b89a58; font-size: 12px; }
.cx-foot { margin: 8px 0 0; font-size: 11px; color: #8f7842; }
</style>
