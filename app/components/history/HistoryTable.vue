<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatSignedCents } from '~/utils/format'

const store = useSlotsStore()
const rows = computed(() => [...store.history].reverse())
</script>

<template>
  <table class="w-full text-sm">
    <thead class="bg-neutral-900/80 sticky top-0">
      <tr class="text-neutral-500 text-xs uppercase tracking-wider">
        <th class="px-4 py-2.5 text-left">
          #
        </th>
        <th class="px-4 py-2.5 text-left">
          Machine
        </th>
        <th class="px-4 py-2.5 text-left">
          Game
        </th>
        <th class="px-4 py-2.5 text-right">
          Bet
        </th>
        <th class="px-4 py-2.5 text-right">
          Win
        </th>
        <th class="px-4 py-2.5 text-right">
          Net
        </th>
        <th class="px-4 py-2.5 text-left">
          Awards
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-neutral-800/50">
      <tr
        v-for="r in rows"
        :key="r.id"
        class="hover:bg-neutral-900/40"
      >
        <td class="px-4 py-2 text-neutral-500 font-mono text-xs">
          {{ r.id }}
        </td>
        <td class="px-4 py-2 text-neutral-300">
          {{ r.machineId }}
        </td>
        <td class="px-4 py-2 text-neutral-500 text-xs">
          {{ r.gameKind }}
        </td>
        <td class="px-4 py-2 text-right font-mono text-neutral-400">
          {{ formatCents(r.coinsInCents) }}
        </td>
        <td
          class="px-4 py-2 text-right font-mono"
          :class="r.payoutCents > 0 ? 'text-emerald-400' : 'text-neutral-600'"
        >
          {{ formatCents(r.payoutCents) }}
        </td>
        <td
          class="px-4 py-2 text-right font-mono"
          :class="r.payoutCents - r.coinsInCents >= 0 ? 'text-emerald-400' : 'text-red-400/80'"
        >
          {{ formatSignedCents(r.payoutCents - r.coinsInCents) }}
        </td>
        <td class="px-4 py-2 text-neutral-500 font-mono text-xs">
          {{ r.entryIds.join(', ') || '—' }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
