<!-- app/pages/learn/glossary.vue -->
<script setup lang="ts">
// Plain-English floor vocabulary (guidelines §2.2). Static on purpose: this
// page defines the words; the other /learn pages prove them with live numbers.
interface Entry { term: string, def: string, link?: { to: string, label: string } }

const entries: Entry[] = [
  { term: 'Coin-in', def: 'The total amount wagered, counted coin by coin. "1% of coin-in feeds the jackpot" means one cent of every dollar bet tops up the progressive meter. Casinos measure everything in coin-in — it is the only number that always goes up.' },
  { term: 'Credits', def: 'The machine\'s internal currency: your money divided by the denomination. Machines display credits instead of dollars because 500 feels bigger than $5.00.' },
  { term: 'Denomination', def: 'The dollar value of one credit — a penny machine is 1¢/credit, a quarter machine 25¢. Same math, different sticker.' },
  { term: 'Free spins', def: 'A bonus feature: spins that charge nothing but still pay (often with a multiplier). Not generosity — their cost is priced into the base game\'s odds, which is why triggering them is rare.' },
  { term: 'Hit frequency', def: 'How often a spin pays anything at all. A 40% hit frequency means 4 spins in 10 light up — including all the "wins" that pay back less than the bet.', link: { to: '/learn/ldw-near-miss', label: 'why that distinction matters' } },
  { term: 'Hold and spin', def: 'A bonus where triggering symbols lock in place and the rest of the board respins a few times, each new lock resetting the counter. Filling the whole board usually pays the Grand. Under the hood it is a Markov chain with an absorbing "board full" state.', link: { to: '/learn/hold-and-spin', label: 'the fill math' } },
  { term: 'House edge', def: 'The casino\'s cut: 1 − RTP. A 90% RTP machine has a 10% edge — on average $10 of every $100 wagered stays with the house. Quiet per spin, inevitable per million.', link: { to: '/learn/house-edge', label: 'the live floor table' } },
  { term: 'Loss disguised as a win (LDW)', def: 'A "win" smaller than the bet — bet 25, win 14, celebrate anyway. The machine throws the same party for a net loss as for a real win; multi-line games exist substantially to manufacture these.', link: { to: '/learn/ldw-near-miss', label: 'measured live' } },
  { term: 'Near miss', def: 'Jackpot-jackpot-almost. On weighted reels the almost is engineered: blanks next to the jackpot stop can be made to land far more often than chance, so you feel close to a prize your odds never approached.', link: { to: '/learn/ldw-near-miss', label: 'how it\'s built' } },
  { term: 'PAR sheet', def: 'The machine\'s internal math card ("Paytable And Reels"): every symbol, weight, pay, and the exact RTP derivation. Real PAR sheets are trade secrets; every machine here hands you its own from the cabinet.' },
  { term: 'Payline', def: 'A fixed path across the reels that a win must land along. Classic machines had one; video slots sell you 25+ at once — which is where losses disguised as wins come from.' },
  { term: 'Progressive', def: 'A jackpot meter that grows as money is wagered (fed by a share of coin-in) and resets after it hits. The climbing number is funded entirely by the players feeding it.' },
  { term: 'RTP (return to player)', def: 'The share of all wagers a machine pays back over the long run — 90% RTP returns $90 of every $100, eventually. Every RTP on this floor is computed exactly from the machine definition, never asserted.', link: { to: '/learn/house-edge', label: 'every machine\'s number' } },
  { term: 'Scatter / pay-anywhere', def: 'A win that counts symbols anywhere on the grid instead of along a payline — the basis of tumble machines like Temple of Gold.', link: { to: '/learn/cascade-tumble', label: 'the tumble math' } },
  { term: 'Skill stop', def: 'Buttons that let you stop the reels yourself. On pachislo machines an internal flag lottery has already decided whether you may win; your press only picks the moment — the slip does the rest.', link: { to: '/learn/pachislo', label: 'the lottery and the slip' } },
  { term: 'Tumble (cascade)', def: 'Winning symbols shatter, survivors fall, fresh symbols drop in, and the new grid is judged again — a chain of pays inside one bet, usually with a climbing multiplier ladder.', link: { to: '/learn/cascade-tumble', label: 'why the exact math is hard' } },
  { term: 'Virtual reel (Telnaes)', def: 'The 1984 patent behind modern steppers: each physical stop is mapped to many "virtual" stops, so a 22-stop reel can behave like a 128-stop one. It is how big jackpots — and engineered near misses — fit on three reels.', link: { to: '/learn/telnaes-reels', label: 'physical vs virtual, live' } },
  { term: 'Volatility (variance)', def: 'How wild the ride is at the same RTP. Low volatility pays small and often; high volatility starves you between rare big hits. Two machines can share an RTP and feel nothing alike.' },
  { term: 'Ways (e.g. 243-ways)', def: 'Instead of paylines, any left-to-right run of adjacent reels pays: 3 rows across 5 reels = 3⁵ = 243 ways. More "ways" mostly means more chances at sub-bet wins.' }
]
</script>

<template>
  <div class="px-4 py-8 max-w-[760px] mx-auto space-y-8">
    <nav class="text-xs text-neutral-400">
      <NuxtLink
        to="/learn"
        class="hover:text-amber-400"
      >← Learn</NuxtLink>
    </nav>
    <header class="space-y-2">
      <h1 class="text-3xl font-bold">
        Glossary
      </h1>
      <p class="text-neutral-400 leading-relaxed">
        The floor's vocabulary in plain English — no term used on this site should ever
        make you feel like an outsider. Words with a deep-dive page link to it.
      </p>
    </header>

    <dl class="space-y-5">
      <div
        v-for="e in entries"
        :key="e.term"
        class="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3"
      >
        <dt class="font-semibold text-amber-400">
          {{ e.term }}
        </dt>
        <dd class="mt-1 text-sm text-neutral-300 leading-relaxed">
          {{ e.def }}
          <NuxtLink
            v-if="e.link"
            :to="e.link.to"
            class="text-amber-400 hover:text-amber-300 whitespace-nowrap underline underline-offset-2"
          >
            → {{ e.link.label }}
          </NuxtLink>
        </dd>
      </div>
    </dl>
  </div>
</template>
