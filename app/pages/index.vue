<script setup lang="ts">
import { FLOOR } from '~/machines'
import { exactRtp } from '~/engine'

const rows = FLOOR.map(m => ({
  id: m.id,
  name: m.name,
  family: m.family,
  rtp: (exactRtp(m).rtpPerCoin * 100).toFixed(4) + '%'
}))
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-mono">
    <h1 class="text-2xl text-amber-400 mb-4">
      Slots Simulator — engine milestone
    </h1>
    <p class="text-neutral-400 mb-6">
      Headless engine online. Full floor UI lands in a later milestone; run
      <code>pnpm verify</code> for the verification report.
    </p>
    <table class="text-sm">
      <thead>
        <tr class="text-neutral-500 text-left">
          <th class="pr-6">
            Machine
          </th><th class="pr-6">
            Family
          </th><th>Exact RTP</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.id"
        >
          <td class="pr-6">
            {{ r.name }}
          </td>
          <td class="pr-6">
            {{ r.family }}
          </td>
          <td class="text-emerald-400">
            {{ r.rtp }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
