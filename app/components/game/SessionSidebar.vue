<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { floorIntel } from '~/utils/floorIntel'
import { formatCents, formatPercent, formatSignedCents } from '~/utils/format'
import { learnLink } from '~/utils/learnLink'

const store = useSlotsStore()
const tab = ref<'session' | 'machine'>('session')
const def = computed(() => store.currentDef)
const net = computed(() => store.stats.totalOutCents - store.stats.totalInCents)
const sessionRtp = computed(() =>
  store.stats.totalInCents === 0 ? null : store.stats.totalOutCents / store.stats.totalInCents)
const oddsLevel = computed(() =>
  def.value?.family === 'pachislo' ? store.currentState?.pachislo?.oddsLevel : undefined)
// Hit frequency and volatility are per-spin figures that depend on the active
// line count for 'lines' machines, so report them at the player's current bet.
const intel = computed(() =>
  def.value === null ? null : floorIntel(def.value, { oddsLevel: oddsLevel.value, coins: store.currentBet }))
const learn = computed(() => def.value === null ? null : learnLink(def.value))
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
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Games
          </th><td class="py-1 text-right text-neutral-200">
            {{ store.stats.spins.toLocaleString() }}
          </td>
        </tr>
        <tr>
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Wagered
          </th><td class="py-1 text-right text-neutral-200">
            {{ formatCents(store.stats.totalInCents) }}
          </td>
        </tr>
        <tr>
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Returned
          </th><td class="py-1 text-right text-neutral-200">
            {{ formatCents(store.stats.totalOutCents) }}
          </td>
        </tr>
        <tr>
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Net
          </th><td
            class="py-1 text-right"
            :class="net >= 0 ? 'text-emerald-400' : 'text-red-400'"
          >
            {{ formatSignedCents(net) }}
          </td>
        </tr>
        <tr>
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Peak
          </th><td class="py-1 text-right text-neutral-200">
            {{ formatSignedCents(store.stats.netPeakCents) }}
          </td>
        </tr>
        <tr>
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Max drawdown
          </th><td class="py-1 text-right text-neutral-200">
            {{ formatCents(store.stats.maxDrawdownCents) }}
          </td>
        </tr>
        <tr v-if="sessionRtp !== null">
          <th
            scope="row"
            class="py-1 text-left font-normal text-neutral-400"
          >
            Session RTP
          </th><td class="py-1 text-right text-neutral-200">
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
            <th
              scope="row"
              class="py-1 text-left font-normal text-neutral-400"
            >
              <NuxtLink
                to="/learn/glossary#rtp"
                class="underline decoration-dotted underline-offset-2 hover:text-amber-300"
              >Exact RTP</NuxtLink>
            </th><td class="py-1 text-right text-emerald-400">
              {{ formatPercent(intel.rtp, 4) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-1 text-left font-normal text-neutral-400"
            >
              <NuxtLink
                to="/learn/glossary#hit-frequency"
                class="underline decoration-dotted underline-offset-2 hover:text-amber-300"
              >Hit frequency</NuxtLink>
            </th><td class="py-1 text-right text-neutral-200">
              {{ formatPercent(intel.hitFrequency) }}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              class="py-1 text-left font-normal text-neutral-400"
            >
              <NuxtLink
                to="/learn/glossary#volatility"
                class="underline decoration-dotted underline-offset-2 hover:text-amber-300"
              >Volatility</NuxtLink>
            </th><td class="py-1 text-right text-neutral-200">
              {{ intel.sdPerCoin.toFixed(2) }} sd/coin
            </td>
          </tr>
        </tbody>
      </table>
      <NuxtLink
        v-if="learn"
        :to="learn.to"
        data-test="learn-link"
        class="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline underline-offset-2"
      >
        <UIcon
          name="i-lucide-book-open"
          class="w-3 h-3"
        />
        Learn: {{ learn.label }} →
      </NuxtLink>
    </div>
  </div>
</template>
