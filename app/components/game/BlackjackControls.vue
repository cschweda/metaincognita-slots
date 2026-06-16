<!-- app/components/game/BlackjackControls.vue -->
<!-- Lucky 21 — STOP / CASH OUT controls styled to match the demo's Bungee chunky buttons.
     No separate Deal button: pressing STOP while idle deals the hand and
     locks the first reel in one action (matches the approved demo). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const store = useSlotsStore()
const { phase, canStop, canCash, stop, cashOut, cashValueDollars } = useBlackjackReel()

const def = computed(() => {
  const d = store.currentDef
  return d?.family === 'blackjack-reel' ? d : null
})

const anteDisplay = computed(() => {
  if (def.value === null) return ''
  const coins = store.currentBet
  const cents = coins * def.value.denominationCents
  return `Ante: ${coins} coin${coins !== 1 ? 's' : ''} ($${(cents / 100).toFixed(2)})`
})

const reelIdx = computed(() => (store.currentState?.blackjackReel?.idx ?? 0) + 1)
</script>

<template>
  <div
    v-if="def"
    class="l21-controls"
  >
    <span class="l21-ante">{{ anteDisplay }}</span>

    <div class="l21-btns">
      <!-- STOP — starts the hand from idle, or locks next reel during a hand -->
      <button
        class="l21-btn l21-btn-stop"
        data-test="stop"
        :disabled="!canStop"
        :aria-label="phase === 'idle' ? 'Stop — deal and lock reel 1' : 'Stop — lock the next reel'"
        @click="stop"
      >
        Stop
        <small>{{ phase === 'idle' ? 'press to deal' : `reel ${reelIdx}` }}</small>
      </button>

      <!-- CASH OUT — available once a hand is in progress -->
      <button
        class="l21-btn l21-btn-cash"
        data-test="cash-out"
        :disabled="!canCash"
        aria-label="Cash out — take current winnings"
        @click="cashOut"
      >
        Cash Out
        <small
          v-if="canCash"
          data-test="cash-val"
        >take {{ cashValueDollars }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
.l21-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.l21-ante {
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  color: #9fd9c8;
  letter-spacing: 1px;
  margin-right: 4px;
}

.l21-btns {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Demo-faithful button base */
.l21-btn {
  border: none;
  border-radius: 14px;
  padding: 15px 22px;
  font-family: 'Bungee', sans-serif;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform .08s;
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 130px;
}
.l21-btn:active { transform: translateY(2px); }
.l21-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }

.l21-btn small {
  display: block;
  font-family: 'Orbitron', monospace;
  font-size: 12px;
  letter-spacing: 1px;
  margin-top: 2px;
  opacity: .85;
  text-transform: none;
  font-weight: 400;
}

/* STOP — gold gradient (matches demo .btn.stop) */
.l21-btn-stop {
  background: linear-gradient(180deg, #ffd76b, #e0890f);
  color: #2a1500;
  box-shadow: 0 4px 0 #8a4f00, 0 0 26px rgba(255,160,30,.55);
}

/* CASH OUT — green gradient (matches demo .btn.cash) */
.l21-btn-cash {
  background: linear-gradient(180deg, #7bffb0, #16a85a);
  color: #04240f;
  box-shadow: 0 4px 0 #0a5e30, 0 0 26px rgba(40,220,120,.5);
}

/* Responsive: stack on very narrow viewports */
@media (max-width: 420px) {
  .l21-btns { flex-direction: column; width: 100%; }
  .l21-btn  { width: 100%; }
}
</style>
