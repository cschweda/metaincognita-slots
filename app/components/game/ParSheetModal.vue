<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { exactRtp } from '~/engine'
import { pachisloBonusValues } from '~/engine/pachisloRtp'
import { optimalAction } from '~/engine/blackjackReelRtp'
import { formatOdds, formatPercent } from '~/utils/format'
import type { ExactRtpReport, MachineDef } from '~/engine'
import type { BlackjackReelSessionState } from '~/engine/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const store = useSlotsStore()
const def = computed(() => store.currentDef)
const tab = ref<'strips' | 'paytable' | 'math'>('strips')

/** the joint pass for video machines costs ~1s on first compute — load lazily */
const report = ref<ExactRtpReport | null>(null)
const computing = ref(false)
watch([() => props.open, def, tab], async ([open, d, t]) => {
  if (!open || d === null || t !== 'math') return
  report.value = null
  computing.value = true
  await new Promise(resolve => setTimeout(resolve, 30)) // let the modal paint first
  // Report hit frequency/volatility at the active line count for 'lines'
  // machines (currentBet); RTP/coin is unaffected. Pachislo is keyed by level.
  const opts = d.family === 'pachislo'
    ? { oddsLevel: store.currentState?.pachislo?.oddsLevel ?? undefined }
    : { coins: store.currentBet }
  report.value = exactRtp(d, opts)
  computing.value = false
}, { immediate: true })

interface StripRow { symbol: string, label: string, counts: number[], weights?: number[] }
const stripRows = computed<StripRow[]>(() => {
  const d = def.value
  if (d === null) return []
  const strips = d.family === 'stepper' ? d.physicalStrips : d.strips
  const symbols = Object.keys(d.symbols)
  return symbols.map((symbol) => {
    const counts = strips.map(strip => strip.filter(c => c === symbol).length)
    const row: StripRow = { symbol, label: d.symbols[symbol]?.label ?? symbol, counts }
    if (d.family === 'stepper') {
      row.weights = d.virtualMaps.map((vmap, r) =>
        vmap.filter(idx => d.physicalStrips[r]![idx] === symbol).length)
    }
    return row
  }).filter(row => row.counts.some(c => c > 0))
})

const virtualSizes = computed(() =>
  def.value?.family === 'stepper' ? def.value.virtualMaps.map(v => v.length) : [])

const pachisloLevel = computed(() => store.currentState?.pachislo?.oddsLevel ?? null)
const pachisloRates = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'pachislo' || pachisloLevel.value === null) return null
  const lv = d.oddsLevels[pachisloLevel.value - 1]!
  return [
    { flag: 'cherry (each row ×3)', n: d.baseRates.cherryPerRow },
    { flag: 'watermelon', n: d.baseRates.watermelon },
    { flag: 'bell', n: lv.bell },
    { flag: 'replay', n: d.baseRates.replay },
    { flag: 'REG', n: lv.reg },
    { flag: 'BIG', n: lv.big }
  ]
})
const bonusValues = computed(() => {
  const d = def.value
  return d !== null && d.family === 'pachislo' ? pachisloBonusValues(d) : null
})

// For pachislo the breakdown's avgPayPerCoin is each flag's renewal value ÷ tokens
// in (out/IN), not credits paid — so don't mislabel it "Avg pay/coin".
const payColLabel = computed(() => def.value?.family === 'pachislo' ? 'Value ÷ IN' : 'Avg pay/coin')

/**
 * Optimal strategy table for the blackjack-reel PAR sheet.
 * Samples the DP policy across representative totals × save/mult states and
 * collapses to human-readable rows shown in the math tab.
 */
