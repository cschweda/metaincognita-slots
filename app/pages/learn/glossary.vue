<!-- app/pages/learn/glossary.vue -->
<script setup lang="ts">
// Plain-English floor vocabulary (guidelines §2.2). Static on purpose: this
// page defines the words; the other /learn pages prove them with live numbers.
// Every entry carries an anchor id so app copy can deep-link a term
// (/learn/glossary#rtp) instead of leaving jargon undefined.
interface Entry { id: string, term: string, def: string, link?: { to: string, label: string } }

const entries: Entry[] = [
  { id: 'bankroll', term: 'Bankroll', def: 'The money you walked in with — the pot every bet drains and every win refills. All slot math is written against it: the house edge grinds a fixed share of everything wagered out of it, quietly, over time.', link: { to: '/learn/house-edge', label: 'the grind, quantified' } },
  { id: 'coin-in', term: 'Coin-in', def: 'The total amount wagered, counted coin by coin. "1% of coin-in feeds the jackpot" means one cent of every dollar bet tops up the progressive meter. Casinos measure everything in coin-in — it is the only number that always goes up.' },
  { id: 'credits', term: 'Credits', def: 'The machine\'s internal currency: your money divided by the denomination. Machines display credits instead of dollars because 500 feels bigger than $5.00.' },
  { id: 'denomination', term: 'Denomination', def: 'The dollar value of one credit — a penny machine is 1¢/credit, a quarter machine 25¢. Same math, different sticker.' },
  { id: 'drawdown', term: 'Drawdown (max drawdown)', def: 'How far below your session\'s best point you have sunk — peak minus now. "Max drawdown" is the deepest that dip ever got: the stomach-drop number that decides whether a session felt survivable.' },
  { id: 'ev', term: 'Expected value (EV)', def: 'The long-run average of a bet: every outcome weighted by its probability. A $1 spin at 90% RTP has an EV of −10¢ — the fee you pay for the ride, invisible per spin, inevitable per thousand.' },
  { id: 'flag', term: 'Flag (pachislo)', def: 'The internal lottery result drawn the instant you bet on a pachislo machine — it decides whether this game may pay before you touch a button. Your stops just carry out the verdict.', link: { to: '/learn/pachislo', label: 'the lottery and the slip' } },
  { id: 'free-spins', term: 'Free spins', def: 'A bonus feature: spins that charge nothing but still pay (often with a multiplier). Not generosity — their cost is priced into the base game\'s odds, which is why triggering them is rare.' },
  { id: 'gamblers-fallacy', term: 'Gambler\'s fallacy', def: 'The belief that a run of losses makes a win more likely — that the machine "owes" you. It doesn\'t: every spin is an independent draw, and the odds after ten straight losses are identical to the odds on any other spin.', link: { to: '/learn/myths', label: 'watch it fail across 250,000 live spins' } },
  { id: 'hit-frequency', term: 'Hit frequency', def: 'How often a spin pays anything at all. A 40% hit frequency means 4 spins in 10 light up — including all the "wins" that pay back less than the bet.', link: { to: '/learn/ldw-near-miss', label: 'why that distinction matters' } },
  { id: 'hold-and-spin', term: 'Hold and spin', def: 'A bonus where triggering symbols lock in place and the rest of the board respins a few times, each new lock resetting the counter. Filling the whole board usually pays the Grand. Under the hood it is a Markov chain with an absorbing "board full" state.', link: { to: '/learn/hold-and-spin', label: 'the fill math' } },
  { id: 'house-edge', term: 'House edge', def: 'The casino\'s cut: 1 − RTP. A 90% RTP machine has a 10% edge — on average $10 of every $100 wagered stays with the house. Quiet per spin, inevitable per million.', link: { to: '/learn/house-edge', label: 'the live floor table' } },
  { id: 'illusion-of-control', term: 'Illusion of control', def: 'The feeling that your timing, your button, your ritual steers a random outcome. Slot design cultivates it — stop buttons, "skill" framing — because a player who feels in control plays longer. The RNG never once checked what your hands were doing.', link: { to: '/learn/psychology', label: 'the toolkit, item by item' } },
  { id: 'independence', term: 'Independence (of spins)', def: 'The statistical property that makes slot myths myths: each spin is a fresh random draw, unaffected by every spin before it. No memory, no ripening, no hot or cold — streaks happen in the results, never in the odds.', link: { to: '/learn/myths', label: 'the live experiment' } },
  { id: 'jackpot-tiers', term: 'Jackpot tiers (Mini / Minor / Major / Grand)', def: 'The ladder of prizes many machines dangle, small to huge. The small tiers hit often enough to keep hope alive; the Grand exists mostly to be photographed.' },
  { id: 'ldw', term: 'Loss disguised as a win (LDW)', def: 'A "win" smaller than the bet — bet 25, win 14, celebrate anyway. The machine throws the same party for a net loss as for a real win; multi-line games exist substantially to manufacture these.', link: { to: '/learn/ldw-near-miss', label: 'measured live' } },
  { id: 'multiplier', term: 'Multiplier', def: 'A factor applied to a win (×2, ×5…). Machines differ on whether several multipliers add (2+3 = ×5) or multiply (2×3 = ×6) — the difference is enormous, and the marquee rarely says which.', link: { to: '/learn/gargoyles-eye', label: 'additive vs multiplicative, worked' } },
  { id: 'n0', term: 'N₀ — spins to outrun luck', def: 'How many spins it takes before the house edge\'s steady pull reliably exceeds one standard deviation of luck. Below N₀, variance decides your session; beyond it, the math does. For a jackpot stepper it can be tens of thousands of spins — which is why short sessions can win and long careers cannot.', link: { to: '/sim-lab', label: 'computed live as you set the sliders' } },
  { id: 'near-miss', term: 'Near miss', def: 'Jackpot-jackpot-almost. On weighted reels the almost is engineered: blanks next to the jackpot stop can be made to land far more often than chance, so you feel close to a prize your odds never approached.', link: { to: '/learn/ldw-near-miss', label: 'how it\'s built' } },
  { id: 'pachislo', term: 'Pachislo', def: 'The Japanese parlor slot family: three reels you stop yourself, a hidden flag lottery that already decided whether this game may pay, and a slip that slides your stop up to four symbols to enforce the verdict. Regulated as amusement machines, engineered like slots.', link: { to: '/learn/pachislo', label: 'flags, stock, and the slip' } },
  { id: 'par-sheet', term: 'PAR sheet', def: 'The machine\'s internal math card ("Paytable And Reels"): every symbol, weight, pay, and the exact RTP derivation. Real PAR sheets are trade secrets; every machine here hands you its own from the cabinet.' },
  { id: 'payline', term: 'Payline', def: 'A fixed path across the reels that a win must land along. Classic machines had one; video slots sell you 25+ at once — which is where losses disguised as wins come from.' },
  { id: 'progressive', term: 'Progressive', def: 'A jackpot meter that grows as money is wagered (fed by a share of coin-in) and resets after it hits. The climbing number is funded entirely by the players feeding it.' },
  { id: 'reg-big-jac', term: 'REG / BIG / JAC (pachislo bonuses)', def: 'Pachislo\'s bonus ladder: REG (regular) pays a short bonus round, BIG pays a long one, and JAC games are the high-paying hands inside a bonus. When your history shows "BIG bonus", the flag lottery drew it before you ever pressed stop.', link: { to: '/learn/pachislo', label: 'the bonus machinery' } },
  { id: 'risk-of-ruin', term: 'Risk of ruin', def: 'The probability you lose the whole bankroll before you stop. Not a feeling — a measurable number: run thousands of simulated sessions and count the busts.', link: { to: '/sim-lab', label: 'measure it live' } },
  { id: 'rng', term: 'RNG (random number generator)', def: 'The only gambler in the machine: a stream of numbers, drawn fresh every spin, that picks the outcome before the reels move. The spinning is theater; the draw is the game. Every machine here shows you its draws in the X-ray panel.', link: { to: '/learn/myths', label: 'watch independence hold across 250,000 draws' } },
  { id: 'rtp', term: 'RTP (return to player)', def: 'The share of all wagers a machine pays back over the long run — 90% RTP returns $90 of every $100, eventually. Every RTP on this floor is computed exactly from the machine definition, never asserted.', link: { to: '/learn/house-edge', label: 'every machine\'s number' } },
  { id: 'scatter', term: 'Scatter / pay-anywhere', def: 'A win that counts symbols anywhere on the grid instead of along a payline — the basis of tumble machines like Temple of Gold.', link: { to: '/learn/cascade-tumble', label: 'the tumble math' } },
  { id: 'skill-stop', term: 'Skill stop', def: 'Buttons that let you stop the reels yourself. On pachislo machines an internal flag lottery has already decided whether you may win; your press only picks the moment — the slip does the rest.', link: { to: '/learn/pachislo', label: 'the lottery and the slip' } },
  { id: 'slip', term: 'Slip (pachislo)', def: 'The machine\'s quiet correction after a skill stop: it may slide the reel up to four symbols past where you pressed, so the outcome obeys the flag lottery — not your timing.', link: { to: '/learn/pachislo', label: 'watch the slip work' } },
  { id: 'sd-per-coin', term: 'Standard deviation (sd/coin)', def: 'The volatility number on the machine cards: how far one spin\'s result typically swings from the average, per coin bet. Higher sd = wilder ride at the same RTP.' },
  { id: 'stock', term: 'Stock (pachislo)', def: 'A bonus the lottery has already awarded but the machine is still holding back, to be released a few games later. Stock-era machines used it to smooth payouts — and to make streaks feel real.', link: { to: '/learn/pachislo', label: 'the stock meter, live' } },
  { id: 'time-on-device', term: 'Time on device', def: 'The slot industry\'s actual success metric: not what you lose per spin but how long you keep spinning. Fast cadence, credits instead of dollars, no natural stopping points — the design goal is that you never quite find the exit. This floor builds the exits in.', link: { to: '/learn/psychology', label: 'why the room has no clocks' } },
  { id: 'tumble', term: 'Tumble (cascade)', def: 'Winning symbols shatter, survivors fall, fresh symbols drop in, and the new grid is judged again — a chain of pays inside one bet, usually with a climbing multiplier ladder.', link: { to: '/learn/cascade-tumble', label: 'why the exact math is hard' } },
  { id: 'variable-ratio', term: 'Variable-ratio reinforcement', def: 'The psychology-lab name for a slot machine\'s payout schedule: rewards arrive after an unpredictable number of tries. It is the most persistence-inducing schedule known to behavioral science — pigeons peck at it until exhaustion, and it is the reason "one more spin" feels like a plan.', link: { to: '/learn/psychology', label: 'the schedule, demonstrated' } },
  { id: 'virtual-reel', term: 'Virtual reel (Telnaes)', def: 'The 1984 patent behind modern steppers: each physical stop is mapped to many "virtual" stops, so a 22-stop reel can behave like a 128-stop one. It is how big jackpots — and engineered near misses — fit on three reels.', link: { to: '/learn/telnaes-reels', label: 'physical vs virtual, live' } },
  { id: 'volatility', term: 'Volatility (variance)', def: 'How wild the ride is at the same RTP. Low volatility pays small and often; high volatility starves you between rare big hits. Two machines can share an RTP and feel nothing alike.' },
  { id: 'ways', term: 'Ways (e.g. 243-ways)', def: 'Instead of paylines, any left-to-right run of adjacent reels pays: 3 rows across 5 reels = 3⁵ = 243 ways. More "ways" mostly means more chances at sub-bet wins.' },
  { id: 'wild', term: 'Wild', def: 'A symbol that stands in for others to complete a win — and often multiplies the pay when it does. Wilds are why paytables have footnotes.' }
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
        :id="e.id"
        :key="e.term"
        class="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 scroll-mt-4"
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
