<!-- app/pages/learn/psychology.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
// The floor's persuasion toolkit, demonstrated on THIS floor's own machinery.
// The live numbers reuse the cached LDW experiment (10,000 seeded Canal Royale
// spins in the rtp.worker) — no new math, the same receipts the LDW page shows.
import { LDW_PAID_SPINS as N, type LdwExperimentResult } from '~/utils/ldwExperiment'
import { ldwExperimentAsync } from '~/utils/rtpClient'
import { formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'

const exp = ref<LdwExperimentResult | null>(null)
onMounted(async () => {
  exp.value = await ldwExperimentAsync()
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
      The psychology of the floor
    </h1>
    <p class="text-neutral-400 text-sm">
      None of the tricks below require a dishonest machine — the math can be
      exactly as published and the room still wins your evening. Every one of
      them is running on this floor right now, deliberately, with the receipts
      turned on.
    </p>

    <LearnSection
      title="The party is for you, not the win"
      :headline="exp ? formatPercent(exp.ldwShareOfWins) : 'measuring…'"
      headline-label="Share of celebrated Canal Royale 'wins' that actually lost money — measured live in your browser"
    >
      <template #intuition>
        <p>
          Bet 25, win back 14, and the cabinet celebrates like you're rich: that's a
          <strong>loss disguised as a win</strong>, and the celebration is the whole
          point — your memory keeps the jingle, not the subtraction. The number above
          is how often the party you see on a modern multi-line machine is thrown
          for money you just lost.
        </p>
        <p>
          This floor does it too, on purpose. Every reveal jingle here scales with
          the <em>payout</em>, exactly like a real cabinet — an LDW gets a real
          little fanfare — while the result bar and the
          <NuxtLink
            to="/history"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >session history</NuxtLink> speak the net truth beside it. Hear the trick
          and read the receipt in the same second; that contrast is the lesson. (The
          full measurement lives on
          <NuxtLink
            to="/learn/ldw-near-miss"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >LDWs &amp; near misses</NuxtLink> — and the sound has a mute in the nav.)
        </p>
      </template>
    </LearnSection>

    <LearnSection
      title="The hook is the schedule"
      :headline="exp ? `${formatPercent(exp.hitPct)} pay · ${formatPercent(exp.trueWinPct)} profit` : 'measuring…'"
      headline-label="Canal Royale spins that pay something vs. spins that actually beat the bet — same live experiment"
    >
      <template #intuition>
        <p>
          Psychology labs call it <strong>variable-ratio reinforcement</strong>:
          rewards that arrive after an unpredictable number of tries. It is the most
          persistence-inducing schedule behavioral science has found — Skinner's
          pigeons pecked themselves ragged on it — and a slot machine is its purest
          commercial form. Not the biggest rewards, not the most rewards:
          <em>unpredictable</em> rewards, at a rate tuned so quitting always feels
          one spin early.
        </p>
        <p>
          The tuning is visible in the live pair above: over half the spins deliver
          <em>something</em> — a flash, a chime, a number — while far fewer actually
          return more than they cost. The schedule keeps you responding; the
          <NuxtLink
            to="/learn/house-edge"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >edge</NuxtLink> does the arithmetic.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="Almost is engineered">
      <template #intuition>
        <p>
          Jackpot, jackpot, one row off. The near miss fires the same reward
          circuitry as a win — brain scans say almost-winning <em>feels</em> like
          winning — and on weighted reels it is a placement choice, manufactured far
          more often than chance while your odds never move. This floor detects and
          announces its own near misses in the X-ray panel the moment they happen;
          <NuxtLink
            to="/learn/ldw-near-miss"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >the LDW page counts them live</NuxtLink>, and
          <NuxtLink
            to="/learn/myths"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >the myths page</NuxtLink> shows why "so close" carries zero information.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="Credits keep dollars abstract">
      <template #intuition>
        <p>
          On the penny video slots here, a $10 bill becomes <strong>1,000
            credits</strong> and a 25¢ max bet reads as a friendly little "25". That's
          not a display quirk — it's <em>denomination distancing</em>. Money you've
          converted stops feeling spent, numbers without dollar signs stop feeling
          like prices, and 500 always feels bigger than $5.00. Every cabinet on this
          floor shows the honest dollar figure alongside the credits, which is
          exactly what a real one won't do.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="Buttons that don't steer">
      <template #intuition>
        <p>
          Stop buttons, lucky timing, your ritual before the max-bet press: the
          <strong>illusion of control</strong>. The floor's cleanest demonstration is
          <NuxtLink
            to="/learn/pachislo"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >Stock Rush</NuxtLink> — you stop all three reels yourself, and it changes
          nothing: a hidden flag lottery decided the game before your first press,
          and the machine quietly slides your stop up to four symbols to enforce it.
          Feeling in control keeps people playing; being in control was never on
          offer. Flip the X-ray on any machine and watch the RNG draw happen —
          before the reels finish moving.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="Time on device">
      <template #intuition>
        <p>
          The industry's real success metric isn't your loss per spin — it's
          <strong>time on device</strong>. Fast spin cadence, credits instead of
          cash, no clocks, no windows, wins announced everywhere and exits announced
          nowhere: the room is engineered so stopping never quite comes up. The edge
          is small per spin and inevitable per thousand, so the product being sold
          is the thousand.
        </p>
        <p>
          This floor builds the exits in. The
          <NuxtLink
            to="/history"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >history page</NuxtLink> tells you what your session <em>should</em> have
          cost at the exact edges versus what it did; the
          <NuxtLink
            to="/sim-lab"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >Sim Lab</NuxtLink> computes N₀ — how long luck can hide the edge — before
          you spin; and End session is one click, in the same place, always.
        </p>
      </template>
    </LearnSection>

    <p class="text-xs text-neutral-500">
      Every number above was computed in your browser from the same engine the
      games run on — {{ N.toLocaleString('en-US') }} seeded spins, identical on
      every reload.
    </p>
  </div>
</template>