const bjStrategy = computed(() => {
  const d = def.value
  if (d === null || d.family !== 'blackjack-reel') return null

  interface StrategyRow { condition: string, action: 'hit' | 'stand', note: string }
  const rows: StrategyRow[] = []

  // Helper: build a minimal session state and query the policy.
  const query = (cards: string[], saveHeld: boolean, total: number, isSoft: boolean): 'hit' | 'stand' => {
    const state: BlackjackReelSessionState = {
      phase: 'dealt', cards, total, isSoft,
      multSum: 0, saveHeld, busted: false, charlie: false, ante: 1
    }
    return optimalAction(d, state)
  }
  const queryMult = (cards: string[], saveHeld: boolean, total: number, isSoft: boolean): 'hit' | 'stand' => {
    const state: BlackjackReelSessionState = {
      phase: 'dealt', cards, total, isSoft,
      multSum: 2, saveHeld, busted: false, charlie: false, ante: 1
    }
    return optimalAction(d, state)
  }

  // Hard totals (2-card deal, no save, no mult): totals 4–17
  // Determine the threshold where stand becomes optimal (hard, no save, no mult)
  let hardThreshold = 21
  for (let t = 4; t <= 21; t++) {
    const cards = t >= 10 ? ['CK', 'CA'] : ['C2', 'C2'] // dummy cards — only total matters via summarize
    // Use two-card hand so handSize=2, draw from reel[2]
    const act = query([cards[0]!, cards[1]!], false, t, false)
    if (act === 'stand') {
      hardThreshold = t
      break
    }
  }
  rows.push({
    condition: `Hard ≤${hardThreshold - 1}`,
    action: 'hit',
    note: 'Risk is worth the higher total'
  })
  rows.push({
    condition: `Hard ${hardThreshold}+`,
    action: 'stand',
    note: 'Standing EV ≥ hit EV'
  })

  // Soft 17 (A+6) — classic borderline: check with and without save
  const softAct = query(['CA', 'C6'], false, 17, true)
  rows.push({
    condition: 'Soft 17 (Ace + 6)',
    action: softAct,
    note: softAct === 'hit' ? 'Ace cushion makes hitting +EV' : 'Stand (no gain from hitting)'
  })

  // With a multiplier held — typically widens the hit range (bigger payoff amplifies the upside)
  let hardMultThreshold = 21
  for (let t = 4; t <= 21; t++) {
    const act = queryMult(['CK', 'C2'], false, t, false)
    if (act === 'stand') {
      hardMultThreshold = t
      break
    }
  }
  if (hardMultThreshold !== hardThreshold) {
    rows.push({
      condition: `Hard ≤${hardMultThreshold - 1} (multiplier held)`,
      action: 'hit',
      note: 'Multiplier amplifies upside; hit threshold rises'
    })
    rows.push({
      condition: `Hard ${hardMultThreshold}+ (multiplier held)`,
      action: 'stand',
      note: 'Even with ×N, standing wins'
    })
  } else {
    rows.push({
      condition: 'With multiplier held',
      action: 'hit',
      note: `Same threshold (${hardThreshold}) — multiplier doesn't change break-even`
    })
  }

  // With bust-save held — save extends the hit range
  let hardSaveThreshold = 21
  for (let t = 4; t <= 21; t++) {
    const act = query(['CK', 'C2'], true, t, false)
    if (act === 'stand') {
      hardSaveThreshold = t
      break
    }
  }
  if (hardSaveThreshold !== hardThreshold) {
    rows.push({
      condition: `Hard ≤${hardSaveThreshold - 1} (Bust Save held)`,
      action: 'hit',
      note: 'Save provides insurance; hit threshold rises'
    })
    rows.push({
      condition: `Hard ${hardSaveThreshold}+ (Bust Save held)`,
      action: 'stand',
      note: 'Even with a save, standing is optimal'
    })
  }

  return { rows, hardThreshold, hardSaveThreshold, hardMultThreshold }
})

/** Human-readable label for a breakdown entry ID (e.g. "total-20" → "Total 20"). */
function breakdownLabel(entryId: string): string {
  if (entryId === 'bust') return 'Bust (loss)'
  if (entryId === 'charlie') return 'Five-Card Charlie'
  if (entryId.startsWith('total-')) return `Total ${entryId.slice(6)}`
  return entryId
}

