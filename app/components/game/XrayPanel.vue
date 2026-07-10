<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { nearMisses } from '~/engine'
import { useExactRtp } from '~/composables/useExactRtp'
import { formatOdds, formatPercent } from '~/utils/format'
import type { WheelMachineDef } from '~/engine/types'

const store = useSlotsStore()
const def = computed(() => store.currentDef)
const out = computed(() => store.lastOutcome)

const callouts = computed(() => {
  if (def.value === null || out.value === null) return []
  return nearMisses(def.value, out.value)
})

const draws = computed(() => out.value?.trace.draws.slice(0, 24) ?? [])
const presses = computed(() => out.value?.trace.presses ?? null)
const virtualStops = computed(() => out.value?.trace.virtualStops ?? null)

const oddsLevel = computed(() =>
  def.value?.family === 'pachislo' ? store.currentState?.pachislo?.oddsLevel : undefined)
// Off-thread via the rtp.worker; the sparkline v-if absorbs the brief pending
// state on a cold video machine.
const rtpReport = useExactRtp(() => def.value, () => ({ oddsLevel: oddsLevel.value }))
const exactRtpValue = computed(() => rtpReport.value === null ? null : rtpReport.value.rtpPerCoin)
const samples = computed(() => def.value === null ? [] : store.perMachine[def.value.id]?.samples ?? [])
const sessionRtp = computed(() => {
  const d = def.value
  if (d === null) return null
  const t = store.perMachine[d.id]
  return t === undefined || t.inCents === 0 ? null : t.outCents / t.inCents
})

/** inline sparkline: samples vs the exact line */
const sparkline = computed(() => {
  const exact = exactRtpValue.value
  if (exact === null || samples.value.length < 2) return null
  const w = 280
  const h = 44
  const lo = Math.min(...samples.value, exact) - 0.02
  const hi = Math.max(...samples.value, exact) + 0.02
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h
  const step = w / (samples.value.length - 1)
  return {
    w,
    h,
    exactY: y(exact),
    points: samples.value.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  }
})

const internals = computed(() => {
  const d = def.value
  const s = d === null ? null : store.machineStates[d.id]
  if (d === null || s === null || s === undefined) return []
  const rows: { k: string, v: string }[] = []
  const prog = s.progressive
  if (prog?.kind === 'percent') rows.push({ k: 'meter', v: prog.value.toFixed(2) })
  if (prog?.kind === 'single') rows.push({ k: 'meter', v: `${prog.value.toFixed(2)} (coins ${prog.coins})` })
  if (prog?.kind === 'dual') {
    rows.push({ k: 'upper', v: `${prog.upper} ${prog.live === 'upper' ? '· LIVE' : ''}` })
    rows.push({ k: 'lower', v: `${prog.lower} ${prog.live === 'lower' ? '· LIVE' : ''}` })
    rows.push({ k: 'toggle in', v: `${prog.coinsTowardToggle} coins` })
  }
  const f = s.videoFeature
  if (f?.kind === 'freeSpins') rows.push({ k: 'free spins', v: `${f.remaining} left ×${f.multiplier}` })
  if (f?.kind === 'holdAndSpin') rows.push({ k: 'hold & spin', v: `${f.locked.filter(c => c !== null).length}/15 locked, ${f.respins} respins` })
  const p = s.pachislo
  if (p !== null) {
    rows.push({ k: 'small queue', v: p.smallQueue.join(', ') || '—' })
    rows.push({ k: 'bonus queue', v: p.bonusQueue.join(', ') || '—' })
    if (p.replayNext) rows.push({ k: 'replay', v: 'next game free' })
  }
  return rows
})

// The parked families' sections (Flameout live EV, Stop & Lock strip truth)
// live in LazyGameXrayParkedPanel so their DP modules stay off the /game route.
const isParked = computed(() =>
  def.value?.family === 'blackjack-reel' || def.value?.family === 'lock-reel')

/**
 * Wonder Wheel wedge TRUTH table — the machine's central lesson. The topper
 * draws the 24 wedges at equal 15° slices (a visual 1-in-24 each) while the
 * real odds are the def's integer weights. Pure def data, no solver needed;
 * arm odds come from the reel-3 virtual map.
 */
const wheelTruth = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'wheel') return null
  const w = d as WheelMachineDef
  const W = w.wedges.reduce((s, x) => s + x.weight, 0)
  const vmap3 = w.virtualMaps[2]!
  const strip3 = w.physicalStrips[2]!
  const armWeight = vmap3.filter(idx => strip3[idx] === w.wheelSymbol).length
  const pArm = armWeight / vmap3.length
  return {
    pArm,
    maxCoins: w.maxCoins,
    atMax: store.currentBet === w.maxCoins,
    rows: w.wedges.map(x => ({
      credits: x.credits,
      truePct: x.weight / W,
      spinOdds: pArm * (x.weight / W)
    }))
  }
})
</script>

