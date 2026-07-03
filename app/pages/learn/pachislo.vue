<!-- app/pages/learn/pachislo.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { STOCK_RUSH } from '~/machines/stock-rush'
import { exactRtp } from '~/engine'
import { formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const def = STOCK_RUSH

// The six operator settings, each computed exactly from the machine definition.
const levels = computed(() => def.oddsLevels.map((_, i) => {
  const rtp = exactRtp(def, { oddsLevel: i + 1 }).rtpPerCoin
  return { level: i + 1, rtp, houseEdge: 1 - rtp, isDefault: i + 1 === def.defaultOddsLevel }
}))
const defaultRtp = computed(() => levels.value.find(l => l.isDefault)!.rtp)
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
      Pachislo (skill-stop)
    </h1>

    <LearnSection
      title="The lottery decides; the reels obey"
      :headline="formatPercent(defaultRtp)"
      headline-label="Stock Rush exact RTP at the factory default (level 4) — computed live"
    >
      <template #intuition>
        <p>
          A pachislo machine looks like the one slot where <em>you</em> are in control:
          the reels spin nonstop and you stop each one yourself with a button. Here is
          what actually happens. The moment you start a game, an internal
          <strong>flag lottery</strong> runs — before any reel stops. Draw a
          <strong>flag</strong> (cherry, bell, REG bonus, BIG bonus…) and the machine
          is now <em>allowed</em> to pay that prize. Draw nothing, and no win can land,
          period — no matter how perfectly you time your presses.
        </p>
        <p>
          The reels obey through the <strong>slip</strong>: when you press, the machine
          honors your stop only within a window of up to <strong>4 stops</strong>. Flag
          drawn? The reel slips to <em>make</em> the win land. No flag? It slips to
          <em>avoid</em> one. Your timing changes <strong>when</strong> you win — never
          <strong>how much</strong>. And bonus flags you draw but don't land are
          <strong>stocked</strong>: they queue up and wait, never lost, which is what
          made the parlor "stock era" so notorious.
        </p>
        <p>
          This isn't an accusation — it's the design, and this floor proves it: an
          exhaustive check of all 21³ stop combinations confirms that no winning line
          can appear without its flag. Watch the slip happen live in Stock Rush's
          X-ray while you press <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd>.
        </p>
      </template>
    </LearnSection>

    <LearnSection title="The operator key">
      <template #intuition>
        <p>
          The house's real control isn't the reels — it's a six-position
          <strong>operator</strong> setting inside the cabinet that scales the flag
          lottery itself. Same machine, same paytable, same slip: only the invisible
          draw rates change. The manual's bands run from stingy (~66% return) to
          promotional (over 100% — parlors genuinely run loss-leader machines).
          You can turn the same key in this simulator and watch the X-ray odds move.
        </p>
      </template>
      <LearnDisclosure label="Show the math — exact RTP at every operator level">
        <table class="w-full text-xs font-mono">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">
                Level
              </th>
              <th class="py-1 px-2 text-right">
                Exact RTP
              </th>
              <th class="py-1 pl-2 text-right">
                House edge
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr
              v-for="l in levels"
              :key="l.level"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ l.level }}<span
                  v-if="l.isDefault"
                  class="text-amber-400"
                > · default</span>
              </td>
              <td
                class="py-1 px-2 text-right"
                :class="l.rtp >= 1 ? 'text-amber-300' : 'text-emerald-400'"
              >
                {{ formatPercent(l.rtp) }}
              </td>
              <td
                class="py-1 pl-2 text-right"
                :class="l.houseEdge < 0 ? 'text-amber-300' : 'text-rose-400'"
              >
                {{ formatPercent(l.houseEdge) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          Every figure is computed at render time from the machine definition via
          <code>exactRtp(def, { oddsLevel })</code> — a level above 100% RTP is a
          player-favorable promotional setting, and its "house edge" goes negative.
        </p>
      </LearnDisclosure>
      <NuxtLink
        to="/game?m=stock-rush"
        class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
      >
        <UIcon
          name="i-lucide-play"
          class="w-4 h-4"
        />
        Play Stock Rush — stop the reels yourself →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
