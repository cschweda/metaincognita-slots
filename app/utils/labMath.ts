// app/utils/labMath.ts
// The Sim Lab's "math before you spin" (guidelines §2.5): closed-form
// expectation and volatility for the CURRENT form values, all in cents, all
// labeled MODEL by the component that renders them. The model deliberately
// assumes every spin plays (no bust truncation) — the page says so, and the
// gap against the measured mean is itself the lesson.
import type { ExactRtpReport, MachineDef } from '~/engine'

export interface LabExpectedMathParams {
  startCredits: number
  bet: number
  spinCap: number
}

export interface LabExpectedMathModel {
  perSpinCostCents: number
  perSpinReturnCents: number
  perSpinLossCents: number
  capCoinInCents: number
  capExpectedLossCents: number
  /** start − expected loss; negative means expectation alone busts the bankroll */
  capExpectedEndCents: number
  /** spins at which pure expectation crosses $0 (null when the game has no edge) */
  expectationBustSpins: number | null
  /** one-session ±1σ of luck: bet × √(spinCap × variancePerCoin), in cents */
  sessionSigmaCents: number
  /** spins for the edge to outgrow 1σ of luck: variancePerCoin / edge² (null when no edge) */
  n0Spins: number | null
}

export function labExpectedMath(
  def: MachineDef,
  report: ExactRtpReport,
  p: LabExpectedMathParams
): LabExpectedMathModel {
  const denom = def.denominationCents
  const edge = 1 - report.rtpPerCoin
  const perSpinCostCents = p.bet * denom
  const perSpinReturnCents = perSpinCostCents * report.rtpPerCoin
  const perSpinLossCents = perSpinCostCents - perSpinReturnCents
  const capCoinInCents = p.spinCap * perSpinCostCents
  const capExpectedLossCents = capCoinInCents * edge
  const startCents = p.startCredits * denom
  return {
    perSpinCostCents,
    perSpinReturnCents,
    perSpinLossCents,
    capCoinInCents,
    capExpectedLossCents,
    capExpectedEndCents: startCents - capExpectedLossCents,
    expectationBustSpins: perSpinLossCents > 0 ? Math.ceil(startCents / perSpinLossCents) : null,
    sessionSigmaCents: p.bet * Math.sqrt(p.spinCap * report.variancePerCoin) * denom,
    n0Spins: edge > 0 ? report.variancePerCoin / (edge * edge) : null
  }
}
