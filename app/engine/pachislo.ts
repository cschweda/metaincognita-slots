import type {
  FeatureEvent, LineWin, MachineSessionState, PachisloFlag,
  PachisloMachineDef, PachisloSessionState, RngDraw, SpinOutcome, SymbolId
} from './types'
import type { RandomFn } from './rng'

const N = 21

/** active line row-patterns by token count (manual 2.1) */
export const PACHISLO_LINES: number[][][] = [
  [[1, 1, 1]],
  [[1, 1, 1], [0, 0, 0], [2, 2, 2]],
  [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]]
]

/** lines crossing reel-1's cell at `row` for this token count (cherry pays) */
export function linesThroughRow(row: number, tokens: number): number {
  let n = 0
  for (const pat of PACHISLO_LINES[tokens - 1]!) {
    if (pat[0] === row) n++
  }
  return n
}

/**
 * Stop-combo search order: total slip ascending, then lexicographic. FROZEN —
 * the planning-time service counts assume exactly this order.
 */
const DELTAS: number[][] = (() => {
  const out: number[][] = []
  for (let a = 0; a <= 4; a++) {
    for (let b = 0; b <= 4; b++) {
      for (let c = 0; c <= 4; c++) out.push([a, b, c])
    }
  }
  return out.sort((x, y) =>
    (x[0]! + x[1]! + x[2]!) - (y[0]! + y[1]! + y[2]!)
    || x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!)
})()

export type ComboFlag = 'watermelon' | 'bell' | 'replay' | 'reg' | 'big'

export type ControlTarget
  = | { kind: 'combo', flag: ComboFlag }
    | { kind: 'cherry', row: number }
    | null

export type PachisloHit
  = | { kind: 'combo', flag: ComboFlag, rows: number[] }
    | { kind: 'cherry', row: number }

function comboTriple(def: PachisloMachineDef, flag: ComboFlag): [SymbolId, SymbolId, SymbolId] {
  const r = def.roles
  switch (flag) {
    case 'watermelon': return [r.watermelon, r.watermelon, r.watermelon]
    case 'bell': return [r.bell, r.bell, r.bell]
    case 'replay': return [r.replay, r.replay, r.replay]
    case 'reg': return [r.seven, r.seven, r.bar]
    case 'big': return [r.seven, r.seven, r.seven]
  }
}

const COMBO_ORDER: ComboFlag[] = ['watermelon', 'bell', 'replay', 'reg', 'big']

function cellAt(def: PachisloMachineDef, reel: number, stop: number, row: number): SymbolId {
  return def.strips[reel]![(stop + row) % N]!
}

/** Every paying combination visible on the active lines (plus paying cherries). */
export function payingHits(def: PachisloMachineDef, stops: number[], tokens: number): PachisloHit[] {
  const hits: PachisloHit[] = []
  const lines = PACHISLO_LINES[tokens - 1]!
  for (const flag of COMBO_ORDER) {
    const combo = comboTriple(def, flag)
    for (const pat of lines) {
      if (
        cellAt(def, 0, stops[0]!, pat[0]!) === combo[0]
        && cellAt(def, 1, stops[1]!, pat[1]!) === combo[1]
        && cellAt(def, 2, stops[2]!, pat[2]!) === combo[2]
      ) {
        hits.push({ kind: 'combo', flag, rows: [...pat] })
      }
    }
  }
  for (const row of [0, 1, 2]) {
    if (linesThroughRow(row, tokens) === 0) continue
    if (cellAt(def, 0, stops[0]!, row) === def.roles.cherry) {
      hits.push({ kind: 'cherry', row })
    }
  }
  return hits
}

export interface ControlResult {
  stops: number[]
  slips: number[]
  realized: boolean
}

/**
 * Deterministic skill-stop control. From the player's press positions it
 * searches stop combos in slip order (DELTAS) and picks the FIRST that
 * realizes the target with NO other paying combination; failing that, the
 * first with no paying combination at all (the flag stays stocked). The
 * planning-time exhaustive check proves a win-free combo always exists.
 */
export function controlStops(
  def: PachisloMachineDef,
  presses: number[],
  tokens: number,
  target: ControlTarget
): ControlResult {
  let fallback: ControlResult | null = null
  for (const d of DELTAS) {
    const stops = [
      (presses[0]! + d[0]!) % N,
      (presses[1]! + d[1]!) % N,
      (presses[2]! + d[2]!) % N
    ]
    const hits = payingHits(def, stops, tokens)
    if (target === null) {
      if (hits.length === 0) return { stops, slips: [...d], realized: false }
      continue
    }
    if (target.kind === 'cherry') {
      const visible = cellAt(def, 0, stops[0]!, target.row) === def.roles.cherry
      const others = hits.filter(h => !(h.kind === 'cherry' && h.row === target.row))
      if (visible && others.length === 0) return { stops, slips: [...d], realized: true }
    } else {
      const wanted = hits.some(h =>
        h.kind === 'combo' && h.flag === target.flag
        && h.rows[0] === 1 && h.rows[1] === 1 && h.rows[2] === 1)
      const others = hits.filter(h => !(
        h.kind === 'combo' && h.flag === target.flag
        && h.rows[0] === 1 && h.rows[1] === 1 && h.rows[2] === 1))
      if (wanted && others.length === 0) return { stops, slips: [...d], realized: true }
    }
    if (hits.length === 0 && fallback === null) {
      fallback = { stops, slips: [...d], realized: false }
    }
  }
  if (fallback !== null) return fallback
  throw new Error(
    `${def.id}: control found no win-free stop for presses ${presses.join(',')} — strip invariant broken`)
}

