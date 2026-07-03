<!-- app/pages/learn/cascade-tumble.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { TEMPLE_OF_GOLD } from '~/machines/temple-of-gold'
import { formatOdds, formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const def = TEMPLE_OF_GOLD
const cells = def.cols * def.rows // 20
const totalWeight = Object.values(def.weights).reduce((a, w) => a + w, 0)

/** Exact binomial tail P(X >= k) for X ~ Bin(n, p) — small n, do it directly. */
function binomTail(n: number, p: number, k: number): number {
  let sum = 0
  for (let i = k; i <= n; i++) {
    let c = 1
    for (let j = 0; j < i; j++) c = c * (n - j) / (j + 1)
    sum += c * p ** i * (1 - p) ** (n - i)
  }
  return sum
}

// Per-symbol odds of paying (8+ anywhere) on the FIRST drop — closed-form exact.
const symbolRows = computed(() => Object.keys(def.paytable).map((sym) => {
  const p = def.weights[sym]! / totalWeight
  return {
    label: def.symbols[sym]?.label ?? sym,
    weight: def.weights[sym]!,
    p,
    hit8: binomTail(cells, p, def.minMatch)
  }
}))

// The Grand trigger: 6+ Golden Idols on the initial 20-cell drop — exact.
const idolP = computed(() => def.weights[def.idolSymbol]! / totalWeight)
const grandOdds = computed(() => binomTail(cells, idolP.value, def.grandTrigger))
const anyFirstDropPay = computed(() =>
  // P(at least one symbol pays on the first drop) — union bound is close enough
  // to show scale, but we can be honest: sum minus nothing (events are near-
  // disjoint at minMatch 8 of 20 cells; at most two symbols can hold 8+ cells).
  symbolRows.value.reduce((a, r) => a + r.hit8, 0)
)
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
      Cascades (tumble mechanics)
    </h1>

    <LearnSection
      title="Pay anywhere, then tumble"
      :headline="formatOdds(grandOdds)"
      headline-label="Golden-Idol Grand trigger on the first drop — computed live"
    >
      <template #intuition>
        <p>
          Temple of Gold has no paylines at all. It pays <strong>scatter</strong> style —
          a symbol landing <strong>{{ def.minMatch }}+ times anywhere</strong> on the
          {{ def.cols }}×{{ def.rows }} grid pays, regardless of position. Then the
          machine's signature move: the winners <em>shatter</em>, the survivors
          <strong>tumble</strong> down, fresh symbols drop into the gaps, and the new grid
          is checked again. Each re-win climbs the multiplier
          <strong>ladder</strong> — ×{{ def.multiplierLadder.join(', ×') }} — all inside
          one bet. One dollar in, potentially five paid grids out.
        </p>
        <p>
          That loop is why tumble machines (the Gonzo's Quest / Sweet Bonanza lineage)
          <em>feel</em> generous: something is almost always moving, shattering, or
          climbing. The X-ray trace in the cabinet shows you what it actually paid,
          link by link.
        </p>
      </template>
      <LearnDisclosure label="Show the math — first-drop odds per symbol">
        <table class="w-full text-xs font-mono">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Symbol
              </th>
              <th class="py-1 px-2 text-right">
                Weight
              </th>
              <th class="py-1 px-2 text-right">
                P(cell)
              </th>
              <th class="py-1 pl-2 text-right">
                P({{ def.minMatch }}+ of {{ cells }})
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="r in symbolRows"
              :key="r.label"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ r.label }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ r.weight }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ formatPercent(r.p) }}
              </td>
              <td class="py-1 pl-2 text-right text-emerald-400">
                {{ formatOdds(r.hit8) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          Each cell draws independently with weight ÷ {{ totalWeight }}, so a symbol's
          first-drop count is <code>Binomial(n = {{ cells }}, p = weight/{{ totalWeight }})</code>
          and the figures above are exact tail sums, computed at render time. Roughly
          {{ formatOdds(anyFirstDropPay) }} first drops pays <em>something</em> before any
          tumble — the tumbles (and the {{ formatPercent(0.355, 1) }}-ish overall hit rate
          the PAR sheet reports) come from the chain.
        </p>
      </LearnDisclosure>
    </LearnSection>

    <LearnSection title="Why the exact math is genuinely hard">
      <template #intuition>
        <p>
          A payline machine's math is a big multiplication. A tumble is a
          <strong>branching process</strong>: whether chain 2 happens depends on which
          symbols shattered in chain 1, how the survivors landed, and what dropped in —
          and every branch multiplies. Simulating it is easy; computing it
          <em>exactly</em> is the hard part.
        </p>
        <p>
          The engine treats each grid as a vector of symbol counts and solves an
          <strong>absorbing-Markov</strong> dynamic program over those states: every
          possible refill is enumerated with its exact probability, chains deeper than
          {{ def.maxTumbles }} are capped, and vanishingly unlikely branches are pruned
          with an explicit error bound. Out comes the exact per-spin mean <em>and</em>
          variance — no Monte-Carlo anywhere in the exact path. The full enumeration
          lives in the machine's <strong>PAR sheet</strong> (the spreadsheet button on
          the cabinet), and <code>pnpm verify</code> re-checks it against five million
          simulated spins on every change.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="The floor's first free-play trainer">
      <template #intuition>
        <p>
          Temple of Gold is the one machine on this floor you cannot lose money on —
          it is <strong>free play</strong>, permanently. The cabinet runs the same
          engine a real machine would, but instead of debiting a balance it keeps an
          honest <strong>House Ledger</strong>: what a $1/spin player <em>would</em> have
          fed, won, and netted, in real dollars, settling toward the true RTP. A
          per-spin <strong>trick-exposer</strong> then names each result for what it is —
          a genuine win, a loss disguised as a win, an engineered near miss, or a clean
          loss. The spectacle stays; the loss is only ever a stated fact.
        </p>
      </template>
      <NuxtLink
        to="/game?m=temple-of-gold"
        class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
      >
        <UIcon
          name="i-lucide-play"
          class="w-4 h-4"
        />
        Walk up to Temple of Gold — no bankroll needed →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
