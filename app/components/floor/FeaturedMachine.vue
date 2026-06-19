<!-- app/components/floor/FeaturedMachine.vue -->
<!-- Big, visual "Featured machine" card for the floor select screen.
     Styled to preview the Stop & Lock 777 cabinet — the floor's brushed-steel
     "big daddy": gold bezel, vault-7s, and the hold-and-spin cash-collect motif. -->
<script setup lang="ts">
import { useSlotsStore } from '~/stores/slots'
import { formatCents } from '~/utils/format'
import type { MachineDef } from '~/engine'

const props = defineProps<{ def: MachineDef }>()
const store = useSlotsStore()

// Decorative reel motif — a representative stop-through: cash locking left to
// right with the three vault-7s landing in the middle (the 777 trigger).
interface Tile { kind: 'cash' | 'seven', label: string }
const MOTIF: Tile[] = [
  { kind: 'cash', label: '$1' },
  { kind: 'seven', label: '7' },
  { kind: 'seven', label: '7' },
  { kind: 'seven', label: '7' },
  { kind: 'cash', label: '$5' }
]

const FACTS = [
  '5 reels — stop them one by one',
  'Lock the cash — nothing is ever wiped',
  'Three 7s crack the 777 bonus',
  'Fill the grid for the GRAND · ~94.5% RTP'
] as const

function play() {
  store.selectMachine(props.def.id)
  navigateTo('/game')
}
</script>

<template>
  <button
    class="feat"
    :aria-label="`Play ${def.name} — featured machine`"
    @click="play"
  >
    <span class="feat-eyebrow">★ Featured machine</span>

    <span
      class="feat-bulbs"
      aria-hidden="true"
    >
      <span
        v-for="b in 9"
        :key="b"
        class="feat-bulb"
      />
    </span>

    <span class="feat-title">STOP&nbsp;&amp;&nbsp;LOCK&nbsp;777</span>
    <span class="feat-tag">Stop the reels, lock the cash — 777 lands the hold-and-spin bonus.</span>

    <span
      class="feat-reels"
      aria-hidden="true"
    >
      <span
        v-for="(t, i) in MOTIF"
        :key="i"
        class="feat-window"
      >
        <span
          class="feat-tile"
          :class="t.kind === 'seven' ? 'feat-tile-seven' : 'feat-tile-cash'"
        >
          <span class="feat-tile-glyph">{{ t.label }}</span>
        </span>
      </span>
    </span>

    <span class="feat-facts">
      <span
        v-for="(f, i) in FACTS"
        :key="i"
        class="feat-chip"
      >{{ f }}</span>
    </span>

    <span class="feat-cta">
      <span class="feat-play">▶ Play Stop &amp; Lock 777</span>
      <span class="feat-meta">{{ formatCents(def.denominationCents) }}/credit · lock &amp; collect</span>
    </span>
  </button>
</template>

<style scoped>
.feat {
  display: block;
  width: 100%;
  text-align: center;
  border: 3px solid #b8860b;
  border-radius: 22px;
  padding: 20px 18px 24px;
  background:
    radial-gradient(120% 90% at 50% -10%, rgba(255, 210, 74, .14), transparent 55%),
    linear-gradient(180deg, #2a2f37, #14171d);
  box-shadow: 0 0 0 5px #1c1206, 0 0 50px rgba(0,0,0,.55), inset 0 0 70px rgba(0,0,0,.45);
  cursor: pointer;
  color: #f3f6fb;
  transition: transform .1s, box-shadow .2s;
}
.feat:hover {
  box-shadow: 0 0 0 5px #1c1206, 0 0 60px rgba(255,210,74,.28), inset 0 0 70px rgba(0,0,0,.45);
}
.feat:active { transform: translateY(2px); }
.feat:focus-visible {
  outline: 3px solid #ffd24a;
  outline-offset: 3px;
}

.feat-eyebrow {
  display: inline-block;
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 4px;
  text-transform: uppercase;
  padding: 6px 20px;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 50%, #b8860b);
  color: #2a1500;
  box-shadow: 0 0 16px rgba(255,210,74,.65), 0 2px 0 #7a4f00;
  margin-bottom: 12px;
  animation: feat-badge-pulse 2.4s ease-in-out infinite alternate;
}
@keyframes feat-badge-pulse {
  from { box-shadow: 0 0 10px rgba(255,210,74,.45), 0 2px 0 #7a4f00; }
  to   { box-shadow: 0 0 28px rgba(255,210,74,.85), 0 2px 0 #7a4f00; }
}
@media (prefers-reduced-motion: reduce) {
  .feat-eyebrow { animation: none !important; }
}

.feat-bulbs {
  display: flex;
  justify-content: center;
  gap: 9px;
  margin-bottom: 6px;
}
.feat-bulb {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6c8, #ffd24a 45%, #b8860b);
  box-shadow: 0 0 7px #ffd24a;
  animation: feat-tw 1.2s infinite alternate;
}
.feat-bulb:nth-child(2n) { animation-delay: .3s; }
.feat-bulb:nth-child(3n) { animation-delay: .6s; }
@keyframes feat-tw {
  from { opacity: .4; }
  to   { opacity: 1; }
}

.feat-title {
  display: block;
  font-family: 'Bungee', sans-serif;
  font-size: clamp(34px, 7.5vw, 60px);
  line-height: 1;
  letter-spacing: 2px;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 45%, #b8860b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 #5a3c00);
}
.feat-tag {
  display: block;
  font-size: 13px;
  color: #d6def0;
  letter-spacing: .5px;
  margin: 8px 0 16px;
}

.feat-reels {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}
.feat-window {
  display: block;
  width: 40px;
  height: 57px;
  border-radius: 6px;
  background: #0a0d12;
  box-shadow: inset 0 0 10px rgba(0,0,0,.85), 0 0 0 1px #3a4150;
  overflow: hidden;
}

/* Cash / vault-7 tiles — the same look as the in-game reel cells, sized to the
   featured motif window. */
.feat-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-family: 'Bungee', sans-serif;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, .5);
}
.feat-tile-glyph { font-size: 20px; line-height: 1; }
.feat-tile-cash { background: linear-gradient(180deg, #7bffb0, #0f8f48); color: #04240f; }
.feat-tile-seven { background: linear-gradient(180deg, #ffd76b, #cf8b14); color: #3a1d00; }

.feat-facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 7px;
  margin-bottom: 18px;
}
.feat-chip {
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 999px;
  background: #0a0d12;
  border: 1px solid #3a4150;
  color: #c7d2e6;
}

.feat-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}
.feat-play {
  display: inline-block;
  font-family: 'Bungee', sans-serif;
  font-size: 18px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 13px 28px;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffd76b, #e0890f);
  color: #2a1500;
  box-shadow: 0 4px 0 #8a4f00, 0 0 22px rgba(255,160,30,.45);
}
.feat-meta {
  font-size: 11px;
  color: #c0cbe0;
  letter-spacing: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .feat-bulb { animation: none !important; }
}
</style>
