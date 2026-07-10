<!-- app/components/game/CascadeXray.vue -->
<!-- Temple of Gold teaching panel: instant, always-on plain-English explainers +
     per-cell symbol odds + the multiplier ladder. The per-spin link-by-link
     X-ray trace lives in the cabinet (toggled by X-ray); the full paytable + the
     exact computed RTP live in the PAR sheet. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatPercent } from '~/utils/format'
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
</script>

<template>
  <div
    v-if="def"
    class="cx"
  >
    <section class="cx-card">
      <h2 class="cx-h">
        How it works
      </h2>
      <p><b>Cascade (tumble).</b> Land {{ def.minMatch }}+ of one symbol <i>anywhere</i> on the grid and it pays, shatters, and the symbols above fall into the gaps while fresh ones drop in — which can pay again. Every link climbs the multiplier, all inside one bet. That's the "down, down, down."</p>
      <p><b>Progressive.</b> The Grand is a single prize that climbs a little with every bet on the floor until someone lands {{ def.grandTrigger }} golden idols — then it pays and resets. A rare carrot funded by everyone's play.</p>
      <p><b>Why free play?</b> This machine runs the exact maths a real one would — but it never debits a balance. The House Ledger shows, in real dollars, what it <i>would</i> have taken. You get the spectacle and the lesson; the loss stays hypothetical.</p>
    </section>

    <section class="cx-card">
      <h2 class="cx-h">
        The multiplier ladder
      </h2>
      <div class="cx-ladder">
        <span
          v-for="(m, i) in def.multiplierLadder"
          :key="i"
          class="cx-rung"
        >chain {{ i + 1 }}: ×{{ m }}</span>
      </div>
    </section>

    <section class="cx-card">
      <h2 class="cx-h">
        Symbols &amp; odds <span class="cx-note">per cell</span>
      </h2>
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

    <section class="cx-card">
      <h2 class="cx-h">
        See the math
      </h2>
      <p>Flip <b>🔬 X-ray</b> (top right) to break down the <i>last spin</i> link by link — every cascade, every multiplier, every cent.</p>
      <p>Open the <b>PAR sheet</b> for the full paytable and the exact, computed return (a real absorbing-Markov enumeration, re-checked every build against a 5-million-spin simulation).</p>
    </section>

    <p class="cx-foot">
      <NuxtLink
        to="/learn/cascade-tumble"
        class="cx-learn"
      >📖 Learn: the tumble math — why exact cascade RTP is hard →</NuxtLink>
    </p>
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
.cx-learn { color: #ffd24a; text-decoration: underline; text-underline-offset: 2px; }
.cx-learn:hover { color: #ffe58a; }
</style>
