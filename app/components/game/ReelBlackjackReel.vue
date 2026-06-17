<!-- app/components/game/ReelBlackjackReel.vue -->
<!-- Lucky 21 — stop-the-reels reel surface. Visuals match lucky21-playable-v7.html demo. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'
import { GAMBLE_CAP } from '~/engine/blackjackReel'
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

// ─── per-reel spin speed (visual escalation; does not affect the draw) ────────
// Reels 1–2 (pure cards) spin calmly and readably at base 2.1 s; reels 3–5 spin
// much faster so their dense BUST symbols blur past rather than reading as a
// "wall of BUST". Visual only — STOP is still a uniform draw, RTP is unchanged.
// Reduced-motion's `animation: none !important` wins over inline animation-duration.
const REEL_SPIN_MS = [2100, 2100, 1000, 750, 550] as const

// ─── reel labels + cocktail tags (presentation; matches the demo verbatim) ────
const REEL_NAMES = [
  'Reel 1 · cards',
  'Reel 2 · cards',
  'Reel 3 · LOCK-IN BONUS · no cards',
  'Reel 4 · MIX · ×3/×5',
  'Reel 5 · BIG · ×5/×10'
] as const

type CocktailTag = { text: string, tone: '' | 'good' | 'danger' | 'charlie' }
const REEL_COCKTAILS: CocktailTag[][] = [
  [{ text: 'cards', tone: '' }],
  [{ text: 'cards', tone: '' }],
  [{ text: '×2/×3', tone: 'good' }, { text: '−3', tone: 'good' }, { text: 'BUST', tone: 'danger' }],
  [{ text: 'cards', tone: '' }, { text: '×3/×5', tone: 'good' }, { text: '−3', tone: 'good' }, { text: 'BUST', tone: 'danger' }],
  [{ text: 'cards', tone: '' }, { text: '×5/×10 big', tone: 'good' }, { text: 'BUST', tone: 'danger' }, { text: 'survive=CHARLIE', tone: 'charlie' }]
]
</script>

