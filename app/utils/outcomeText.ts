import type { MachineDef, SpinOutcome } from '~/engine'
import { formatCentsExact, formatCredits } from '~/utils/format'

/**
 * The spoken/live-region narration for one outcome — honest by design (a win
 * under the bet is announced as a net loss). Pure text: the store passes its
 * current bankrollCents so the balance can be spoken.
 */
export function describeOutcome(def: MachineDef, out: SpinOutcome, bankrollCents: number): string {
  if (def.family === 'lock-reel') {
    // Spoken at resolve: the GRAND (grid fill) flag, then the collect, then
    // the banked dollars + balance. A bonus TRIGGER would carry no collect
    // (it pays at the bonus's own resolve), so a 0-payout outcome just reports
    // the lock activity.
    const dollars = (credits: number): string => formatCentsExact(credits * def.denominationCents)
    const grand = out.featureEvents.some(e => e.type === 'grand')
    const collect = out.featureEvents.find(e => e.type === 'collect')
    const bonus = out.featureEvents.some(e => e.type === 'bonus-triggered')
    const parts: string[] = []
    if (grand) parts.push('GRAND — filled the grid!')
    if (bonus && collect === undefined) parts.push('Three 7s — 777 BONUS!')
    if (collect !== undefined) {
      parts.push(collect.credits > 0
        ? `Collected ${formatCredits(collect.credits)} credits${out.totalPayout > 0 ? ` — banked ${dollars(out.totalPayout)}.` : '.'}`
        : 'No cash locked — collected nothing.')
    }
    if (parts.length === 0) parts.push('Locked.')
    parts.push(`Balance ${formatCredits(Math.floor(bankrollCents / def.denominationCents))} credits.`)
    return parts.join(' ')
  }
  if (def.family === 'blackjack-reel') {
    const dollars = (credits: number): string => formatCentsExact(credits * def.denominationCents)
    for (const e of out.featureEvents) {
      if (e.type === 'crash') return `Flamed out on reel ${e.reel + 1} at ×${e.multiplier.toFixed(2)} — lost the bet. Balance ${formatCentsExact(bankrollCents)}.`
      if (e.type === 'cash-out') return `Cashed out at ×${e.multiplier.toFixed(2)} — banked ${dollars(out.totalPayout)}. Balance ${formatCentsExact(bankrollCents)}.`
      if (e.type === 'topped-out') return `Topped out at ×${e.multiplier.toFixed(2)} — banked ${dollars(out.totalPayout)}! Balance ${formatCentsExact(bankrollCents)}.`
    }
    return 'Dealt.'
  }
  const parts: string[] = []
  if (out.totalPayout > 0) {
    parts.push(`Won ${formatCredits(out.totalPayout)} credits.`)
  } else {
    parts.push('No win.')
  }
  // Speak the honest result too: a win under the bet is a net loss (LDW).
  const net = out.totalPayout - out.coinsIn
  if (net > 0) parts.push(`Net up ${formatCredits(net)}.`)
  else if (net < 0) parts.push(`Net down ${formatCredits(-net)}.`)
  else parts.push('Net even.')
  for (const e of out.featureEvents) {
    if (e.type === 'free-spins-triggered') parts.push(`${e.count} free spins at ${e.multiplier}x.`)
    if (e.type === 'free-spin-consumed') parts.push(`Free spins: ${e.remaining} remaining.`)
    if (e.type === 'free-spins-retriggered') parts.push(`Retrigger! ${e.remaining} free spins.`)
    if (e.type === 'orbs-locked') parts.push(`${e.cells.length} orbs locked.`)
    if (e.type === 'mult-orbs-locked') parts.push(`${e.mults.map(m => `times ${m}`).join(' ')} multiplier locked.`)
    if (e.type === 'hold-and-spin-ended') parts.push(`Hold and spin pays ${formatCredits(e.totalCredits)} credits${e.filled ? ' — GRAND!' : '.'}`)
    if (e.type === 'flag-stocked') parts.push(`${e.flag} stocked.`)
    if (e.type === 'bonus-started') parts.push(`${e.bonus.toUpperCase()} bonus!`)
    if (e.type === 'interlude-started') parts.push('Bonus interlude.')
    if (e.type === 'bonus-ended') parts.push('Bonus complete.')
    if (e.type === 'replay-granted') parts.push('Replay — next game free.')
    if (e.type === 'wheel-armed') parts.push('WHEEL! The topper is armed — the next spin is free.')
    if (e.type === 'wheel-landed') parts.push(`The wheel pays ${formatCredits(e.credits)} credits${e.credits >= 2500 ? ' — MEGA!' : '.'}`)
    if (e.type === 'wheel-wasted') parts.push('The WHEEL landed, but only max coins arms it — a real cabinet would have kept that quiet.')
  }
  for (const p of out.progressiveEvents) {
    parts.push(`PROGRESSIVE: ${formatCredits(p.amountCredits)} credits!`)
  }
  parts.push(`Balance ${formatCredits(Math.floor(bankrollCents / def.denominationCents))} credits.`)
  return parts.join(' ')
}