function payRows(d: MachineDef): { id: string, text: string, pay: string }[] {
  switch (d.family) {
    case 'video':
      return d.paytable.map(e => ({
        id: e.id,
        text: `${d.symbols[e.symbol]?.label ?? e.symbol} × ${e.length}`,
        pay: `${e.pay}`
      }))
    case 'stepper':
      return d.paytable.map(e => ({
        id: e.id,
        text: e.kind === 'allWild'
          ? 'All wilds'
          : e.kind === 'allSame'
            ? `3 × ${d.symbols[e.symbol]?.label ?? e.symbol}${e.progressiveAtMaxCoins ? ' (PROGRESSIVE @ max coins)' : ''}`
            : e.kind === 'anyOf'
              ? `Any of ${e.symbols.join('/')}`
              : `${e.n} × ${d.symbols[e.symbol]?.label ?? e.symbol} anywhere`,
        pay: `${e.pay}`
      }))
    case 'bally-em':
      return d.paytable.map(e => ({
        id: e.id,
        text: e.kind === 'run'
          ? `${e.length} × ${d.symbols[e.symbol]?.label ?? e.symbol}${e.progressive ? ` (PROGRESSIVE ${e.progressive})` : ''}`
          : `All ${d.symbols[e.symbol]?.label ?? e.symbol}`,
        pay: `${e.pay}`
      }))
    case 'pachislo':
      return [
        { id: 'cherry', text: 'Cherry (per line through its cell)', pay: `${d.pays.cherryPerLine}` },
        { id: 'watermelon', text: 'Watermelon × 3', pay: `${d.pays.watermelon}` },
        { id: 'bell', text: 'Bell × 3', pay: `${d.pays.bell}` },
        { id: 'reg', text: 'REG lined (then 8 guaranteed wins)', pay: `${d.pays.bonusLined}` },
        { id: 'big', text: 'BIG lined (then 3 rounds of 8)', pay: `${d.pays.bonusLined}` }
      ]
    case 'blackjack-reel':
      return [
        ...d.paytable.map(e => ({
          id: `total-${e.total}`,
          text: `Hand total ${e.total}`,
          pay: `${e.pay} per coin`
        })),
        {
          id: 'charlie-bonus',
          text: `Five-Card Charlie bonus (added on top)`,
          pay: `+${d.charlieBonus} per coin`
        }
      ]
    default: {
      const exhaustive: never = d
      throw new Error(`unhandled family: ${(exhaustive as MachineDef).family}`)
    }
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="`PAR sheet — ${def?.name ?? ''}`"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        v-if="def"
        class="space-y-4"
      >
        <div class="flex items-center gap-2">
          <UButton
            v-for="t in (['strips', 'paytable', 'math'] as const)"
            :key="t"
            :data-test="`tab-${t}`"
            size="xs"
            :color="tab === t ? 'primary' : 'neutral'"
            :variant="tab === t ? 'solid' : 'outline'"
            @click="tab = t"
          >
            {{ t === 'strips' ? 'Strips & weights' : t === 'paytable' ? 'Paytable' : 'Exact math' }}
          </UButton>
        </div>

        <div
          v-if="tab === 'strips'"
          class="space-y-2"
        >
          <p class="text-[11px] text-neutral-400">
            <template v-if="def.family === 'stepper'">
              Physical stops are what you watch; the RNG draws over the VIRTUAL entries (Telnaes 1984).
            </template>
            <template v-else-if="def.family === 'bally-em'">
              Uniform physical stops — every stop is exactly 1/{{ def.stops }}. No weighting exists on this machine.
            </template>
            <template v-else-if="def.family === 'pachislo'">
              21 stops per reel. Strips only place wins; the /16384 lottery decides them.
            </template>
            <template v-else>
              24-cell strips — short enough that the app enumerates the complete 24⁵ cycle exactly.
            </template>
          </p>
          <table class="w-full text-xs font-mono">
            <thead>
              <tr class="text-neutral-400 text-left">
                <th
                  scope="col"
                  class="py-1 pr-3"
                >
                  Symbol
                </th>
                <th
                  v-for="(_, r) in stripRows[0]?.counts ?? []"
                  :key="r"
                  scope="col"
                  class="py-1 pr-3 text-right"
                >
                  Reel {{ r + 1 }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/60">
              <tr
                v-for="row in stripRows"
                :key="row.symbol"
              >
                <td class="py-1 pr-3 text-neutral-300">
                  {{ row.label }}
                </td>
                <td
                  v-for="(c, r) in row.counts"
                  :key="r"
                  class="py-1 pr-3 text-right text-neutral-400"
                >
                  {{ row.label }} × {{ c }}
                  <span
                    v-if="row.weights"
                    class="text-amber-400/80 block text-[10px]"
                  >
                    weight {{ row.weights[r] }} of {{ virtualSizes[r] }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-else-if="tab === 'paytable'"
          class="space-y-3"
        >
          <table class="w-full text-xs font-mono">
            <tbody class="divide-y divide-neutral-800/60">
              <tr
                v-for="row in payRows(def)"
                :key="row.id"
              >
                <th
                  scope="row"
                  class="py-1 pr-3 text-left font-normal text-neutral-300"
                >
                  {{ row.text }}
                </th>
                <td class="py-1 text-right text-amber-300">
                  {{ row.pay }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="pachisloRates"
            class="space-y-1"
          >
            <div class="text-[11px] text-neutral-400">
              Flag lottery at level {{ pachisloLevel }} (counts of 16384 per game):
            </div>
            <table class="w-full text-xs font-mono">
              <tbody class="divide-y divide-neutral-800/60">
                <tr
                  v-for="row in pachisloRates"
                  :key="row.flag"
                >
                  <th
                    scope="row"
                    class="py-1 pr-3 text-left font-normal text-neutral-300"
                  >
                    {{ row.flag }}
                  </th>
                  <td class="py-1 text-right text-neutral-400">
                    {{ row.n }} / 16384
                  </td>
                  <td class="py-1 text-right text-neutral-400">
                    {{ formatOdds(row.n / 16384) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="bonusValues"
              class="text-[11px] text-neutral-400"
            >
              E[REG] = {{ bonusValues.regOut }} tokens gross · E[BIG] = {{ bonusValues.bigOut.toFixed(2) }} tokens
              (ceiling {{ bonusValues.bigMaxOut }} — the manual's "35 payouts")
            </div>
          </div>
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <div
            v-if="computing"
            class="text-sm text-neutral-400"
          >
            Enumerating the complete cycle…
            <span v-if="def.family === 'video'">(all 7,962,624 reel states — about a second)</span>
          </div>
          <template v-else-if="report">
            <div class="grid grid-cols-3 gap-2 font-mono text-center">
              <div class="rounded-lg bg-neutral-950 border border-neutral-800 px-2 py-2">
                <div class="text-[9px] uppercase tracking-widest text-neutral-400">
                  Exact RTP
                </div>
                <div class="text-emerald-400">
                  {{ formatPercent(report.rtpPerCoin, 4) }}
                </div>
              </div>
              <div class="rounded-lg bg-neutral-950 border border-neutral-800 px-2 py-2">
                <div class="text-[9px] uppercase tracking-widest text-neutral-400">
                  Hit freq
                </div>
                <div class="text-neutral-200">
                  {{ formatPercent(report.hitFrequency, 4) }}
                </div>
              </div>
              <div class="rounded-lg bg-neutral-950 border border-neutral-800 px-2 py-2">
                <div class="text-[9px] uppercase tracking-widest text-neutral-400">
                  Volatility
                </div>
                <div class="text-neutral-200">
                  {{ Math.sqrt(report.variancePerCoin).toFixed(2) }} sd
                </div>
              </div>
            </div>
            <table class="w-full text-xs font-mono">
              <thead>
                <tr class="text-neutral-400 text-left">
                  <th
                    scope="col"
                    class="py-1 pr-2"
                  >
                    Award
                  </th>
                  <th
                    scope="col"
                    class="py-1 pr-2 text-right"
                  >
                    Probability
                  </th>
                  <th
                    scope="col"
                    class="py-1 pr-2 text-right"
                  >
                    {{ payColLabel }}
                  </th>
                  <th
                    scope="col"
                    class="py-1 text-right"
                  >
                    RTP share
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-800/60">
                <tr
                  v-for="b in report.breakdown"
                  :key="b.entryId"
                >
                  <td class="py-1 pr-2 text-neutral-300">
                    {{ def.family === 'blackjack-reel' ? breakdownLabel(b.entryId) : b.entryId }}
                  </td>
                  <td class="py-1 pr-2 text-right text-neutral-400">
                    {{ formatOdds(b.probability) }}
                  </td>
                  <td class="py-1 pr-2 text-right text-neutral-400">
                    {{ b.avgPayPerCoin.toFixed(3) }}
                  </td>
                  <td class="py-1 text-right text-amber-300">
                    {{ formatPercent(b.contribution, 3) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              v-if="def.family === 'pachislo'"
              class="text-[10px] text-neutral-400"
            >
              Pachislo column is each flag's renewal value ÷ tokens in (so probability × value = RTP share), not credits paid.
            </p>
            <p class="text-[10px] text-neutral-400">
              RTP-share column sums to the exact RTP. Every figure derives from the machine definition at render time.
            </p>

            <!-- Blackjack-reel: optimal strategy derived from the DP -->
            <template v-if="def.family === 'blackjack-reel' && bjStrategy">
              <div class="text-[10px] uppercase tracking-widest text-neutral-400 pt-1">
                Optimal strategy (DP-derived, assumes this machine's strips)
              </div>
              <table
                class="w-full text-xs font-mono"
                data-test="bj-strategy-table"
              >
                <thead>
                  <tr class="text-neutral-400 text-left">
                    <th
                      scope="col"
                      class="py-1 pr-2"
                    >
                      Situation
                    </th>
                    <th
                      scope="col"
                      class="py-1 pr-2 text-center"
                    >
                      Action
                    </th>
                    <th
                      scope="col"
                      class="py-1 text-left"
                    >
                      Why
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-800/60">
                  <tr
                    v-for="row in bjStrategy.rows"
                    :key="row.condition"
                  >
                    <td class="py-1 pr-2 text-neutral-300">
                      {{ row.condition }}
                    </td>
                    <td
                      class="py-1 pr-2 text-center font-bold"
                      :class="row.action === 'hit' ? 'text-amber-300' : 'text-emerald-400'"
                    >
                      {{ row.action.toUpperCase() }}
                    </td>
                    <td class="py-1 text-neutral-400 text-[10px]">
                      {{ row.note }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p class="text-[10px] text-neutral-400">
                Strategy assumes no prior knowledge of upcoming cards (each reel is independent).
                Bust rate {{ formatPercent(1 - report.hitFrequency, 2) }} · Charlie rate
                {{ formatPercent(report.breakdown.find(b => b.entryId === 'charlie')?.probability ?? 0, 2) }}.
              </p>
            </template>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