<template>
  <div
    v-if="def"
    class="l21-surface"
    data-test="bj-surface"
  >
    <!-- ── Bulb row ────────────────────────────────────────────────── -->
    <div
      class="l21-bulbs"
      aria-hidden="true"
    >
      <span
        v-for="b in 11"
        :key="b"
        class="l21-bulb"
      />
    </div>

    <!-- ── LUCKY 21 Marquee ─────────────────────────────────────────── -->
    <div
      class="l21-marquee"
      aria-label="Lucky 21"
    >
      LUCKY&nbsp;21
    </div>
    <div class="l21-sub">
      What's on the line is what you get
    </div>

    <!-- ── Score + Cash Out displays ────────────────────────────────── -->
    <div class="l21-displays">
      <div class="l21-panel l21-panel-total">
        <div class="l21-cap">
          Score
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="l21-num"
          data-test="score-display"
          v-html="scoreDisplay"
        />
      </div>
      <div class="l21-panel l21-panel-bank">
        <div class="l21-cap">
          Cash Out value
        </div>
        <div
          class="l21-num"
          data-test="cash-display"
        >
          {{ cashDollars }}
        </div>
        <div
          class="l21-betref"
          data-test="cash-ref"
        >
          {{ cashAtZero ? 'reach 15 to win' : `from your ${bj.anteDollars.value} bet` }}
        </div>
      </div>
    </div>

    <!-- ── 5 Reel Windows ─────────────────────────────────────────── -->
    <div
      class="l21-reels"
      role="group"
      aria-label="Lucky 21 reels"
    >
      <div
        v-for="i in 5"
        :key="i - 1"
        class="l21-reel"
        :class="{
          'l21-reel-next': bj.phase.value === 'spinning' && bj.idx.value === (i - 1) && bj.landed.value[i - 1] === null,
          'l21-reel-locked': bj.landed.value[i - 1] !== null,
          'l21-reel-dead': bj.phase.value === 'resolved' && bj.landed.value[i - 1] === null
        }"
      >
        <!-- Reel label -->
        <div class="l21-reel-name">
          {{ REEL_NAMES[i - 1] }}
        </div>

        <!-- Reel window -->
        <div
          class="l21-window"
          :class="{ 'l21-window-dead': bj.phase.value === 'resolved' && bj.landed.value[i - 1] === null }"
          :aria-label="`Reel ${i}${bj.landed.value[i-1] !== null ? ': locked' : (bj.phase.value === 'resolved' ? ': not reached' : '')}`"
          role="img"
        >
          <!-- Gold payline bar (shown only while spinning/unlocked) -->
          <div
            v-if="bj.landed.value[i - 1] === null && bj.phase.value !== 'resolved'"
            class="l21-payline"
            aria-hidden="true"
          />

          <!-- Locked symbol display -->
          <div
            v-if="bj.landed.value[i - 1] !== null"
            class="l21-locked-card"
            data-test="locked-card"
          >
            <GameCardFace :symbol="bj.landed.value[i - 1]!" />
          </div>

          <!-- Spinning strip (active during a hand) -->
          <div
            v-else-if="bj.phase.value === 'spinning' && bj.reelStrips.value[i - 1]"
            class="l21-strip l21-strip-spin"
            :style="{ animationDuration: `${REEL_SPIN_MS[i - 1]}ms` }"
          >
            <template
              v-for="pass in 2"
              :key="pass"
            >
              <div
                v-for="(sym, si) in bj.reelStrips.value[i - 1]"
                :key="`${pass}-${si}`"
                class="l21-strip-card"
              >
                <GameCardFace :symbol="sym" />
              </div>
            </template>
          </div>

          <!-- Idle attract spin — uses reel composition -->
          <div
            v-else-if="bj.phase.value === 'idle'"
            class="l21-strip l21-strip-spin"
            :style="{ animationDuration: `${REEL_SPIN_MS[i - 1]}ms` }"
            aria-hidden="true"
          >
            <template
              v-for="pass in 2"
              :key="pass"
            >
              <div
                v-for="(sym, si) in bj.attractStrips.value[i - 1]"
                :key="`${pass}-${si}`"
                class="l21-strip-card"
              >
                <GameCardFace :symbol="sym" />
              </div>
            </template>
          </div>
        </div>

        <!-- Cocktail tags — what each reel can land (matches the demo) -->
        <div class="l21-cocktail">
          <span
            v-for="(tag, ti) in REEL_COCKTAILS[i - 1]"
            :key="ti"
            class="l21-tag"
            :class="tag.tone ? `l21-tag-${tag.tone}` : ''"
          >{{ tag.text }}</span>
        </div>
      </div>
    </div>

    <!-- ── Live message line (mirrors the demo's setMsg states) ───────── -->
    <div
      class="l21-msg"
      :class="bj.message.value.tone ? `l21-msg-${bj.message.value.tone}` : ''"
      data-test="bj-msg"
      aria-live="polite"
    >
      {{ bj.message.value.text }}
    </div>

    <!-- ── STOP / CASH OUT controls (in-cabinet, like the demo) ───────── -->
    <div class="l21-controls">
      <button
        class="l21-btn l21-btn-stop"
        data-test="stop"
        :disabled="!bj.canStop.value"
        :aria-label="bj.phase.value === 'idle' ? 'Stop — deal and lock reel 1' : 'Stop — lock the next reel'"
        @click="bj.stop()"
      >
        Stop
        <small>{{ bj.stopHint.value }}</small>
      </button>
      <button
        class="l21-btn l21-btn-cash"
        data-test="cash-out"
        :disabled="!bj.canCash.value"
        aria-label="Cash out — take current winnings"
        @click="bj.cashOut()"
      >
        Cash Out
        <small>take {{ cashDollars }}</small>
      </button>
    </div>

    <!-- ── Foot explainer (matches the demo) ──────────────────────────── -->
    <div class="l21-foot">
      Reels 1–2 are pure cards — your 2-card total. <b>Reel 3 has no cards</b>: the
      lock-in bonus — grab a <b>×multiplier</b> (or −safe room) over a wall of BUST.
      The <b>real danger is reels 4–5</b>, where cards return and the big <b>×5/×10</b>
      sit behind even more BUST. Nothing pays under 15; <b>15 qualifies</b>, a 21 pays
      triple, and surviving all five is <b>Charlie ×3</b>.
    </div>

    <!-- ── Result Modal ──────────────────────────────────────────────── -->
    <Transition name="l21-modal">
      <div
        v-if="showModal"
        class="l21-modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="bj.modalOutcome.value?.kind === 'bust' ? 'BUST — hand lost' : 'Hand result'"
        data-test="result-modal"
      >
        <div
          class="l21-rcard"
          :class="{
            'l21-rcard-win': bj.modalOutcome.value?.kind === 'win',
            'l21-rcard-bust': bj.modalOutcome.value?.kind === 'bust',
            'l21-rcard-charlie': bj.modalOutcome.value?.kind === 'charlie'
          }"
        >
          <!-- Title -->
          <div
            class="l21-rtitle"
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
            class="l21-recap"
            aria-label="Hand recap"
            data-test="modal-recap"
          >
            <div
              v-for="ri in 5"
              :key="ri"
              class="l21-rr"
            >
              <span class="l21-rrn">{{ ri }}</span>
              <GameCardFace
                v-if="bj.landed.value[ri - 1] !== null"
                :symbol="bj.landed.value[ri - 1]!"
                class="l21-recap-card"
              />
              <div
                v-else
                class="l21-recap-none"
                aria-label="Not reached"
              >
                –
              </div>
            </div>
          </div>

          <!-- Breakdown chips -->
          <div
            class="l21-flow"
            data-test="modal-flow"
          >
            <!-- Blackjack double-or-nothing bonus: a single result chip -->
            <template v-if="bj.modalOutcome.value?.gamble">
              <div
                class="l21-fchip"
                :class="bj.modalOutcome.value?.kind === 'bust' ? 'l21-fchip-danger' : ''"
              >
                <div class="l21-fl">
                  Blackjack bonus
                </div>
                <div class="l21-fv">
                  {{ bj.modalOutcome.value?.kind === 'bust' ? 'BUST' : bj.modalOutcome.value?.totalDollars }}
                </div>
              </div>
            </template>
            <template v-else-if="bj.modalOutcome.value?.kind !== 'bust'">
              <div class="l21-fchip">
                <div class="l21-fl">
                  {{ bj.modalOutcome.value?.kind === 'charlie' ? '5-card survival' : `Hand ${bj.modalOutcome.value?.best} pays` }}
                </div>
                <div class="l21-fv">
                  ${{ bj.modalOutcome.value?.baseDollars?.toFixed(2) }}
                </div>
              </div>
              <template v-if="(bj.modalOutcome.value?.mult ?? 1) > 1">
                <span class="l21-fop">×</span>
                <div class="l21-fchip l21-fchip-mult">
                  <div class="l21-fl">
                    Multiplier
                  </div>
                  <div class="l21-fv">
                    ×{{ bj.modalOutcome.value?.mult }}
                  </div>
                </div>
              </template>
              <template v-if="bj.modalOutcome.value?.kind === 'charlie'">
                <span class="l21-fop">×</span>
                <div class="l21-fchip l21-fchip-charlie">
                  <div class="l21-fl">
                    5-Card Charlie
                  </div>
                  <div class="l21-fv">
                    ×{{ def?.charlieMultiplier }}
                  </div>
                </div>
              </template>
            </template>
            <template v-else>
              <div class="l21-fchip l21-fchip-danger">
                <div class="l21-fl">
                  {{ bj.modalOutcome.value?.bustLabel }}
                </div>
                <div class="l21-fv">
                  {{ bj.modalOutcome.value?.bustValue }}
                </div>
              </div>
              <span class="l21-fop">→</span>
              <div class="l21-fchip l21-fchip-danger">
                <div class="l21-fl">
                  Result
                </div>
                <div class="l21-fv">
                  {{ bj.modalOutcome.value?.bustResult }}
                </div>
              </div>
            </template>
          </div>

          <!-- Dollar payout hero -->
          <div
            class="l21-ramount"
            data-test="modal-amount"
          >
            {{ bj.modalOutcome.value?.kind === 'bust' ? '$0' : bj.modalOutcome.value?.totalDollars }}
          </div>

          <!-- Sub caption -->
          <div class="l21-rsub">
            {{ bj.modalOutcome.value?.sub }}
          </div>

          <!-- Play Again — dismiss the modal and return to idle attract -->
          <button
            class="l21-btn l21-btn-again"
            data-test="play-again"
            @click="bj.playAgain()"
          >
            Play Again
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Double-or-nothing bonus overlay (a true 2-card natural) ─────── -->
    <Transition name="l21-modal">
      <div
        v-if="bj.phase.value === 'gamble'"
        class="l21-gamble-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="l21-gamble-title"
        data-test="gamble-overlay"
      >
        <div class="l21-gamble">
          <div
            id="l21-gamble-title"
            class="l21-gamble-title"
          >
            BLACKJACK!
          </div>
          <div class="l21-gamble-online">
            on the line: <b data-test="gamble-amount">{{ bj.gambleAmountDollars.value }}</b>
          </div>

          <!-- the spinning chromed reel (honest 50/50 — the engine flips it) -->
          <div class="l21-gamble-window">
            <div
              class="l21-gamble-strip l21-strip-spin"
              aria-hidden="true"
            >
              <template
                v-for="pass in 2"
                :key="pass"
              >
                <div
                  v-for="n in 4"
                  :key="`${pass}-${n}`"
                  class="l21-gamble-face"
                  :class="n % 2 === 1 ? 'l21-gamble-x2' : 'l21-gamble-bust'"
                >
                  <b>{{ n % 2 === 1 ? '×2' : '💥' }}</b>
                  <span>{{ n % 2 === 1 ? 'DOUBLE' : 'BUST' }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- ladder: light the rung at the current double count -->
          <div
            class="l21-gamble-ladder"
            aria-hidden="true"
          >
            <span
              v-for="r in (GAMBLE_CAP + 1)"
              :key="r"
              class="l21-rung"
              :class="{ 'l21-rung-on': (r - 1) === bj.gambleCount.value }"
            >×{{ 2 ** (r - 1) }}</span>
          </div>

          <div class="l21-controls">
            <button
              class="l21-btn l21-btn-gstop"
              data-test="gamble-stop"
              :disabled="!bj.canGambleStop.value"
              aria-label="Stop the bonus reel — double or bust"
              @click="bj.gambleStop()"
            >
              Stop
              <small>double or bust</small>
            </button>
            <button
              class="l21-btn l21-btn-cash"
              data-test="gamble-cash"
              :disabled="!bj.canGambleCashOut.value"
              aria-label="Cash out the blackjack bonus"
              @click="bj.gambleCashOut()"
            >
              Cash Out
              <small>keep {{ bj.gambleAmountDollars.value }}</small>
            </button>
          </div>

          <div class="l21-gamble-cap">
            Land <b>×2</b> → the amount doubles and the reel spins again (up to 3 doubles).
            Land <i>BUST</i> → lose it all. Nothing is locked until you choose.
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── CSS custom props (matches demo palette) ── */
.l21-surface {
  --gold:    #ffd24a;
  --gold-dk: #b8860b;
  --felt:    #0c4a37;
  --felt-dk: #04221a;
  --cyan:    #38e8ff;
  --red:     #ff3b5c;
  --green:   #46e08a;

  max-width: 940px;
  margin: 0 auto;
  padding: 12px 12px 18px;
  position: relative;
  background: linear-gradient(180deg, #15392e, #0a2a20);
  border-radius: 22px;
  border: 3px solid var(--gold-dk);
  box-shadow: 0 0 0 6px #1c1206, 0 0 60px rgba(0,0,0,.6), inset 0 0 80px rgba(0,0,0,.45);
}

/* ── Bulb row ── */
.l21-bulbs {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 2px 0 6px;
}
.l21-bulb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6c8, var(--gold) 45%, var(--gold-dk));
  box-shadow: 0 0 8px var(--gold);
  animation: l21-tw 1.2s infinite alternate;
}
.l21-bulb:nth-child(2n) { animation-delay: .3s; }
.l21-bulb:nth-child(3n) { animation-delay: .6s; }
@keyframes l21-tw {
  from { opacity: .35; }
  to   { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .l21-bulb { animation: none !important; }
}

/* ── LUCKY 21 marquee ── */
.l21-marquee {
  font-family: 'Bungee', sans-serif;
  text-align: center;
  font-size: clamp(34px, 8vw, 62px);
  line-height: 1;
  letter-spacing: 2px;
  background: linear-gradient(180deg, #fff6c8, var(--gold) 45%, var(--gold-dk));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 #5a3c00);
  animation: l21-glow 2.2s ease-in-out infinite alternate;
}
@keyframes l21-glow {
  from { filter: drop-shadow(0 2px 0 #5a3c00) drop-shadow(0 0 6px rgba(255,210,74,.4)); }
  to   { filter: drop-shadow(0 2px 0 #5a3c00) drop-shadow(0 0 22px rgba(255,210,74,.85)); }
}
@media (prefers-reduced-motion: reduce) {
  .l21-marquee { animation: none !important; filter: drop-shadow(0 2px 0 #5a3c00); }
}

.l21-sub {
  text-align: center;
  letter-spacing: 4px;
  font-size: 11px;
  color: var(--gold);
  opacity: .85;
  margin: 2px 0 12px;
  text-transform: uppercase;
}

/* ── Display panels ── */
.l21-displays {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.l21-panel {
  flex: 1;
  border: 2px solid #11352a;
  border-radius: 14px;
  padding: 9px 16px 13px;
  min-height: 84px;
  background: linear-gradient(180deg, #05140f, #020a07);
  box-shadow: inset 0 0 26px rgba(0,0,0,.8);
}
.l21-cap {
  font-size: 10px;
  letter-spacing: 3px;
  color: #7fd9bf;
  text-transform: uppercase;
  opacity: .8;
  margin-bottom: 4px;
}
.l21-num {
  font-family: 'Orbitron', monospace;
  font-weight: 700;
  line-height: 1.12;
}
.l21-panel-total .l21-num {
  font-size: clamp(26px, 5vw, 40px);
  letter-spacing: 3px;
  color: #eafff9;
  text-shadow: 0 0 7px rgba(56,232,255,.5);
}
/* Demo: .alt class on the soft "or 17" span */
.l21-panel-total .l21-num :deep(.alt) {
  color: #8fefff;
  opacity: .8;
  letter-spacing: 1px;
}
.l21-panel-bank {
  border-color: var(--gold-dk);
  background: linear-gradient(180deg, #2a1c02, #120c00);
}
.l21-panel-bank .l21-cap { color: var(--gold); }
.l21-panel-bank .l21-num {
  font-weight: 900;
  font-size: clamp(30px, 7vw, 52px);
  letter-spacing: 1px;
  background: linear-gradient(180deg, #fff6c8, var(--gold) 50%, var(--gold-dk));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.l21-betref {
  font-size: 10px;
  color: #d8b86a;
  letter-spacing: 1.5px;
  margin-top: 4px;
  text-transform: uppercase;
}

/* ── 5 reel grid ── */
.l21-reels {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 9px;
}
.l21-reel {
  background: #02100c;
  border: 2px solid #1d4a3b;
  border-radius: 12px;
  padding: 7px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  transition: opacity .3s;
}
.l21-reel-next  { border-color: var(--gold); box-shadow: 0 0 16px rgba(255,210,74,.5); }
.l21-reel-dead  { opacity: .22; }
.l21-reel-name {
  font-size: 9px;
  letter-spacing: .5px;
  color: #86b9aa;
  text-transform: uppercase;
  min-height: 20px;
  text-align: center;
  display: flex;
  align-items: center;
}
.l21-reel-next .l21-reel-name { color: var(--gold); }

/* ── Reel window ── */
.l21-window {
  width: 100%;
  height: 118px;
  border-radius: 8px;
  background: #05100d;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 16px rgba(0,0,0,.9);
  display: flex;
  align-items: center;
  justify-content: center;
}
.l21-reel-locked .l21-window {
  box-shadow: inset 0 0 0 2px var(--gold), inset 0 0 18px rgba(255,210,74,.35);
}
.l21-window-dead {
  box-shadow: inset 0 0 22px #000;
  background: #030a08;
}

/* Gold center payline */
.l21-payline {
  position: absolute;
  left: 6px;
  right: 6px;
  top: 50%;
  height: 2px;
  transform: translateY(-1px);
  background: linear-gradient(90deg, transparent, rgba(255,210,74,.55), transparent);
  z-index: 3;
  pointer-events: none;
}

.l21-locked-card {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Spinning strip ── */
.l21-strip {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: blur(.3px);
}
.l21-strip-card { margin-bottom: 12px; }

@keyframes l21-scroll {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
.l21-strip-spin {
  animation: l21-scroll 2.1s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .l21-strip-spin { animation: none !important; filter: none; }
}

/* cocktail tags — what each reel can land */
.l21-cocktail {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
  min-height: 18px;
}
.l21-tag {
  font-size: 8px;
  padding: 2px 4px;
  border-radius: 5px;
  background: #0d2d24;
  border: 1px solid #1d4a3b;
  color: #9fe0cd;
}
.l21-tag-danger  { color: #ffb3bf; border-color: #5a2230; }
.l21-tag-good    { color: #e7c9ff; border-color: #4a2a6b; }
.l21-tag-charlie { color: var(--gold); border-color: var(--gold-dk); }

/* ── Result Modal ── */
.l21-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2,10,7,.82);
  backdrop-filter: blur(4px);
  z-index: 50;
  padding: 20px;
}
.l21-modal-enter-active,
.l21-modal-leave-active { transition: opacity .25s; }
.l21-modal-enter-from,
.l21-modal-leave-to { opacity: 0; }

.l21-rcard {
  max-width: 580px;
  width: 100%;
  border-radius: 22px;
  padding: 28px 24px;
  text-align: center;
  border: 3px solid var(--gold-dk);
  background: linear-gradient(180deg, #15392e, #0a2a20);
  box-shadow: 0 0 0 5px #1c1206, 0 0 70px rgba(0,0,0,.7);
}
.l21-rcard-win     { border-color: var(--green); }
.l21-rcard-bust    { border-color: var(--red); }
.l21-rcard-charlie { border-color: var(--gold); }

.l21-rtitle {
  font-family: 'Bungee', sans-serif;
  font-size: clamp(32px, 8vw, 56px);
  line-height: 1.05;
  margin-bottom: 6px;
  color: #eafff9;
}
.l21-rcard-win     .l21-rtitle { color: var(--green); text-shadow: 0 0 20px rgba(70,224,138,.6); }
.l21-rcard-bust    .l21-rtitle { color: var(--red);   text-shadow: 0 0 20px rgba(255,59,92,.6); }
.l21-rcard-charlie .l21-rtitle { color: var(--gold);  text-shadow: 0 0 24px rgba(255,210,74,.7); }

/* Recap row */
.l21-recap {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin: 14px 0 4px;
  flex-wrap: wrap;
}
.l21-rr { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.l21-rrn { font-size: 9px; color: #7fd9bf; letter-spacing: 1px; opacity: .8; }

/* Recap cards scaled to 44×62 as in demo */
.l21-recap-card {
  /* The demo uses 44×62 recap cards: 44/60 = 0.733 scale of the full 60×86 card */
  transform: scale(0.733);
  transform-origin: top center;
}
.l21-recap-none {
  width: 44px;
  height: 62px;
  border-radius: 6px;
  border: 2px dashed #234b3e;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3a6155;
  font-size: 16px;
}

/* Breakdown chips */
.l21-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 16px 0 10px;
}
.l21-fchip {
  border-radius: 12px;
  padding: 9px 13px;
  background: #02100c;
  border: 2px solid #1d4a3b;
  min-width: 74px;
}
.l21-fchip-mult    { border-color: #4a2a6b; }
.l21-fchip-charlie { border-color: var(--gold-dk); }
.l21-fchip-danger  { border-color: #5a2230; }
.l21-fl {
  font-size: 9px;
  letter-spacing: 1.2px;
  color: #7fd9bf;
  text-transform: uppercase;
}
.l21-fv {
  font-family: 'Orbitron', monospace;
  font-weight: 800;
  font-size: 21px;
  color: #eafff9;
}
.l21-fchip-mult    .l21-fv { color: #d9b3ff; }
.l21-fchip-charlie .l21-fv { color: var(--gold); }
.l21-fchip-danger  .l21-fv { color: #ff6478; }
.l21-fop {
  font-family: 'Orbitron', monospace;
  font-weight: 900;
  font-size: 20px;
  color: #9fd9c8;
}

/* Dollar payout hero */
.l21-ramount {
  font-family: 'Orbitron', monospace;
  font-weight: 900;
  font-size: clamp(48px, 14vw, 88px);
  line-height: 1;
  margin: 6px 0 2px;
}
.l21-rcard-win .l21-ramount,
.l21-rcard-charlie .l21-ramount {
  background: linear-gradient(180deg, #fff6c8, var(--gold) 50%, var(--gold-dk));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.l21-rcard-bust .l21-ramount { color: #ff6478; }

.l21-rsub {
  font-size: 12px;
  color: #9fd9c8;
  margin-bottom: 20px;
  letter-spacing: 1px;
}

/* ── Live message line ── */
.l21-msg {
  text-align: center;
  min-height: 26px;
  margin: 12px 0 4px;
  font-family: 'Bungee', sans-serif;
  font-size: 18px;
  letter-spacing: 1px;
  color: #eafff9;
}
.l21-msg-good { color: var(--green); }
.l21-msg-bad  { color: var(--red); }
.l21-msg-gold { color: var(--gold); }

/* ── STOP / CASH OUT controls (in-cabinet) ── */
.l21-controls {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}
.l21-btn {
  flex: 1;
  border: none;
  border-radius: 14px;
  padding: 15px;
  font-weight: 900;
  font-size: 17px;
  letter-spacing: 2px;
  cursor: pointer;
  text-transform: uppercase;
  font-family: 'Bungee', sans-serif;
  transition: transform .08s;
  display: flex;
  flex-direction: column;
  align-items: center;
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
.l21-btn-stop {
  background: linear-gradient(180deg, #ffd76b, #e0890f);
  color: #2a1500;
  box-shadow: 0 4px 0 #8a4f00, 0 0 26px rgba(255,160,30,.55);
}
.l21-btn-cash {
  background: linear-gradient(180deg, #7bffb0, #16a85a);
  color: #04240f;
  box-shadow: 0 4px 0 #0a5e30, 0 0 26px rgba(40,220,120,.5);
}

/* Play Again (in the result modal) — blue, matches the demo's .btn.again */
.l21-btn-again {
  flex: 0 0 auto;
  min-width: 220px;
  margin-top: 4px;
  background: linear-gradient(180deg, #cfe7ff, #6aa6e6);
  color: #06243f;
  box-shadow: 0 4px 0 #1d4f86;
}

/* ── Foot explainer ── */
.l21-foot {
  margin-top: 14px;
  text-align: center;
  font-size: 11px;
  color: #9fd9c8;
  line-height: 1.6;
}
.l21-foot b { color: var(--gold); }

@media (max-width: 420px) {
  .l21-controls { flex-direction: column; }
}

/* ── Double-or-nothing bonus overlay (chrome, ported from bonus-reel-spin.html) ── */
.l21-gamble-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2,10,7,.82);
  backdrop-filter: blur(4px);
  z-index: 60;
  padding: 20px;
}

/* the chromed metallic frame (mockup .dz) */
.l21-gamble {
  width: 100%;
  max-width: 380px;
  border-radius: 16px;
  padding: 14px 16px 16px;
  background: linear-gradient(180deg, #f4f7fa 0%, #c6cfd8 16%, #7e8995 50%, #aab4c0 80%, #e8eef2 100%);
  border: 2px solid #e2e8ee;
  box-shadow: 0 0 0 2px #444c56, 0 14px 40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.85);
}
.l21-gamble-title {
  text-align: center;
  font-family: 'Bungee', 'Arial Black', sans-serif;
  font-size: 22px;
  color: #0a5e30;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  line-height: 1;
}
.l21-gamble-online {
  text-align: center;
  font-family: 'Orbitron', monospace;
  font-weight: 800;
  font-size: 12px;
  color: #2b323a;
  margin: 2px 0 10px;
}
.l21-gamble-online b { color: var(--gold-dk); }

/* the spinning reel window (mockup .dzwin) */
.l21-gamble-window {
  position: relative;
  width: 130px;
  height: 150px;
  margin: 0 auto;
  border-radius: 10px;
  overflow: hidden;
  background: #05100d;
  box-shadow: inset 0 0 16px #000, 0 0 0 3px #cdd6de, 0 0 0 5px #4a525c;
}
.l21-gamble-window::after {
  content: "";
  position: absolute;
  left: 6px;
  right: 6px;
  top: 50%;
  height: 3px;
  transform: translateY(-1.5px);
  z-index: 3;
  background: linear-gradient(90deg, transparent, rgba(255,210,74,.9), transparent);
}
.l21-gamble-strip {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* faces (mockup .face): height 64 + margin 4*2 = 72px each; the strip duplicates
   4 faces, so the .l21-strip-spin translateY(-50%) loops seamlessly. */
.l21-gamble-face {
  width: 108px;
  height: 64px;
  margin: 4px 0;
  border-radius: 8px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Bungee', 'Arial Black', sans-serif;
  box-shadow: inset 0 0 10px rgba(0,0,0,.5);
}
.l21-gamble-face b { line-height: 1; }
.l21-gamble-face span { font-size: 8px; letter-spacing: 1.5px; }
.l21-gamble-x2 {
  background: linear-gradient(180deg, #7bffb0, #0f8f48);
  color: #04240f;
}
.l21-gamble-x2 b { font-size: 26px; }
.l21-gamble-bust {
  background: linear-gradient(180deg, #ff7d92, #cf1c39);
  color: #fff;
}
.l21-gamble-bust b { font-size: 22px; }

/* ladder (mockup .ladder / .rung) */
.l21-gamble-ladder {
  display: flex;
  gap: 4px;
  justify-content: center;
  margin: 12px 0 4px;
}
.l21-rung {
  font-family: 'Orbitron', monospace;
  font-weight: 700;
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 20px;
  background: #39404a;
  color: #aeb8c2;
  border: 1px solid #596470;
}
.l21-rung-on {
  background: linear-gradient(180deg, #fff6c8, var(--gold));
  color: #3a2400;
  border-color: var(--gold-dk);
}

/* STOP(red) / CASH(green) gamble buttons (mockup .btn.stop / .btn.cash) */
.l21-btn-gstop {
  background: linear-gradient(180deg, #ff8aa0, #cf1c39);
  color: #fff;
  box-shadow: 0 4px 0 #7a0f20;
}

.l21-gamble-cap {
  text-align: center;
  font-size: 10px;
  color: #2b323a;
  margin-top: 12px;
  line-height: 1.5;
}
.l21-gamble-cap b { color: #0a5e30; }
.l21-gamble-cap i { color: #cf1c39; font-style: normal; }
</style>