<template>
  <div
    v-if="store.settings.xray && def"
    class="rounded-xl bg-neutral-900 border border-amber-500/25 p-4 space-y-4 text-xs"
    data-test="xray"
  >
    <div class="flex items-center gap-1.5 text-amber-400 uppercase tracking-widest text-[10px]">
      <UIcon
        name="i-lucide-scan-line"
        class="w-3.5 h-3.5"
      />
      X-ray — what the casino never shows
    </div>

    <div
      v-if="callouts.length"
      class="space-y-1.5"
    >
      <div
        v-for="(c, i) in callouts"
        :key="i"
        class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-amber-200/90 leading-snug"
      >
        {{ c.message }}
      </div>
    </div>

    <div
      v-if="sparkline"
      class="space-y-1"
    >
      <div class="flex items-center justify-between text-[10px] text-neutral-400">
        <span>Session RTP vs exact</span>
        <span
          v-if="sessionRtp !== null"
          class="font-mono"
        >
          {{ formatPercent(sessionRtp, 2) }} vs {{ formatPercent(exactRtpValue!, 2) }}
        </span>
      </div>
      <svg
        :viewBox="`0 0 ${sparkline.w} ${sparkline.h}`"
        class="w-full h-11"
      >
        <line
          x1="0"
          :y1="sparkline.exactY"
          :x2="sparkline.w"
          :y2="sparkline.exactY"
          stroke="rgb(251 191 36 / 0.5)"
          stroke-dasharray="4 3"
          stroke-width="1"
        />
        <polyline
          :points="sparkline.points"
          fill="none"
          stroke="rgb(52 211 153)"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <div
      v-if="presses"
      class="space-y-1"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        Presses → control
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr
            v-for="p in presses"
            :key="p.reel"
          >
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              reel {{ p.reel + 1 }}
            </th>
            <td class="py-0.5 text-right">
              press {{ p.press }}
            </td>
            <td
              class="py-0.5 text-right"
              :class="p.slipUsed > 0 ? 'text-amber-300' : 'text-neutral-400'"
            >
              slip {{ p.slipUsed }}
            </td>
            <td class="py-0.5 text-right text-neutral-300">
              stop {{ p.stop }}
            </td>
            <td class="py-0.5 text-right text-neutral-400">
              {{ p.target ?? 'avoid wins' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="virtualStops"
      class="space-y-1"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        Virtual → physical (Telnaes)
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr
            v-for="v in virtualStops"
            :key="v.reel"
          >
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              reel {{ v.reel + 1 }}
            </th>
            <td class="py-0.5 text-right">
              virtual {{ v.virtualIndex }}/{{ v.virtualSize }}
            </td>
            <td class="py-0.5 text-right text-neutral-300">
              stop {{ v.physicalStop }}
            </td>
            <td class="py-0.5 text-right text-amber-300/90">
              weight {{ v.weight }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="draws.length"
      class="space-y-1"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        RNG draws (this game)
      </div>
      <div class="max-h-36 overflow-y-auto font-mono text-[11px] divide-y divide-neutral-800/50">
        <div
          v-for="(d, i) in draws"
          :key="i"
          class="flex justify-between py-0.5"
        >
          <span class="text-neutral-400">{{ d.label }}</span>
          <span class="text-neutral-300">{{ d.value }} <span class="text-neutral-400">/ {{ d.range }}</span></span>
        </div>
      </div>
    </div>

    <div
      v-if="internals.length"
      class="space-y-1"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        Machine internals
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr
            v-for="row in internals"
            :key="row.k"
          >
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              {{ row.k }}
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ row.v }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Wonder Wheel: the wedge-weight truth table (drawn equal, weighted unequal) -->
    <div
      v-if="wheelTruth"
      class="space-y-1"
      data-test="wheel-truth-panel"
    >
      <div class="text-[10px] text-amber-400 uppercase tracking-wider">
        The wheel's wedges are NOT what they look like
      </div>
      <p class="text-[10px] text-neutral-400">
        Every wedge is drawn at 1/24 of the circle ({{ formatPercent(1 / 24, 2) }} by eye).
        The real odds are the weights below. WHEEL lands
        {{ formatOdds(wheelTruth.pArm) }} spins —
        <span :class="wheelTruth.atMax ? 'text-emerald-400' : 'text-rose-300'">
          {{ wheelTruth.atMax ? 'armed at your bet' : `wasted below ${wheelTruth.maxCoins} coins` }}</span>.
      </p>
      <div class="max-h-40 overflow-y-auto">
        <table class="w-full font-mono text-[11px]">
          <thead>
            <tr class="text-neutral-500 text-left">
              <th class="py-0.5 font-normal">
                wedge
              </th>
              <th class="py-0.5 text-right font-normal">
                looks like
              </th>
              <th class="py-0.5 text-right font-normal">
                really is
              </th>
              <th class="py-0.5 text-right font-normal">
                per spin
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/50">
            <tr
              v-for="r in wheelTruth.rows"
              :key="r.credits"
            >
              <th
                scope="row"
                class="py-0.5 text-left font-normal"
                :class="r.credits === 2500 ? 'text-amber-300' : 'text-neutral-300'"
              >
                {{ r.credits === 2500 ? 'MEGA 2500' : r.credits }}
              </th>
              <td class="py-0.5 text-right text-neutral-500">
                {{ formatPercent(1 / 24, 2) }}
              </td>
              <td
                class="py-0.5 text-right"
                :class="r.truePct < 1 / 24 ? 'text-rose-300' : 'text-emerald-400'"
              >
                {{ formatPercent(r.truePct, 2) }}
              </td>
              <td class="py-0.5 text-right text-neutral-400">
                {{ formatOdds(r.spinOdds) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <LazyGameXrayParkedPanel v-if="isParked" />
  </div>
</template>
