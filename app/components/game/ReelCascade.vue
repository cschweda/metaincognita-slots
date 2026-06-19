<!-- app/components/game/ReelCascade.vue -->
<!-- Temple of Gold — the floor's gaudy, FREE-PLAY cascade cabinet. Runs the real
     engine (via useCascade) but never debits a balance; instead it shows an
     honest House Ledger + a per-spin trick-exposer. Decorative chrome is built
     in (full-cabinet pattern, like the lock-reel cabinet). -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useCascade } from '~/composables/useCascade'
import { useSlotsStore } from '~/stores/slots'

const c = useCascade()
const store = useSlotsStore()

const EMOJI: Record<string, string> = {
  MASK: '🎭', JAGUAR: '🐆', CROWN: '👑', GOLD: '🪙', IDOL: '🗿'
}

function onKey(e: KeyboardEvent): void {
  if (e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return
  const t = e.target as HTMLElement | null
  if (t !== null && ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
  e.preventDefault()
  if (c.phase.value === 'idle') void c.spin()
}

onMounted(() => {
  c.ensure()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

const usd = (credits: number): string => '$' + (credits / 100).toFixed(2)
const usdCents = (cents: number): string => (cents < 0 ? '-$' : '$') + (Math.abs(cents) / 100).toFixed(2)

const ladder = computed(() => c.def.value?.multiplierLadder ?? [])
const busy = computed(() => c.phase.value !== 'idle')
</script>

<template>
  <div
    class="tg"
    :class="{ 'tg-shake': c.cascadeFlash.value.active }"
  >
    <!-- chasing bulbs frame -->
    <span
      class="tg-bulbs"
      aria-hidden="true"
    >
      <span
        v-for="b in 16"
        :key="b"
        class="tg-bulb"
      />
    </span>

    <!-- CASCADE! — the batshit-crazy can't-miss beat -->
    <div
      v-if="c.cascadeFlash.value.active"
      class="tg-cascade"
      aria-hidden="true"
    >
      <span
        v-for="z in 12"
        :key="z"
        class="tg-zap"
      >⚡</span>
      <div class="tg-cascade-burst">
        <span class="tg-cascade-word">CASCADE!</span>
        <span class="tg-cascade-mult">×{{ c.cascadeFlash.value.mult }}</span>
        <span class="tg-cascade-sub">chain {{ c.cascadeFlash.value.chain }} — it keeps paying</span>
      </div>
    </div>

    <header class="tg-head">
      <span
        class="tg-torch tg-torch-l"
        aria-hidden="true"
      >🔥</span>
      <div class="tg-titles">
        <h1 class="tg-title">
          TEMPLE OF GOLD
        </h1>
        <p class="tg-sub">
          The Honest Machine · free play
        </p>
      </div>
      <span
        class="tg-torch tg-torch-r"
        aria-hidden="true"
      >🔥</span>
    </header>

    <!-- climbing GRAND -->
    <div
      class="tg-grand"
      :class="{ 'tg-grand-hit': c.grandHit.value }"
    >
      <span class="tg-grand-label">🗿 GRAND JACKPOT 🗿</span>
      <span class="tg-grand-amt">{{ usd(c.grandMeter.value) }}</span>
    </div>

    <div class="tg-play">
      <!-- cascade ladder -->
      <div
        class="tg-ladder"
        aria-hidden="true"
      >
        <span class="tg-ladder-cap">CASCADE</span>
        <span
          v-for="(m, i) in ladder"
          :key="i"
          class="tg-rung"
          :class="{ 'tg-rung-on': c.chain.value >= ladder.length - i }"
        >×{{ ladder[ladder.length - 1 - i] }}</span>
        <span class="tg-ladder-arrow">▼</span>
      </div>

      <!-- the 5×4 tumbling grid -->
      <div
        class="tg-grid"
        role="grid"
        :aria-label="`Temple of Gold ${c.def.value?.cols ?? 5} by ${c.def.value?.rows ?? 4} grid`"
      >
        <div
          v-for="(col, ci) in c.grid.value"
          :key="ci"
          class="tg-col"
          role="row"
        >
          <div
            v-for="(sym, ri) in col"
            :key="ri"
            class="tg-cell"
            :class="[`tg-cell-${sym.toLowerCase()}`, { 'tg-cell-win': c.winners.value.has(sym) }]"
            role="gridcell"
            :aria-label="c.def.value?.symbols[sym]?.label ?? sym"
          >
            <span class="tg-glyph">{{ EMOJI[sym] ?? '◆' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- win + meters -->
    <div class="tg-meters">
      <div class="tg-meter">
        <span class="tg-meter-k">THIS SPIN</span>
        <span class="tg-meter-v tg-win">{{ usd(c.spinWinCredits.value) }}</span>
      </div>
      <div class="tg-meter">
        <span class="tg-meter-k">MULTIPLIER</span>
        <span class="tg-meter-v">×{{ c.chainMult.value }}</span>
      </div>
      <div class="tg-meter">
        <span class="tg-meter-k">BET</span>
        <span class="tg-meter-v">{{ usdCents(c.betCents.value) }} · free</span>
      </div>
    </div>

    <!-- controls -->
    <div class="tg-controls">
      <button
        class="tg-spin"
        :disabled="busy"
        @click="c.spin()"
      >
        {{ busy ? '…' : '▼ SPIN ▼' }}
      </button>
      <button
        class="tg-sound"
        :aria-pressed="!c.isMuted()"
        @click="c.setMuted(!c.isMuted())"
      >
        {{ c.isMuted() ? '🔇 Sound off' : '🔊 Sound on' }}
      </button>
    </div>

    <!-- the trick-exposer -->
    <div
      class="tg-trick"
      :class="`tg-trick-${c.trick.value.tone}`"
      aria-live="polite"
    >
      {{ c.trick.value.text }}
    </div>

    <!-- the X-ray: the last spin link by link (revealed by the X-ray toggle) -->
    <div
      v-if="store.settings.xray"
      class="tg-xray"
    >
      <span class="tg-xray-cap">🔬 X-RAY — the last spin, link by link</span>
      <template v-if="c.lastTrace.value && c.lastTrace.value.rows.length">
        <div
          v-for="(r, i) in c.lastTrace.value.rows"
          :key="i"
          class="tg-xray-row"
        >
          <span class="tg-xray-chain">chain {{ r.chain }} <b>×{{ r.mult }}</b></span>
          <span class="tg-xray-sym">{{ EMOJI[r.sym] ?? '◆' }} {{ r.count }}× {{ c.def.value?.symbols[r.sym]?.label ?? r.sym }}</span>
          <span class="tg-xray-pay">{{ usdCents(r.payCents) }}</span>
        </div>
        <div
          v-if="c.lastTrace.value.grandCents > 0"
          class="tg-xray-row tg-xray-grand"
        >
          <span class="tg-xray-chain">🗿 GRAND</span>
          <span class="tg-xray-sym">golden idols filled</span>
          <span class="tg-xray-pay">{{ usdCents(c.lastTrace.value.grandCents) }}</span>
        </div>
      </template>
      <span
        v-else
        class="tg-xray-empty"
      >Spin to X-ray the cascade — every link, every multiplier, every cent.</span>
    </div>

    <!-- the honest House Ledger -->
    <div class="tg-ledger">
      <span class="tg-ledger-cap">THE HOUSE LEDGER · real dollars, never "credits"</span>
      <div class="tg-ledger-row">
        <span><b>{{ c.spins.value.toLocaleString() }}</b> spins</span>
        <span>fed <b>{{ usdCents(c.fedCents.value) }}</b></span>
        <span>back <b>{{ usdCents(c.backCents.value) }}</b></span>
        <span :class="c.netCents.value >= 0 ? 'tg-up' : 'tg-down'">
          {{ c.netCents.value >= 0 ? 'up' : 'down' }} <b>{{ usdCents(Math.abs(c.netCents.value)) }}</b>
        </span>
        <span>payback <b>{{ c.fedCents.value > 0 ? c.paybackPct.value.toFixed(1) + '%' : '—' }}</b></span>
      </div>
      <span class="tg-ledger-foot">→ settles toward ~90%. The 10% gap is the house edge — shown as a fact, taken from no one.</span>
    </div>
  </div>
</template>

<style scoped>
.tg {
  position: relative;
  max-width: 760px;
  margin: 0 auto;
  padding: 22px 18px 20px;
  border: 4px solid #b8860b;
  border-radius: 22px;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(255, 215, 90, .18), transparent 55%),
    linear-gradient(180deg, #3a2708, #1c1304 70%, #120c02);
  box-shadow: 0 0 0 5px #2a1c06, 0 0 60px rgba(0, 0, 0, .6), inset 0 0 80px rgba(0, 0, 0, .5);
  color: #fde6b8;
  overflow: hidden;
}

.tg-bulbs {
  position: absolute;
  inset: 7px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  pointer-events: none;
}
.tg-bulb {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff7d6, #ffd24a 45%, #b8860b);
  box-shadow: 0 0 7px #ffd24a;
  animation: tg-tw 1.1s infinite alternate;
}
.tg-bulb:nth-child(3n) { animation-delay: .35s; }
.tg-bulb:nth-child(4n) { animation-delay: .7s; }
@keyframes tg-tw { from { opacity: .35; } to { opacity: 1; } }

.tg-head { display: flex; align-items: center; justify-content: center; gap: 14px; position: relative; }
.tg-torch { font-size: 30px; animation: tg-flicker 1.3s infinite alternate; }
@keyframes tg-flicker { from { opacity: .7; transform: scale(.95) rotate(-3deg); } to { opacity: 1; transform: scale(1.08) rotate(3deg); } }
.tg-titles { text-align: center; }
.tg-title {
  font-family: 'Bungee', sans-serif;
  font-size: clamp(28px, 6.5vw, 52px);
  line-height: 1;
  letter-spacing: 1px;
  background: linear-gradient(180deg, #fff7d6, #ffd24a 45%, #b8860b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 #5a3c00);
}
.tg-sub { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #e8c878; margin-top: 4px; }

.tg-grand {
  margin: 12px auto 14px;
  max-width: 460px;
  text-align: center;
  border: 2px solid #ffd24a;
  border-radius: 12px;
  padding: 6px 10px;
  background: linear-gradient(180deg, #5a3c00, #2a1c06);
  box-shadow: inset 0 0 18px rgba(255, 210, 74, .3), 0 0 20px rgba(255, 200, 60, .25);
}
.tg-grand-label { display: block; font-size: 11px; letter-spacing: 3px; color: #ffe9a6; }
.tg-grand-amt {
  display: block;
  font-family: 'Bungee', sans-serif;
  font-size: clamp(26px, 6vw, 42px);
  color: #fff;
  text-shadow: 0 0 16px rgba(255, 220, 100, .9);
}
.tg-grand-hit { animation: tg-grandflash .5s ease-in-out 6 alternate; }
@keyframes tg-grandflash { from { box-shadow: inset 0 0 18px rgba(255,210,74,.3); } to { box-shadow: inset 0 0 40px rgba(255,240,180,.9), 0 0 50px rgba(255,220,100,.9); } }

.tg-play { display: flex; gap: 12px; align-items: stretch; justify-content: center; }

.tg-ladder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 6px 4px;
  border-radius: 10px;
  background: rgba(0, 0, 0, .3);
  border: 1px solid #6a4a10;
}
.tg-ladder-cap { font-size: 9px; letter-spacing: 2px; color: #e8c878; writing-mode: vertical-rl; transform: rotate(180deg); margin-bottom: 2px; }
.tg-rung {
  font-family: 'Bungee', sans-serif;
  font-size: 13px;
  width: 38px;
  text-align: center;
  padding: 3px 0;
  border-radius: 6px;
  color: #7a5a1a;
  background: #1a1204;
  border: 1px solid #3a2808;
  transition: all .2s;
}
.tg-rung-on {
  color: #2a1500;
  background: linear-gradient(180deg, #fff7d6, #ffd24a);
  box-shadow: 0 0 12px rgba(255, 210, 74, .8);
}
.tg-ladder-arrow { color: #ffd24a; animation: tg-bob 1s infinite alternate; }
@keyframes tg-bob { from { transform: translateY(-2px); } to { transform: translateY(3px); } }

.tg-grid {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: linear-gradient(180deg, #0c0802, #060400);
  box-shadow: inset 0 0 24px rgba(0, 0, 0, .9), 0 0 0 2px #6a4a10;
}
.tg-col { display: flex; flex-direction: column; gap: 6px; }
.tg-cell {
  width: clamp(46px, 11vw, 64px);
  height: clamp(46px, 11vw, 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: linear-gradient(180deg, #2a2008, #16100340);
  box-shadow: inset 0 0 8px rgba(0, 0, 0, .6), 0 1px 0 rgba(255, 220, 120, .15);
  transition: transform .18s, box-shadow .18s, background .18s;
}
.tg-glyph { font-size: clamp(26px, 6.5vw, 38px); line-height: 1; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .6)); }
.tg-cell-win {
  background: linear-gradient(180deg, #fff7d6, #ffcf4a);
  box-shadow: 0 0 18px rgba(255, 215, 90, .95), inset 0 0 10px rgba(255, 255, 255, .6);
  transform: scale(1.08);
  animation: tg-pop .42s ease-in-out;
}
@keyframes tg-pop { 0% { transform: scale(1); } 50% { transform: scale(1.16); } 100% { transform: scale(1.08); } }

.tg-meters { display: flex; justify-content: center; gap: 10px; margin: 14px 0 10px; flex-wrap: wrap; }
.tg-meter {
  min-width: 110px;
  text-align: center;
  padding: 6px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, .35);
  border: 1px solid #6a4a10;
}
.tg-meter-k { display: block; font-size: 10px; letter-spacing: 2px; color: #e8c878; }
.tg-meter-v { display: block; font-family: 'Bungee', sans-serif; font-size: 20px; color: #fde6b8; }
.tg-win { color: #7bffb0; }

.tg-controls { display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 12px; }
.tg-spin {
  font-family: 'Bungee', sans-serif;
  font-size: 22px;
  letter-spacing: 2px;
  padding: 14px 44px;
  border: none;
  border-radius: 14px;
  color: #2a1500;
  background: linear-gradient(180deg, #ffe27a, #e0890f);
  box-shadow: 0 5px 0 #8a4f00, 0 0 26px rgba(255, 170, 40, .5);
  cursor: pointer;
  transition: transform .08s;
}
.tg-spin:hover:not(:disabled) { filter: brightness(1.07); }
.tg-spin:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #8a4f00; }
.tg-spin:disabled { opacity: .55; cursor: default; }
.tg-spin:focus-visible, .tg-sound:focus-visible { outline: 3px solid #ffd24a; outline-offset: 3px; }
.tg-sound {
  font-size: 12px;
  padding: 9px 14px;
  border-radius: 10px;
  color: #fde6b8;
  background: rgba(0, 0, 0, .4);
  border: 1px solid #6a4a10;
  cursor: pointer;
}

.tg-trick {
  margin: 0 auto 12px;
  max-width: 620px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  border: 1px solid;
}
.tg-trick-intro { background: rgba(255, 255, 255, .05); border-color: #6a4a10; color: #e8d6a8; }
.tg-trick-good { background: rgba(40, 160, 90, .14); border-color: #2f8f5a; color: #b6f0cf; }
.tg-trick-bad { background: rgba(200, 70, 40, .14); border-color: #b4562a; color: #f3c8a8; }

.tg-ledger {
  margin: 0 auto;
  max-width: 660px;
  text-align: center;
  padding: 10px 14px;
  border-radius: 12px;
  background: #0a0702;
  border: 1px solid #3a2808;
}
.tg-ledger-cap { display: block; font-size: 10px; letter-spacing: 2px; color: #c9a85e; margin-bottom: 6px; }
.tg-ledger-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; font-size: 13px; font-family: 'DM Mono', monospace; color: #e8d6a8; }
.tg-ledger-row b { color: #fff; }
.tg-up { color: #7bffb0; }
.tg-down { color: #ff9b7b; }
.tg-ledger-foot { display: block; margin-top: 6px; font-size: 11px; color: #b89a58; }

/* ===== CASCADE! — the batshit-crazy can't-miss beat ===== */
.tg-cascade {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: tg-strobe .12s steps(1) infinite;
}
@keyframes tg-strobe {
  0%   { background: radial-gradient(circle at 50% 45%, rgba(255,40,120,.55), rgba(0,0,0,.55) 72%); }
  33%  { background: radial-gradient(circle at 50% 45%, rgba(90,220,255,.55), rgba(0,0,0,.55) 72%); }
  66%  { background: radial-gradient(circle at 50% 45%, rgba(255,220,40,.6), rgba(0,0,0,.55) 72%); }
}
.tg-cascade-burst { text-align: center; z-index: 1; }
.tg-cascade-word {
  display: block;
  font-family: 'Bungee', sans-serif;
  font-size: clamp(40px, 12vw, 92px);
  line-height: .92;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 0 0 12px #ffd24a, 0 0 30px #ff5cc8, 0 0 48px #5ad8ff;
  animation: tg-cascade-pop .4s ease-out, tg-rainbow .6s linear infinite;
}
@keyframes tg-cascade-pop {
  0%   { transform: scale(.3) rotate(-8deg); opacity: 0; }
  60%  { transform: scale(1.28) rotate(4deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes tg-rainbow { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
.tg-cascade-mult {
  display: block;
  font-family: 'Bungee', sans-serif;
  font-size: clamp(36px, 10vw, 76px);
  color: #fff7d6;
  text-shadow: 0 0 18px #ffd24a;
  animation: tg-mult-pulse .25s ease-in-out infinite alternate;
}
@keyframes tg-mult-pulse { from { transform: scale(1); } to { transform: scale(1.2); } }
.tg-cascade-sub { display: block; margin-top: 4px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #fff; }
.tg-zap {
  position: absolute;
  font-size: clamp(22px, 6vw, 40px);
  animation: tg-zap-fly .5s ease-out infinite;
}
.tg-zap:nth-child(1) { top: 6%; left: 10%; animation-delay: 0s; }
.tg-zap:nth-child(2) { top: 12%; right: 8%; animation-delay: .06s; }
.tg-zap:nth-child(3) { top: 30%; left: 4%; animation-delay: .12s; }
.tg-zap:nth-child(4) { top: 38%; right: 5%; animation-delay: .18s; }
.tg-zap:nth-child(5) { bottom: 30%; left: 8%; animation-delay: .24s; }
.tg-zap:nth-child(6) { bottom: 22%; right: 7%; animation-delay: .3s; }
.tg-zap:nth-child(7) { top: 8%; left: 42%; animation-delay: .1s; }
.tg-zap:nth-child(8) { bottom: 10%; left: 38%; animation-delay: .16s; }
.tg-zap:nth-child(9) { top: 50%; left: 14%; animation-delay: .22s; }
.tg-zap:nth-child(10) { top: 52%; right: 12%; animation-delay: .28s; }
.tg-zap:nth-child(11) { bottom: 14%; right: 30%; animation-delay: .34s; }
.tg-zap:nth-child(12) { top: 20%; left: 50%; animation-delay: .4s; }
@keyframes tg-zap-fly {
  0%   { transform: scale(.4) rotate(0); opacity: 0; }
  50%  { opacity: 1; }
  100% { transform: scale(1.4) rotate(22deg); opacity: 0; }
}
.tg-shake { animation: tg-shake .28s linear infinite; }
@keyframes tg-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-4px, 2px); }
  40% { transform: translate(4px, -2px); }
  60% { transform: translate(-3px, -3px); }
  80% { transform: translate(3px, 3px); }
}

/* ===== X-ray: the last spin link by link ===== */
.tg-xray {
  margin: 0 auto 12px;
  max-width: 660px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(10, 20, 40, .6);
  border: 1px solid #2f5a8f;
}
.tg-xray-cap { display: block; font-size: 11px; letter-spacing: 2px; color: #8fc4ff; margin-bottom: 6px; }
.tg-xray-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: baseline; font-family: 'DM Mono', monospace; font-size: 13px; color: #d6e6ff; padding: 2px 0; }
.tg-xray-chain { color: #8fc4ff; white-space: nowrap; }
.tg-xray-chain b { color: #fff; }
.tg-xray-pay { color: #7bffb0; }
.tg-xray-grand .tg-xray-pay { color: #ffd24a; }
.tg-xray-empty { font-size: 12px; color: #8fa8c8; }

@media (prefers-reduced-motion: reduce) {
  .tg-bulb, .tg-torch, .tg-ladder-arrow, .tg-grand-hit, .tg-cell-win,
  .tg-cascade, .tg-cascade-word, .tg-cascade-mult, .tg-shake { animation: none !important; }
  /* CASCADE! still shows (static) under reduced motion — just no strobe/shake. */
  .tg-cascade { background: radial-gradient(circle at 50% 45%, rgba(255, 220, 40, .5), rgba(0, 0, 0, .6) 72%); }
  .tg-zap { display: none; }
}
</style>
