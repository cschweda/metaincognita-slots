<!-- app/components/game/ReelBlackjackReel.vue -->
<!-- Flameout 21 — crash reel surface. Visuals match lucky21-crash-v2.html. -->
<script setup lang="ts">
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const fo = useBlackjackReel()

// per-reel spin speed (visual only; matches the demo's gradient)
const REEL_SPIN_MS = [2100, 2100, 1000, 750, 550] as const

const REEL_NAMES = [
  'Reel 1 · deal + climb',
  'Reel 2 · sets velocity',
  'Reel 3 · climb · ~20% crash',
  'Reel 4 · climb · ~33% crash',
  'Reel 5 · CLIMB · ~43% crash'
] as const

type Tag = { text: string, tone: '' | 'good' | 'danger' }
const REEL_COCKTAILS: Tag[][] = [
  [{ text: '+ climb', tone: 'good' }],
  [{ text: 'sets velocity', tone: 'good' }],
  [{ text: 'climb', tone: 'good' }, { text: '~20% crash', tone: 'danger' }],
  [{ text: 'climb', tone: 'good' }, { text: '~33% crash', tone: 'danger' }],
  [{ text: 'climb', tone: 'good' }, { text: '~43% crash', tone: 'danger' }]
]

function isCard(sym: string | null | undefined): boolean {
  return sym !== null && sym !== undefined && sym !== 'CLIMB' && sym !== 'CRASH'
}
</script>