const LOTTERY_DENOM = 16384

function drawLottery(
  def: PachisloMachineDef,
  level: number,
  rand: RandomFn,
  draws: RngDraw[]
): PachisloFlag | null {
  const rates = def.oddsLevels[level - 1]!
  const table: [PachisloFlag, number][] = [
    ['cherry-top', def.baseRates.cherryPerRow],
    ['cherry-mid', def.baseRates.cherryPerRow],
    ['cherry-bot', def.baseRates.cherryPerRow],
    ['watermelon', def.baseRates.watermelon],
    ['bell', rates.bell],
    ['replay', def.baseRates.replay],
    ['reg', rates.reg],
    ['big', rates.big]
  ]
  const raw = rand()
  const idx = Math.floor(raw * LOTTERY_DENOM)
  draws.push({ label: 'lottery', raw, value: idx, range: LOTTERY_DENOM })
  let acc = 0
  for (const [flag, n] of table) {
    acc += n
    if (idx < acc) return flag
  }
  return null
}

function targetFor(queue: PachisloSessionState): ControlTarget {
  const small = queue.smallQueue[0]
  if (small !== undefined) {
    if (small === 'cherry-top') return { kind: 'cherry', row: 0 }
    if (small === 'cherry-mid') return { kind: 'cherry', row: 1 }
    if (small === 'cherry-bot') return { kind: 'cherry', row: 2 }
    return { kind: 'combo', flag: small as ComboFlag }
  }
  const bonus = queue.bonusQueue[0]
  if (bonus !== undefined) return { kind: 'combo', flag: bonus }
  return null
}

function spinReels(
  def: PachisloMachineDef,
  tokens: number,
  target: ControlTarget,
  rand: RandomFn,
  draws: RngDraw[]
): { result: ControlResult, presses: NonNullable<SpinOutcome['trace']['presses']> } {
  const presses: number[] = []
  for (let r = 0; r < 3; r++) {
    const raw = rand()
    const press = Math.floor(raw * N)
    draws.push({ label: `reel${r + 1}-press`, raw, value: press, range: N })
    presses.push(press)
  }
  const result = controlStops(def, presses, tokens, target)
  const label = target === null ? null : target.kind === 'cherry' ? `cherry-row${target.row}` : target.flag
  return {
    result,
    presses: presses.map((press, reel) => ({
      reel, press, stop: result.stops[reel]!, slipUsed: result.slips[reel]!, target: label
    }))
  }
}

function gridFor(def: PachisloMachineDef, stops: number[]): SymbolId[][] {
  return def.strips.map((strip, r) =>
    [0, 1, 2].map(row => strip[(stops[r]! + row) % N]!))
}

function realizedWin(
  def: PachisloMachineDef,
  flag: PachisloFlag,
  tokens: number
): LineWin {
  if (flag === 'cherry-top' || flag === 'cherry-mid' || flag === 'cherry-bot') {
    const row = flag === 'cherry-top' ? 0 : flag === 'cherry-mid' ? 1 : 2
    return {
      line: `row-${row}`, entryId: 'cherry', symbols: [def.roles.cherry],
      payCredits: def.pays.cherryPerLine * linesThroughRow(row, tokens),
      wildCount: 0, progressive: false
    }
  }
  const pay = flag === 'watermelon'
    ? def.pays.watermelon
    : flag === 'bell'
      ? def.pays.bell
      : flag === 'replay' ? 0 : def.pays.bonusLined
  const symbols = flag === 'reg'
    ? [def.roles.seven, def.roles.seven, def.roles.bar]
    : flag === 'big'
      ? [def.roles.seven, def.roles.seven, def.roles.seven]
      : new Array<SymbolId>(3).fill(
          flag === 'watermelon' ? def.roles.watermelon : flag === 'bell' ? def.roles.bell : def.roles.replay)
  return { line: 'center', entryId: flag, symbols, payCredits: pay, wildCount: 0, progressive: false }
}

