import type {
  MeterConfig, ProgressiveConfig, ProgressiveState
} from './types'

export function initProgressiveState(cfg: ProgressiveConfig): ProgressiveState {
  if (cfg.kind === 'dual') {
    return {
      kind: 'dual', upper: cfg.upper.reset, lower: cfg.lower.reset,
      live: 'upper', coinsTowardToggle: 0, upperCoins: 0, lowerCoins: 0
    }
  }
  if (cfg.kind === 'single') {
    return { kind: 'single', value: cfg.meter.reset, coins: 0 }
  }
  return { kind: 'percent', value: cfg.reset }
}

function activeRate(value: number, m: MeterConfig) {
  return value >= m.rate1Limit ? m.rate2 : m.rate1
}

function tickMeter(value: number, coins: number, m: MeterConfig): { value: number, coins: number } {
  const rate = activeRate(value, m)
  coins += 1
  if (coins >= rate.coinsPer) {
    coins = 0
    // clip at max — increments freeze, counters keep cycling (FO-5140 p.9)
    value = Math.min(value + rate.amount, m.max)
  }
  return { value, coins }
}

/**
 * Process one coin-in. Mutates state. FO-5140 semantics: the coin counts
 * toward the LIVE meter, then the toggle counter advances. The evaluator owns
 * reset-on-hit; this controller owns feed-on-coin (see ballyEm.ts JSDoc).
 */
export function addCoinToProgressive(state: ProgressiveState, cfg: ProgressiveConfig): void {
  if (state.kind === 'dual' && cfg.kind === 'dual') {
    if (state.live === 'upper') {
      const r = tickMeter(state.upper, state.upperCoins, cfg.upper)
      state.upper = r.value
      state.upperCoins = r.coins
    } else {
      const r = tickMeter(state.lower, state.lowerCoins, cfg.lower)
      state.lower = r.value
      state.lowerCoins = r.coins
    }
    state.coinsTowardToggle += 1
    if (state.coinsTowardToggle >= cfg.coinsPerToggle) {
      state.coinsTowardToggle = 0
      state.live = state.live === 'upper' ? 'lower' : 'upper'
    }
    return
  }
  if (state.kind === 'single' && cfg.kind === 'single') {
    const r = tickMeter(state.value, state.coins, cfg.meter)
    state.value = r.value
    state.coins = r.coins
    return
  }
  if (state.kind === 'percent' && cfg.kind === 'percent') {
    state.value = Math.min(state.value + cfg.feedRate, cfg.max)
    return
  }
  throw new Error(`progressive state/config kind mismatch: ${state.kind} vs ${cfg.kind}`)
}
