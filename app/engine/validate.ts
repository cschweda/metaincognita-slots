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

  switch (def.family) {
    case 'stepper': {
      if (def.physicalStrips.length !== def.virtualMaps.length) {
        errors.push(`reel count mismatch: ${def.physicalStrips.length} strips vs ${def.virtualMaps.length} virtual maps`)
      }
      def.physicalStrips.forEach((strip, r) => {
        strip.forEach(s => checkSymbol(s, `physicalStrips[${r}]`))
      })
      def.virtualMaps.forEach((vmap, r) => {
        const strip = def.physicalStrips[r]
        if (!strip) return
        const covered = new Set<number>()
        vmap.forEach((idx) => {
          if (!Number.isInteger(idx) || idx < 0 || idx >= strip.length) {
            errors.push(`virtual map [${r}] index ${idx} out of range 0..${strip.length - 1}`)
          } else {
            covered.add(idx)
          }
        })
        // Every physical stop must be weighted at least once: an unreferenced
        // stop can never land on the payline, so the modelled odds silently
        // diverge from the strip the player sees — virtually always a dropped-
        // index typo, not intent. Both shipped steppers cover all 22 stops; the
        // engine and the exact-RTP enumerator both draw from this same map.
        for (let i = 0; i < strip.length; i++) {
          if (!covered.has(i)) {
            errors.push(`virtual map [${r}] never references physical stop ${i} (unreachable on the payline)`)
          }
        }
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
      break
    }
    case 'bally-em': {
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
      break
    }
    case 'video': {
      if (def.strips.length !== 5) errors.push(`video needs 5 strips, got ${def.strips.length}`)
      const L = def.strips[0]?.length ?? 0
      if (L !== 24) errors.push(`video strips must be 24 cells (full-cycle enumeration), got ${L}`)
      def.strips.forEach((strip, r) => {
        if (strip.length !== L) errors.push(`strips[${r}] length ${strip.length} != ${L}`)
        strip.forEach(s => checkSymbol(s, `strips[${r}]`))
      })
      const special = new Set<SymbolId>()
      if (def.wildSymbol !== null) {
        checkSymbol(def.wildSymbol, 'wildSymbol')
        special.add(def.wildSymbol)
        if (def.strips[0]!.includes(def.wildSymbol)) {
          errors.push('wild must not appear on reel 1 (line/ways anchoring rule)')
        }
      }
      if (def.scatter !== null) {
        checkSymbol(def.scatter.symbol, 'scatter')
        special.add(def.scatter.symbol)
        def.strips.forEach((strip, r) => {
          const pos = strip.flatMap((s, i) => s === def.scatter!.symbol ? [i] : [])
          for (let a = 0; a < pos.length; a++) {
            for (let b = a + 1; b < pos.length; b++) {
              const d = Math.abs(pos[a]! - pos[b]!)
              if (Math.min(d, L - d) < 3) {
                errors.push(`strips[${r}]: scatter spacing under 3 breaks the one-per-window invariant`)
              }
            }
          }
        })
        for (const k of Object.keys(def.scatter.pays)) {
          const n = Number(k)
          if (!Number.isInteger(n) || n < 1 || n > 5) errors.push(`scatter pays key ${k} out of range 1..5`)
        }
      }
      if (def.wildSymbol !== null && def.scatter !== null && def.wildSymbol === def.scatter.symbol) {
        errors.push('wildSymbol and scatter.symbol must be different symbols')
      }
      if (def.holdAndSpin !== null) {
        const h = def.holdAndSpin
        checkSymbol(h.orbSymbol, 'holdAndSpin.orbSymbol')
        checkSymbol(h.emptySymbol, 'holdAndSpin.emptySymbol')
        special.add(h.orbSymbol)
        special.add(h.emptySymbol)
        if (h.triggerCount < 1 || h.triggerCount > 15) errors.push('holdAndSpin.triggerCount out of range 1..15')
        if (h.respins < 1) errors.push('holdAndSpin.respins must be >= 1')
        if (h.respinOrbDenom < 1 || h.respinOrbNumer < 0 || h.respinOrbNumer > h.respinOrbDenom) {
          errors.push('holdAndSpin respin probability must be a proper fraction')
        }
        if (h.orbValues.length === 0) errors.push('holdAndSpin.orbValues must not be empty')
        let creditEntryCount = 0
        h.orbValues.forEach((v, i) => {
          if ('mult' in v) {
            if (v.mult < 2) errors.push(`holdAndSpin.orbValues[${i}]: multiplier mult must be >= 2`)
            if (v.weight <= 0) errors.push(`holdAndSpin.orbValues[${i}]: weight must be > 0`)
          } else {
            creditEntryCount++
            if (v.credits <= 0 || v.weight <= 0) errors.push(`holdAndSpin.orbValues[${i}]: credits and weight must be > 0`)
          }
        })
        if (creditEntryCount === 0) errors.push('holdAndSpin.orbValues must contain at least one credit entry')
        if (def.strips.some(s => s.includes(h.emptySymbol))) {
          errors.push('holdAndSpin.emptySymbol must not appear on strips')
        }
        if (def.progressive?.kind !== 'percent') {
          errors.push('holdAndSpin requires a percent progressive (the Grand)')
        }
        if (def.freeSpins !== null) errors.push('freeSpins and holdAndSpin are mutually exclusive in v0.2')
        if (!def.fixedBet) errors.push('holdAndSpin machines must be fixed bet')
      } else if (def.progressive !== null) {
        errors.push('video percent progressives are only paid by hold-and-spin (the Grand) in v0.2')
      }
      if (def.freeSpins !== null) {
        if (def.scatter === null || def.scatter.triggerCount === null) {
          errors.push('freeSpins requires a scatter with a triggerCount')
        }
        if (def.freeSpins.count < 1 || def.freeSpins.multiplier < 1) {
          errors.push('freeSpins count and multiplier must be >= 1')
        }
      }
      if (def.betMode.kind === 'lines') {
        if (def.betMode.lines.length !== def.maxCoins) {
          errors.push(`lines count ${def.betMode.lines.length} != maxCoins ${def.maxCoins}`)
        }
        def.betMode.lines.forEach((pat, i) => {
          if (pat.length !== def.strips.length) errors.push(`lines[${i}] length ${pat.length} != 5`)
          pat.forEach((row) => {
            if (row < 0 || row > 2) errors.push(`lines[${i}] row ${row} out of range 0..2`)
          })
        })
      } else if (!def.fixedBet) {
        errors.push('ways machines must be fixed bet (the bet buys all ways)')
      }
      const bySymbol = new Map<SymbolId, Set<number>>()
      for (const e of def.paytable) {
        checkSymbol(e.symbol, `paytable ${e.id}`)
        if (e.pay <= 0) errors.push(`paytable ${e.id}: pay must be > 0`)
        if (special.has(e.symbol)) errors.push(`paytable ${e.id}: wild/scatter/orb symbols cannot pay as line symbols`)
        const set = bySymbol.get(e.symbol) ?? new Set<number>()
        set.add(e.length)
        bySymbol.set(e.symbol, set)
      }
      for (const [sym, lengths] of bySymbol) {
        if (!lengths.has(3) || !lengths.has(4) || !lengths.has(5) || lengths.size !== 3) {
          errors.push(`paytable for ${sym} must cover lengths 3, 4 and 5 (exact-run matching)`)
        }
      }
      break
    }
    case 'pachislo': {
      if (def.strips.length !== 3) errors.push(`pachislo needs 3 strips, got ${def.strips.length}`)
      def.strips.forEach((strip, r) => {
        if (strip.length !== 21) errors.push(`strips[${r}] length ${strip.length} != 21 stops`)
        strip.forEach(s => checkSymbol(s, `strips[${r}]`))
      })
      for (const [role, sym] of Object.entries(def.roles)) {
        checkSymbol(sym, `roles.${role}`)
      }
      if (def.strips[1]?.includes(def.roles.cherry) || def.strips[2]?.includes(def.roles.cherry)) {
        errors.push('cherry must only appear on reel 1 (control treats it as a left-reel win)')
      }
      const need: [number, SymbolId, string][] = [
        [0, def.roles.bell, 'bell'], [1, def.roles.bell, 'bell'], [2, def.roles.bell, 'bell'],
        [0, def.roles.watermelon, 'watermelon'], [1, def.roles.watermelon, 'watermelon'], [2, def.roles.watermelon, 'watermelon'],
        [0, def.roles.replay, 'replay'], [1, def.roles.replay, 'replay'], [2, def.roles.replay, 'replay'],
        [0, def.roles.seven, 'seven'], [1, def.roles.seven, 'seven'], [2, def.roles.seven, 'seven'],
        [2, def.roles.bar, 'bar']
      ]
      for (const [r, sym, name] of need) {
        if (!def.strips[r]?.includes(sym)) {
          errors.push(`combo symbol ${name} missing from reel ${r + 1} — its flag could never land`)
        }
      }
      if (def.slip !== 4) errors.push('slip must be exactly 4 (the control implements the 4-stop window)')
      if (def.maxCoins !== 3) errors.push('maxCoins must be 3 (normal games require the full bet in v0.2)')
      if (def.oddsLevels.length !== 6) errors.push(`need 6 odds levels, got ${def.oddsLevels.length}`)
      if (!Number.isInteger(def.defaultOddsLevel) || def.defaultOddsLevel < 1 || def.defaultOddsLevel > def.oddsLevels.length) {
        errors.push('defaultOddsLevel out of range')
      }
      def.oddsLevels.forEach((lv, i) => {
        const total = 3 * def.baseRates.cherryPerRow + def.baseRates.watermelon
          + def.baseRates.replay + lv.bell + lv.reg + lv.big
        if (lv.bell < 0 || lv.reg < 0 || lv.big < 0) errors.push(`oddsLevels[${i}]: negative rate`)
        if (total > 16384) errors.push(`oddsLevels[${i}]: rates sum ${total} exceeds the 16384 lottery`)
      })
      if (def.jac.perRound < 1 || def.jac.pay < 1 || def.jac.cost < 0) errors.push('jac config must be positive')
      if (def.bigRounds !== 3) errors.push('bigRounds must be 3 in v0.2 (interlude indices are typed 1|2)')
      const il = def.interlude
      if (il.weightDenom < 1 || il.bellWeight < 0 || il.endWeight < 1
        || il.bellWeight + il.endWeight > il.weightDenom) {
        errors.push('interlude weights must satisfy 0 <= bell, 1 <= end, bell+end <= denom')
      }
      if (il.maxBells < 1) errors.push('interlude.maxBells must be >= 1')
      break
    }
    case 'blackjack-reel': {
      if (def.strips.length !== 5) errors.push(`blackjack-reel needs 5 strips, got ${def.strips.length}`)
      if (def.paytable.length === 0) errors.push('blackjack-reel paytable must not be empty')
      // Build the full set of valid symbol ids: card values, multipliers, bust-save
      const validSymbols = new Set<SymbolId>([
        ...Object.keys(def.cardValues),
        def.aceSymbol,
        ...Object.keys(def.multiplierSymbols),
        ...(def.bustSaveSymbol !== null ? [def.bustSaveSymbol] : [])
      ])
      def.strips.forEach((strip, r) => {
        if (strip.length === 0) errors.push(`strips[${r}] must not be empty`)
        strip.forEach((s) => {
          checkSymbol(s, `strips[${r}]`)
          if (!validSymbols.has(s)) {
            errors.push(`strips[${r}]: symbol "${s}" not found in cardValues, aceSymbol, multiplierSymbols, or bustSaveSymbol`)
          }
        })
      })
      break
    }
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid machine "${def.id}":\n  - ${errors.join('\n  - ')}`)
  }
}
