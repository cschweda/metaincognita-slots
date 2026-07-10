<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatSignedCents } from '~/utils/format'
import { ALL_MACHINES } from '~/machines'
import { exactRtpAsync } from '~/utils/rtpClient'
import { edgeOpts } from '~/utils/floorIntel'
import { edgeKey, takeawaySums } from '~/utils/historyTakeaway'

const store = useSlotsStore()
onMounted(() => {
  if (store.phase === 'floor' && store.peekSavedSession()) store.resume()
})

const net = computed(() => store.stats.totalOutCents - store.stats.totalInCents)

// Expected-vs-actual at the machines' exact edges (guidelines §2.3). Edges are
// fetched per distinct (machine, coins) through the rtpClient cache — worker in
// real browsers, sync fallback in SSG/tests.
const edges = ref<Map<string, number>>(new Map())
const wantedKeys = computed(() => {
  const keys = new Map<string, { def: (typeof ALL_MACHINES)[number], coins: number }>()
  for (const r of store.history) {
    const def = ALL_MACHINES.find(m => m.id === r.machineId)
    if (def === undefined) continue
    const k = edgeKey(r.machineId, r.coins)
    if (!keys.has(k)) keys.set(k, { def, coins: r.coins })
  }
  return keys
})
watchEffect(() => {
  for (const [k, { def, coins }] of wantedKeys.value) {
    if (edges.value.has(k)) continue
    void exactRtpAsync(def, edgeOpts(def, coins)).then((report) => {
      const next = new Map(edges.value)
      next.set(k, 1 - report.rtpPerCoin)
      edges.value = next
    })
  }
})
const takeaway = computed(() => {
  if (store.history.length === 0) return null
  for (const k of wantedKeys.value.keys()) {
    if (!edges.value.has(k)) return null // still computing
  }
  return takeawaySums(store.history, edges.value)
})
const luckCents = computed(() => takeaway.value === null ? 0 : takeaway.value.actualNetCents - Math.round(takeaway.value.expectedNetCents))

function exportLog() {
  const blob = new Blob([store.exportHistory()], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `slots-session-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="px-4 py-6 max-w-[1000px] mx-auto space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-neutral-100">
        Session history
      </h1>
      <UButton
        color="neutral"
        variant="outline"
        size="xs"
        icon="i-lucide-download"
        :disabled="store.history.length === 0"
        @click="exportLog"
      >
        Export log
      </UButton>
    </div>
    <div class="rounded-xl bg-neutral-900/70 border border-neutral-800 px-4 py-2.5 font-mono text-sm flex gap-6">
      <span class="text-neutral-400">Games <span class="text-neutral-200">{{ store.stats.spins.toLocaleString() }}</span></span>
      <span class="text-neutral-400">Wagered <span class="text-neutral-200">{{ formatCents(store.stats.totalInCents) }}</span></span>
      <span class="text-neutral-400">Net <span :class="net >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ formatSignedCents(net) }}</span></span>
    </div>
    <div
      v-if="takeaway && takeaway.coveredRows > 0"
      data-test="takeaway"
      class="rounded-xl bg-neutral-900/70 border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300 space-y-1"
    >
      <p>
        At these machines' exact edges, expected result on your
        <span class="font-mono text-neutral-200">{{ formatCents(takeaway.wageredCents) }}</span> wagered:
        <span class="font-mono text-amber-300">{{ formatSignedCents(Math.round(takeaway.expectedNetCents)) }}</span>.
        Your actual:
        <span
          class="font-mono"
          :class="takeaway.actualNetCents >= 0 ? 'text-emerald-400' : 'text-red-400'"
        >{{ formatSignedCents(takeaway.actualNetCents) }}</span>
        — luck has been
        <span class="font-mono text-neutral-200">{{ formatCents(Math.abs(luckCents)) }}</span>
        {{ luckCents >= 0 ? 'kind' : 'unkind' }}.
        Play on and the gap per dollar shrinks toward zero.
        <span
          v-if="takeaway.excludedRows > 0"
          class="text-neutral-500"
        >(Excludes {{ takeaway.excludedRows }} games on retired machines.)</span>
      </p>
      <p class="text-[10px] text-neutral-500">
        Expected figures use each machine's exact math at your recorded bet — Stock Rush at its
        default operator setting, strategy machines at optimal play.
      </p>
    </div>
    <div class="rounded-xl border border-neutral-800 overflow-hidden max-h-[60vh] overflow-y-auto">
      <HistoryTable />
      <div
        v-if="store.history.length === 0"
        class="p-8 text-center text-neutral-400 text-sm"
      >
        No games yet. The reels remember everything once you start.
      </div>
    </div>
  </div>
</template>
