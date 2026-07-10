<!-- app/pages/learn/volatility.vue -->
<script setup lang="ts">
import { computed } from 'vue'
// Same toll, different ride: the whole floor's volatility, computed live from
// the same exact reports the PAR sheets print (rtp.worker; sync fallback in
// SSG/tests). Nothing here is asserted — sd/coin is √variancePerCoin and
// N₀ = variance/edge², straight off each machine's ExactRtpReport.
import { FLOOR } from '~/machines'
import { formatPercent } from '~/utils/format'
import { useFloorReports } from '~/composables/useFloorReports'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const { reports } = useFloorReports()

interface Row {
  id: string
  name: string
  family: string
  rtp: number
  sd: number
  n0: number | null
}

const rows = computed<Row[]>(() => FLOOR.flatMap((def) => {
  const r = reports.value.get(def.id)
  if (r === undefined) return []
  const edge = 1 - r.rtpPerCoin
  return [{
    id: def.id,
    name: def.name,
    family: def.family,
    rtp: r.rtpPerCoin,
    sd: Math.sqrt(r.variancePerCoin),
    n0: edge > 0 ? r.variancePerCoin / (edge * edge) : null
  }]
}).sort((a, b) => b.sd - a.sd))

const wildness = computed(() => {
  if (rows.value.length < 2) return null
  const wild = rows.value[0]!
  const tame = rows.value[rows.value.length - 1]!
  return { wild, tame, ratio: wild.sd / tame.sd }
})

const pair = computed(() => {
  const sevens = rows.value.find(r => r.id === 'sevens-ablaze')
  const diamond = rows.value.find(r => r.id === 'diamond-doubler')
  return sevens !== undefined && diamond !== undefined ? { sevens, diamond } : null
})

const spins = (n: number): string => Math.round(n).toLocaleString('en-US')
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
      Volatility: same edge, different ride
    </h1>

    <LearnSection
      title="Two machines, one toll, nothing alike"
      :headline="wildness ? `${wildness.ratio.toFixed(1)}× wilder` : 'measuring…'"
      :headline-label="wildness ? `Per-spin swings on ${wildness.wild.name} vs ${wildness.tame.name} — at broadly similar house edges` : 'comparing the wildest and tamest rides on the floor'"
    >
      <template #intuition>
        <p>
          RTP tells you what a machine keeps; <strong>volatility</strong> tells you
          how it feels while it happens. Two machines can charge nearly the same
          toll while one pays small and often and the other starves you between
          rare, huge hits. The number that captures it is the
          <NuxtLink
            to="/learn/glossary#sd-per-coin"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >standard deviation per coin</NuxtLink> — how far one spin's result
          typically swings from its average.
        </p>
        <p v-if="pair">
          The floor's built-in demonstration: <strong>{{ pair.diamond.name }}</strong>
          ({{ formatPercent(pair.diamond.rtp) }} RTP, sd {{ pair.diamond.sd.toFixed(1) }})
          and <strong>{{ pair.sevens.name }}</strong>
          ({{ formatPercent(pair.sevens.rtp) }} RTP, sd {{ pair.sevens.sd.toFixed(1) }})
          sit a quarter point apart on edge — yet the progressive jackpot hiding
          in Sevens Ablaze's variance already makes its ride
          {{ (pair.sevens.sd / pair.diamond.sd).toFixed(1) }}× rougher. And that is
          the <em>mild</em> comparison: open the table and the floor-wide spread
          runs {{ wildness ? wildness.ratio.toFixed(1) : '5+' }}×.
        </p>
      </template>
      <LearnDisclosure label="Show the whole floor, ranked by wildness — live exact math">
        <p
          v-if="rows.length === 0"
          class="text-neutral-400"
        >
          Computing every machine's exact variance…
        </p>
        <table
          v-else
          class="w-full text-xs font-mono"
        >
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Machine
              </th>
              <th class="py-1 px-2 text-right">
                RTP
              </th>
              <th class="py-1 px-2 text-right">
                sd / coin
              </th>
              <th class="py-1 pl-2 text-right">
                N₀ (spins)
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="r in rows"
              :key="r.id"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ r.name }}
              </td>
              <td class="py-1 px-2 text-right text-emerald-400">
                {{ formatPercent(r.rtp) }}
              </td>
              <td class="py-1 px-2 text-right text-amber-300">
                {{ r.sd.toFixed(2) }}
              </td>
              <td class="py-1 pl-2 text-right text-neutral-300">
                {{ r.n0 === null ? '—' : spins(r.n0) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          sd/coin = √(per-coin variance) from each machine's exact report, at max
          coins. <NuxtLink
            to="/learn/glossary#n0"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >N₀</NuxtLink> = variance ÷ edge² — the spins it takes the
          <NuxtLink
            to="/learn/house-edge"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >edge's</NuxtLink> steady pull to outgrow one standard deviation of luck.
          Stock Rush's figure uses its attribution variance at the default operator
          setting (descriptive volatility, not an i.i.d. error bar).
        </p>
      </LearnDisclosure>
    </LearnSection>

    <LearnSection title="Why the wild ones exist">
      <template #intuition>
        <p>
          High volatility isn't a defect — it's the product. A machine that pays
          {{ formatPercent(0.9) }} back as frequent small wins feels busy but never
          thrilling; move that same budget into rare jackpots and every spin buys a
          lottery ticket's worth of hope. The house edge is identical either way.
          What changes is <em>your bankroll's path</em>: the wilder the machine, the
          longer luck can hide the edge — and the deeper the drawdowns while it does.
        </p>
        <p>
          That's also why short sessions can win big on wild machines: below
          N₀, variance is in charge. It is not in charge forever.
        </p>
      </template>
      <NuxtLink
        to="/sim-lab"
        class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
      >
        <UIcon
          name="i-lucide-flask-conical"
          class="w-4 h-4"
        />
        Watch the ride happen — survival curves and drawdowns in the Sim Lab →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
