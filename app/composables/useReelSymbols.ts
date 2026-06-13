// app/composables/useReelSymbols.ts
import type { Ref } from 'vue'

/** Minimal shape every reel surface's def satisfies: a symbol table plus an
 * optional wild id. Pachislo has no wildSymbol; the optional field tolerates it. */
interface SymbolBearingDef {
  symbols: Record<string, { label: string, icon?: string }>
  wildSymbol?: string | null
}

/**
 * Symbol-table lookups shared by every reel surface. Reads the live def so the
 * helpers stay reactive; falls back to the symbol id when no label is defined.
 * Generic over the concrete def so each surface keeps its own machine type.
 */
export function useReelSymbols<T extends SymbolBearingDef>(def: Ref<T | null>) {
  function iconFor(sym: string): string | undefined {
    return def.value?.symbols[sym]?.icon
  }
  function labelFor(sym: string): string {
    return def.value?.symbols[sym]?.label ?? sym
  }
  function isWild(sym: string): boolean {
    return def.value?.wildSymbol === sym
  }
  return { iconFor, labelFor, isWild }
}
