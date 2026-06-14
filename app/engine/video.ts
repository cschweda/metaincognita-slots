import type {
  FeatureEvent, LineWin, LockedCell, MachineSessionState, ProgressiveEvent, RngDraw,
  SpinOutcome, SymbolId, VideoFeatureState, VideoMachineDef
} from './types'
import type { RandomFn } from './rng'
import { cellAt, evalLine, evalWays, orbCells, scatterVisibleCount } from './videoAwards'

interface DrawnOrb {
  cell: number
  credits?: number
  label?: 'mini' | 'minor' | 'major'
  mult?: number
}


function lockedCell(o: DrawnOrb): LockedCell {
  return o.mult !== undefined ? { mult: o.mult } : { credits: o.credits!, label: o.label }
}

/** Weighted orb-value draw; one RNG draw per orb, traced per cell. */
function drawOrbValue(def: VideoMachineDef, rand: RandomFn, draws: RngDraw[], cell: number): DrawnOrb {
  const table = def.holdAndSpin!.orbValues
  const total = table.reduce((s, e) => s + e.weight, 0)
  const raw = rand()
  const pick = Math.floor(raw * total)
  draws.push({ label: `orb-value-cell${cell}`, raw, value: pick, range: total })
  let acc = 0
  for (const e of table) {
    acc += e.weight
    if (pick < acc) return 'mult' in e ? { cell, mult: e.mult } : { cell, credits: e.credits, label: e.label }
  }
  const last = table[table.length - 1]!
  return 'mult' in last ? { cell, mult: last.mult } : { cell, credits: last.credits, label: last.label }
}

interface VideoSpinEval {
  draws: RngDraw[]
  stops: number[]
  grid: SymbolId[][]
  wins: LineWin[]
  scatterCount: number
  orbs: DrawnOrb[]
}

/**
 * One reel spin + award evaluation, shared by base and free spins.
 * `coins` = active lines (lines mode) / the full bet (ways mode); the
 * multiplier scales every win (free-spin x2 etc.). Scatter pays are
 * `pays[k] x total bet` = pays[k] x coins.
 */
function evaluateVideoSpin(
  def: VideoMachineDef,
  coins: number,
  multiplier: number,
  rand: RandomFn
): VideoSpinEval {
  const draws: RngDraw[] = []
  const stops = def.strips.map((strip, r) => {
    const raw = rand()
    const value = Math.floor(raw * strip.length)
    draws.push({ label: `reel${r + 1}-stop`, raw, value, range: strip.length })
    return value
  })
  const grid = def.strips.map((strip, r) =>
    [0, 1, 2].map(row => cellAt(strip, stops[r]!, row)))

  const wins: LineWin[] = []
  if (def.betMode.kind === 'lines') {
    for (let li = 0; li < coins; li++) {
      const pattern = def.betMode.lines[li]!
      const cells = pattern.map((row, r) => grid[r]![row]!)
      const res = evalLine(cells, def)
      if (res !== null) {
        wins.push({
          line: `line-${li + 1}`, entryId: res.entry.id, symbols: cells,
          payCredits: res.entry.pay * multiplier, wildCount: res.wildCount, progressive: false
        })
      }
    }
  } else {
    for (const w of evalWays(def, stops)) {
      wins.push({
        line: `ways-x${w.ways}`, entryId: w.entry.id,
        symbols: new Array<SymbolId>(w.entry.length).fill(w.entry.symbol),
        payCredits: w.payCredits * multiplier, wildCount: 0, progressive: false
      })
    }
  }

  const scatterCount = scatterVisibleCount(def, stops)
  if (def.scatter !== null) {
    const pay = def.scatter.pays[scatterCount]
    if (pay !== undefined) {
      wins.push({
        line: 'scatter', entryId: `sc${scatterCount}`,
        symbols: new Array<SymbolId>(scatterCount).fill(def.scatter.symbol),
        payCredits: pay * coins * multiplier, wildCount: 0, progressive: false
      })
    }
  }

  const orbs = def.holdAndSpin === null
    ? []
    : orbCells(def, stops).map(o => drawOrbValue(def, rand, draws, o.cell))
  return { draws, stops, grid, wins, scatterCount, orbs }
}

function videoBaseSpin(
  def: VideoMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  const ev = evaluateVideoSpin(def, coins, 1, rand)
  const featureEvents: FeatureEvent[] = []

  if (
    def.scatter !== null && def.scatter.triggerCount !== null && def.freeSpins !== null
    && ev.scatterCount >= def.scatter.triggerCount
  ) {
    state.videoFeature = {
      kind: 'freeSpins',
      remaining: def.freeSpins.count,
      multiplier: def.freeSpins.multiplier,
      coins
    }
    featureEvents.push({
      type: 'free-spins-triggered', count: def.freeSpins.count, multiplier: def.freeSpins.multiplier
    })
  } else if (def.holdAndSpin !== null && ev.orbs.length >= def.holdAndSpin.triggerCount) {
    const locked: (LockedCell | null)[] = new Array(15).fill(null)
    for (const o of ev.orbs) locked[o.cell] = lockedCell(o)
    state.videoFeature = { kind: 'holdAndSpin', locked, respins: def.holdAndSpin.respins, coins }
    const creditOrbs = ev.orbs.filter(o => o.mult === undefined)
    const multOrbs = ev.orbs.filter(o => o.mult !== undefined)
    if (creditOrbs.length > 0) {
      featureEvents.push({ type: 'orbs-locked', cells: creditOrbs.map(o => o.cell), credits: creditOrbs.map(o => o.credits!) })
    }
    if (multOrbs.length > 0) {
      featureEvents.push({ type: 'mult-orbs-locked', cells: multOrbs.map(o => o.cell), mults: multOrbs.map(o => o.mult!) })
    }
  }

  return {
    machineId: def.id,
    family: 'video',
    coins,
    gameKind: 'base',
    coinsIn: coins,
    stops: ev.stops,
    grid: ev.grid,
    wins: ev.wins,
    totalPayout: ev.wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [],
    featureEvents,
    trace: { draws: ev.draws }
  }
}

