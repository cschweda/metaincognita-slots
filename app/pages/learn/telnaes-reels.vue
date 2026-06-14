<script setup lang="ts">
import { computed } from 'vue'
import { DIAMOND_DOUBLER } from '~/machines/diamond-doubler'
import { formatOdds } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const def = DIAMOND_DOUBLER
const jackpotSymbol = 'DW' // Diamond Wild — top pay (3×DW = 1,000 coins)

// Per-reel physical vs virtual analysis
const reelRows = computed(() => {
  return def.physicalStrips.map((strip, r) => {
    const vMap = def.virtualMaps[r]!
    const physCount = strip.filter(s => s === jackpotSymbol).length
    const virtCount = vMap.filter(idx => strip[idx] === jackpotSymbol).length
    return {
      reel: r + 1,
      physStops: strip.length,
      virtStops: vMap.length,
      physCount,
      virtCount,
      physProb: physCount / strip.length,
      virtProb: virtCount / vMap.length
    }
  })
})

// Per-symbol weight table for reel 1 (index 0)
const reel1Rows = computed(() => {
  const strip = def.physicalStrips[0]!
  const vMap = def.virtualMaps[0]!
  const symbols = [...new Set(strip)]
  return symbols.map((sym) => {
    const physCount = strip.filter(s => s === sym).length
    const virtCount = vMap.filter(idx => strip[idx] === sym).length
    return {
      symbol: def.symbols[sym]?.label ?? sym,
      physCount,
      virtCount,
      physProb: physCount / strip.length,
      virtProb: virtCount / vMap.length
    }
  }).sort((a, b) => b.virtCount - a.virtCount)
})

// Per-reel convenience for the intuition text
const r1 = computed(() => reelRows.value[0]!)
const physOdds = computed(() => formatOdds(r1.value.physProb))
const virtOdds = computed(() => formatOdds(r1.value.virtProb))

// Combined 3-reel jackpot odds (product across all reels)
const physJackpot = computed(() => reelRows.value.reduce((acc, r) => acc * r.physProb, 1))
const virtJackpot = computed(() => reelRows.value.reduce((acc, r) => acc * r.virtProb, 1))
const headline = computed(() => `${formatOdds(virtJackpot.value)} virtual vs ${formatOdds(physJackpot.value)} physical`)
</script>

<template>
  <div class="px-4 py-8 max-w-[760px] mx-auto space-y-8">
    <nav class="text-xs text-neutral-500">
      <NuxtLink
        to="/learn"
        class="hover:text-amber-400"
      >← Learn</NuxtLink>
    </nav>
    <h1 class="text-3xl font-bold">
      Telnaes virtual reels
    </h1>
    <LearnSection
      title="The patent that changed everything"
      :headline="headline"
      headline-label="Three-Diamond-Wild jackpot — virtual vs physical odds (all 3 reels)"
    >
      <template #intuition>
        <p>
          In 1984, Inge Telnaes filed US patent 4,448,419 — the idea that a slot machine's RNG
          doesn't need to pick directly from physical reel stops. Instead, it picks from a much
          larger set of <strong>virtual stops</strong>, each mapped onto a physical stop.
          A jackpot symbol with 1 physical stop can be given only 2–3 virtual stops out of 72,
          making it far rarer than the physical reel suggests — while still letting it land on screen
          for near-miss drama.
        </p>
        <p>
          Diamond Doubler uses this pattern exactly.
          Each reel has <strong>{{ r1.physStops }} physical stops</strong> but
          <strong>{{ r1.virtStops }} virtual entries</strong>.
          The Diamond Wild appears once on every physical strip
          (physical odds: {{ physOdds }} per reel), but the virtual map assigns it only
          {{ r1.virtCount }} out of {{ r1.virtStops }} virtual slots (virtual odds: {{ virtOdds }}).
          The X-ray panel shows this mapping live during play.
        </p>
        <p>
          Across all three reels the squeeze compounds: the three-Diamond-Wild jackpot pays at
          roughly {{ formatOdds(virtJackpot) }} on the virtual reels versus
          {{ formatOdds(physJackpot) }} on the physical strips — about three times rarer than
          the visible reels imply.
        </p>
      </template>

      <LearnDisclosure label="Show the math — per-reel physical vs virtual breakdown">
        <p class="text-neutral-400 text-xs mb-2">
          Physical stops = actual positions on the reel strip; virtual stops = the weighted RNG pool.
          The Diamond Wild jackpot symbol (DW) maps onto fewer virtual slots than its physical presence alone would imply.
        </p>

        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          Diamond Wild (jackpot) — all 3 reels
        </h3>
        <table class="w-full text-xs font-mono mb-4">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Reel
              </th>
              <th class="py-1 px-2 text-right">
                Phys stops
              </th>
              <th class="py-1 px-2 text-right">
                Virt stops
              </th>
              <th class="py-1 px-2 text-right">
                DW phys count
              </th>
              <th class="py-1 px-2 text-right">
                DW virt count
              </th>
              <th class="py-1 px-2 text-right">
                Physical odds
              </th>
              <th class="py-1 pl-2 text-right">
                Virtual odds
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="row in reelRows"
              :key="row.reel"
            >
              <td class="py-1 pr-2 text-neutral-200">
                Reel {{ row.reel }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ row.physStops }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ row.virtStops }}
              </td>
              <td class="py-1 px-2 text-right text-emerald-400">
                {{ row.physCount }}
              </td>
              <td class="py-1 px-2 text-right text-amber-400">
                {{ row.virtCount }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ formatOdds(row.physProb) }}
              </td>
              <td class="py-1 pl-2 text-right text-rose-400">
                {{ formatOdds(row.virtProb) }}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          Reel 1 — all symbols (physical vs virtual weight)
        </h3>
        <table class="w-full text-xs font-mono">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Symbol
              </th>
              <th class="py-1 px-2 text-right">
                Phys count
              </th>
              <th class="py-1 px-2 text-right">
                Virt count
              </th>
              <th class="py-1 px-2 text-right">
                Phys prob
              </th>
              <th class="py-1 pl-2 text-right">
                Virt prob
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="row in reel1Rows"
              :key="row.symbol"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ row.symbol }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ row.physCount }}
              </td>
              <td class="py-1 px-2 text-right text-amber-400">
                {{ row.virtCount }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ (row.physProb * 100).toFixed(2) }}%
              </td>
              <td class="py-1 pl-2 text-right text-neutral-300">
                {{ (row.virtProb * 100).toFixed(2) }}%
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400 text-xs mt-2">
          All figures computed at render time from <code>DIAMOND_DOUBLER.physicalStrips</code> /
          <code>.virtualMaps</code>. The combined 3-reel jackpot (3× DW) probability is the product of
          each reel's virtual DW probability.
        </p>
      </LearnDisclosure>

      <NuxtLink
        to="/sim-lab"
        class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
      >
        <UIcon
          name="i-lucide-flask-conical"
          class="w-4 h-4"
        /> See variance at work in the Sim Lab →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
