import type { MachineDef, SymbolId } from './types'

/** Throws with a readable message list if the def is malformed. */
export function validateMachineDef(def: MachineDef): void {
  const errors: string[] = []
  const known = new Set<SymbolId>(Object.keys(def.symbols))
  const checkSymbol = (s: SymbolId, where: string) => {
    if (!known.has(s)) errors.push(`${where}: unknown symbol "${s}"`)
  }

  if (def.maxCoins < 1) errors.push('maxCoins must be >= 1')
  if (def.denominationCents <= 0) errors.push('denominationCents must be > 0')

  if (def.family === 'stepper') {
    if (def.physicalStrips.length !== def.virtualMaps.length) {
      errors.push(`reel count mismatch: ${def.physicalStrips.length} strips vs ${def.virtualMaps.length} virtual maps`)
    }
    def.physicalStrips.forEach((strip, r) => {
      strip.forEach(s => checkSymbol(s, `physicalStrips[${r}]`))
    })
    def.virtualMaps.forEach((vmap, r) => {
      const strip = def.physicalStrips[r]
      if (!strip) return
      vmap.forEach((idx) => {
        if (!Number.isInteger(idx) || idx < 0 || idx >= strip.length) {
          errors.push(`virtual map [${r}] index ${idx} out of range 0..${strip.length - 1}`)
        }
      })
    })
    if (def.wildSymbol !== null) checkSymbol(def.wildSymbol, 'wildSymbol')
    for (const entry of def.paytable) {
      if (entry.pay <= 0) errors.push(`paytable ${entry.id}: pay must be > 0`)
      if (entry.kind === 'allWild' && def.wildSymbol === null) {
        errors.push(`paytable ${entry.id}: allWild requires a wild symbol`)
      }
      if (entry.kind === 'allSame' || entry.kind === 'count') checkSymbol(entry.symbol, `paytable ${entry.id}`)
      if (entry.kind === 'anyOf') {
        entry.symbols.forEach(s => checkSymbol(s, `paytable ${entry.id}`))
        // wild substitution already applies inside anyOf matching; listing the
        // wild in symbols would double-apply it and silently corrupt the RTP
        if (def.wildSymbol !== null && entry.symbols.includes(def.wildSymbol)) {
          errors.push(`paytable ${entry.id}: anyOf symbols must not include the wild symbol`)
        }
      }
      if (entry.kind === 'count' && entry.symbol === def.wildSymbol) {
        errors.push(`paytable ${entry.id}: count entries must not target the wild symbol`)
      }
      // a progressive award without its matching meter config makes the
      // evaluator and the exact-RTP enumerator silently disagree
      if (entry.kind === 'allSame' && entry.progressiveAtMaxCoins === true && def.progressive?.kind !== 'percent') {
        errors.push(`paytable ${entry.id}: progressiveAtMaxCoins requires a percent progressive config`)
      }
    }
  } else {
    if (def.payMode === 'lines' && def.maxCoins > 3) {
      errors.push(`payMode 'lines' supports at most 3 coins/paylines (maxCoins ${def.maxCoins})`)
    }
    def.strips.forEach((strip, r) => {
      if (strip.length !== def.stops) {
        errors.push(`strips[${r}] length ${strip.length} != stops ${def.stops}`)
      }
      strip.forEach(s => checkSymbol(s, `strips[${r}]`))
    })
    for (const entry of def.paytable) {
      if (entry.pay <= 0) errors.push(`paytable ${entry.id}: pay must be > 0`)
      if (entry.kind === 'run') {
        checkSymbol(entry.symbol, `paytable ${entry.id}`)
        if (entry.length < 1 || entry.length > def.strips.length) {
          errors.push(`paytable ${entry.id}: run length ${entry.length} out of range`)
        }
        if (entry.progressive === 'live' && def.progressive?.kind !== 'dual') {
          errors.push(`paytable ${entry.id}: progressive 'live' requires a dual progressive config`)
        }
        if (entry.progressive === 'maxCoins' && def.progressive?.kind !== 'single') {
          errors.push(`paytable ${entry.id}: progressive 'maxCoins' requires a single progressive config`)
        }
      } else {
        checkSymbol(entry.symbol, `paytable ${entry.id}`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid machine "${def.id}":\n  - ${errors.join('\n  - ')}`)
  }
}
