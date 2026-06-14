import { defineAsyncComponent, type Component } from 'vue'
import DefaultChrome from './DefaultChrome.vue'

// Bespoke modules are added here as they are built (Task 2 onward).
const MODULES: Record<string, () => Promise<{ default: Component }>> = {}

const cache: Record<string, Component> = {}

export function chromeFor(id: string): Component {
  const loader = MODULES[id]
  if (!loader) return DefaultChrome
  return (cache[id] ??= defineAsyncComponent(loader))
}
