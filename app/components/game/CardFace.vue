<!-- app/components/game/CardFace.vue -->
<!-- Renders a single Lucky 21 reel symbol as a playing-card tile.
     Dimensions and styling match lucky21-playable-v7.html exactly (60×86 px). -->
<script setup lang="ts">
import { computed } from 'vue'
import { cardRank, cardSuit, cardColor } from '~/engine/deck'
import type { SymbolId } from '~/engine'

const props = defineProps<{
  symbol: SymbolId
  /** extra wrapper classes */
  class?: string
}>()

// Is it a deck card (e.g. "AH", "TC", "7S")?
const isDeckCard = computed(() => {
  const s = props.symbol
  // Special symbols are BUST, MX2, MX3, MX5, MX10, MM2, MM3
  const special = ['BUST', 'MX2', 'MX3', 'MX5', 'MX10', 'MM2', 'MM3']
  return !special.includes(s) && s.length >= 2
})

const rank = computed(() => isDeckCard.value ? cardRank(props.symbol) : '')
const suit = computed(() => {
  if (!isDeckCard.value) return ''
  const s = cardSuit(props.symbol)
  if (s === 'S') return '♠'
  if (s === 'H') return '♥'
  if (s === 'D') return '♦'
  return '♣'
})
const color = computed(() => isDeckCard.value ? cardColor(props.symbol) : 'black')

// Special symbol classification
const isMult = computed(() => props.symbol.startsWith('MX'))
const isMinus = computed(() => props.symbol.startsWith('MM'))
const isBust = computed(() => props.symbol === 'BUST')

// Multiplier face value
const multN = computed(() => {
  if (!isMult.value) return 0
  return parseInt(props.symbol.slice(2), 10)
})

// Minus face value
const minusN = computed(() => {
  if (!isMinus.value) return 0
  return parseInt(props.symbol.slice(2), 10)
})
</script>

<template>
  <!-- Deck card (standard or ace) — matches demo .pcard.red / .pcard.blk -->
  <div
    v-if="isDeckCard"
    class="pcard"
    :class="color === 'red' ? 'pcard-red' : 'pcard-blk'"
  >
    <span
      class="pr tl"
      aria-hidden="true"
    >{{ rank }}</span>
    <span
      class="ps"
      aria-hidden="true"
    >{{ suit }}</span>
    <span
      class="pr br"
      aria-hidden="true"
    >{{ rank }}</span>
  </div>

  <!-- Multiplier — matches demo .pcard.sp.mult / .pcard.sp.special -->
  <div
    v-else-if="isMult"
    class="pcard pcard-sp"
    :class="multN >= 5 ? 'pcard-special' : 'pcard-mult'"
  >
    <span class="sp-big">×{{ multN }}</span>
    <span class="sp-lab">{{ multN >= 5 ? 'BIG MULT' : 'MULTIPLY' }}</span>
  </div>

  <!-- Minus — matches demo .pcard.sp.minus -->
  <div
    v-else-if="isMinus"
    class="pcard pcard-sp pcard-minus"
  >
    <span class="sp-big">−{{ minusN }}</span>
    <span class="sp-lab">TAKE OFF</span>
  </div>

  <!-- Bust — matches demo .pcard.sp.bust + SVG polygon explosion -->
  <div
    v-else-if="isBust"
    class="pcard pcard-sp pcard-bust"
    role="img"
    aria-label="BUST"
  >
    <svg
      class="boom"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points="24,1 28,16 40,8 34,21 47,24 34,27 40,40 28,32 24,47 20,32 8,40 14,27 1,24 14,21 8,8 20,16"
        fill="#fff"
      />
      <circle
        cx="24"
        cy="24"
        r="6"
        fill="#7a0f20"
      />
    </svg>
    <span class="sp-lab">BUST</span>
  </div>
</template>

<style scoped>
/* Base card tile — 60×86 exactly as in the demo */
.pcard {
  width: 60px;
  height: 86px;
  border-radius: 9px;
  flex: 0 0 auto;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 9px rgba(0,0,0,.45);
}

/* Deck card (standard + ace) */
.pcard:not(.pcard-sp) {
  background: linear-gradient(180deg, #fbf7ec, #eadfc6);
}
.pcard-red { color: #c0202f; }
.pcard-blk { color: #16110a; }

/* Rank pip at top-left and bottom-right */
.pr {
  position: absolute;
  font-family: 'Orbitron', monospace;
  font-weight: 800;
  font-size: 14px;
  line-height: 1;
}
.tl { top: 6px; left: 7px; }
.br { bottom: 6px; right: 7px; transform: rotate(180deg); }

/* Center suit glyph */
.ps { font-size: 32px; }

/* Special card base */
.pcard-sp {
  flex-direction: column;
  gap: 2px;
  color: #fff;
}

/* Special variants matching demo */
.pcard-mult    { background: linear-gradient(180deg, #c79bff, #7e43cf); }
.pcard-special { background: linear-gradient(180deg, #ffe98a, #e0a512); color: #3a2400; }
.pcard-minus   { background: linear-gradient(180deg, #8fd4ff, #2f86d6); }
.pcard-bust    { background: linear-gradient(180deg, #ff7d92, #cf1c39); }

/* Big number label on special cards */
.sp-big {
  font-family: 'Orbitron', monospace;
  font-weight: 900;
  font-size: 25px;
  line-height: 1;
}

/* Small label below the big number */
.sp-lab {
  font-size: 8px;
  letter-spacing: 1.5px;
  opacity: .9;
  text-transform: uppercase;
}

/* Explosion starburst SVG on BUST card */
.boom {
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.45));
}
</style>
