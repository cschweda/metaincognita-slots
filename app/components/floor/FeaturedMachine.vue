<!-- app/components/floor/FeaturedMachine.vue -->
<!-- Big, visual "Featured machine" card for the floor select screen.
     Styled to preview the Flameout 21 crash cabinet (felt + gold + Bungee marquee). -->
<script setup lang="ts">
import { useSlotsStore } from '~/stores/slots'
import { formatCents } from '~/utils/format'
import type { MachineDef, SymbolId } from '~/engine'

const props = defineProps<{ def: MachineDef }>()
const store = useSlotsStore()

// Decorative 5-reel motif — a representative crash row (deal + climb + crash).
const MOTIF: SymbolId[] = ['KH', 'AS', 'CLIMB', 'CLIMB', 'CRASH']

// GameCardFace only renders deck cards; CLIMB/CRASH use the inline reel tile.
function isSpecial(sym: SymbolId): sym is 'CLIMB' | 'CRASH' {
  return sym === 'CLIMB' || sym === 'CRASH'
}

const FACTS = [
  '5 reels — stop them one by one',
  'Your hand sets launch + climb speed',
  'Cash out before it crashes',
  '~97% RTP — true crash-game odds'
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

    <span class="feat-title">FLAMEOUT&nbsp;21</span>
    <span class="feat-tag">Climb to multiply. Crash and lose it all.</span>

    <span
      class="feat-reels"
      aria-hidden="true"
    >
      <span
        v-for="(sym, i) in MOTIF"
        :key="i"
        class="feat-window"
      >
        <span
          v-if="isSpecial(sym)"
          class="feat-tile"
          :class="sym === 'CRASH' ? 'feat-tile-crash' : 'feat-tile-climb'"
        >
          <span class="feat-tile-glyph">{{ sym === 'CRASH' ? '💥' : '▲' }}</span>
          <span class="feat-tile-lab">{{ sym }}</span>
        </span>
        <GameCardFace
          v-else
          :symbol="sym"
        />
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
      <span class="feat-play">▶ Play Flameout 21</span>
      <span class="feat-meta">{{ formatCents(def.denominationCents) }}/credit · climb-or-crash</span>
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
  background: linear-gradient(180deg, #15392e, #0a2a20);
  box-shadow: 0 0 0 5px #1c1206, 0 0 50px rgba(0,0,0,.55), inset 0 0 70px rgba(0,0,0,.4);
  cursor: pointer;
  color: #eafff9;
  transition: transform .1s, box-shadow .2s;
}
.feat:hover {
  box-shadow: 0 0 0 5px #1c1206, 0 0 60px rgba(255,210,74,.25), inset 0 0 70px rgba(0,0,0,.4);
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
  font-size: clamp(40px, 9vw, 72px);
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
  color: #bfe9da;
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
  background: #05100d;
  box-shadow: inset 0 0 10px rgba(0,0,0,.85);
  overflow: hidden;
}
.feat-window :deep(.pcard) {
  transform: scale(0.66);
  transform-origin: top left;
  box-shadow: none;
}

/* CLIMB / CRASH tiles — the same look as the in-game reel tiles, sized to the
   featured motif window (GameCardFace only knows deck cards). */
.feat-tile {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 6px;
  font-family: 'Orbitron', monospace;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, .5);
}
.feat-tile-glyph { font-size: 18px; line-height: 1; }
.feat-tile-lab { font-size: 7px; letter-spacing: 1px; font-family: 'Bungee', sans-serif; }
.feat-tile-climb { background: linear-gradient(180deg, #7bffb0, #0f8f48); color: #04240f; }
.feat-tile-crash { background: linear-gradient(180deg, #ff7d92, #cf1c39); color: #fff; }

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
  background: #02100c;
  border: 1px solid #1d4a3b;
  color: #9fe0cd;
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
  color: #9fd9c8;
  letter-spacing: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .feat-bulb { animation: none !important; }
}
</style>
