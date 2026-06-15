<!-- app/components/game/CardFace.vue -->
<!-- Renders a single Lucky 21 reel symbol as a playing-card tile. -->
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
  <!-- Deck card (standard or ace) -->
  <div
    v-if="isDeckCard"
    class="card-face card-deck"
    :class="color === 'red' ? 'card-red' : 'card-black'"
  >
    <span
      class="card-rank card-tl"
      aria-hidden="true"
    >{{ rank }}</span>
    <span
      class="card-suit-center"
      aria-hidden="true"
    >{{ suit }}</span>
    <span
      class="card-rank card-br"
      aria-hidden="true"
    >{{ rank }}</span>
  </div>

  <!-- Multiplier -->
  <div
    v-else-if="isMult"
    class="card-face card-special card-mult"
    :class="multN >= 5 ? 'card-mult-big' : ''"
  >
    <span class="card-special-big">×{{ multN }}</span>
    <span class="card-special-lab">{{ multN >= 5 ? 'BIG MULT' : 'MULTIPLY' }}</span>
  </div>

  <!-- Minus -->
  <div
    v-else-if="isMinus"
    class="card-face card-special card-minus"
  >
    <span class="card-special-big">−{{ minusN }}</span>
    <span class="card-special-lab">TAKE OFF</span>
  </div>

  <!-- Bust -->
  <div
    v-else-if="isBust"
    class="card-face card-special card-bust"
    role="img"
    aria-label="BUST"
  >
    <svg
      class="card-boom motion-reduce:hidden"
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
    <span class="card-special-lab">BUST</span>
  </div>
</template>

<style scoped>
.card-face {
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
.card-deck {
  background: linear-gradient(180deg, #fbf7ec, #eadfc6);
  flex-direction: column;
}
.card-red { color: #c0202f; }
.card-black { color: #16110a; }
.card-rank {
  position: absolute;
  font-family: 'Orbitron', 'Segoe UI', monospace;
  font-weight: 800;
  font-size: 14px;
  line-height: 1;
}
.card-tl { top: 6px; left: 7px; }
.card-br { bottom: 6px; right: 7px; transform: rotate(180deg); }
.card-suit-center { font-size: 32px; }

.card-special {
  flex-direction: column;
  gap: 3px;
  color: #fff;
}
.card-mult { background: linear-gradient(180deg, #c79bff, #7e43cf); }
.card-mult-big { background: linear-gradient(180deg, #ffe98a, #e0a512); color: #3a2400; }
.card-minus { background: linear-gradient(180deg, #8fd4ff, #2f86d6); }
.card-bust { background: linear-gradient(180deg, #ff7d92, #cf1c39); }

.card-special-big {
  font-family: 'Orbitron', 'Segoe UI', monospace;
  font-weight: 900;
  font-size: 22px;
  line-height: 1;
}
.card-special-lab {
  font-size: 8px;
  letter-spacing: 1.5px;
  opacity: 0.9;
  text-transform: uppercase;
}
.card-boom {
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.45));
}
/* reduced-motion: hide the spinning animation on the reel strip; bust card is static, ok. */
@media (prefers-reduced-motion: reduce) {
  .card-boom { /* static is fine already */ }
}
</style>