<template>
  <div
    v-if="fo.bjState.value !== null || fo.phase.value === 'idle'"
    class="l21-surface"
    data-test="bj-surface"
  >
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

    <div
      class="l21-marquee"
      aria-label="Flameout 21"
    >
      FLAMEOUT&nbsp;21
    </div>
    <div class="l21-sub">
      The climb starts on reel 1 — your hand sets how steep
    </div>

    <!-- ── Velocity / Multiplier / Cash Out displays ── -->
    <div class="l21-displays">
      <div class="l21-panel l21-panel-vel">
        <div class="l21-cap">
          Velocity
        </div>
        <div
          class="l21-num"
          data-test="vel-display"
        >
          {{ fo.velocityDisplay.value }}
        </div>
        <div class="l21-hand">
          {{ fo.handText.value }}
        </div>
      </div>
      <div class="l21-panel l21-panel-mult">
        <div class="l21-cap">
          Multiplier
        </div>
        <div
          class="l21-num"
          data-test="mult-display"
        >
          {{ fo.multiplierDisplay.value }}
        </div>
      </div>
      <div class="l21-panel l21-panel-bank">
        <div class="l21-cap">
          Cash Out value
        </div>
        <div
          class="l21-num"
          data-test="cash-display"
        >
          {{ fo.cashValueDollars.value }}
        </div>
      </div>
    </div>

    <!-- ── Bet chips (new) ── -->
    <div
      class="l21-bets"
      role="group"
      aria-label="Bet amount"
    >
      <button
        v-for="chip in fo.betChips.value"
        :key="chip.coins"
        class="l21-chip"
        :class="{ 'l21-chip-on': chip.active }"
        :aria-pressed="chip.active"
        :disabled="fo.phase.value === 'spinning'"
        :data-test="`bet-${chip.coins}`"
        @click="fo.selectBet(chip.coins)"
      >
        {{ chip.dollars }}
      </button>
      <button
        class="l21-chip l21-chip-same"
        :disabled="!fo.canDeal.value"
        data-test="same-bet"
        @click="fo.sameBet()"
      >
        Same Bet
      </button>
    </div>

    <!-- ── 5 reel windows ── -->
    <div
      class="l21-reels"
      role="group"
      aria-label="Flameout 21 reels"
    >
      <div
        v-for="i in 5"
        :key="i - 1"
        class="l21-reel"
        :class="{
          'l21-reel-deal': i <= 2,
          'l21-reel-crash': i >= 3,
          'l21-reel-next': fo.phase.value === 'spinning' && fo.idx.value === (i - 1) && fo.landed.value[i - 1] === null,
          'l21-reel-locked': fo.landed.value[i - 1] !== null,
          'l21-reel-dead': fo.phase.value === 'resolved' && fo.landed.value[i - 1] === null
        }"
      >
        <div class="l21-reel-name">
          {{ REEL_NAMES[i - 1] }}
        </div>

        <div
          class="l21-window"
          :class="{ 'l21-window-dead': fo.phase.value === 'resolved' && fo.landed.value[i - 1] === null }"
          role="img"
          :aria-label="`Reel ${i}${fo.landed.value[i - 1] !== null ? ': ' + fo.landed.value[i - 1] : ''}`"
        >
          <div
            v-if="fo.landed.value[i - 1] === null && fo.phase.value !== 'resolved'"
            class="l21-payline"
            aria-hidden="true"
          />

          <!-- locked symbol -->
          <div
            v-if="fo.landed.value[i - 1] !== null"
            class="l21-locked-card"
            data-test="locked-card"
          >
            <GameCardFace
              v-if="isCard(fo.landed.value[i - 1])"
              :symbol="fo.landed.value[i - 1]!"
            />
            <div
              v-else
              class="l21-tile"
              :class="fo.landed.value[i - 1] === 'CRASH' ? 'l21-tile-crash' : 'l21-tile-climb'"
            >
              <span class="l21-tile-glyph">{{ fo.landed.value[i - 1] === 'CRASH' ? '💥' : '▲' }}</span>
              <span class="l21-tile-lab">{{ fo.landed.value[i - 1] === 'CRASH' ? 'CRASH' : 'CLIMB' }}</span>
            </div>
          </div>

          <!-- spinning strip (a hand in progress) -->
          <div
            v-else-if="fo.phase.value === 'spinning' && fo.reelStrips.value[i - 1]"
            class="l21-strip l21-strip-spin"
            :style="{ animationDuration: `${REEL_SPIN_MS[i - 1]}ms` }"
            aria-hidden="true"
          >
            <template
              v-for="pass in 2"
              :key="pass"
            >
              <div
                v-for="(sym, si) in fo.reelStrips.value[i - 1]"
                :key="`${pass}-${si}`"
                class="l21-strip-card"
              >
                <GameCardFace
                  v-if="isCard(sym)"
                  :symbol="sym"
                />
                <div
                  v-else
                  class="l21-tile"
                  :class="sym === 'CRASH' ? 'l21-tile-crash' : 'l21-tile-climb'"
                >
                  <span class="l21-tile-glyph">{{ sym === 'CRASH' ? '💥' : '▲' }}</span>
                  <span class="l21-tile-lab">{{ sym === 'CRASH' ? 'CRASH' : 'CLIMB' }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- idle attract spin -->
          <div
            v-else-if="fo.phase.value === 'idle'"
            class="l21-strip l21-strip-spin"
            :style="{ animationDuration: `${REEL_SPIN_MS[i - 1]}ms` }"
            aria-hidden="true"
          >
            <template
              v-for="pass in 2"
              :key="pass"
            >
              <div
                v-for="(sym, si) in fo.attractStrips.value[i - 1]"
                :key="`${pass}-${si}`"
                class="l21-strip-card"
              >
                <GameCardFace
                  v-if="isCard(sym)"
                  :symbol="sym"
                />
                <div
                  v-else
                  class="l21-tile"
                  :class="sym === 'CRASH' ? 'l21-tile-crash' : 'l21-tile-climb'"
                >
                  <span class="l21-tile-glyph">{{ sym === 'CRASH' ? '💥' : '▲' }}</span>
                  <span class="l21-tile-lab">{{ sym === 'CRASH' ? 'CRASH' : 'CLIMB' }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>

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

    <div
      class="l21-msg"
      :class="fo.message.value.tone ? `l21-msg-${fo.message.value.tone}` : ''"
      data-test="bj-msg"
      aria-live="polite"
    >
      {{ fo.message.value.text }}
    </div>

    <!-- ── STOP / CASH OUT (in-cabinet) ── -->
    <div class="l21-controls">
      <button
        class="l21-btn l21-btn-stop"
        data-test="stop"
        :disabled="!fo.canStop.value"
        :aria-label="fo.phase.value === 'idle' ? 'Stop — deal and start the climb' : 'Stop — lock the next reel'"
        @click="fo.stop()"
      >
        Stop
        <small>{{ fo.stopHint.value }}</small>
      </button>
      <button
        class="l21-btn l21-btn-cash"
        data-test="cash-out"
        :disabled="!fo.canCash.value"
        aria-label="Cash out — bank your multiplier"
        @click="fo.cashOut()"
      >
        Cash Out
        <small>take {{ fo.cashValueDollars.value }}</small>
      </button>
    </div>

    <div class="l21-foot">
      Each card sets the multiplier <b>by your hand</b> — a better hand launches higher;
      a <b>natural 21 launches highest of all</b>.
      Your 2-card total sets the <b>climb velocity</b>. Reels 3–5 multiply your win by that
      velocity… <b>unless they CRASH</b> (~20% → ~33% → ~43%). <b>Cash out any reel</b> to bank
      <b>bet × multiplier</b> before it blows.
    </div>

    <!-- ── In-page result card (replaces the modal; rockets added in Task 4) ── -->
    <div
      class="l21-result-slot"
      aria-live="polite"
    >
      <Transition name="l21-result">
        <div
          v-if="fo.resultOutcome.value"
          class="l21-rcard"
          :class="{
            'l21-rcard-win': fo.resultOutcome.value.kind === 'cash',
            'l21-rcard-topped': fo.resultOutcome.value.kind === 'topped',
            'l21-rcard-crash': fo.resultOutcome.value.kind === 'crash'
          }"
          data-test="result-card"
        >
          <div
            class="l21-rocket-slot"
            aria-hidden="true"
          >
            <svg
              v-if="fo.resultOutcome.value.kind === 'crash'"
              class="l21-result-rocket l21-result-rocket-crash"
              viewBox="0 0 48 48"
              width="46"
              height="46"
            >
              <polygon
                points="24,1 28,16 40,8 34,21 47,24 34,27 40,40 28,32 24,47 20,32 8,40 14,27 1,24 14,21 8,8 20,16"
                fill="#ff7d4a"
              />
              <circle
                cx="24"
                cy="24"
                r="6"
                fill="#7a0f20"
              />
            </svg>
            <svg
              v-else
              class="l21-result-rocket l21-result-rocket-win"
              viewBox="0 0 24 50"
              width="30"
              height="60"
            >
              <path
                d="M12 0 C18 8 19 20 19 30 L5 30 C5 20 6 8 12 0 Z"
                fill="#fff6c8"
                stroke="#b8860b"
                stroke-width="1"
              />
              <circle
                cx="12"
                cy="16"
                r="3.5"
                fill="#46e08a"
              />
              <path
                d="M5 30 L1 40 L7 33 Z M19 30 L23 40 L17 33 Z"
                fill="#16a85a"
              />
            </svg>
          </div>
          <div
            class="l21-rtitle"
            data-test="result-title"
          >
            {{ fo.resultOutcome.value.title }}
          </div>
          <div
            class="l21-ramount"
            data-test="result-amount"
          >
            {{ fo.resultOutcome.value.amountDollars }}
          </div>
          <div class="l21-rsub">
            {{ fo.resultOutcome.value.sub }}
          </div>
          <button
            class="l21-btn l21-btn-again"
            data-test="play-again"
            @click="fo.playAgain()"
          >
            Play Again
          </button>
        </div>
      </Transition>
    </div>
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

/* ── FLAMEOUT 21 marquee ── */
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
  text-align: center;
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

/* Velocity + Multiplier display panels (demo .panel.vel / .panel.mult) */
.l21-panel-vel .l21-num { font-size: clamp(17px, 4vw, 26px); color: #8fefff; text-shadow: 0 0 7px rgba(56, 232, 255, .5); }
.l21-hand { font-size: 11px; color: #9fd9c8; margin-top: 3px; letter-spacing: 1px; }
.l21-panel-mult { border-color: #2f6da0; background: linear-gradient(180deg, #04223a, #02101d); }
.l21-panel-mult .l21-cap { color: var(--cyan); }
.l21-panel-mult .l21-num { font-weight: 900; font-size: clamp(34px, 9vw, 62px); color: #bdf3ff; text-shadow: 0 0 16px rgba(56, 232, 255, .6); }

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

/* Bet chips (new) */
.l21-bets { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 12px; }
.l21-chip {
  min-width: 56px; padding: 9px 12px; border-radius: 12px; cursor: pointer;
  font-family: 'Orbitron', monospace; font-weight: 800; font-size: 15px;
  color: #eafff9; background: linear-gradient(180deg, #0c2c22, #06150f);
  border: 2px solid #1d4a3b; transition: transform .08s, border-color .15s, box-shadow .15s;
}
.l21-chip:active { transform: translateY(1px); }
.l21-chip:disabled { opacity: .45; cursor: not-allowed; }
.l21-chip-on { border-color: var(--gold); color: #fff6c8; box-shadow: 0 0 14px rgba(255, 210, 74, .5); }
.l21-chip-same { font-family: 'Bungee', sans-serif; font-size: 12px; letter-spacing: 1px; color: #06243f; background: linear-gradient(180deg, #cfe7ff, #6aa6e6); border-color: #1d4f86; }

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
.l21-reel-deal  { border-color: #2f6da0; }
.l21-reel-crash { border-color: #5a2230; }
.l21-reel-next  { border-color: var(--gold); box-shadow: 0 0 16px rgba(255,210,74,.5); }
.l21-reel-dead  { opacity: .22; }
.l21-reel-name {
  font-size: 10.5px;
  letter-spacing: .5px;
  color: #86b9aa;
  text-transform: uppercase;
  min-height: 24px;
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

/* CLIMB / CRASH tiles (demo .tile.climb / .tile.crash), sized like a card */
.l21-tile {
  width: 54px; height: 74px; border-radius: 8px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px; box-shadow: inset 0 0 10px rgba(0, 0, 0, .5);
  font-family: 'Orbitron', monospace;
}
.l21-tile-glyph { font-size: 24px; line-height: 1; }
.l21-tile-lab { font-size: 8px; letter-spacing: 1px; font-family: 'Bungee', sans-serif; }
.l21-tile-climb { background: linear-gradient(180deg, #7bffb0, #0f8f48); color: #04240f; }
.l21-tile-crash { background: linear-gradient(180deg, #ff7d92, #cf1c39); color: #fff; }

/* cocktail tags — what each reel can land */
.l21-cocktail {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
  min-height: 18px;
}
.l21-tag {
  font-size: 9px;
  padding: 2px 4px;
  border-radius: 5px;
  background: #0d2d24;
  border: 1px solid #1d4a3b;
  color: #9fe0cd;
}
.l21-tag-danger { color: #ffb3bf; border-color: #5a2230; }
.l21-tag-good   { color: #bff3d2; border-color: #2f8a55; }

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
.l21-msg-cyan { color: var(--cyan); }

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

/* Play Again (in the result card) — blue, matches the demo's .btn.again */
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

/* In-page result card (replaces the modal; static, in normal flow) */
.l21-result-slot { margin-top: 14px; }
.l21-rcard {
  max-width: 560px; margin: 0 auto; border-radius: 22px; padding: 22px 20px; text-align: center;
  border: 3px solid var(--gold-dk); background: linear-gradient(180deg, #15392e, #0a2a20);
  box-shadow: 0 0 0 5px #1c1206, 0 0 50px rgba(0, 0, 0, .6); position: relative;
}
.l21-rcard-win { border-color: var(--green); }
.l21-rcard-topped { border-color: var(--gold); }
.l21-rcard-crash { border-color: var(--red); }
.l21-rocket-slot { position: absolute; top: -34px; left: 50%; transform: translateX(-50%); pointer-events: none; }
.l21-result-rocket-win { filter: drop-shadow(0 0 14px rgba(70, 224, 138, .85)); }
.l21-result-rocket-crash { filter: drop-shadow(0 0 14px rgba(255, 124, 74, .8)); }
.l21-rtitle { font-family: 'Bungee', sans-serif; font-size: clamp(28px, 7vw, 48px); line-height: 1.05; }
.l21-rcard-win .l21-rtitle { color: var(--green); }
.l21-rcard-topped .l21-rtitle { color: var(--gold); }
.l21-rcard-crash .l21-rtitle { color: var(--red); }
.l21-ramount { font-family: 'Orbitron', monospace; font-weight: 900; font-size: clamp(40px, 12vw, 72px); line-height: 1; margin: 6px 0 2px; }
.l21-rcard-win .l21-ramount, .l21-rcard-topped .l21-ramount {
  background: linear-gradient(180deg, #fff6c8, var(--gold) 50%, var(--gold-dk));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.l21-rcard-crash .l21-ramount { color: #ff6478; }
.l21-rsub { font-size: 12px; color: #9fd9c8; margin-bottom: 16px; letter-spacing: .5px; }
.l21-result-enter-active, .l21-result-leave-active { transition: opacity .25s, transform .25s; }
.l21-result-enter-from, .l21-result-leave-to { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) {
  .l21-result-enter-active, .l21-result-leave-active { transition: none; }
}
</style>
