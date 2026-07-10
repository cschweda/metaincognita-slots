<!-- app/pages/learn/myths.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
// A live, seeded independence experiment: a quarter-million spins of the REAL
// Sevens Ablaze engine, hit rates conditioned on what just happened. Same
// seed, same numbers, every visit — the experiment lives in
// ~/utils/mythsExperiment so the worker, the fallback, and the tests all run
// the same code.
import { MYTHS_SPINS as N, type MythsExperimentResult } from '~/utils/mythsExperiment'
import { mythsExperimentAsync } from '~/utils/rtpClient'
import { formatOdds, formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const exp = ref<MythsExperimentResult | null>(null)
onMounted(async () => {
  // Runs in the rtp.worker in real browsers — first paint never waits on
  // 250,000 spins. Same seed, same numbers, exactly as promised below.
  exp.value = await mythsExperimentAsync()
})

const after10 = (r: MythsExperimentResult): number =>
  r.buckets.find(b => b.label.startsWith('after 10+'))?.hitRate ?? 0
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
      Myths: due, hot &amp; cold
    </h1>
    <p class="text-neutral-400 text-sm">
      Every myth below is stated the way it gets said on a real floor — then a
      quarter-million live spins of Sevens Ablaze, run through the same engine
      the game page uses, get to answer.
    </p>

    <LearnSection
      title="“It hasn't paid in ages — it has to hit soon.”"
      :headline="exp ? `${formatPercent(exp.overallHitRate)} vs ${formatPercent(after10(exp))}` : 'measuring…'"
      headline-label="Hit rate on any random spin vs. immediately after 10+ straight losses — measured live in your browser"
    >
      <template #intuition>
        <p>
          That feeling is the <strong>gambler's fallacy</strong>: the belief that a
          run of losses makes a win more likely, as if the machine owed you one.
          But a slot machine <strong>has no memory</strong>. Every spin is one fresh
          draw from the random number generator; the reels are a display, not a
          state. The machine doesn't know it just took your last twenty bets —
          nothing inside it counts droughts, and nothing ripens.
        </p>
        <p>
          The two numbers above are the whole argument: the chance of a pay right
          after a brutal cold streak is the same chance as on any other spin.
        </p>
      </template>
      <LearnDisclosure :label="`Show the experiment — ${N.toLocaleString('en-US')} real spins, conditioned on the streak`">
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
          <thead>
            <tr class="text-neutral-500 text-left">
              <th class="py-1 pr-2 font-normal">
                The spin played…
              </th>
              <th class="py-1 px-2 text-right font-normal">
                Spins measured
              </th>
              <th class="py-1 pl-2 text-right font-normal">
                Hit rate
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr>
              <td class="py-1 pr-2 text-neutral-200">
                on any spin (overall)
              </td>
              <td class="py-1 px-2 text-right text-neutral-400">
                {{ exp.spins.toLocaleString('en-US') }}
              </td>
              <td class="py-1 pl-2 text-right text-amber-300">
                {{ formatPercent(exp.overallHitRate) }}
              </td>
            </tr>
            <tr
              v-for="b in exp.buckets"
              :key="b.label"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ b.label }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-400">
                {{ b.samples.toLocaleString('en-US') }}
              </td>
              <td class="py-1 pl-2 text-right text-emerald-400">
                {{ formatPercent(b.hitRate) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          {{ N.toLocaleString('en-US') }} seeded spins of Sevens Ablaze (1 coin),
          run through the real engine at render time — reload and the numbers
          repeat exactly. Cold streaks, hot streaks, long droughts: the next
          spin's odds never move.
        </p>
      </LearnDisclosure>
    </LearnSection>

    <LearnSection
      title="“The jackpot is due.”"
      :headline="exp ? formatOdds(1 / exp.expectedGap) : 'measuring…'"
      headline-label="Odds of the 3× Flaming Seven jackpot — identical on every single spin, computed exactly from the reels"
    >
      <template #intuition>
        <p>
          No jackpot is ever due, because nothing accumulates toward it. The odds
          above come from the machine's own
          <NuxtLink
            to="/learn/telnaes-reels"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >virtual reel weights</NuxtLink> — and they were exactly the same on
          every one of the {{ N.toLocaleString('en-US') }} spins.
        </p>
        <p v-if="exp && exp.jackpotGaps">
          In the experiment the jackpot landed {{ exp.jackpots }} times. The gap
          between one jackpot and the next ran from
          <strong>{{ exp.jackpotGaps.min.toLocaleString('en-US') }}</strong> spins to
          <strong>{{ exp.jackpotGaps.max.toLocaleString('en-US') }}</strong> — around an
          expected {{ Math.round(exp.expectedGap).toLocaleString('en-US') }}. A short gap
          didn't mean the machine was "hot", and a long one didn't mean it was
          "filling up": both are just what independent {{ formatOdds(1 / exp.expectedGap) }}
          odds look like when you actually watch them. The longest stretch without
          <em>any</em> pay was {{ exp.longestDrought }} spins — droughts are ordinary,
          not meaningful.
        </p>
        <p>
          (The one number on a real floor that <em>does</em> grow is a progressive
          meter — the display of what players fed it, not better odds. See
          <NuxtLink
            to="/learn/house-edge"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >house edge</NuxtLink>.)
        </p>
      </template>
    </LearnSection>

    <LearnSection title="“This machine runs hot.” / “That one's gone cold.”">
      <template #intuition>
        <p>
          Streaks are real — you just watched a {{ exp ? exp.longestDrought : 'long' }}-spin
          drought happen in seeded data. What's not real is the machine <em>knowing</em>
          about them. Hot and cold are stories told <strong>afterward</strong> about
          runs that any independent sequence produces; the streak-conditioned table
          above shows the next spin never gets the memo. Picking a machine "because
          it's hot" changes the story you'll tell, not the odds you'll get.
        </p>
        <p>
          Want to see the draw happen instead of guessing at it? Every betting
          machine's X-ray panel shows the RNG numbers behind each spin. And the one
          floor machine that LOOKS like it has memory —
          <NuxtLink
            to="/learn/pachislo"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >Stock Rush's stock meter</NuxtLink> — is a disclosed pachislo mechanic,
          priced into its exact math, not a mood.
        </p>
      </template>
    </LearnSection>
  </div>
</template>
