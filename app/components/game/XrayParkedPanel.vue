<!-- app/components/game/XrayParkedPanel.vue -->
<!-- The PARKED families' X-ray sections (Flameout 21 live EV + odds, Stop &
     Lock 777 strip truth). Split from XrayPanel and mounted Lazy so their DP
     modules never ride the /game route for floor machines — only a restored
     legacy parked session loads this chunk. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { decisionEvs, blackjackReelExactRtp, crashOdds } from '~/engine/blackjackReelRtp'
import { lockReelExactRtp, reelCashEvs, bonusOdds, bonusEv } from '~/engine/lockReelRtp'
import { formatCentsExact, formatOdds, formatPercent } from '~/utils/format'
import type { BlackjackReelMachineDef, LockReelMachineDef } from '~/engine/types'

const store = useSlotsStore()
const def = computed(() => store.currentDef)

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
  <div class="space-y-4">
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
