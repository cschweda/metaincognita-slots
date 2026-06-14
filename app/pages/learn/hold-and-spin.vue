<script setup lang="ts">
import { computed } from 'vue'
import { RUBY_OF_GARGOYLE } from '~/machines/ruby-of-gargoyle'
import { formatPercent, formatOdds } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const cfg = RUBY_OF_GARGOYLE.holdAndSpin!

// Board size is 15 cells (hardcoded in app/engine/video.ts, lines 130, 212, 238, 257)
const BOARD_SIZE = 15

// Per-cell lock probability per respin: p = respinOrbNumer / respinOrbDenom
// From config: respinOrbNumer=2, respinOrbDenom=24 → p = 2/24 ≈ 0.0833
const p = cfg.respinOrbNumer / cfg.respinOrbDenom
const INIT_RESPINS = cfg.respins // 3
const TRIGGER = cfg.triggerCount // 6 (starting filled count)

// Markov chain: absorbing states over (filled, respinsLeft)
// Each respin: the number of new locks among (BOARD_SIZE - filled) empty cells
// is Binomial(empty, p). If ≥1 new: filled += k, respinsLeft resets to INIT_RESPINS.
// If 0 new: respinsLeft -= 1. Absorb when filled == BOARD_SIZE or respinsLeft == 0.
function binomProb(n: number, k: number, prob: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0) return Math.pow(1 - prob, n)
  let coeff = 1
  for (let i = 0; i < k; i++) coeff = (coeff * (n - i)) / (i + 1)
  return coeff * Math.pow(prob, k) * Math.pow(1 - prob, n - k)
}

interface MarkovResult {
  pFill: number
  eFilled: number
  endDist: { filled: number, prob: number }[]
}

function solveMarkov(startFilled: number, startRespins: number): MarkovResult {
  let states = new Map<string, number>()
  states.set(`${startFilled},${startRespins}`, 1.0)

  let pFill = 0
  const absorbed = new Map<number, number>() // filled -> prob

  let iter = 0
  while (states.size > 0 && iter < 10000) {
    iter++
    const next = new Map<string, number>()
    for (const [key, prob] of states) {
      const comma = key.indexOf(',')
      const filled = Number(key.slice(0, comma))
      const respins = Number(key.slice(comma + 1))
      const empty = BOARD_SIZE - filled

      for (let k = 0; k <= empty; k++) {
        const bProb = binomProb(empty, k, p)
        if (bProb < 1e-15) continue
        const tp = prob * bProb
        if (k === 0) {
          // No new locks
          const newRespins = respins - 1
          if (newRespins <= 0) {
            absorbed.set(filled, (absorbed.get(filled) ?? 0) + tp)
          } else {
            const nk = `${filled},${newRespins}`
            next.set(nk, (next.get(nk) ?? 0) + tp)
          }
        } else {
          const newFilled = filled + k
          if (newFilled >= BOARD_SIZE) {
            pFill += tp
          } else {
            const nk = `${newFilled},${INIT_RESPINS}`
            next.set(nk, (next.get(nk) ?? 0) + tp)
          }
        }
      }
    }
    states = next
  }

  let eFilled = pFill * BOARD_SIZE
  const endDist: { filled: number, prob: number }[] = []
  for (const [f, pr] of absorbed) {
    eFilled += f * pr
    endDist.push({ filled: f, prob: pr })
  }
  if (pFill > 0) endDist.push({ filled: BOARD_SIZE, prob: pFill })
  endDist.sort((a, b) => a.filled - b.filled)

  return { pFill, eFilled, endDist }
}

const result = computed(() => solveMarkov(TRIGGER, INIT_RESPINS))
const pFillPct = computed(() => formatPercent(result.value.pFill))
const pFillOdds = computed(() => formatOdds(result.value.pFill))
const eFilledStr = computed(() => result.value.eFilled.toFixed(2))

