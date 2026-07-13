<!-- app/components/floor/FeaturedMachine.vue -->
<!-- Big, gaudy "Featured machine" card for the floor. DATA-DRIVEN: the def
     comes from machines/index.ts FEATURED_ID and the words from
     featuredCopy.ts, so revolving the spotlight is a one-line curation change
     — the gold marquee housing stays the same for every headliner. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { FEATURED_COPY } from './featuredCopy'
import type { MachineDef } from '~/engine'

const props = defineProps<{ def: MachineDef }>()
const store = useSlotsStore()

const copy = computed(() => FEATURED_COPY[props.def.id] ?? {
  title: props.def.name.toUpperCase(),
  tagline: '',
  motif: ['🎰', '🎰', '🎰', '🎰', '🎰'],
  facts: [],
  playLabel: `▼ Play ${props.def.name}`,
  meta: ''
})

function play() {
  // The headliner fronts a cold floor too, so entering it may have to open the
  // session first (free play walks up without one).
  store.enterMachine(props.def.id)
  navigateTo('/game')
}
</script>

<template>
  <!-- No aria-label: the accessible name IS the visible content (eyebrow +
       title + tag), which keeps WCAG 2.5.3 label-in-name exact. -->
  <button
    class="feat"
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

    <!-- real spaces (not &nbsp;) so the visible text matches the accessible
         name (WCAG 2.5.3 label-in-name); nowrap keeps the one-line marquee -->
    <span class="feat-title">{{ copy.title }}</span>
    <span class="feat-tag">{{ copy.tagline }}</span>

    <span
      class="feat-reels"
      aria-hidden="true"
    >
      <span
        v-for="(t, i) in copy.motif"
        :key="i"
        class="feat-window"
      >
        <span class="feat-tile">
          <span class="feat-tile-glyph">{{ t }}</span>
        </span>
      </span>
    </span>

    <span class="feat-facts">
      <span
        v-for="(f, i) in copy.facts"
        :key="i"
        class="feat-chip"
      >{{ f }}</span>
    </span>

    <span class="feat-cta">
      <span class="feat-play">{{ copy.playLabel }}</span>
      <span class="feat-meta">{{ copy.meta }}</span>
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
    radial-gradient(120% 90% at 50% -10%, rgba(255, 215, 90, .16), transparent 55%),
    linear-gradient(180deg, #3a2708, #160f02);
  box-shadow: 0 0 0 5px #1c1206, 0 0 50px rgba(0, 0, 0, .55), inset 0 0 70px rgba(0, 0, 0, .45);
  cursor: pointer;
  color: #fde6b8;
  transition: transform .1s, box-shadow .2s;
}
.feat:hover {
  box-shadow: 0 0 0 5px #1c1206, 0 0 60px rgba(255, 210, 74, .3), inset 0 0 70px rgba(0, 0, 0, .45);
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
  box-shadow: 0 0 16px rgba(255, 210, 74, .65), 0 2px 0 #7a4f00;
  margin-bottom: 12px;
  animation: feat-badge-pulse 2.4s ease-in-out infinite alternate;
}
@keyframes feat-badge-pulse {
  from { box-shadow: 0 0 10px rgba(255, 210, 74, .45), 0 2px 0 #7a4f00; }
  to   { box-shadow: 0 0 28px rgba(255, 210, 74, .85), 0 2px 0 #7a4f00; }
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
  white-space: nowrap;
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
  color: #e8d6a8;
  letter-spacing: .5px;
  margin: 8px auto 16px;
  max-width: 460px;
}

.feat-reels {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}
.feat-window {
  display: block;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #0a0702;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, .85), 0 0 0 1px #5a3c0a;
  overflow: hidden;
}
.feat-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #2a2008, #140d02);
}
.feat-tile-glyph { font-size: 26px; line-height: 1; }

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
  background: #140d02;
  border: 1px solid #5a3c0a;
  color: #e8d6a8;
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
  box-shadow: 0 4px 0 #8a4f00, 0 0 22px rgba(255, 160, 30, .45);
}
.feat-meta {
  font-size: 11px;
  color: #c0a868;
  letter-spacing: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .feat-bulb, .feat-eyebrow { animation: none !important; }
}
</style>
