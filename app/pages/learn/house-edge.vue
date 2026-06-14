<!-- app/pages/learn/house-edge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { FLOOR } from '~/machines'
import { exactRtp } from '~/engine'
import { formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const rows = computed(() => FLOOR.map((def) => {
  const rtp = exactRtp(def, { coins: def.maxCoins }).rtpPerCoin
  return { name: def.name, rtp, houseEdge: 1 - rtp, lossPer100: (1 - rtp) * 100 }
}))
const avgEdge = computed(() => rows.value.reduce((a, r) => a + r.houseEdge, 0) / rows.value.length)
</script>

<template>
  <div class="px-4 py-8 max-w-[760px] mx-auto space-y-8">
    <nav class="text-xs text-neutral-400">
      <NuxtLink
        to="/learn"
        class="hover:text-amber-400"
      >← Learn</NuxtLink>
    </nav>
    <h1 class="text-3xl font-bold">
      House edge
    </h1>
    <LearnSection
      title="The casino's cut"
      :headline="formatPercent(avgEdge)"
      headline-label="Average house edge across this floor"
    >
      <template #intuition>
        <p>
          Every machine pays back a little less than it takes — over millions of spins. The gap is the
          <strong>house edge</strong>: <code>house edge = 1 − RTP</code>, where RTP is the long-run return
          to player. A 5% edge means that, on average, every $100 wagered returns $95. You rarely feel it
          spin to spin, because variance is loud and the edge is quiet — which is exactly the point.
        </p>
      </template>
      <LearnDisclosure label="Show the math — every machine on the floor">
        <table class="w-full text-xs font-mono">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Machine
              </th>
              <th class="py-1 px-2 text-right">
                RTP
              </th>
              <th class="py-1 px-2 text-right">
                House edge
              </th>
              <th class="py-1 pl-2 text-right">
                Loss / $100
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="r in rows"
              :key="r.name"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ r.name }}
              </td>
              <td class="py-1 px-2 text-right text-emerald-400">
                {{ formatPercent(r.rtp) }}
              </td>
              <td class="py-1 px-2 text-right text-rose-400">
                {{ formatPercent(r.houseEdge) }}
              </td>
              <td class="py-1 pl-2 text-right text-neutral-300">
                ${{ r.lossPer100.toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          Every figure is computed at render time from the machine definition via <code>exactRtp()</code>.
        </p>
      </LearnDisclosure>
      <NuxtLink
        to="/sim-lab"
        class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
      >
        <UIcon
          name="i-lucide-flask-conical"
          class="w-4 h-4"
        />
        Watch the edge grind a bankroll down in the Sim Lab →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