// Per-respin continue probability (P(at least 1 new lock) given k empty cells)
// At the start of each respin from the trigger state (6 filled, 9 empty)
const pContinueRows = computed(() => {
  // Show a range of filled counts and their P(continue)
  return [6, 7, 8, 9, 10, 11, 12, 13, 14].map((filled) => {
    const empty = BOARD_SIZE - filled
    const pMiss = binomProb(empty, 0, p)
    const pContinue = 1 - pMiss
    return { filled, empty, pMiss, pContinue }
  })
})
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
      Hold &amp; spin math
    </h1>
    <LearnSection
      title="The respin-reset Markov chain"
      :headline="pFillPct"
      headline-label="P(board fills to 15) from a 6-ruby trigger"
    >
      <template #intuition>
        <p>
          When {{ cfg.triggerCount }} or more rubies land, the hold-and-spin feature begins:
          {{ INIT_RESPINS }} respins on a {{ BOARD_SIZE }}-cell board,
          with the {{ cfg.triggerCount }} triggering rubies already locked.
          On each respin, every empty cell independently locks a new ruby with probability
          <strong>p = {{ cfg.respinOrbNumer }}/{{ cfg.respinOrbDenom }}
            ≈ {{ (p * 100).toFixed(2) }}%</strong>.
          The key twist: if <em>any</em> new ruby lands, the respin counter
          <strong>resets to {{ INIT_RESPINS }}</strong>. A hot board snowballs — but most boards
          stall well before all 15 perches are filled.
        </p>
        <p>
          This is a classic <strong>Markov chain</strong> over states
          <code>(cellsFilled, respinsLeft)</code>, starting at
          <code>({{ TRIGGER }}, {{ INIT_RESPINS }})</code>. The chain absorbs when
          <code>respinsLeft</code> hits 0 (no new ruby landed) or
          <code>cellsFilled</code> reaches {{ BOARD_SIZE }} (Grand jackpot eligible).
          Solving the chain exactly gives P(fill the board) = <strong>{{ pFillPct }}</strong>
          ({{ pFillOdds }}) and an expected final lock count of
          <strong>{{ eFilledStr }}</strong> cells out of {{ BOARD_SIZE }}.
        </p>
      </template>

      <LearnDisclosure label="Show the math — Markov transition table">
        <p class="text-neutral-400 text-xs mb-2">
          <code>p = {{ cfg.respinOrbNumer }}/{{ cfg.respinOrbDenom }}</code>
          is read directly from the machine config (<code>respinOrbNumer</code> /
          <code>respinOrbDenom</code>). Board size = {{ BOARD_SIZE }} cells
          (engine constant). Starting state: ({{ TRIGGER }} filled, {{ INIT_RESPINS }} respins).
        </p>

        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          P(continue) vs P(miss) by filled count
        </h3>
        <p class="text-xs text-neutral-400 mb-2">
          "Continue" = at least 1 new ruby lands this respin → respins reset to {{ INIT_RESPINS }}.
          "Miss" = 0 new rubies → respins decrease by 1.
        </p>
        <table class="w-full text-xs font-mono mb-4">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Filled cells
              </th>
              <th class="py-1 px-2 text-right">
                Empty cells
              </th>
              <th class="py-1 px-2 text-right">
                P(miss all)
              </th>
              <th class="py-1 pl-2 text-right">
                P(at least 1 new ruby)
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="row in pContinueRows"
              :key="row.filled"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ row.filled }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ row.empty }}
              </td>
              <td class="py-1 px-2 text-right text-rose-400">
                {{ (row.pMiss * 100).toFixed(2) }}%
              </td>
              <td class="py-1 pl-2 text-right text-emerald-400">
                {{ (row.pContinue * 100).toFixed(2) }}%
              </td>
            </tr>
          </tbody>
        </table>

        <h3 class="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
          Final lock distribution (exact enumeration)
        </h3>
        <table class="w-full text-xs font-mono mb-3">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Final filled
              </th>
              <th class="py-1 px-2 text-right">
                Probability
              </th>
              <th class="py-1 pl-2 text-right">
                Odds
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="row in result.endDist"
              :key="row.filled"
            >
              <td
                class="py-1 pr-2"
                :class="row.filled === BOARD_SIZE ? 'text-amber-400 font-semibold' : 'text-neutral-200'"
              >
                {{ row.filled }}{{ row.filled === BOARD_SIZE ? ' (Grand)' : '' }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-300">
                {{ formatPercent(row.prob) }}
              </td>
              <td class="py-1 pl-2 text-right text-neutral-400">
                {{ formatOdds(row.prob) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400 text-xs">
          Model: exact binomial enumeration over all reachable
          <code>(filled, respinsLeft)</code> states (no Monte-Carlo). Computed at render time from
          the machine config. E[final filled] = {{ eFilledStr }} cells.
        </p>
      </LearnDisclosure>

      <div class="flex flex-wrap gap-3 text-sm">
        <NuxtLink
          to="/learn/gargoyles-eye"
          class="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300"
        >
          <UIcon
            name="i-lucide-gem"
            class="w-4 h-4"
          /> The Gargoyle's Eye gems land in this feature →
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
