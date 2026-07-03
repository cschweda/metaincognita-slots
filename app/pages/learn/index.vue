<!-- app/pages/learn/index.vue -->
<script setup lang="ts">
import LearnTopicCard from '~/components/learn/LearnTopicCard.vue'

const topics = [
  { to: '/learn/house-edge', icon: 'i-lucide-percent', title: 'House edge', blurb: 'Why every machine quietly keeps a slice of every dollar — and how slowly that truth shows up.' },
  { to: '/learn/telnaes-reels', icon: 'i-lucide-dices', title: 'Telnaes virtual reels', blurb: 'The patent that let three physical reels hide a million-to-one jackpot behind near-misses.' },
  { to: '/learn/hold-and-spin', icon: 'i-lucide-grip', title: 'Hold & spin math', blurb: 'The respin-reset feature as a Markov chain: how often the board actually fills.' },
  { to: '/learn/gargoyles-eye', icon: 'i-lucide-gem', title: 'Gargoyle\'s Eye multiplier', blurb: 'What an additive ×N gem is really worth, and why additive ≠ multiplicative.' },
  { to: '/learn/cascade-tumble', icon: 'i-lucide-layers', title: 'Cascades (tumble math)', blurb: 'Winning symbols shatter and the survivors fall — how one bet chains five paid grids, and why the exact math is a branching monster.' },
  { to: '/learn/pachislo', icon: 'i-lucide-cherry', title: 'Pachislo: the flag lottery', blurb: 'You stop the reels; a hidden lottery already decided. Flags, stock, the ≤4-stop slip — and the operator key.' },
  { to: '/learn/ldw-near-miss', icon: 'i-lucide-party-popper', title: 'LDWs & near misses', blurb: 'The win that loses money and the almost-jackpot that never was — the floor\'s two best tricks, measured live.' },
  { to: '/learn/glossary', icon: 'i-lucide-book-open', title: 'Glossary', blurb: 'Every term on this floor in plain English — RTP to ways, no jargon left standing.' }
]
</script>

<template>
  <div class="px-4 py-8 max-w-[900px] mx-auto space-y-8">
    <header class="space-y-2">
      <h1 class="text-4xl font-bold tracking-tight">
        <span class="text-amber-400">Learn</span> the math
      </h1>
      <p class="text-neutral-400 max-w-2xl leading-relaxed">
        The floor shows you spinning reels. These pages show you the machinery underneath — the same
        numbers the PAR sheet, X-ray, and Sim Lab are built from.
      </p>
    </header>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <LearnTopicCard
        v-for="t in topics"
        :key="t.to"
        v-bind="t"
      />
    </div>
    <NuxtLink
      to="/sim-lab"
      class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
    >
      <UIcon
        name="i-lucide-flask-conical"
        class="w-4 h-4"
      />
      See it in action in the Sim Lab →
    </NuxtLink>
  </div>
</template>
