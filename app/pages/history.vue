<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatSignedCents } from '~/utils/format'

const store = useSlotsStore()
onMounted(() => {
  if (store.phase === 'floor' && store.peekSavedSession()) store.resume()
})

const net = computed(() => store.stats.totalOutCents - store.stats.totalInCents)

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
