// Free-play driver for Temple of Gold (cascade). Runs the REAL engine spin()
// but never debits the session bankroll — instead it keeps an honest House
// Ledger (what a $1/spin player would have fed/won/netted) and classifies each
// result for the trick-exposer. Drives the synth SFX and the tumble animation.
import { ref, shallowRef, computed, getCurrentScope, onScopeDispose } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { spinCascade, cascadeAlphabet, countSymbols } from '~/engine/cascade'
import { initMachineState, feedProgressive } from '~/engine'
import { liveRand } from '~/utils/liveRand'
import type { CascadeMachineDef, MachineSessionState, SymbolId, SpinOutcome } from '~/engine'
import {
  unlockAudio, sfxWhirr, sfxWin, sfxShatter, sfxDrop, sfxJackpot, sfxCascade, isMuted, setMuted
} from '~/utils/audio'

export interface TraceRow { chain: number, mult: number, sym: SymbolId, count: number, payCents: number }

export type TrickTone = 'intro' | 'good' | 'bad'

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export function useCascade() {
  const store = useSlotsStore()
  const def = computed<CascadeMachineDef | null>(() =>
    store.currentDef?.family === 'cascade' ? store.currentDef : null)

  // Cancellation: navigating away mid-tumble disposes the component scope; the
  // awaited timer chain must stop there (no SFX bleeding onto the floor page,
  // no state mutation for a cabinet that no longer exists).
  let disposed = false
  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
    })
  }
  /** Await one animation beat; false = the scope died mid-sleep, abandon the spin. */
  const beat = async (ms: number): Promise<boolean> => {
    await wait(ms)
    return !disposed
  }

  // Free-play session state — holds the climbing Grand meter. Never touches the bankroll.
  let state: MachineSessionState | null = null

  const phase = ref<'idle' | 'spinning' | 'tumbling'>('idle')
  const grid = shallowRef<SymbolId[][]>([]) // col-major: grid[col][row], row 0 = top
  const winners = ref<Set<SymbolId>>(new Set()) // symbols currently lit as winning
  const chain = ref(0)
  const chainMult = ref(1)
  const spinWinCredits = ref(0) // running win for the spin in progress
  const grandMeter = ref(0)
  const grandHit = ref(false)

  // The CASCADE! celebration — a chain ≥ 2 re-win, a forced flashy beat.
  const cascadeFlash = ref<{ active: boolean, chain: number, mult: number }>({ active: false, chain: 0, mult: 1 })
  // Last spin's link-by-link breakdown (the X-ray trace).
  const lastTrace = ref<{ rows: TraceRow[], grandCents: number } | null>(null)

  // Honest House Ledger (cents).
  const spins = ref(0)
  const fedCents = ref(0)
  const backCents = ref(0)

  const trick = ref<{ tone: TrickTone, text: string }>({
    tone: 'intro',
    text: 'Hit SPIN. Every result gets X-rayed below — watch, in real dollars, exactly how the machine would treat you. It just never takes a cent.'
  })

  const betCents = computed(() => (def.value ? def.value.maxCoins * def.value.denominationCents : 0))
  const netCents = computed(() => backCents.value - fedCents.value)
  const paybackPct = computed(() => (fedCents.value > 0 ? (backCents.value / fedCents.value) * 100 : 0))

  /** A decorative attract grid so the cabinet shows symbols before the first spin. */
  function attractGrid(d: CascadeMachineDef): SymbolId[][] {
    const { entries, total } = cascadeAlphabet(d)
    const pick = (): SymbolId => {
      let r = liveRand() * total
      for (const e of entries) {
        r -= e.w
        if (r < 0) return e.sym
      }
      return entries[entries.length - 1]!.sym
    }
    return Array.from({ length: d.cols }, () => Array.from({ length: d.rows }, pick))
  }

  function ensure(): void {
    const d = def.value
    if (d === null) return
    if (state === null) {
      state = initMachineState(d)
      grandMeter.value = state.progressive?.kind === 'percent' ? Math.floor(state.progressive.value) : 0
    }
    if (grid.value.length === 0) grid.value = attractGrid(d)
  }

  function classify(out: SpinOutcome, d: CascadeMachineDef): void {
    const winC = out.totalPayout * d.denominationCents
    const betC = d.maxCoins * d.denominationCents
    const dollars = (c: number): string => '$' + (c / 100).toFixed(2)
    if (out.progressiveEvents.length > 0) {
      trick.value = { tone: 'good', text: `💥 THE GRAND — ${dollars(winC)}! The rare carrot the whole game dangles, funded by everyone else's losses. This is the jackpot that keeps people feeding the machine for hours.` }
      return
    }
    if (winC >= betC) {
      trick.value = { tone: 'good', text: `✅ A genuine win: ${dollars(winC)} on a ${dollars(betC)} bet — net up ${dollars(winC - betC)}. These are real. They're also rarer than all the noise makes them feel.` }
      return
    }
    if (winC > 0) {
      trick.value = { tone: 'bad', text: `⚠️ Loss disguised as a win. The lights, the chimes, the climbing number — all for ${dollars(winC)} on a ${dollars(betC)} bet. You actually LOST ${dollars(betC - winC)}. This is the #1 trick on the floor.` }
      return
    }
    // No pay: near-miss if a paying symbol landed one short of minMatch on the initial grid.
    const initGrid = out.cascadeSteps?.[0]?.grid ?? out.grid
    const counts = new Map<SymbolId, number>()
    for (const col of initGrid) for (const s of col) counts.set(s, (counts.get(s) ?? 0) + 1)
    const near = Object.keys(d.paytable).some(s => (counts.get(s) ?? 0) === d.minMatch - 1)
    trick.value = near
      ? { tone: 'bad', text: `🎯 Near miss — by design. One symbol short of a pay. That "so close!" jolt is engineered; your odds were identical to every other spin.` }
      : { tone: 'bad', text: '➖ A clean loss. No party, no near-miss — just gone. At least this machine is honest about it.' }
  }

  async function spin(): Promise<void> {
    const d = def.value
    if (d === null || phase.value !== 'idle') return
    ensure()
    unlockAudio()

    phase.value = 'spinning'
    sfxWhirr()
    spinWinCredits.value = 0
    winners.value = new Set()
    chain.value = 0
    chainMult.value = 1
    grandHit.value = false
    cascadeFlash.value = { active: false, chain: 0, mult: 1 }
    // brief spin shuffle for spectacle
    for (let f = 0; f < 3; f++) {
      grid.value = attractGrid(d)
      if (!(await beat(110))) return
    }

    const out = spinCascade(d, state!, d.maxCoins, liveRand)
    // Feed the Grand live so it visibly climbs (spectacle; RTP-neutral in free play).
    feedProgressive(d, state!.progressive, 'after', out.coinsIn)
    if (state!.progressive?.kind === 'percent') grandMeter.value = Math.floor(state!.progressive.value)

    // Ledger (honest, in real cents).
    spins.value += 1
    fedCents.value += out.coinsIn * d.denominationCents
    backCents.value += out.totalPayout * d.denominationCents

    // Build the link-by-link trace (the X-ray): one row per winning symbol per chain.
    const rows: TraceRow[] = []
    for (const step of out.cascadeSteps ?? []) {
      if (step.wins.length === 0) continue
      const counts = countSymbols(step.grid)
      for (const w of step.wins) {
        rows.push({ chain: step.chain, mult: step.chainMult, sym: w.entryId, count: counts.get(w.entryId) ?? 0, payCents: w.payCredits * d.denominationCents })
      }
    }
    const grandWin = out.wins.find(w => w.entryId === 'grand')
    lastTrace.value = { rows, grandCents: grandWin ? grandWin.payCredits * d.denominationCents : 0 }

    // Animate the tumble sequence.
    phase.value = 'tumbling'
    for (const step of out.cascadeSteps ?? []) {
      grid.value = step.grid
      chain.value = step.chain
      chainMult.value = step.chainMult
      if (step.wins.length === 0) {
        winners.value = new Set()
        continue
      }
      // CASCADE! — a re-win after a tumble. Force a flashy, can't-miss beat.
      if (step.chain >= 2) {
        cascadeFlash.value = { active: true, chain: step.chain, mult: step.chainMult }
        sfxCascade(step.chain)
        if (!(await beat(900))) return
      }
      winners.value = new Set(step.wins.map(w => w.entryId))
      sfxWin(step.chain)
      if (!(await beat(460))) return
      sfxShatter()
      spinWinCredits.value += step.wins.reduce((a, w) => a + w.payCredits, 0)
      if (!(await beat(250))) return
      winners.value = new Set()
      cascadeFlash.value = { active: false, chain: 0, mult: 1 }
      sfxDrop()
      if (!(await beat(210))) return
    }
    grid.value = out.grid
    if (out.progressiveEvents.length > 0) {
      grandHit.value = true
      sfxJackpot()
    }
    classify(out, d)
    phase.value = 'idle'
  }

  return {
    def, phase, grid, winners, chain, chainMult, spinWinCredits, grandMeter, grandHit,
    cascadeFlash, lastTrace,
    spins, fedCents, backCents, betCents, netCents, paybackPct, trick,
    ensure, spin, isMuted, setMuted
  }
}
