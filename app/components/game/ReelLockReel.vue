<!-- app/components/game/ReelLockReel.vue -->
<!-- Stop & Lock 777 — the floor's "big daddy" cash-collect cabinet. Ports the -->
<!-- approved vault-v4-bigdaddy mockup: brushed-steel frame, gold bezel + rivets, -->
<!-- marquee bulbs, a FEATURED crown, three giant vault-7s (the bonus meter) -->
<!-- flanked by vault wheels, a 5×4 beveled-chrome grid, five 3-D metal STOP keys, -->
<!-- and a metal deck plate. Reels spin nonstop until each is STOPPED + locked. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLockReel } from '~/composables/useLockReel'

const sl = useLockReel()

// A short, representative spin strip per reel column (the symbols that scroll
// while a column is live). Decorative only (aria-hidden) — it never reveals the
// real draw, which lands when the column is STOPPED.
const spinStrips = computed((): string[][] => {
  const d = sl.def.value
  if (d === null) return [[], [], [], [], []]
  // a lively 8-token sample per column (mostly cash/7 + a little blank texture)
  const sample = ['7', '$', 'K', '$', '7', '·', '$', '7']
  return d.reels.map(() => sample.slice())
})

// per-column spin speed (visual only; staggered so the five reels don't lock-step)
const REEL_SPIN_MS = [560, 600, 520, 640, 580] as const

function cellClass(kind: string): string {
  if (kind === 'cash') return 'bd-cell-cash'
  if (kind === 'prize') return 'bd-cell-prize'
  if (kind === 'seven') return 'bd-cell-seven'
  return ''
}
</script>

