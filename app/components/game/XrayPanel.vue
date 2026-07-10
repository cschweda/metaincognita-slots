<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { nearMisses } from '~/engine'
import { decisionEvs, blackjackReelExactRtp, crashOdds } from '~/engine/blackjackReelRtp'
import { lockReelExactRtp, reelCashEvs, bonusOdds, bonusEv } from '~/engine/lockReelRtp'
import { floorIntel } from '~/utils/floorIntel'
import { formatCentsExact, formatOdds, formatPercent } from '~/utils/format'
import type { BlackjackReelMachineDef, LockReelMachineDef } from '~/engine/types'

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
 * Live crash cash-vs-push surface for blackjack-reel hands in the 'spinning'
 * phase, expressed in dollars at the live bet. Null when not applicable (other
 * families or not at a climb decision).
 */
const bjEv = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'blackjack-reel') return null
  const bj = store.currentState?.blackjackReel
  if (bj === null || bj === undefined || bj.phase !== 'spinning') return null
  const ev = decisionEvs(d as BlackjackReelMachineDef, bj)
  if (ev === null) return null
  const toDollars = (perCoin: number): string => formatCentsExact(perCoin * bj.ante * d.denominationCents)
  return { cash: toDollars(ev.evCash), push: toDollars(ev.evContinue), action: ev.action }
})

/**
 * Crash odds + RTP from the exact RTP report. Shown when the hand is not in the
 * 'spinning' phase (idle or resolved); the live EV panel takes over otherwise.
 */
const bjOdds = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'blackjack-reel') return null
  const bj = store.currentState?.blackjackReel
  if (bj?.phase === 'spinning') return null // the live EV panel takes over
  const report = blackjackReelExactRtp(d as BlackjackReelMachineDef)
  return {
    rtpPerCoin: report.rtpPerCoin,
    crashRate: report.breakdown.find(b => b.entryId === 'crash')?.probability ?? 0,
    perReel: crashOdds(d as BlackjackReelMachineDef) // [reel3, reel4, reel5]
  }
})

/**
 * Stop & Lock 777 (lock-reel) strip-driven truth. The stop is an honest uniform
 * draw — skill-neutral, no live cash/push decision — so the X-ray shows the
 * per-reel expected cash, the 777 bonus odds + bonus EV, and the GRAND rate,
 * not a decision EV.
 */
const lockOdds = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'lock-reel') return null
  const lr = d as LockReelMachineDef
  const report = lockReelExactRtp(lr)
  const grand = lr.prizes[lr.bonus.grandOnFill] ?? 0
  const grandRow = report.breakdown.find(b => b.entryId === 'grand')
  // the GRAND breakdown row's probability is the per-round fill rate already
  const grandRate = grandRow?.probability ?? 0
  const trigger = bonusOdds(lr)
  return {
    rtpPerCoin: report.rtpPerCoin,
    houseEdge: 1 - report.rtpPerCoin,
    reelCash: reelCashEvs(lr), // [reel1..reel5] expected locked cash per stop
    bonusOdds: trigger,
    bonusEv: bonusEv(lr), // E[extra credits | 777 triggers]
    grandRate, // P(full grid this round)
    grandGivenBonus: trigger > 0 ? grandRate / trigger : 0,
    grand
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

    <!-- Flameout 21: live cash-now vs push-the-reel EV during 'spinning' phase -->
    <div
      v-if="bjEv"
      class="space-y-1"
      data-test="bj-ev-panel"
    >
      <div class="text-[10px] text-amber-400 uppercase tracking-wider">
        The casino never shows you this live EV
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Cash now
            </th>
            <td
              class="py-0.5 text-right"
              :class="bjEv.action === 'cash' ? 'text-emerald-400 font-bold' : 'text-neutral-300'"
            >
              {{ bjEv.cash }}
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
              Push the reel (EV)
            </th>
            <td
              class="py-0.5 text-right"
              :class="bjEv.action === 'continue' ? 'text-amber-300 font-bold' : 'text-neutral-300'"
            >
              {{ bjEv.push }}
              <span
                v-if="bjEv.action === 'continue'"
                class="text-amber-300"
              > ← optimal</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-[10px] text-neutral-400">
        Optimal call:
        <span
          class="font-bold"
          :class="bjEv.action === 'continue' ? 'text-amber-300' : 'text-emerald-400'"
        >{{ bjEv.action === 'cash' ? 'cash' : 'push' }}</span>
        — the casino never shows you this live EV.
      </p>
    </div>

    <!-- Flameout 21: idle/resolved — show RTP + crash odds -->
    <div
      v-else-if="bjOdds"
      class="space-y-1"
      data-test="bj-odds-panel"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        Flameout 21 odds (optimal play)
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              RTP
            </th>
            <td class="py-0.5 text-right text-emerald-400">
              {{ formatPercent(bjOdds.rtpPerCoin, 4) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Crash before you cash
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ formatPercent(bjOdds.crashRate, 2) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Reel 3/4/5 crash
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ bjOdds.perReel.map(p => formatPercent(p)).join(' · ') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Stop & Lock 777: strip-driven cash/bonus truth (honest skill-stop) -->
    <div
      v-if="lockOdds"
      class="space-y-1"
      data-test="lock-odds-panel"
    >
      <div class="text-[10px] text-neutral-400 uppercase tracking-wider">
        Stop &amp; Lock 777 — what each stop is really worth
      </div>
      <table class="w-full font-mono text-[11px]">
        <tbody class="divide-y divide-neutral-800/50">
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              RTP
            </th>
            <td class="py-0.5 text-right text-emerald-400">
              {{ formatPercent(lockOdds.rtpPerCoin, 4) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              House edge
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ formatPercent(lockOdds.houseEdge, 4) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Cash/stop · reels 1-5
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ lockOdds.reelCash.map(c => c.toFixed(3)).join(' · ') }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              777 bonus odds
            </th>
            <td class="py-0.5 text-right text-amber-300">
              {{ formatOdds(lockOdds.bonusOdds) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              Bonus EV (given trigger)
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ lockOdds.bonusEv.toFixed(2) }} credits
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-0.5 text-left font-normal text-neutral-400"
            >
              GRAND (fill the grid)
            </th>
            <td class="py-0.5 text-right text-neutral-300">
              {{ formatOdds(lockOdds.grandRate) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-[10px] text-neutral-400">
        Stopping a reel is a uniform draw — your timing feels skillful but doesn't change the odds.
      </p>
    </div>
  </div>
</template>