function jacGame(
  def: PachisloMachineDef,
  state: PachisloSessionState,
  rand: RandomFn
): SpinOutcome {
  const bonus = state.bonus!
  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  // reels are presentation during JAC: try to line bells, else stop clean
  const { result, presses } = spinReels(def, 1, { kind: 'combo', flag: 'bell' }, rand, draws)
  bonus.jacLeft -= 1
  const wins: LineWin[] = [{
    line: 'center', entryId: 'jac', symbols: new Array<SymbolId>(3).fill(def.roles.bell),
    payCredits: def.jac.pay, wildCount: 0, progressive: false
  }]
  if (bonus.jacLeft === 0) {
    featureEvents.push({ type: 'jac-round-complete', round: bonus.round })
    if (bonus.type === 'reg' || bonus.round === def.bigRounds) {
      featureEvents.push({ type: 'bonus-ended', bonus: bonus.type })
      state.bonus = null
    } else {
      bonus.interlude = { index: bonus.round as 1 | 2, bells: 0 }
      featureEvents.push({ type: 'interlude-started', index: bonus.round as 1 | 2 })
    }
  }
  return {
    machineId: def.id, family: 'pachislo', coins: 1, gameKind: 'jac', coinsIn: def.jac.cost,
    stops: result.stops, grid: gridFor(def, result.stops), wins,
    totalPayout: def.jac.pay, progressiveEvents: [], featureEvents,
    trace: { draws, presses }
  }
}

function interludeGame(
  def: PachisloMachineDef,
  state: PachisloSessionState,
  rand: RandomFn
): SpinOutcome {
  const bonus = state.bonus!
  const inter = bonus.interlude!
  const cfg = def.interlude
  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  const raw = rand()
  const idx = Math.floor(raw * cfg.weightDenom)
  draws.push({ label: 'interlude-lottery', raw, value: idx, range: cfg.weightDenom })
  const isBell = idx < cfg.bellWeight
  const isEnd = !isBell && idx < cfg.bellWeight + cfg.endWeight
  const wins: LineWin[] = []
  const { result, presses } = spinReels(
    def, 1, isBell ? { kind: 'combo', flag: 'bell' } : null, rand, draws)
  if (isBell) {
    inter.bells += 1
    wins.push({
      line: 'center', entryId: 'interlude-bell', symbols: new Array<SymbolId>(3).fill(def.roles.bell),
      payCredits: cfg.bellPay, wildCount: 0, progressive: false
    })
  }
  if (isEnd || inter.bells >= cfg.maxBells) {
    featureEvents.push({ type: 'interlude-ended', index: inter.index, bells: inter.bells })
    bonus.round += 1
    bonus.jacLeft = def.jac.perRound
    bonus.interlude = null
  }
  return {
    machineId: def.id, family: 'pachislo', coins: 1, gameKind: 'interlude', coinsIn: cfg.cost,
    stops: result.stops, grid: gridFor(def, result.stops), wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [], featureEvents,
    trace: { draws, presses }
  }
}

/**
 * One pachislo game. Routing: bonus interlude > JAC round > normal lottery
 * game. The lottery decides value; control decides placement; queues make
 * timing irrelevant to long-run RTP.
 */
export function spinPachislo(
  def: PachisloMachineDef,
  state: MachineSessionState,
  tokens: number,
  rand: RandomFn
): SpinOutcome {
  const ps = state.pachislo
  if (ps === null) throw new Error(`${def.id}: missing pachislo session state`)
  if (ps.bonus !== null) {
    return ps.bonus.interlude !== null ? interludeGame(def, ps, rand) : jacGame(def, ps, rand)
  }
  if (tokens !== def.maxCoins) {
    throw new Error(
      `${def.id}: normal games take exactly ${def.maxCoins} tokens — real stock-era machines gate `
      + 'bonus flags by full bet; variable-token line play is deferred beyond v0.2')
  }

  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  const coinsIn = ps.replayNext ? 0 : tokens
  ps.replayNext = false

  const flag = drawLottery(def, ps.oddsLevel, rand, draws)
  if (flag !== null) {
    featureEvents.push({ type: 'flag-drawn', flag })
    if (flag === 'reg' || flag === 'big') ps.bonusQueue.push(flag)
    else ps.smallQueue.push(flag)
  }

  const target = targetFor(ps)
  const { result, presses } = spinReels(def, tokens, target, rand, draws)
  const wins: LineWin[] = []

  if (result.realized && target !== null) {
    const realizedFlag: PachisloFlag = ps.smallQueue.length > 0
      ? ps.smallQueue.shift()!
      : ps.bonusQueue.shift()!
    featureEvents.push({ type: 'flag-realized', flag: realizedFlag })
    const win = realizedWin(def, realizedFlag, tokens)
    wins.push(win)
    if (realizedFlag === 'replay') {
      ps.replayNext = true
      featureEvents.push({ type: 'replay-granted' })
    }
    if (realizedFlag === 'reg' || realizedFlag === 'big') {
      ps.bonus = { type: realizedFlag, round: 1, jacLeft: def.jac.perRound, interlude: null }
      featureEvents.push({ type: 'bonus-started', bonus: realizedFlag })
    }
  } else if (target !== null) {
    const stockedFlag: PachisloFlag = ps.smallQueue.length > 0
      ? ps.smallQueue[0]!
      : ps.bonusQueue[0]!
    featureEvents.push({
      type: 'flag-stocked', flag: stockedFlag,
      queueDepth: ps.smallQueue.length + ps.bonusQueue.length
    })
  }

  return {
    machineId: def.id, family: 'pachislo', coins: tokens, gameKind: 'normal', coinsIn,
    stops: result.stops, grid: gridFor(def, result.stops), wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [], featureEvents,
    trace: { draws, presses }
  }
}