function freeSpinSpin(
  def: VideoMachineDef,
  state: MachineSessionState,
  feature: VideoFeatureState & { kind: 'freeSpins' },
  rand: RandomFn
): SpinOutcome {
  const ev = evaluateVideoSpin(def, feature.coins, feature.multiplier, rand)
  const featureEvents: FeatureEvent[] = []

  if (
    def.scatter !== null && def.scatter.triggerCount !== null && def.freeSpins !== null
    && def.freeSpins.retrigger && ev.scatterCount >= def.scatter.triggerCount
  ) {
    feature.remaining += def.freeSpins.count
    featureEvents.push({
      type: 'free-spins-retriggered', added: def.freeSpins.count, remaining: feature.remaining
    })
  }

  feature.remaining -= 1
  featureEvents.push({ type: 'free-spin-consumed', remaining: feature.remaining })
  if (feature.remaining === 0) state.videoFeature = null

  return {
    machineId: def.id,
    family: 'video',
    coins: feature.coins,
    gameKind: 'free-spin',
    coinsIn: 0,
    stops: ev.stops,
    grid: ev.grid,
    wins: ev.wins,
    totalPayout: ev.wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [],
    featureEvents,
    trace: { draws: ev.draws }
  }
}

function holdAndSpinRespin(
  def: VideoMachineDef,
  state: MachineSessionState,
  feature: VideoFeatureState & { kind: 'holdAndSpin' },
  rand: RandomFn
): SpinOutcome {
  const cfg = def.holdAndSpin!
  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  const newCreditCells: number[] = []
  const newCredits: number[] = []
  const newMultCells: number[] = []
  const newMults: number[] = []

  for (let cell = 0; cell < 15; cell++) {
    if (feature.locked[cell] !== null) continue
    const raw = rand()
    const value = Math.floor(raw * cfg.respinOrbDenom)
    draws.push({ label: `cell${cell}-respin`, raw, value, range: cfg.respinOrbDenom })
    if (value < cfg.respinOrbNumer) {
      const orb = drawOrbValue(def, rand, draws, cell)
      feature.locked[cell] = lockedCell(orb)
      if (orb.mult !== undefined) { newMultCells.push(cell); newMults.push(orb.mult) }
      else { newCreditCells.push(cell); newCredits.push(orb.credits!) }
    }
  }

  const lockedCount = feature.locked.filter(c => c !== null).length
  const landed = newCreditCells.length + newMultCells.length
  let ended = false
  if (landed > 0) {
    feature.respins = cfg.respins
    if (newCreditCells.length > 0) featureEvents.push({ type: 'orbs-locked', cells: newCreditCells, credits: newCredits })
    if (newMultCells.length > 0) featureEvents.push({ type: 'mult-orbs-locked', cells: newMultCells, mults: newMults })
    featureEvents.push({ type: 'respins-reset', respins: cfg.respins })
    if (lockedCount === 15) ended = true
  } else {
    feature.respins -= 1
    featureEvents.push({ type: 'respin-missed', remaining: feature.respins })
    if (feature.respins <= 0) ended = true
  }

  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []
  if (ended) {
    let creditSum = 0
    let multSum = 0
    for (const c of feature.locked) {
      if (c === null) continue
      if ('mult' in c) multSum += c.mult
      else creditSum += c.credits
    }
    const multiplier = multSum > 0 ? multSum : 1
    const totalCredits = creditSum * multiplier
    const filled = lockedCount === 15
    wins.push({
      line: 'hold-and-spin', entryId: 'hold-and-spin', symbols: [],
      payCredits: totalCredits, wildCount: 0, progressive: false
    })
    // validator invariant: holdAndSpin machines always carry a percent progressive
    if (filled && state.progressive?.kind === 'percent' && def.progressive !== null) {
      const grand = Math.floor(state.progressive.value)
      state.progressive.value = def.progressive.reset
      wins.push({
        line: 'grand', entryId: 'grand', symbols: [],
        payCredits: grand, wildCount: 0, progressive: true
      })
      progressiveEvents.push({ type: 'hit', meter: 'percent', amountCredits: grand })
    }
    featureEvents.push({ type: 'hold-and-spin-ended', totalCredits, filled })
    state.videoFeature = null
  }

  // respins have no strip stops; the grid renders the lock board
  const grid: SymbolId[][] = [0, 1, 2, 3, 4].map(r =>
    [0, 1, 2].map(row => feature.locked[r * 3 + row] !== null ? cfg.orbSymbol : cfg.emptySymbol))

  return {
    machineId: def.id,
    family: 'video',
    coins: feature.coins,
    gameKind: 'respin',
    coinsIn: 0,
    stops: [],
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents,
    featureEvents,
    trace: { draws }
  }
}

/**
 * Video family dispatch. Feature state on MachineSessionState routes
 * free-spin and respin calls; base spins validate the bet.
 */
export function spinVideo(
  def: VideoMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  const feature = state.videoFeature
  if (feature !== null) {
    if (feature.kind === 'freeSpins') return freeSpinSpin(def, state, feature, rand)
    return holdAndSpinRespin(def, state, feature, rand)
  }
  if (def.fixedBet && coins !== def.maxCoins) {
    throw new Error(`${def.id}: fixed bet machine requires ${def.maxCoins} coins`)
  }
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  return videoBaseSpin(def, state, coins, rand)
}
