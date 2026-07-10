<!-- app/pages/learn/ldw-near-miss.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
// A live, seeded experiment: the REAL Canal Royale engine — same code the game
// page uses — classifying every paid spin honestly. Same seed, same numbers,
// every visit (that's the point: it's math, not luck). The experiment itself
// lives in ~/utils/ldwExperiment so the worker, the fallback, and the tests
// all run the same code.
import { LDW_PAID_SPINS as N, runLdwExperiment, type LdwExperimentResult } from '~/utils/ldwExperiment'
import { formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const exp = ref<LdwExperimentResult | null>(null)
onMounted(() => {
  exp.value = runLdwExperiment()
})
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
      Losses disguised as wins &amp; the engineered near miss
    </h1>

    <LearnSection
      title="The win that loses money"
      :headline="exp ? formatPercent(exp.ldwShareOfWins) : 'measuring…'"
      headline-label="Share of Canal Royale 'wins' that are actually net losses — measured live in your browser"
    >
      <template #intuition>
        <p>
          Bet 25 credits, win 14 back. The lights flash, the chimes ring, the counter
          climbs — and you just lost 11 credits. That is a
          <strong>loss disguised as a win</strong> (the industry's own term is LDW),
          and it is the single most effective trick on a modern multi-line floor:
          celebrate <em>every</em> pay, whatever it cost, and the session
          <em>feels</em> like winning while the balance walks downhill.
        </p>
        <p>
          It works because the machine controls the scoreboard. Nothing on a real
          cabinet ever compares the pay to the bet — that one subtraction is left as
          an exercise for you, mid-jingle. This floor does the subtraction out loud:
          every result is announced as net up or net down.
        </p>
      </template>
      <LearnDisclosure :label="`Show the experiment — ${N.toLocaleString('en-US')} real spins, right now`">
        <p
          v-if="!exp"
          class="text-neutral-400"
        >
          Running {{ N.toLocaleString('en-US') }} seeded spins in your browser…
        </p>
        <table
          v-else
          class="w-full text-xs font-mono"
        >
          <tbody class="divide-y divide-neutral-800/60">
            <tr>
              <td class="py-1 pr-2 text-neutral-200">
                Spins that paid <em>something</em> (what the lights celebrate)
              </td>
              <td class="py-1 pl-2 text-right text-emerald-400">
                {{ exp.wins.toLocaleString('en-US') }} · {{ formatPercent(exp.hitPct) }}
              </td>
            </tr>
            <tr>
              <td class="py-1 pr-2 text-neutral-200">
                …of which actually paid ≥ the bet (real wins)
              </td>
              <td class="py-1 pl-2 text-right text-emerald-400">
                {{ exp.trueWins.toLocaleString('en-US') }} · {{ formatPercent(exp.trueWinPct) }}
              </td>
            </tr>
            <tr>
              <td class="py-1 pr-2 text-neutral-200">
                …and losses disguised as wins
              </td>
              <td class="py-1 pl-2 text-right text-rose-400">
                {{ exp.ldw.toLocaleString('en-US') }} · {{ formatPercent(exp.ldwPct) }}
              </td>
            </tr>
            <tr>
              <td class="py-1 pr-2 text-neutral-200">
                Losing spins that flashed an engineered near miss
              </td>
              <td class="py-1 pl-2 text-right text-amber-300">
                {{ exp.nearMissLosses.toLocaleString('en-US') }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          {{ N.toLocaleString('en-US') }} paid spins of Canal Royale (25-line, max bet),
          run seeded through the real engine at render time — reload and the numbers
          repeat exactly. Free-spin feature games are excluded (no stake at risk).
        </p>
      </LearnDisclosure>
    </LearnSection>

    <LearnSection title="The near miss is engineered">
      <template #intuition>
        <p>
          Jackpot symbol lands on reel 1… reel 2… and stops one row off on reel 3.
          "So close!" — except it wasn't. On a weighted machine the near miss is a
          <strong>placement choice</strong>: blanks adjacent to the jackpot stop can be
          weighted so the almost-jackpot shows up far more often than chance, while
          your actual odds never move a hair. The jolt you feel is real neuroscience;
          the closeness is set dressing. (The weighting trick is the same Telnaes
          virtual-reel patent that makes million-to-one jackpots fit on three reels —
          see <NuxtLink
            to="/learn/telnaes-reels"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >Telnaes virtual reels</NuxtLink>.)
        </p>
        <p>
          Every betting machine here calls its near misses out in the X-ray panel the
          moment they happen — the same detection that counted
          {{ exp ? exp.nearMissLosses.toLocaleString('en-US') : 'the' }} engineered near
          misses in the experiment above.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="See both tricks exposed, spin by spin">
      <template #intuition>
        <p>
          <strong>Temple of Gold</strong> — the free-play cascade — has a
          trick-exposer built into the cabinet: after every spin it names the result
          in plain dollars. A genuine win, a loss disguised as a win, an engineered
          near miss, or a clean loss. No balance is ever debited; the tricks just get
          caught in the act.
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
        Watch the trick-exposer work — free play →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
