<!-- app/components/game/ReelBlackjackReel.vue -->
<!-- Lucky 21 — stop-the-reels reel surface (Task 9). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'
import type { BlackjackReelMachineDef } from '~/engine'

const store = useSlotsStore()
const bj = useBlackjackReel()
const def = computed(() => store.currentDef as BlackjackReelMachineDef | null)

// ─── score / cash-out ────────────────────────────────────────────────────────

const scoreDisplay = computed(() => bj.score.value)
const cashDollars = computed(() => bj.cashValueDollars.value)
const cashAtZero = computed(() => bj.cashValueCents.value === 0)

// ─── result modal open/close ──────────────────────────────────────────────────
const showModal = computed(() => bj.phase.value === 'resolved')
</script>

<template>
  <div
    v-if="def"
    class="bj-surface"
    data-test="bj-surface"
  >
    <!-- ── Score + Cash Out displays ─────────────────────────────── -->
    <div class="bj-displays">
      <div class="bj-panel bj-panel-score">
        <div class="bj-panel-cap">
          Score
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="bj-panel-num"
          data-test="score-display"
          v-html="scoreDisplay"
        />
      </div>
      <div class="bj-panel bj-panel-bank">
        <div class="bj-panel-cap">
          Cash Out value
        </div>
        <div
          class="bj-panel-num"
          data-test="cash-display"
        >
          {{ cashDollars }}
        </div>
        <div
          class="bj-betref"
          data-test="cash-ref"
        >
          {{ cashAtZero ? 'reach 15 to win' : 'from your bet' }}
        </div>
      </div>
    </div>

    <!-- ── 5 Reel Windows ────────────────────────────────────────── -->
    <div
      class="bj-reels"
      role="group"
      aria-label="Lucky 21 reels"
    >
      <div
        v-for="i in 5"
        :key="i - 1"
        class="bj-reel"
        :class="{
          'bj-reel-next': bj.phase.value === 'spinning' && bj.idx.value === (i - 1) && bj.landed.value[i - 1] === null,
          'bj-reel-locked': bj.landed.value[i - 1] !== null,
          'bj-reel-dead': bj.phase.value === 'resolved' && bj.landed.value[i - 1] === null
        }"
      >
        <!-- Reel label -->
        <div class="bj-reel-name">
          Reel {{ i }}
        </div>

        <!-- Reel window -->
        <div
          class="bj-window"
          :aria-label="`Reel ${i}${bj.landed.value[i-1] !== null ? ': locked' : (bj.phase.value === 'resolved' ? ': not reached' : '')}`"
          role="img"
        >
          <!-- Gold payline bar -->
          <div
            v-if="bj.landed.value[i - 1] === null && bj.phase.value !== 'resolved'"
            class="bj-payline"
            aria-hidden="true"
          />

          <!-- Locked symbol display -->
          <div
            v-if="bj.landed.value[i - 1] !== null"
            class="bj-locked-card"
            data-test="locked-card"
          >
            <GameCardFace :symbol="bj.landed.value[i - 1]!" />
          </div>

          <!-- Dead reel (busted/not reached) -->
          <div
            v-else-if="bj.phase.value === 'resolved'"
            class="bj-dead-overlay"
            aria-hidden="true"
          />

          <!-- Spinning strip (active during a hand) -->
          <div
            v-else-if="bj.phase.value === 'spinning' && bj.reelStrips.value[i - 1]"
            class="bj-strip motion-safe:bj-strip-spin"
          >
            <!-- Two passes of the strip for seamless loop -->
            <template
              v-for="pass in 2"
              :key="pass"
            >
              <div
                v-for="(sym, si) in bj.reelStrips.value[i - 1]"
                :key="`${pass}-${si}`"
                class="bj-strip-card"
              >
                <GameCardFace :symbol="sym" />
              </div>
            </template>
          </div>

          <!-- Idle attract spin — uses reel composition, not the empty dealt strips -->
          <div
            v-else-if="bj.phase.value === 'idle'"
            class="bj-strip motion-safe:bj-strip-spin"
            aria-hidden="true"
          >
            <!-- Two passes for seamless loop; content from reel composition -->
            <template
              v-for="pass in 2"
              :key="pass"
            >
              <div
                v-for="(sym, si) in bj.attractStrips.value[i - 1]"
                :key="`${pass}-${si}`"
                class="bj-strip-card"
              >
                <GameCardFace :symbol="sym" />
              </div>
            </template>
          </div>
        </div>

        <!-- Cocktail tags (reel composition hints) -->
        <div
          v-if="bj.phase.value !== 'idle'"
          class="bj-cocktail"
        />
      </div>
    </div>

    <!-- ── Result Modal ───────────────────────────────────────────── -->
    <Transition name="bj-modal">
      <div
        v-if="showModal"
        class="bj-modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="bj.modalOutcome.value?.kind === 'bust' ? 'BUST — hand lost' : 'Hand result'"
        data-test="result-modal"
      >
        <div
          class="bj-modal-card"
          :class="{
            'bj-modal-win': bj.modalOutcome.value?.kind === 'win',
            'bj-modal-bust': bj.modalOutcome.value?.kind === 'bust',
            'bj-modal-charlie': bj.modalOutcome.value?.kind === 'charlie'
          }"
        >
          <!-- Title -->
          <div
            class="bj-modal-title"
            data-test="modal-title"
          >
            <template v-if="bj.modalOutcome.value?.kind === 'charlie'">
              FIVE-CARD CHARLIE!
            </template>
            <template v-else-if="bj.modalOutcome.value?.kind === 'bust'">
              BUST
            </template>
            <template v-else>
              YOU WIN
            </template>
          </div>

          <!-- 5-reel recap row -->
          <div
            class="bj-recap"
            aria-label="Hand recap"
            data-test="modal-recap"
          >
            <div
              v-for="ri in 5"
              :key="ri"
              class="bj-recap-reel"
            >
              <span class="bj-recap-n">{{ ri }}</span>
              <GameCardFace
                v-if="bj.landed.value[ri - 1] !== null"
                :symbol="bj.landed.value[ri - 1]!"
                class="bj-recap-card"
              />
              <div
                v-else
                class="bj-recap-none"
                aria-label="Not reached"
              >
                –
              </div>
            </div>
          </div>

          <!-- Breakdown chips -->
          <div
            class="bj-flow"
            data-test="modal-flow"
          >
            <template v-if="bj.modalOutcome.value?.kind !== 'bust'">
              <div class="bj-fchip">
                <div class="bj-fl">
                  {{ bj.modalOutcome.value?.kind === 'charlie' ? '5-card survival' : `Hand ${bj.modalOutcome.value?.best} pays` }}
                </div>
                <div class="bj-fv">
                  ${{ bj.modalOutcome.value?.baseDollars?.toFixed(2) }}
                </div>
              </div>
              <template v-if="(bj.modalOutcome.value?.mult ?? 1) > 1">
                <span class="bj-fop">×</span>
                <div class="bj-fchip bj-fchip-mult">
                  <div class="bj-fl">
                    Multiplier
                  </div>
                  <div class="bj-fv">
                    ×{{ bj.modalOutcome.value?.mult }}
                  </div>
                </div>
              </template>
              <template v-if="bj.modalOutcome.value?.kind === 'charlie'">
                <span class="bj-fop">×</span>
                <div class="bj-fchip bj-fchip-charlie">
                  <div class="bj-fl">
                    5-Card Charlie
                  </div>
                  <div class="bj-fv">
                    ×{{ def?.charlieMultiplier }}
                  </div>
                </div>
              </template>
            </template>
            <template v-else>
              <div class="bj-fchip bj-fchip-danger">
                <div class="bj-fl">
                  {{ bj.modalOutcome.value?.bustLabel }}
                </div>
                <div class="bj-fv">
                  {{ bj.modalOutcome.value?.bustValue }}
                </div>
              </div>
              <span class="bj-fop">→</span>
              <div class="bj-fchip bj-fchip-danger">
                <div class="bj-fl">
                  Result
                </div>
                <div class="bj-fv">
                  {{ bj.modalOutcome.value?.bustResult }}
                </div>
              </div>
            </template>
          </div>

          <!-- Dollar payout hero -->
          <div
            class="bj-ramount"
            data-test="modal-amount"
          >
            {{ bj.modalOutcome.value?.kind === 'bust' ? '$0' : bj.modalOutcome.value?.totalDollars }}
          </div>

          <!-- Sub caption -->
          <div class="bj-rsub">
            {{ bj.modalOutcome.value?.sub }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bj-surface {
  padding: 12px;
  position: relative;
}

/* ── Score / bank panels ── */
.bj-displays { display: flex; gap: 10px; margin-bottom: 12px; }
.bj-panel {
  flex: 1; border: 2px solid #11352a; border-radius: 14px; padding: 9px 14px 11px;
  min-height: 80px;
  background: linear-gradient(180deg, #05140f, #020a07);
}
.bj-panel-cap {
  font-size: 10px; letter-spacing: 3px; color: #7fd9bf; text-transform: uppercase;
  opacity: .8; margin-bottom: 4px;
}
.bj-panel-num {
  font-family: 'Orbitron', monospace; font-weight: 700; font-size: clamp(22px, 4vw, 34px);
  letter-spacing: 2px; color: #eafff9;
  text-shadow: 0 0 7px rgba(56,232,255,.4); line-height: 1.15;
}
.bj-panel-bank { border-color: #b8860b; background: linear-gradient(180deg, #2a1c02, #120c00); }
.bj-panel-bank .bj-panel-cap { color: #ffd24a; }
.bj-panel-bank .bj-panel-num {
  font-weight: 900; font-size: clamp(26px, 5vw, 44px);
  background: linear-gradient(180deg, #fff6c8, #ffd24a 50%, #b8860b);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.bj-betref { font-size: 10px; color: #d8b86a; letter-spacing: 1.2px; margin-top: 3px; text-transform: uppercase; }

/* ── 5 reels ── */
.bj-reels {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
}
.bj-reel {
  background: #02100c; border: 2px solid #1d4a3b; border-radius: 12px;
  padding: 6px 4px; display: flex; flex-direction: column; align-items: center;
  gap: 6px; transition: opacity .3s;
}
.bj-reel-next { border-color: #ffd24a; box-shadow: 0 0 14px rgba(255,210,74,.45); }
.bj-reel-dead { opacity: .22; }
.bj-reel-name {
  font-size: 9px; letter-spacing: .5px; color: #86b9aa;
  text-transform: uppercase; text-align: center; min-height: 20px;
  display: flex; align-items: center;
}
.bj-reel-next .bj-reel-name { color: #ffd24a; }

.bj-window {
  width: 100%; height: 108px; border-radius: 8px; background: #05100d;
  position: relative; overflow: hidden;
  box-shadow: inset 0 0 16px rgba(0,0,0,.9);
  display: flex; align-items: center; justify-content: center;
}
.bj-reel-locked .bj-window {
  box-shadow: inset 0 0 0 2px #ffd24a, inset 0 0 16px rgba(255,210,74,.3);
}

.bj-payline {
  position: absolute; left: 6px; right: 6px; top: 50%; height: 2px;
  transform: translateY(-1px);
  background: linear-gradient(90deg, transparent, rgba(255,210,74,.55), transparent);
  z-index: 3; pointer-events: none;
}
.bj-locked-card { display: flex; align-items: center; justify-content: center; }
.bj-dead-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.65); border-radius: 6px;
}

/* Spinning strip */
.bj-strip {
  position: absolute; top: 0; left: 0; width: 100%;
  display: flex; flex-direction: column; align-items: center;
}
.bj-strip-card { margin-bottom: 10px; }

/* CSS keyframe spin */
@keyframes lucky21-scroll {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
.bj-strip-spin {
  animation: lucky21-scroll 2.1s linear infinite;
  filter: blur(.2px);
}
/* Reduced-motion: freeze the strip in place (both attract and active spin). */
@media (prefers-reduced-motion: reduce) {
  .bj-strip-spin { animation: none !important; filter: none; }
}

/* ── Result Modal ── */
.bj-modal-backdrop {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(2,10,7,.82); backdrop-filter: blur(4px);
  z-index: 50; padding: 20px;
}
.bj-modal-enter-active, .bj-modal-leave-active { transition: opacity .25s; }
.bj-modal-enter-from, .bj-modal-leave-to { opacity: 0; }

.bj-modal-card {
  max-width: 560px; width: 100%; border-radius: 22px; padding: 26px 22px;
  text-align: center; border: 3px solid #b8860b;
  background: linear-gradient(180deg, #15392e, #0a2a20);
  box-shadow: 0 0 0 5px #1c1206, 0 0 70px rgba(0,0,0,.7);
}
.bj-modal-win { border-color: #46e08a; }
.bj-modal-bust { border-color: #ff3b5c; }
.bj-modal-charlie { border-color: #ffd24a; }

.bj-modal-title {
  font-family: 'Bungee', 'Segoe UI', sans-serif;
  font-size: clamp(28px, 7vw, 52px); line-height: 1.05; margin-bottom: 6px;
  color: #eafff9;
}
.bj-modal-win .bj-modal-title { color: #46e08a; text-shadow: 0 0 20px rgba(70,224,138,.6); }
.bj-modal-bust .bj-modal-title { color: #ff3b5c; text-shadow: 0 0 20px rgba(255,59,92,.6); }
.bj-modal-charlie .bj-modal-title { color: #ffd24a; text-shadow: 0 0 24px rgba(255,210,74,.7); }

/* 5-reel recap */
.bj-recap {
  display: flex; justify-content: center; gap: 6px; margin: 14px 0 6px; flex-wrap: wrap;
}
.bj-recap-reel { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.bj-recap-n { font-size: 9px; color: #7fd9bf; letter-spacing: 1px; opacity: .8; }
.bj-recap-card { transform: scale(0.72); transform-origin: top center; }
.bj-recap-none {
  width: 44px; height: 62px; border-radius: 6px; border: 2px dashed #234b3e;
  display: flex; align-items: center; justify-content: center; color: #3a6155; font-size: 16px;
}

/* Breakdown chips */
.bj-flow {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 9px; margin: 14px 0 8px;
}
.bj-fchip {
  border-radius: 12px; padding: 8px 12px; background: #02100c;
  border: 2px solid #1d4a3b; min-width: 68px;
}
.bj-fchip-mult { border-color: #4a2a6b; }
.bj-fchip-charlie { border-color: #b8860b; }
.bj-fchip-danger { border-color: #5a2230; }
.bj-fl { font-size: 9px; letter-spacing: 1.2px; color: #7fd9bf; text-transform: uppercase; }
.bj-fv { font-family: 'Orbitron', monospace; font-weight: 800; font-size: 19px; color: #eafff9; }
.bj-fchip-mult .bj-fv { color: #d9b3ff; }
.bj-fchip-charlie .bj-fv { color: #ffd24a; }
.bj-fchip-danger .bj-fv { color: #ff6478; }
.bj-fop { font-family: 'Orbitron', monospace; font-weight: 900; font-size: 18px; color: #9fd9c8; }

/* Dollar hero */
.bj-ramount {
  font-family: 'Orbitron', monospace; font-weight: 900;
  font-size: clamp(40px, 12vw, 80px); line-height: 1; margin: 6px 0 2px;
}
.bj-modal-win .bj-ramount,
.bj-modal-charlie .bj-ramount {
  background: linear-gradient(180deg, #fff6c8, #ffd24a 50%, #b8860b);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.bj-modal-bust .bj-ramount { color: #ff6478; }

.bj-rsub { font-size: 12px; color: #9fd9c8; margin-bottom: 4px; letter-spacing: 1px; }
</style>
