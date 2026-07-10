<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { exactRtpAsync } from '~/utils/rtpClient'
import { crashOdds } from '~/engine/blackjackReelRtp'
import { bonusEv, bonusOdds } from '~/engine/lockReelRtp'
import { pachisloBonusValues } from '~/engine/pachisloRtp'
import { formatOdds, formatPercent } from '~/utils/format'
import type { ExactRtpReport, MachineDef } from '~/engine'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const store = useSlotsStore()
const def = computed(() => store.currentDef)
const tab = ref<'strips' | 'paytable' | 'math'>('strips')

// Cascade has no reel strips — drop that tab and default to the paytable.
const tabs = computed<('strips' | 'paytable' | 'math')[]>(() =>
  def.value?.family === 'cascade' ? ['paytable', 'math'] : ['strips', 'paytable', 'math'])
watch([() => props.open, def], ([open]) => {
  if (open && !tabs.value.includes(tab.value)) tab.value = tabs.value[0]!
}, { immediate: true })

/** the joint pass for video machines costs ~1s — computed in the rtp.worker */
const report = ref<ExactRtpReport | null>(null)
const computing = ref(false)
let reportToken = 0
watch([() => props.open, def, tab], async ([open, d, t]) => {
  const token = ++reportToken
  if (!open || d === null || t !== 'math') return
  report.value = null
  computing.value = true
  // Report hit frequency/volatility at the active line count for 'lines'
  // machines (currentBet); RTP/coin is unaffected. Pachislo is keyed by level.
  const opts = d.family === 'pachislo'
    ? { oddsLevel: store.currentState?.pachislo?.oddsLevel ?? undefined }
    : { coins: store.currentBet }
  const result = await exactRtpAsync(d, opts)
  if (token !== reportToken) return // tab/machine changed mid-compute
  report.value = result
  computing.value = false
}, { immediate: true })

interface StripRow { symbol: string, label: string, counts: number[], weights?: number[] }
const stripRows = computed<StripRow[]>(() => {
  const d = def.value
  if (d === null) return []
  if (d.family === 'cascade') return [] // cascade has no reel strips (it has its own panel)
  const strips = d.family === 'stepper' || d.family === 'wheel'
    ? d.physicalStrips
    : d.family === 'blackjack-reel' || d.family === 'lock-reel' ? d.reels : d.strips
  const symbols = Object.keys(d.symbols)
  return symbols.map((symbol) => {
    const counts = strips.map(strip => strip.filter(c => c === symbol).length)
    const row: StripRow = { symbol, label: d.symbols[symbol]?.label ?? symbol, counts }
    if (d.family === 'stepper' || d.family === 'wheel') {
      row.weights = d.virtualMaps.map((vmap, r) =>
        vmap.filter(idx => d.physicalStrips[r]![idx] === symbol).length)
    }
    return row
  }).filter(row => row.counts.some(c => c > 0))
})

const virtualSizes = computed(() =>
  def.value?.family === 'stepper' || def.value?.family === 'wheel' ? def.value.virtualMaps.map(v => v.length) : [])

/**
 * Lock-reel (Stop & Lock 777) only: the DEDICATED bonus strips' per-symbol
 * counts. The 777 hold-and-spin respins draw from these denser strips — not the
 * sparse base `reels` shown above — so cash genuinely keeps locking.
 */
const bonusStripRows = computed<StripRow[]>(() => {
  const d = def.value
  if (d === null || d.family !== 'lock-reel') return []
  const symbols = Object.keys(d.symbols)
  return symbols.map((symbol) => {
    const counts = d.bonusReels.map(strip => strip.filter(c => c === symbol).length)
    return { symbol, label: d.symbols[symbol]?.label ?? symbol, counts }
  }).filter(row => row.counts.some(c => c > 0))
})
const baseStripLen = computed(() => def.value?.family === 'lock-reel' ? (def.value.reels[0]?.length ?? 0) : 0)
const bonusStripLen = computed(() => def.value?.family === 'lock-reel' ? (def.value.bonusReels[0]?.length ?? 0) : 0)

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

/** Human-readable label for a blackjack-reel (crash) breakdown entry ID. */
function breakdownLabel(entryId: string): string {
  if (entryId === 'crash') return 'Crash (loss)'
  if (entryId === 'cash') return 'Cashed out'
  if (entryId === 'topped') return 'Topped out (all five)'
  return entryId
}

/** Human-readable label for a lock-reel (cash-collect) breakdown entry ID. */
function wheelBreakdownLabel(entryId: string): string {
  const m = /^wedge-(\d+)$/.exec(entryId)
  if (m !== null) return Number(m[1]) >= 2500 ? `Wheel wedge — MEGA ${m[1]}` : `Wheel wedge: ${m[1]} credits`
  return entryId
}

