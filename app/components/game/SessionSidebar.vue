<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { floorIntel } from '~/utils/floorIntel'
import { formatCents, formatPercent, formatSignedCents } from '~/utils/format'

const store = useSlotsStore()
const tab = ref<'session' | 'machine'>('session')
const def = computed(() => store.currentDef)
const net = computed(() => store.stats.totalOutCents - store.stats.totalInCents)
const sessionRtp = computed(() =>
  store.stats.totalInCents === 0 ? null : store.stats.totalOutCents / store.stats.totalInCents)
const intel = computed(() => def.value === null ? null : floorIntel(def.value))
</script>

<template>
  <div class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3 text-xs">
    <div class="flex items-center gap-2">
      <UButton
        v-for="t in (['session', 'machine'] as const)"
        :key="t"
        size="xs"
        :color="tab === t ? 'primary' : 'neutral'"
        :variant="tab === t ? 'solid' : 'outline'"
        @click="tab = t"
      >
        {{ t === 'session' ? 'Session' : 'Machine intel' }}
      </UButton>
    </div>

    <table
      v-if="tab === 'session'"
      class="w-full font-mono text-[11px]"
    >
      <tbody class="divide-y divide-neutral-800/50">
        <tr>
          <td class="py-1 text-neutral-500">
            Games
          </td><td class="py-1 text-right text-neutral-200">
            {{ store.stats.spins.toLocaleString() }}
          </td>
        </tr>
        <tr>
          <td class="py-1 text-neutral-500">
            Wagered
          </td><td class="py-1 text-right text-neutral-200">
            {{ formatCents(store.stats.totalInCents) }}
          </td>
        </tr>
        <tr>
          <td class="py-1 text-neutral-500">
            Returned
          </td><td class="py-1 text-right text-neutral-200">
            {{ formatCents(store.stats.totalOutCents) }}
          </td>
        </tr>
        <tr>
          <td class="py-1 text-neutral-500">
            Net
          </td><td
            class="py-1 text-right"
            :class="net >= 0 ? 'text-emerald-400' : 'text-red-400'"
          >
            {{ formatSignedCents(net) }}
          </td>
        </tr>
        <tr>
          <td class="py-1 text-neutral-500">
            Peak
          </td><td class="py-1 text-right text-neutral-200">
            {{ formatSignedCents(store.stats.netPeakCents) }}
          </td>
        </tr>
        <tr>
          <td class="py-1 text-neutral-500">
            Max drawdown
          </td><td class="py-1 text-right text-neutral-200">
            {{ formatCents(store.stats.maxDrawdownCents) }}
          </td>
        </tr>
        <tr v-if="sessionRtp !== null">
          <td class="py-1 text-neutral-500">
            Session RTP
          </td><td class="py-1 text-right text-neutral-200">
            {{ formatPercent(sessionRtp) }}
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-else-if="def"
      class="space-y-2"
    >
      <p class="text-neutral-400 leading-relaxed">
        {{ def.history }}
      </p>
      <table
        v-if="intel"
        class="w-full font-mono text-[11px]"
      >
        <tbody class="divide-y divide-neutral-800/50">
          <tr>
            <td class="py-1 text-neutral-500">
              Exact RTP
            </td><td class="py-1 text-right text-emerald-400">
              {{ formatPercent(intel.rtp, 4) }}
            </td>
          </tr>
          <tr>
            <td class="py-1 text-neutral-500">
              Hit frequency
            </td><td class="py-1 text-right text-neutral-200">
              {{ formatPercent(intel.hitFrequency) }}
            </td>
          </tr>
          <tr>
            <td class="py-1 text-neutral-500">
              Volatility
            </td><td class="py-1 text-right text-neutral-200">
              {{ intel.sdPerCoin.toFixed(2) }} sd/coin
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