<template>
  <div
    v-if="sl.lockState.value !== null || sl.phase.value === 'idle'"
    class="bd"
    data-test="sl-surface"
  >
    <div class="bd-cab">
      <span
        class="bd-rivet bd-tl"
        aria-hidden="true"
      />
      <span
        class="bd-rivet bd-tr"
        aria-hidden="true"
      />
      <span
        class="bd-rivet bd-bl"
        aria-hidden="true"
      />
      <span
        class="bd-rivet bd-br"
        aria-hidden="true"
      />
      <span
        class="bd-rivet bd-tm"
        aria-hidden="true"
      />
      <span
        class="bd-rivet bd-bm"
        aria-hidden="true"
      />

      <div class="bd-gold-edge">
        <!-- marquee bulbs -->
        <div
          class="bd-bulbs"
          aria-hidden="true"
        >
          <span
            v-for="b in 11"
            :key="b"
            class="bd-bulb"
          />
        </div>

        <!-- gold crown -->
        <div class="bd-crown">
          <div
            class="bd-feat"
            aria-hidden="true"
          >
            ★ FEATURED ★
          </div>
          <div
            class="bd-title"
            aria-label="Stop and Lock 777"
          >
            STOP &amp; LOCK 777
          </div>
        </div>

        <!-- vault door: three giant 7s (the bonus meter) flanked by wheels -->
        <div
          class="bd-vault"
          role="img"
          :aria-label="`Vault 7 meter: ${sl.sevenCount.value >= 3 ? 3 : sl.sevenCount.value} of 3 sevens locked`"
        >
          <span
            class="bd-wheel"
            aria-hidden="true"
          />
          <div
            class="bd-sevens"
            data-test="seven-meter"
          >
            <div
              v-for="(lamp, li) in sl.sevenLamps.value"
              :key="li"
              class="bd-vreel"
              :class="{ 'bd-locked': lamp.lit, 'bd-spin': lamp.next }"
              :data-test="`seven-${li}`"
            >
              <div
                v-if="lamp.lit"
                class="bd-face"
              >
                7
              </div>
              <div
                v-else-if="lamp.next"
                class="bd-vcol"
                aria-hidden="true"
              >
                <span
                  v-for="(t, ti) in ['7', 'K', '6', '$', '7', 'K', '6', '$']"
                  :key="ti"
                >{{ t }}</span>
              </div>
              <div
                v-else
                class="bd-face bd-face-dim"
              >
                7
              </div>
            </div>
          </div>
          <span
            class="bd-wheel"
            aria-hidden="true"
          />
        </div>
        <div
          class="bd-bonus-line"
          aria-hidden="true"
        >
          ONE MORE 7 → BONUS SPINS
          <small>land three 7s to crack the vault — free spins, locked cash stays, 7s turn sticky</small>
        </div>

        <!-- 5×4 beveled cash grid -->
        <div
          class="bd-grid"
          role="img"
          :aria-label="`5 by ${sl.rows.value} cash grid; ${sl.idx.value} of 5 reels locked; ${sl.collectDollars.value} locked`"
        >
          <template
            v-for="(row, r) in sl.gridRows.value"
            :key="r"
          >
            <div
              v-for="(cell, c) in row"
              :key="`${r}-${c}`"
              class="bd-cell"
              :class="[cellClass(cell.kind), { 'bd-lock': cell.locked && cell.kind !== 'blank' }]"
              :data-test="`cell-${r}-${c}`"
            >
              <!-- locked cell: show its banked face -->
              <span
                v-if="cell.locked"
                class="bd-cell-face"
              >{{ cell.text }}</span>
              <!-- live column: a scrolling strip -->
              <div
                v-else
                class="bd-ccol"
                :style="{ animationDuration: `${REEL_SPIN_MS[c]}ms` }"
                aria-hidden="true"
              >
                <span
                  v-for="(t, ti) in spinStrips[c]"
                  :key="ti"
                >{{ t }}</span>
                <span
                  v-for="(t, ti) in spinStrips[c]"
                  :key="`b-${ti}`"
                >{{ t }}</span>
              </div>
            </div>
          </template>
        </div>
        <div
          class="bd-tag"
          aria-hidden="true"
        >
          ↓ reels spin nonstop — hit STOP to lock each one
        </div>

        <!-- live message -->
        <div
          class="bd-msg"
          :class="sl.message.value.tone ? `bd-msg-${sl.message.value.tone}` : ''"
          data-test="sl-msg"
          aria-live="polite"
        >
          {{ sl.message.value.text }}
        </div>

        <!-- five 3-D metal STOP keys (one per reel; the live one pulses gold) -->
        <div
          class="bd-stops"
          role="group"
          aria-label="Stop keys"
        >
          <button
            v-for="i in 5"
            :key="i - 1"
            class="bd-stop"
            :class="{ 'bd-hot': sl.liveReel.value === (i - 1) }"
            :disabled="!sl.canStop.value || sl.isBonus.value || sl.liveReel.value !== (i - 1)"
            :aria-label="`Stop and lock reel ${i}`"
            :data-test="`stop-${i}`"
            @click="sl.stop()"
          >
            STOP
          </button>
        </div>

        <!-- metal deck plate: Bet / Min / Collect -->
        <div class="bd-deck">
          <div>
            <div class="bd-lab">
              Bet
            </div>
            <div class="bd-val">
              {{ sl.betDollars.value }}
            </div>
          </div>
          <div>
            <div class="bd-lab">
              Min
            </div>
            <div class="bd-val">
              {{ sl.minDollars.value }}
            </div>
          </div>
          <div class="bd-collect">
            <div class="bd-lab">
              Collect
            </div>
            <div
              class="bd-val"
              data-test="collect"
            >
              {{ sl.collectDollars.value }}
            </div>
          </div>
        </div>

        <!-- bet chips -->
        <div
          class="bd-bets"
          role="group"
          aria-label="Bet amount"
        >
          <button
            v-for="chip in sl.betChips.value"
            :key="chip.coins"
            class="bd-chip"
            :class="{ 'bd-chip-on': chip.active }"
            :aria-pressed="chip.active"
            :disabled="sl.isLive.value"
            :data-test="`bet-${chip.coins}`"
            @click="sl.selectBet(chip.coins)"
          >
            {{ chip.dollars }}
          </button>
        </div>
      </div>
    </div>

    <!-- bonus presentation: the vault cracks open into the free-spin feature -->
    <div
      class="bd-bonus-slot"
      aria-live="polite"
    >
      <Transition name="bd-fade">
        <div
          v-if="sl.isBonus.value"
          class="bd-bonus"
          data-test="bonus"
        >
          <div
            class="bd-bonus-crown"
            aria-hidden="true"
          >
            ⚡ 777 VAULT CRACKED ⚡
          </div>
          <div class="bd-bonus-head">
            FREE STOP &amp; LOCK
          </div>
          <div class="bd-bonus-stats">
            <div class="bd-bstat">
              <div class="bd-lab">
                Respins
              </div>
              <div
                class="bd-bstat-num"
                data-test="bonus-respins"
              >
                {{ sl.respinsLeft.value }}
              </div>
            </div>
            <div class="bd-bstat">
              <div class="bd-lab">
                Locked
              </div>
              <div class="bd-bstat-num bd-bstat-gold">
                {{ sl.collectDollars.value }}
              </div>
            </div>
          </div>
          <div class="bd-bonus-note">
            Every empty cell respins off the dense vault reels — locked cash stays,
            any new lock resets the respins. Fill all
            {{ 5 * sl.rows.value }} cells for the <b>GRAND</b>.
          </div>
          <button
            class="bd-stop bd-hot bd-bonus-spin"
            :disabled="!sl.canBonusStop.value"
            data-test="bonus-spin"
            aria-label="Respin the vault"
            @click="sl.stop()"
          >
            RESPIN
          </button>
        </div>
      </Transition>
    </div>

    <!-- result: collected $ / GRAND with a Play Again button -->
    <div
      class="bd-result-slot"
      aria-live="polite"
    >
      <Transition name="bd-fade">
        <div
          v-if="sl.resultOutcome.value"
          class="bd-result"
          :class="{ 'bd-result-grand': sl.resultOutcome.value.kind === 'grand' }"
          data-test="result"
        >
          <div
            class="bd-rtitle"
            data-test="result-title"
          >
            {{ sl.resultOutcome.value.title }}
          </div>
          <div
            class="bd-ramount"
            data-test="result-amount"
          >
            {{ sl.resultOutcome.value.amountDollars }}
          </div>
          <div class="bd-rsub">
            {{ sl.resultOutcome.value.sub }}
          </div>
          <button
            class="bd-stop bd-again"
            data-test="play-again"
            @click="sl.playAgain()"
          >
            PLAY AGAIN
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.bd { font-family: 'SF Pro Display', -apple-system, Arial, sans-serif; }

