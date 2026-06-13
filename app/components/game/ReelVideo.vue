<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { formatCredits } from '~/utils/format'
import type { VideoMachineDef } from '~/engine'

const store = useSlotsStore()
const reduced = useReducedMotion()

const def = computed(() => store.currentDef as VideoMachineDef | null)
const feature = computed(() => store.currentState?.videoFeature ?? null)
const hns = computed(() => feature.value?.kind === 'holdAndSpin' ? feature.value : null)
const fs = computed(() => feature.value?.kind === 'freeSpins' ? feature.value : null)

/** outcome grid, falling back to top-of-strip columns before the first spin */
const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id && out.grid.length === 5 && out.gameKind !== 'respin') {
    return out.grid
  }
  return d.strips.map(s => [s[0]!, s[1]!, s[2]!])
})

/** cells to highlight: "reel:row" keys from line/ways wins */
const winCells = computed<Set<string>>(() => {
  const cells = new Set<string>()
  const d = def.value
  const out = store.lastOutcome
  if (d === null || out === null || revealedReels.value < 5) return cells
  for (const w of out.wins) {
    const m = /^line-(\d+)$/.exec(w.line)
    if (m !== null && d.betMode.kind === 'lines') {
      const pattern = d.betMode.lines[Number(m[1]) - 1]
      if (pattern === undefined) continue
      for (let r = 0; r < w.symbols.length && r < 5; r++) cells.add(`${r}:${pattern[r]}`)
    } else if (w.line.startsWith('ways-')) {
      // symbols[0] is always entry.symbol — the engine fills ways-win
      // symbols with the paying symbol, never the substituting wild
      const sym = w.symbols[0]
      grid.value.forEach((col, r) => col.forEach((cell, row) => {
        if (cell === sym || (d.wildSymbol !== null && cell === d.wildSymbol)) cells.add(`${r}:${row}`)
      }))
    }
  }
  return cells
})

const revealedReels = ref(5)
let timers: ReturnType<typeof setTimeout>[] = []

watch(() => store.spinning, (spinning) => {
  timers.forEach(clearTimeout)
  timers = []
  if (!spinning) return
  if (reduced.value || store.lastOutcome?.gameKind === 'respin') {
    revealedReels.value = 5
    store.revealDone()
    return
  }
  revealedReels.value = 0
  for (let r = 1; r <= 5; r++) {
    timers.push(setTimeout(() => {
      revealedReels.value = r
      if (r === 5) store.revealDone()
    }, 200 + r * 120))
  }
})

onUnmounted(() => {
  timers.forEach(clearTimeout)
  timers = []
})

const SYMBOL_HUE: Record<string, string> = {
  WD: 'text-amber-300', SC: 'text-fuchsia-300', OR: 'text-sky-300'
}
function hueFor(sym: string): string {
  return SYMBOL_HUE[sym] ?? 'text-neutral-200'
}
function labelFor(sym: string): string {
  return def.value?.symbols[sym]?.label ?? sym
}
</script>

<template>
  <div
    v-if="def"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <div class="flex items-center justify-between text-[11px] font-mono">
      <div class="flex items-center gap-2">
        <span
          v-if="fs"
          class="rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2 py-0.5"
        >
          FREE SPINS ×{{ fs.multiplier }} — {{ fs.remaining }} left
        </span>
        <span
          v-if="hns"
          class="rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 px-2 py-0.5"
        >
          HOLD &amp; SPIN — {{ hns.respins }} respins
        </span>
      </div>
      <GameProgressiveMeter
        v-if="def.progressive"
        :def="def"
        label="GRAND"
      />
    </div>

    <!-- hold-and-spin lock board -->
    <div
      v-if="hns"
      class="grid grid-cols-5 gap-1.5"
      data-test="lock-board"
    >
      <template
        v-for="r in 5"
        :key="r"
      >
        <div
          v-for="row in 3"
          :key="`${r}:${row}`"
          class="h-16 rounded-lg flex items-center justify-center font-mono text-sm border"
          :class="hns.locked[(r - 1) * 3 + (row - 1)]
            ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
            : 'bg-neutral-950 border-neutral-800 text-neutral-700'"
        >
          <template v-if="hns.locked[(r - 1) * 3 + (row - 1)]">
            {{ formatCredits(hns.locked[(r - 1) * 3 + (row - 1)]!.credits) }}
            <span
              v-if="hns.locked[(r - 1) * 3 + (row - 1)]!.label"
              class="ml-1 uppercase text-[9px] text-amber-300"
            >
              {{ hns.locked[(r - 1) * 3 + (row - 1)]!.label }}
            </span>
          </template>
          <span v-else>·</span>
        </div>
      </template>
    </div>

    <!-- base / free-spin reel grid -->
    <div
      v-else
      class="grid grid-cols-5 gap-1.5"
    >
      <div
        v-for="(col, r) in grid"
        :key="r"
        class="space-y-1.5"
      >
        <div
          v-for="(cell, row) in col"
          :key="row"
          class="h-16 rounded-lg bg-neutral-950 border flex items-center justify-center text-xs font-bold tracking-tight text-center px-1 transition-all"
          :class="[
            r < revealedReels ? '' : 'opacity-30 motion-safe:blur-[2px]',
            winCells.has(`${r}:${row}`) ? 'border-amber-400/70 bg-amber-500/10' : 'border-neutral-800',
            hueFor(cell)
          ]"
        >
          {{ r < revealedReels ? labelFor(cell) : '···' }}
        </div>
      </div>
    </div>
  </div>
</template>
