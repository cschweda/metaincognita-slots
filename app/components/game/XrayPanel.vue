<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { nearMisses } from '~/engine'
import { decisionEvs, blackjackReelExactRtp } from '~/engine/blackjackReelRtp'
import { floorIntel } from '~/utils/floorIntel'
import { formatPercent } from '~/utils/format'
import type { BlackjackReelMachineDef } from '~/engine/types'

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
const exactRtpValue = computed(() =>
  def.value === null ? null : floorIntel(def.value, { oddsLevel: oddsLevel.value }).rtp)
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

/**
 * Live EV(hit) vs EV(stand) for blackjack-reel hands in the 'spinning' phase.
 * Returns null when not applicable (other families or idle/resolved state).
 */
const bjEv = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'blackjack-reel') return null
  const bj = store.currentState?.blackjackReel
  if (bj === null || bj === undefined || bj.phase !== 'spinning') return null
  return decisionEvs(d as BlackjackReelMachineDef, bj)
})

/**
 * Bust rate and Five-Card Charlie rate from the exact RTP report.
 * Shown when the hand is not in the 'spinning' phase (idle or resolved).
 */
const bjOdds = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'blackjack-reel') return null
  const bj = store.currentState?.blackjackReel
  if (bj?.phase === 'spinning') return null // EV panel takes over
  const report = blackjackReelExactRtp(d as BlackjackReelMachineDef)
  const charlieBucket = report.breakdown.find(b => b.entryId === 'charlie')
  const bustBucket = report.breakdown.find(b => b.entryId === 'bust')
  return {
    bustRate: bustBucket?.probability ?? 0,
    charlieRate: charlieBucket?.probability ?? 0,
    rtpPerCoin: report.rtpPerCoin
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

    <!-- Blackjack-reel: live EV(hit) vs EV(stand) during 'spinning' phase -->
    <div
      v-if="bjEv"
      class="space-y-1"
      data-test="bj-ev-panel"
    >
      <div class="text-[10px] text-amber-400 uppercase tracking-wider">
        The casino never shows you this
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              EV(cash)
            </th>
            <td
              class="py-0.5 text-right"
              :class="bjEv.action === 'cash' ? 'text-emerald-400 font-bold' : 'text-neutral-300'"
            >
              {{ bjEv.evCash.toFixed(4) }}
              <span
                v-if="bjEv.action === 'cash'"
                class="text-emerald-400"
              > ← optimal</span>
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              EV(continue)
            </th>
            <td
              class="py-0.5 text-right"
              :class="bjEv.action === 'continue' ? 'text-amber-300 font-bold' : 'text-neutral-300'"
            >
              {{ bjEv.evContinue.toFixed(4) }}
              <span
                v-if="bjEv.action === 'continue'"
                class="text-amber-300"
              > ← optimal</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-[10px] text-neutral-400">
        EV per coin wagered under this machine's optimal policy. Optimal action:
        <span
          class="font-bold"
          :class="bjEv.action === 'continue' ? 'text-amber-300' : 'text-emerald-400'"
        >{{ bjEv.action.toUpperCase() }}</span>
      </p>
    </div>

    <!-- Blackjack-reel: idle/resolved — show bust + charlie odds -->
    <div
      v-else-if="bjOdds"
      class="space-y-1"
      data-test="bj-odds-panel"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        Hit or Bust odds (optimal play)
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Bust rate
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ formatPercent(bjOdds.bustRate, 2) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Five-Card Charlie
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ formatPercent(bjOdds.charlieRate, 2) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Exact RTP/coin
            </th>
            <td class="py-0.5 text-right text-emerald-400">
              {{ formatPercent(bjOdds.rtpPerCoin, 4) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