/* ===== outer steel cabinet ===== */
.bd-cab {
  max-width: 500px;
  margin: 0 auto;
  position: relative;
  border-radius: 22px;
  padding: 16px;
  background: linear-gradient(180deg, #e8edf2 0%, #b3bcc7 16%, #828c98 48%, #525a65 82%, #363d47 100%);
  box-shadow: 0 24px 50px rgba(0,0,0,.6), 0 0 0 2px #1a1f27, inset 0 2px 2px rgba(255,255,255,.6), inset 0 -3px 6px rgba(0,0,0,.5);
}
.bd-gold-edge {
  border-radius: 16px;
  padding: 12px 12px 14px;
  position: relative;
  background: linear-gradient(180deg, #1a1f27, #0c0f15);
  box-shadow: inset 0 0 0 3px #b8860b, inset 0 0 0 5px #6b4a08, inset 0 0 34px rgba(0,0,0,.8);
}

/* rivets */
.bd-rivet {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fdfefe, #9aa3ae 55%, #454c56);
  box-shadow: 0 1px 1px rgba(0,0,0,.6);
}
.bd-tl { top: 7px; left: 7px; }
.bd-tr { top: 7px; right: 7px; }
.bd-bl { bottom: 7px; left: 7px; }
.bd-br { bottom: 7px; right: 7px; }
.bd-tm { top: 7px; left: 50%; margin-left: -4px; }
.bd-bm { bottom: 7px; left: 50%; margin-left: -4px; }

/* ===== marquee bulbs ===== */
.bd-bulbs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 7px;
}
.bd-bulb {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6c8, #ffd24a 45%, #b8860b);
  box-shadow: 0 0 8px #ffd24a;
  animation: bd-tw 1.1s infinite alternate;
}
.bd-bulb:nth-child(2n) { animation-delay: .3s; }
.bd-bulb:nth-child(3n) { animation-delay: .6s; }
@keyframes bd-tw {
  from { opacity: .35; }
  to   { opacity: 1; }
}

/* ===== gold crown ===== */
.bd-crown {
  text-align: center;
  margin-bottom: 9px;
}
.bd-feat {
  display: inline-block;
  font-family: 'Bungee', sans-serif;
  font-size: 10px;
  letter-spacing: 4px;
  color: #2a1500;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 50%, #b8860b);
  padding: 3px 16px;
  border-radius: 999px;
  box-shadow: 0 0 14px rgba(255,210,74,.7), 0 2px 0 #5a3c00;
  margin-bottom: 6px;
}
.bd-title {
  font-family: 'Bungee', sans-serif;
  font-size: clamp(26px, 7.5vw, 46px);
  line-height: .95;
  letter-spacing: 1px;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 42%, #9c7212);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 #4a3200) drop-shadow(0 0 10px rgba(255,210,74,.5));
}

/* ===== vault door with side wheels ===== */
.bd-vault {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px 0 6px;
}
.bd-wheel {
  width: clamp(34px, 9vw, 46px);
  height: clamp(34px, 9vw, 46px);
  border-radius: 50%;
  flex: none;
  background: conic-gradient(from 0deg, #cfd6de, #8a929d, #cfd6de, #8a929d, #cfd6de);
  box-shadow: 0 0 0 3px #5a626d, inset 0 0 8px rgba(0,0,0,.6), 0 2px 4px rgba(0,0,0,.5);
  position: relative;
}
.bd-wheel::after {
  content: "";
  position: absolute;
  inset: 34%;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, #fff, #aab2bd 60%, #5a626d);
}
.bd-sevens {
  display: flex;
  gap: 9px;
  padding: 8px;
  border-radius: 12px;
  background: linear-gradient(180deg, #10131a, #05070b);
  box-shadow: inset 0 0 0 3px #b8860b, inset 0 0 18px rgba(0,0,0,.9);
}
.bd-vreel {
  width: clamp(46px, 13vw, 64px);
  height: clamp(62px, 17vw, 88px);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: linear-gradient(180deg, #1a1d24, #05070b);
  box-shadow: inset 0 0 16px rgba(0,0,0,.9), 0 0 0 3px #cfd6de, 0 0 0 5px #6b4a08;
}
.bd-face {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Bungee', sans-serif;
  font-style: italic;
  font-size: clamp(34px, 10vw, 54px);
  color: #ffd24a;
  text-shadow: 0 0 16px rgba(255,210,74,.7);
}
.bd-face-dim { color: #3a3f49; text-shadow: none; }
.bd-locked {
  box-shadow: inset 0 0 16px rgba(0,0,0,.9), 0 0 0 3px #ffd24a, 0 0 18px rgba(255,210,74,.6);
}
.bd-vcol {
  display: flex;
  flex-direction: column;
  animation: bd-scroll .4s linear infinite;
}
.bd-vcol span {
  height: clamp(62px, 17vw, 88px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Bungee', sans-serif;
  font-style: italic;
  font-size: clamp(30px, 9vw, 48px);
  color: #e3cc92;
  filter: blur(.5px);
}
@keyframes bd-scroll {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
.bd-bonus-line {
  text-align: center;
  font-family: 'Bungee', sans-serif;
  font-size: 13px;
  letter-spacing: 1px;
  color: #ffd24a;
  margin: 2px 0 9px;
}
.bd-bonus-line small {
  display: block;
  font-family: 'SF Pro Display', sans-serif;
  font-weight: 600;
  font-size: 9px;
  letter-spacing: .5px;
  color: #9aa0ab;
  margin-top: 2px;
}

/* ===== beveled cash grid ===== */
.bd-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
  padding: 8px;
  border-radius: 12px;
  background: linear-gradient(180deg, #0c0f15, #05070b);
  box-shadow: inset 0 0 0 2px #5a626d, inset 0 0 18px rgba(0,0,0,.9);
}
.bd-cell {
  aspect-ratio: 1 / 0.86;
  border-radius: 9px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: clamp(11px, 2.6vw, 16px);
  background: linear-gradient(180deg, #262b34, #0e1218);
  color: #737d8e;
  box-shadow: inset 0 2px 1px rgba(255,255,255,.12), inset 0 -3px 5px rgba(0,0,0,.6), 0 0 0 1px #000;
}
.bd-cell-face { position: relative; z-index: 2; }
.bd-lock {
  color: #ffe9a0;
  background: linear-gradient(180deg, #3a2f10, #171208);
  box-shadow: inset 0 2px 1px rgba(255,230,150,.25), 0 0 0 2px #caa44a, 0 0 12px rgba(202,164,74,.5);
}
.bd-cell-seven.bd-lock {
  color: #ffd24a;
  background: linear-gradient(180deg, #3a1010, #1a0707);
  box-shadow: inset 0 2px 1px rgba(255,210,74,.3), 0 0 0 2px #ffd24a, 0 0 14px rgba(255,210,74,.6);
  font-family: 'Bungee', sans-serif;
  font-style: italic;
}
.bd-cell-prize.bd-lock {
  color: #bdf3ff;
  background: linear-gradient(180deg, #103040, #07171f);
  box-shadow: inset 0 2px 1px rgba(120,220,255,.3), 0 0 0 2px #4aa6ca, 0 0 12px rgba(74,166,202,.5);
  font-size: clamp(8px, 2vw, 11px);
}
.bd-ccol {
  display: flex;
  flex-direction: column;
  animation: bd-scroll .52s linear infinite;
}
.bd-ccol span {
  height: clamp(36px, 9vw, 52px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(10px, 2.3vw, 14px);
  color: #8a93a4;
  filter: blur(.45px);
}
.bd-tag {
  font-size: 9.5px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #cfd6de;
  text-align: center;
  margin: 9px 0 0;
  opacity: .85;
}

/* live message */
.bd-msg {
  text-align: center;
  min-height: 22px;
  margin: 9px 0 2px;
  font-family: 'Bungee', sans-serif;
  font-size: 14px;
  letter-spacing: .5px;
  color: #e8edf2;
}
.bd-msg-good { color: #9be7c4; }
.bd-msg-gold { color: #ffd24a; }
.bd-msg-big {
  color: #ffd24a;
  text-shadow: 0 0 12px rgba(255,210,74,.7);
  animation: bd-pulse 1s ease-in-out infinite alternate;
}

/* ===== chunky 3-D metal STOP keys ===== */
.bd-stops {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 9px;
}
.bd-stop {
  text-align: center;
  font-family: 'Bungee', sans-serif;
  font-weight: 900;
  letter-spacing: .5px;
  border: none;
  border-radius: 11px;
  padding: 14px 0;
  font-size: 13px;
  color: #11141b;
  cursor: pointer;
  background: linear-gradient(180deg, #f4f7fa, #c3cbd5 45%, #8a929d);
  box-shadow: 0 6px 0 #4a525c, 0 8px 10px rgba(0,0,0,.5), inset 0 2px 1px rgba(255,255,255,.9);
  transition: transform .07s;
}
.bd-stop:active { transform: translateY(3px); }
.bd-stop:disabled { cursor: not-allowed; opacity: .55; }
.bd-stop.bd-hot {
  color: #3a0a0a;
  background: linear-gradient(180deg, #ffe08a, #f0b43a 45%, #c98a16);
  box-shadow: 0 6px 0 #7a5210, 0 8px 12px rgba(0,0,0,.5), 0 0 20px rgba(255,200,60,.7), inset 0 2px 1px rgba(255,255,255,.8);
  animation: bd-pulse 1s ease-in-out infinite alternate;
  opacity: 1;
}
@keyframes bd-pulse {
  from { filter: brightness(1); }
  to   { filter: brightness(1.18); }
}

/* ===== metal deck plate ===== */
.bd-deck {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 9px 14px;
  border-radius: 10px;
  background: linear-gradient(180deg, #cfd6de, #9aa3ae 55%, #6b737e);
  box-shadow: inset 0 1px 1px rgba(255,255,255,.8), inset 0 -2px 4px rgba(0,0,0,.4);
}
.bd-lab {
  font-size: 9px;
  letter-spacing: 2px;
  color: #3a414b;
  text-transform: uppercase;
  font-weight: 800;
}
.bd-val {
  font-family: 'Orbitron', 'SF Mono', monospace;
  font-weight: 900;
  font-size: 15px;
  color: #11141b;
}
.bd-collect .bd-val { color: #0a6e3a; }

/* bet chips */
.bd-bets {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  justify-content: center;
  margin-top: 10px;
}
.bd-chip {
  min-width: 50px;
  padding: 8px 10px;
  border-radius: 11px;
  cursor: pointer;
  font-family: 'Orbitron', monospace;
  font-weight: 800;
  font-size: 14px;
  color: #11141b;
  background: linear-gradient(180deg, #e3e8ee, #aab2bd);
  border: 2px solid #6b737e;
  transition: transform .08s, border-color .15s, box-shadow .15s;
}
.bd-chip:active { transform: translateY(1px); }
.bd-chip:disabled { opacity: .5; cursor: not-allowed; }
.bd-chip-on {
  border-color: #b8860b;
  color: #2a1500;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 55%, #d39f1c);
  box-shadow: 0 0 14px rgba(255,210,74,.6);
}

/* ===== bonus presentation ===== */
.bd-bonus-slot { margin-top: 14px; }
.bd-bonus {
  max-width: 500px;
  margin: 0 auto;
  border-radius: 18px;
  padding: 18px 18px 20px;
  text-align: center;
  background: linear-gradient(180deg, #2a1c02, #120c00);
  border: 3px solid #b8860b;
  box-shadow: 0 0 0 4px #1a1206, 0 0 40px rgba(255,200,60,.4), inset 0 0 30px rgba(0,0,0,.6);
}
.bd-bonus-crown {
  font-family: 'Bungee', sans-serif;
  font-size: 12px;
  letter-spacing: 2px;
  color: #ffd24a;
  text-shadow: 0 0 12px rgba(255,210,74,.8);
  margin-bottom: 4px;
}
.bd-bonus-head {
  font-family: 'Bungee', sans-serif;
  font-size: clamp(22px, 6vw, 34px);
  line-height: 1;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 45%, #b8860b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 12px;
}
.bd-bonus-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 12px;
}
.bd-bstat {
  flex: 1;
  max-width: 160px;
  border-radius: 12px;
  padding: 8px 10px 10px;
  background: linear-gradient(180deg, #05070b, #020407);
  border: 2px solid #6b4a08;
}
.bd-bstat-num {
  font-family: 'Orbitron', monospace;
  font-weight: 900;
  font-size: 26px;
  color: #e8edf2;
}
.bd-bstat-gold { color: #ffd24a; }
.bd-bonus-note {
  font-size: 11px;
  line-height: 1.6;
  color: #cdb98a;
  margin-bottom: 14px;
}
.bd-bonus-note b { color: #ffd24a; }
.bd-bonus-spin {
  min-width: 200px;
  font-size: 16px;
}

/* ===== result ===== */
.bd-result-slot { margin-top: 14px; }
.bd-result {
  max-width: 500px;
  margin: 0 auto;
  border-radius: 18px;
  padding: 20px 18px;
  text-align: center;
  background: linear-gradient(180deg, #15392e, #0a2a20);
  border: 3px solid #0a6e3a;
  box-shadow: 0 0 0 4px #06150f, 0 0 40px rgba(0,0,0,.6);
}
.bd-result-grand {
  background: linear-gradient(180deg, #2a1c02, #120c00);
  border-color: #ffd24a;
  box-shadow: 0 0 0 4px #1a1206, 0 0 50px rgba(255,200,60,.5);
}
.bd-rtitle {
  font-family: 'Bungee', sans-serif;
  font-size: clamp(24px, 6vw, 40px);
  line-height: 1.05;
  color: #9be7c4;
}
.bd-result-grand .bd-rtitle { color: #ffd24a; text-shadow: 0 0 16px rgba(255,210,74,.7); }
.bd-ramount {
  font-family: 'Orbitron', monospace;
  font-weight: 900;
  font-size: clamp(36px, 11vw, 64px);
  line-height: 1;
  margin: 4px 0 2px;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 50%, #b8860b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.bd-rsub {
  font-size: 11px;
  color: #9fd9c8;
  margin-bottom: 14px;
  letter-spacing: .3px;
}
.bd-result-grand .bd-rsub { color: #cdb98a; }
.bd-again {
  min-width: 200px;
  color: #06243f;
  background: linear-gradient(180deg, #cfe7ff, #6aa6e6);
  box-shadow: 0 6px 0 #1d4f86, 0 8px 10px rgba(0,0,0,.5), inset 0 2px 1px rgba(255,255,255,.7);
}

.bd-fade-enter-active, .bd-fade-leave-active { transition: opacity .25s, transform .25s; }
.bd-fade-enter-from, .bd-fade-leave-to { opacity: 0; transform: translateY(8px); }

/* ===== reduced motion: freeze every spin / bulb / pulse ===== */
@media (prefers-reduced-motion: reduce) {
  .bd-vcol,
  .bd-ccol,
  .bd-bulb,
  .bd-stop.bd-hot,
  .bd-msg-big { animation: none !important; }
  .bd-vcol, .bd-ccol { filter: none; }
  .bd-fade-enter-active, .bd-fade-leave-active { transition: none; }
}
</style>