function lockBreakdownLabel(entryId: string): string {
  if (entryId === 'base-cash') return 'Base collect (5 stops)'
  if (entryId === 'bonus-cash') return '777 bonus — cash locked'
  if (entryId === 'seven-upgrade') return '777 bonus — 7 upgrades'
  if (entryId === 'grand') return '777 bonus — GRAND (grid fill)'
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
    case 'blackjack-reel': {
      const reels = crashOdds(d) // [reel3, reel4, reel5]
      return [
        ...d.launchTable.map(e => ({ id: `launch-${e.atLeast}`, text: `Launch · total ≥ ${e.atLeast}`, pay: `×${e.mult.toFixed(2)}` })),
        { id: 'natural-launch', text: 'Launch · natural 21', pay: `×${d.naturalLaunch.toFixed(2)}` },
        ...reels.map((p, i) => ({ id: `crash-${i + 3}`, text: `Reel ${i + 3} crash chance`, pay: `${(p * 100).toFixed(0)}%` }))
      ]
    }
    case 'lock-reel': {
      const trigger = bonusOdds(d)
      return [
        ...Object.entries(d.cashValues).map(([id, v]) => ({ id, text: `${d.symbols[id]?.label ?? id} (cash collect)`, pay: `${v}` })),
        ...Object.entries(d.prizes).map(([id, v]) => ({
          id,
          text: id === d.bonus.grandOnFill ? `${d.symbols[id]?.label ?? id} (777 bonus — fill the grid)` : `${d.symbols[id]?.label ?? id} (fixed prize)`,
          pay: `${v}`
        })),
        { id: 'bonus-sticky-7', text: `Sticky 7 upgrade (777 bonus, per 7)`, pay: `${d.bonus.sevenUpgrade}` },
        { id: 'bonus-trigger', text: '777 BONUS — trigger (3 sevens)', pay: formatOdds(trigger) },
        { id: 'bonus-ev', text: '777 BONUS — EV given trigger', pay: `${bonusEv(d).toFixed(2)} cr` }
      ]
    }
    case 'cascade':
      return [
        ...Object.entries(d.paytable).flatMap(([sym, tiers]) =>
          tiers.map(t => ({
            id: `${sym}-${t.countAtLeast}`,
            text: `${d.symbols[sym]?.label ?? sym} × ${t.countAtLeast}+ anywhere`,
            pay: `×${t.pay}/coin`
          }))),
        { id: 'grand', text: `${d.symbols[d.idolSymbol]?.label ?? d.idolSymbol} × ${d.grandTrigger}+ — GRAND`, pay: `${d.progressive?.reset ?? 0}+ cr` }
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
            v-for="t in tabs"
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
            <template v-else-if="def.family === 'lock-reel'">
              {{ baseStripLen }}-cell BASE strips — long and blank-heavy, so each uniform 4-cell stop window rarely catches cash. Every stop is exactly 1/{{ baseStripLen }}; there is no weighting, only counts.
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

          <div
            v-if="bonusStripRows.length"
            class="space-y-2 pt-2"
            data-test="bonus-strips"
          >
            <p class="text-[11px] text-amber-400/90">
              777 BONUS strips — {{ bonusStripLen }} cells each, ~25× denser than the base. The hold-and-spin respins draw from THESE, so cash genuinely keeps locking and the grid can fill the GRAND.
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
                    v-for="(_, r) in bonusStripRows[0]?.counts ?? []"
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
                  v-for="row in bonusStripRows"
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
          <p
            v-if="def.family === 'lock-reel'"
            class="text-[11px] text-neutral-400 leading-relaxed"
            data-test="lock-explainer"
          >
            <strong class="text-neutral-300">Collection, not paylines.</strong>
            You STOP each reel left-to-right; every cash symbol and fixed prize in the window BANKS — nothing is ever wiped out. Each stop is an honest
            <strong class="text-neutral-300">skill-stop</strong>: a uniform draw from the strip, so your timing feels skillful but doesn't change the odds.
            Lock three 7s in one pass and the <strong class="text-neutral-300">777 BONUS</strong> fires — a free hold-and-spin where held cash sticks, every still-empty cell respins off the denser bonus strips, and filling the whole grid pays the
            <strong class="text-neutral-300">GRAND</strong>. See the strips, know the edge.
          </p>
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
                    {{ def.family === 'blackjack-reel' ? breakdownLabel(b.entryId) : def.family === 'lock-reel' ? lockBreakdownLabel(b.entryId) : def.family === 'wheel' ? wheelBreakdownLabel(b.entryId) : b.entryId }}
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

            <p
              v-if="def.family === 'blackjack-reel'"
              class="text-[10px] text-neutral-400"
            >
              Optimal play: climb while the crash odds keep the push +EV; cash once they don't.
            </p>
            <p
              v-if="def.family === 'lock-reel'"
              class="text-[10px] text-neutral-400"
            >
              No play decision to optimize — each stop is a uniform draw. Value lives in the base collect plus the rare 777 hold-and-spin (cash + sticky-7 upgrades + the GRAND on a fill).
            </p>
          </template>
        </div>
        <!-- PAR sheet explainer — always visible below the tab content -->
        <div class="pt-4 mt-2 border-t border-neutral-800/60 space-y-1">
          <p class="text-[11px] font-semibold text-neutral-300 uppercase tracking-widest">
            What's a PAR sheet?
          </p>
          <p class="text-[11px] text-neutral-400 leading-relaxed">
            <strong class="text-neutral-300">PAR</strong> stands for
            <strong class="text-neutral-300">Paytable And Reels</strong>
            (also called a <strong class="text-neutral-300">Probability Accounting Report</strong>).
            It's a slot machine's internal specification: the reel strips (every symbol and how often it appears),
            the paytable (what each outcome pays), and the resulting math —
            <strong class="text-neutral-300">RTP</strong> (return to player),
            <strong class="text-neutral-300">hit frequency</strong>, and
            <strong class="text-neutral-300">volatility</strong>.
            Manufacturers file it with gaming regulators to certify the machine; it's normally
            <strong class="text-neutral-300">confidential</strong> — players never see it.
            This simulator shows it so you can see exactly the math a real casino keeps hidden.
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
