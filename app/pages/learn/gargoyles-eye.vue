<script setup lang="ts">
import { computed } from 'vue'
import { RUBY_OF_GARGOYLE } from '~/machines/ruby-of-gargoyle'
import { formatPercent, formatOdds } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const cfg = RUBY_OF_GARGOYLE.holdAndSpin!
const orbValues = cfg.orbValues

// Separate gems (have mult) from credit orbs
const gems = orbValues.filter((o): o is { mult: number, weight: number } => 'mult' in o && o.mult !== undefined)
const totalWeight = orbValues.reduce((s, o) => s + o.weight, 0)
const gemWeight = gems.reduce((s, o) => s + o.weight, 0)

// P(a collected orb is a gem) = gemWeight / totalWeight = 2/176
const pGem = gemWeight / totalWeight

// E[added multiplier | a gem lands] = (2×1 + 3×1) / (1+1) = 2.5
const eMult = gems.reduce((s, o) => s + o.mult * o.weight, 0) / gemWeight

// Gem table rows
const gemRows = computed(() =>
  gems.map(o => ({
    face: o.mult,
    weight: o.weight,
    prob: o.weight / totalWeight,
    contribution: (o.weight / gemWeight) * o.mult
  }))
)

// All orbValue rows for the full table
const orbRows = computed(() =>
  orbValues.map(o => ({
    label: 'mult' in o ? `×${o.mult} gem` : `${(o as { credits: number, weight: number, label?: string }).credits} cr${(o as { credits: number, weight: number, label?: string }).label ? ` (${(o as { credits: number, weight: number, label?: string }).label})` : ''}`,
    weight: o.weight,
    prob: o.weight / totalWeight,
    isGem: 'mult' in o
  }))
)

const headlineStr = computed(() => `×${eMult.toFixed(1)} expected added multiplier per gem face`)
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
      Gargoyle's Eye multiplier
    </h1>
    <LearnSection
      title="Additive, not multiplicative"
      :headline="headlineStr"
      headline-label="E[added multiplier | a gem lands in the hold-and-spin feature]"
    >
      <template #intuition>
        <p>
          The Gargoyle's Eye is a special orb that can land during the hold-and-spin feature.
          Instead of collecting credits, it adds a multiplier to a running total.
          When the feature ends, the engine sums all credit-orb values and then multiplies
          by that total — <strong>additively</strong>, not multiplicatively.
        </p>
        <p>
          A ×2 gem and a ×3 gem together produce a ×5 multiplier applied to your ruby credits
          (2 + 3 = 5). If they compounded, you would get ×6 (2 × 3 = 6).
          The additive rule is <em>linear</em>: each gem face always adds exactly its face value
          to the total, regardless of what other gems landed.
          This is simpler to budget mathematically and more predictable for players.
        </p>
        <p>
          Landing a gem at all is uncommon: with {{ orbValues.length }} orb-value entries totaling
          {{ totalWeight }} weight, the probability that any individual locked orb turns out to be
          a gem is {{ formatPercent(pGem) }} ({{ formatOdds(pGem) }}). When one does land,
          its expected face value is <strong>×{{ eMult.toFixed(1) }}</strong>.
        </p>
      </template>

      <LearnDisclosure label="Show the math — gem probability and worked examples">
        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          Gargoyle's Eye gem faces
        </h3>
        <table class="w-full text-xs font-mono mb-4">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Gem face
              </th>
              <th class="py-1 px-2 text-right">
                Weight
              </th>
              <th class="py-1 px-2 text-right">
                P(this face | any orb)
              </th>
              <th class="py-1 pl-2 text-right">
                Contribution to E[ΔMult]
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="row in gemRows"
              :key="row.face"
            >
              <td class="py-1 pr-2 text-amber-400 font-semibold">
                ×{{ row.face }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ row.weight }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ formatPercent(row.prob) }}
              </td>
              <td class="py-1 pl-2 text-right text-neutral-200">
                +{{ row.contribution.toFixed(4) }}
              </td>
            </tr>
            <tr class="border-t border-neutral-700">
              <td class="py-1 pr-2 text-neutral-400 italic">
                Total / E[ΔMult | gem]
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ gemWeight }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ formatPercent(pGem) }}
              </td>
              <td class="py-1 pl-2 text-right text-amber-400 font-semibold">
                ×{{ eMult.toFixed(1) }}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          Two-gem worked example: additive vs multiplicative
        </h3>
        <p class="text-xs text-neutral-400 mb-2">
          Suppose your board ends with two Eye gems (×2 and ×3) and 500 credits worth of ruby orbs.
        </p>
        <table class="w-full text-xs font-mono mb-4">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Rule
              </th>
              <th class="py-1 px-2 text-right">
                Multiplier calculation
              </th>
              <th class="py-1 px-2 text-right">
                Total mult
              </th>
              <th class="py-1 pl-2 text-right">
                Payout on 500 cr
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr>
              <td class="py-1 pr-2 text-emerald-400 font-semibold">
                Additive (actual)
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                2 + 3
              </td>
              <td class="py-1 px-2 text-right text-emerald-400">
                ×5
              </td>
              <td class="py-1 pl-2 text-right text-neutral-200">
                2,500 cr
              </td>
            </tr>
            <tr>
              <td class="py-1 pr-2 text-rose-400">
                Multiplicative (not used)
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                2 × 3
              </td>
              <td class="py-1 px-2 text-right text-rose-400">
                ×6
              </td>
              <td class="py-1 pl-2 text-right text-neutral-400">
                3,000 cr
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs text-neutral-400 mb-2">
          If no gem lands, the multiplier defaults to ×1 (credits paid at face value).
          The Grand jackpot (all 15 cells filled) pays the progressive directly and is
          not affected by the multiplier.
        </p>

        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          Full orb-value distribution ({{ totalWeight }} total weight)
        </h3>
        <table class="w-full text-xs font-mono">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Orb value
              </th>
              <th class="py-1 px-2 text-right">
                Weight
              </th>
              <th class="py-1 pl-2 text-right">
                Probability
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="row in orbRows"
              :key="row.label"
            >
              <td
                class="py-1 pr-2"
                :class="row.isGem ? 'text-amber-400 font-semibold' : 'text-neutral-200'"
              >
                {{ row.label }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ row.weight }}
              </td>
              <td class="py-1 pl-2 text-right text-neutral-300">
                {{ formatPercent(row.prob) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs text-neutral-400 mt-2">
          Gem probability per orb: {{ formatPercent(pGem) }} ({{ formatOdds(pGem) }}).
          Values and weights read from <code>RUBY_OF_GARGOYLE.holdAndSpin.orbValues</code> at render time.
        </p>
      </LearnDisclosure>

      <div class="flex flex-wrap gap-3 text-sm">
        <NuxtLink
          to="/learn/hold-and-spin"
          class="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300"
        >
          <UIcon
            name="i-lucide-grip"
            class="w-4 h-4"
          /> How often the board fills in the hold-and-spin feature →
        </NuxtLink>
        <NuxtLink
          to="/sim-lab"
          class="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300"
        >
          <UIcon
            name="i-lucide-flask-conical"
            class="w-4 h-4"
          /> Sim Lab →
        </NuxtLink>
      </div>
    </LearnSection>
  </div>
</template>
