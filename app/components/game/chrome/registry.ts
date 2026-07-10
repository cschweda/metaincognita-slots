import { defineAsyncComponent, type Component } from 'vue'
import DefaultChrome from './DefaultChrome.vue'

// Bespoke modules are added here as they are built (Task 2 onward).
const MODULES: Record<string, () => Promise<{ default: Component }>> = {
  'ruby-of-gargoyle': () => import('./RubyOfGargoyleChrome.vue'),
  'stock-rush': () => import('./StockRushChrome.vue'),
  'canal-royale': () => import('./CanalRoyaleChrome.vue'),
  'dragons-hoard': () => import('./DragonsHoardChrome.vue'),
  'thunder-vault': () => import('./ThunderVaultChrome.vue'),
  'diamond-doubler': () => import('./DiamondDoublerChrome.vue'),
  'sevens-ablaze': () => import('./SevensAblazeChrome.vue'),
  'series-e-3line': () => import('./SeriesE3LineChrome.vue'),
  'series-e-multiplier': () => import('./SeriesEMultiplierChrome.vue'),
  'wonder-wheel': () => import('./WonderWheelChrome.vue'),
  'flameout-21': () => import('./FlameoutChrome.vue')
  // Stop & Lock 777 (lock-reel) deliberately has no entry: it renders its own
  // full-page bespoke cabinet (GameReelLockReel) instead of the standard
  // MachineChrome path, so it never calls chromeFor — the DefaultChrome fallback
  // below is the correct no-op and an explicit entry would be dead.
}

const cache: Record<string, Component> = {}

export function chromeFor(id: string): Component {
  const loader = MODULES[id]
  if (!loader) return DefaultChrome
  return (cache[id] ??= defineAsyncComponent(loader))
}
