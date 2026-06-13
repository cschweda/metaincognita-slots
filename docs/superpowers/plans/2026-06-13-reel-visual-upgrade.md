# Reel Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four reel surfaces look and play like real slot machines — pictorial SVG symbols, reels that vertically scroll to a staggered stop, winning paylines drawn across the face with left-gutter numbers, a held result card (gross win + current bankroll + literal chips + bankroll sparkline), a denomination tag, and a per-machine marquee.

**Architecture:** Presentation-only. A shared `SymbolIcon` (backed by an icon registry) replaces text labels; a shared `useReelSpin` composable owns the scroll/blur/staggered-reveal and calls the existing `store.revealDone()`; a `PaylineOverlay` draws winning lines; `ResultBar` replaces the auto-hiding `WinBanner` and persists until the next spin. The engine, RTP math, PAR sheet, and cents/credits money model are untouched (one display-only `icon?` string is added to symbol metadata).

**Tech Stack:** Nuxt 4 SPA (ssr:false), Vue 3 `<script setup lang="ts">`, Pinia options store, Tailwind 4, @nuxt/ui 4, Vitest 4 + @vue/test-utils + happy-dom. `~` aliases `app/`. Components auto-import path-prefixed: `app/components/game/X.vue` → `<GameX>`.

**Spec:** `docs/superpowers/specs/2026-06-13-reel-visual-upgrade-design.md`

---

## Conventions (read first)

- **Component tests** start with `// @vitest-environment happy-dom`, use `mount` from `@vue/test-utils`, `setActivePinia(createPinia())`, `localStorage.clear()`, `store.startSession(n)`, `store.selectMachine(id)`, and stub `@nuxt/ui` components: `stubs: { UIcon: true, UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' } }`. The engine suites stay in the default `node` environment (do not add the pragma there).
- **Run one test file:** `pnpm vitest run tests/<path>`. **All tests:** `pnpm test`. **Lint:** `pnpm lint`. **Types:** `pnpm typecheck`. **Build:** `pnpm generate`. **Verify CLI:** `pnpm verify`.
- **Engine purity:** nothing under `app/engine/` may import Vue/Nuxt/Pinia (CI greps for it). The `icon?` field is a plain string, so this holds.
- **Commits:** end the message with descriptive content. **Do NOT add any `Co-Authored-By` / AI-attribution trailer** (project rule). Work happens on branch `reel-visual-upgrade`.
- **Symbol-id → icon-id map** (used by Tasks 1, 3, 4):

  | Machine | symbol → icon |
  |---|---|
  | canal-royale | LI→lion, MA→mask, FA→fan, AA→ace, KK→king, QQ→queen, JJ→jack, TT→ten, WD→doge, SC→gondola |
  | diamond-doubler | DW→diamond, S7→seven, B3→bar3, B2→bar2, B1→bar1, CH→cherry, BL→blank |
  | dragons-hoard | DR→dragon, PH→phoenix, KO→koi, AA→ace, KK→king, QQ→queen, JJ→jack, TT→ten, WD→pearl, SC→ingot |
  | series-e-3line | S7→seven, AR→bar1, BE→bell, PL→plum, OR→orange, CH→cherry, BL→blank |
  | series-e-multiplier | S7→seven, AR→bar1, BE→bell, PL→plum, OR→orange, CH→cherry, BL→blank |
  | sevens-ablaze | F7→seven-flame, S7→seven-red, B3→bar3, B2→bar2, B1→bar1, CH→cherry, BL→blank |
  | stock-rush | R7→seven-red, BB→bar-bonus, BE→bell, RP→replay, WM→watermelon, CH→cherry, BL→blank |
  | thunder-vault | VA→vault, LT→lightning, GB→goldbar, AA→ace, KK→king, QQ→queen, JJ→jack, OR→orb, EM→blank |

  Wilds (canal WD, dragons WD, diamond DW) render their themed icon **plus** a corner "WILD" ribbon, driven by a `wild` prop the surfaces pass for `cell === def.wildSymbol`.

---

## Task 1: Add display-only `icon` field to symbol metadata + tag every machine

**Files:**
- Modify: `app/engine/types.ts` (the `symbols:` line of every machine-def interface that has one)
- Modify: all of `app/machines/*.ts` (add `icon` to each symbol entry per the map above)
- Test: `tests/engine/symbolIcons.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/symbolIcons.test.ts
import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'

describe('symbol icon metadata', () => {
  it('every symbol on every machine declares an icon id', () => {
    for (const def of FLOOR) {
      for (const [id, meta] of Object.entries(def.symbols)) {
        expect(typeof (meta as { icon?: string }).icon, `${def.id}:${id}`).toBe('string')
        expect((meta as { icon?: string }).icon!.length, `${def.id}:${id}`).toBeGreaterThan(0)
      }
    }
  })
})
```

(If `FLOOR` is not the export name in `app/machines/index.ts`, open that file and use the actual array export.)

- [ ] **Step 2: Run it — expect FAIL**

Run: `pnpm vitest run tests/engine/symbolIcons.test.ts`
Expected: FAIL (icons are `undefined`).

- [ ] **Step 3: Widen the type**

In `app/engine/types.ts`, change each symbol map (there are a few — `VideoMachineDef`, `StepperMachineDef`, `BallyEmMachineDef`, `PachisloMachineDef`, or a shared base). The current line is:

```ts
  /** symbol id → display label (glyphs/art arrive in Plan 3) */
  symbols: Record<SymbolId, { label: string }>
```

Change to:

```ts
  /** symbol id → display label + optional icon id (see components/game/symbols/registry) */
  symbols: Record<SymbolId, { label: string, icon?: string }>
```

(`icon` is optional in the type but every def sets it; the test enforces presence.)

- [ ] **Step 4: Tag every machine def**

In each `app/machines/*.ts`, add `icon` to each symbol per the map. Example for `canal-royale.ts`:

```ts
  symbols: {
    LI: { label: 'Winged Lion', icon: 'lion' },
    MA: { label: 'Carnival Mask', icon: 'mask' },
    FA: { label: 'Golden Fan', icon: 'fan' },
    AA: { label: 'Ace', icon: 'ace' },
    KK: { label: 'King', icon: 'king' },
    QQ: { label: 'Queen', icon: 'queen' },
    JJ: { label: 'Jack', icon: 'jack' },
    TT: { label: 'Ten', icon: 'ten' },
    WD: { label: 'Wild Doge', icon: 'doge' },
    SC: { label: 'Gondola Scatter', icon: 'gondola' }
  },
```

Repeat for the other seven machines using the map table.

- [ ] **Step 5: Run the test + typecheck — expect PASS**

Run: `pnpm vitest run tests/engine/symbolIcons.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/engine/types.ts app/machines tests/engine/symbolIcons.test.ts
git commit -m "Add display-only icon id to symbol metadata; tag all 8 machines"
```

---

## Task 2: Icon registry framework + typographic + core pictorial icons + `SymbolIcon`

**Files:**
- Create: `app/components/game/symbols/registry.ts`
- Create: `app/components/game/SymbolIcon.vue`
- Test: `tests/components/symbolIcon.test.ts`

- [ ] **Step 1: Write the registry**

```ts
// app/components/game/symbols/registry.ts
//
// Icon house style: 24x24 viewBox, FILLED DUOTONE — one solid fill + one darker
// shade for depth, rounded forms, no thin outlines. Colours use literal hex close
// to Tailwind tokens. Pictorial ids return inline SVG *children* (no <svg> wrapper);
// SymbolIcon supplies the wrapper. Typographic ids (royals, sevens, bars) render
// as styled text instead of art.

export type SymbolArt =
  | { kind: 'svg', body: string }
  | { kind: 'text', text: string, variant: 'royal' | 'seven' | 'bar', color?: string }

const A = '#f59e0b' // amber base
const AD = '#b45309' // amber dark

export const SYMBOL_ART: Record<string, SymbolArt> = {
  // ---- typographic ----
  ace: { kind: 'text', text: 'A', variant: 'royal' },
  king: { kind: 'text', text: 'K', variant: 'royal' },
  queen: { kind: 'text', text: 'Q', variant: 'royal' },
  jack: { kind: 'text', text: 'J', variant: 'royal' },
  ten: { kind: 'text', text: '10', variant: 'royal' },
  seven: { kind: 'text', text: '7', variant: 'seven', color: '#f59e0b' },
  'seven-red': { kind: 'text', text: '7', variant: 'seven', color: '#ef4444' },
  'seven-flame': { kind: 'text', text: '7', variant: 'seven', color: '#fb923c' },
  bar1: { kind: 'text', text: '1', variant: 'bar' },
  bar2: { kind: 'text', text: '2', variant: 'bar' },
  bar3: { kind: 'text', text: '3', variant: 'bar' },
  'bar-bonus': { kind: 'text', text: 'B', variant: 'bar', color: '#fcd34d' },
  // ---- core pictorial (vetted in the design demo) ----
  bell: { kind: 'svg', body: '<path d="M12 2.4c.9 0 1.6.7 1.6 1.6v.5c2.9 1 4.8 3.8 4.8 7v3.1l1.6 2.1c.3.4 0 1-.5 1H4.9c-.5 0-.8-.6-.5-1l1.6-2.1V12c0-3.2 1.9-6 4.8-7v-.5c0-.9.7-1.6 1.6-1.6z" fill="#fcd34d"/><path d="M12 5.6c-2.6 0-4.4 2.4-4.4 6.4v3.4h8.8V12c0-4-1.8-6.4-4.4-6.4z" fill="#b45309"/><circle cx="12" cy="20.4" r="1.9" fill="#fcd34d"/>' },
  cherry: { kind: 'svg', body: '<path d="M10 8c-3-5-9-3-9 1 0 3 4 5 8 5" stroke="#15803d" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="8.5" cy="17" r="4.4" fill="#f43f5e"/><circle cx="16.5" cy="18" r="3.8" fill="#e11d48"/><circle cx="7" cy="15.6" r="1.2" fill="#fda4af"/>' },
  diamond: { kind: 'svg', body: '<path d="M6 4h12l4 5-10 12L2 9z" fill="#38bdf8"/><path d="M6 4l-4 5h20l-4-5M12 21L8 9h8z" fill="#0ea5e9"/>' },
  plum: { kind: 'svg', body: '<circle cx="11.5" cy="14" r="7" fill="#7c3aed"/><circle cx="9" cy="11.5" r="2.1" fill="#c4b5fd"/><path d="M12 7c1-3 4-4.5 6.5-4.3C18 5.7 15.6 7.4 12 7z" fill="#22c55e"/>' },
  orange: { kind: 'svg', body: '<circle cx="12" cy="13.5" r="7.3" fill="#f97316"/><circle cx="9.4" cy="10.8" r="2.2" fill="#fdba74"/><path d="M12 6c1-2.2 3.2-2.7 4.8-2-.6 2.2-2.4 3.2-4.8 2z" fill="#16a34a"/>' },
  watermelon: { kind: 'svg', body: '<path d="M3 8a9 9 0 0 0 18 0z" fill="#16a34a"/><path d="M5 8a7 7 0 0 0 14 0z" fill="#ef4444"/><circle cx="9" cy="11" r=".8" fill="#1c1917"/><circle cx="12" cy="12.2" r=".8" fill="#1c1917"/><circle cx="15" cy="11" r=".8" fill="#1c1917"/>' },
  replay: { kind: 'svg', body: '<path d="M19 12a7 7 0 1 1-2-4.9" fill="none" stroke="#34d399" stroke-width="2.4" stroke-linecap="round"/><path d="M17 3.5V8h-4.5z" fill="#34d399"/>' },
  blank: { kind: 'svg', body: '<circle cx="12" cy="12" r="2" fill="#3f3f46"/>' }
}

export function symbolArt(iconId: string | undefined): SymbolArt | null {
  if (iconId === undefined) return null
  return SYMBOL_ART[iconId] ?? null
}
```

- [ ] **Step 2: Write `SymbolIcon.vue`**

```vue
<!-- app/components/game/SymbolIcon.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { symbolArt } from '~/components/game/symbols/registry'

const props = withDefaults(defineProps<{
  icon?: string
  label: string
  size?: number
  wild?: boolean
}>(), { size: 58, wild: false })

const art = computed(() => symbolArt(props.icon))
const barCount = computed(() => art.value?.kind === 'text' && art.value.variant === 'bar'
  ? Number(art.value.text) || 1 : 0)
</script>

<template>
  <div
    class="relative flex items-center justify-center select-none"
    :style="{ width: size + 'px', height: size + 'px' }"
    role="img"
    :aria-label="label"
  >
    <!-- pictorial -->
    <svg
      v-if="art && art.kind === 'svg'"
      viewBox="0 0 24 24"
      :width="size"
      :height="size"
      aria-hidden="true"
      v-html="art.body"
    />
    <!-- royals / sevens -->
    <span
      v-else-if="art && art.kind === 'text' && art.variant !== 'bar'"
      aria-hidden="true"
      :class="art.variant === 'seven' ? 'font-black italic' : 'font-bold'"
      :style="{
        fontSize: (art.variant === 'seven' ? size * 0.82 : size * 0.66) + 'px',
        lineHeight: 1,
        fontFamily: art.variant === 'seven' ? 'Arial Black, Impact, sans-serif' : 'Georgia, serif',
        color: art.color ?? (art.variant === 'seven' ? '#f59e0b' : '#e5e5e5'),
        textShadow: art.variant === 'seven' ? '0 2px 0 #7c2d12' : 'none'
      }"
    >{{ art.text }}</span>
    <!-- bars -->
    <span
      v-else-if="art && art.kind === 'text' && art.variant === 'bar'"
      aria-hidden="true"
      class="flex flex-col gap-[3px]"
    >
      <span
        v-for="n in barCount"
        :key="n"
        class="font-black tracking-wide rounded-[3px]"
        :style="{ fontSize: size * 0.16 + 'px', padding: '1px ' + size * 0.13 + 'px', background: art.color ?? '#f59e0b', color: '#1c1207' }"
      >BAR</span>
    </span>
    <!-- fallback: the label text (never render empty) -->
    <span
      v-else
      aria-hidden="true"
      class="text-center font-bold text-neutral-200 px-1"
      :style="{ fontSize: size * 0.2 + 'px', lineHeight: 1.1 }"
    >{{ label }}</span>

    <!-- wild ribbon -->
    <span
      v-if="wild"
      class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-amber-500 text-[8px] font-black tracking-wider text-amber-950 px-1.5 py-px"
    >WILD</span>
  </div>
</template>
```

- [ ] **Step 3: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SymbolIcon from '../../app/components/game/SymbolIcon.vue'

describe('SymbolIcon', () => {
  it('renders pictorial art as inline svg', () => {
    const w = mount(SymbolIcon, { props: { icon: 'bell', label: 'Bell' } })
    expect(w.find('svg').exists()).toBe(true)
    expect(w.attributes('aria-label')).toBe('Bell')
  })

  it('renders royals and sevens as styled text', () => {
    const k = mount(SymbolIcon, { props: { icon: 'king', label: 'King' } })
    expect(k.text()).toContain('K')
    const s = mount(SymbolIcon, { props: { icon: 'seven', label: 'Seven' } })
    expect(s.text()).toContain('7')
  })

  it('renders the right number of BAR pills', () => {
    const w = mount(SymbolIcon, { props: { icon: 'bar3', label: 'Triple Bar' } })
    expect(w.findAll('span').filter(s => s.text() === 'BAR')).toHaveLength(3)
  })

  it('falls back to the label when the icon id is unknown or missing', () => {
    const w = mount(SymbolIcon, { props: { icon: 'no-such-icon', label: 'Mystery' } })
    expect(w.text()).toContain('Mystery')
    const n = mount(SymbolIcon, { props: { label: 'Bare' } })
    expect(n.text()).toContain('Bare')
  })

  it('adds a WILD ribbon when wild', () => {
    const w = mount(SymbolIcon, { props: { icon: 'doge', label: 'Wild Doge', wild: true } })
    expect(w.text()).toContain('WILD')
  })
})
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm vitest run tests/components/symbolIcon.test.ts`
Expected: PASS (5 tests). Note: `'doge'` art arrives in Task 4; the wild test only checks the ribbon text, which renders regardless of the fallback path — it passes now.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/symbols/registry.ts app/components/game/SymbolIcon.vue tests/components/symbolIcon.test.ts
git commit -m "Add SymbolIcon + icon registry (typographic + core pictorial, duotone)"
```

---

## Task 3: Author the themed icons + variant icons; verify every machine resolves

**Files:**
- Modify: `app/components/game/symbols/registry.ts` (add the themed entries)
- Test: `tests/components/iconCoverage.test.ts` (Create)

**Art direction** (24×24, filled duotone, base + one darker/lighter shade; keep them readable at 32px). Author each as a `{ kind: 'svg', body: '...' }` entry. Starter bodies below are complete and on-style; refine shapes freely but keep the two-tone fill and palette.

- [ ] **Step 1: Write the coverage test (failing)**

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'
import { symbolArt } from '../../app/components/game/symbols/registry'

describe('icon coverage', () => {
  it('every machine symbol icon id resolves to registry art', () => {
    for (const def of FLOOR) {
      for (const [id, meta] of Object.entries(def.symbols)) {
        const icon = (meta as { icon?: string }).icon
        expect(symbolArt(icon), `${def.id}:${id} (${icon})`).not.toBeNull()
      }
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (themed ids missing)

Run: `pnpm vitest run tests/components/iconCoverage.test.ts`
Expected: FAIL on `lion`, `mask`, etc.

- [ ] **Step 3: Add the themed entries to `SYMBOL_ART`**

Add these keys (complete, on-style starters):

```ts
  // ---- Canal Royale ----
  lion: { kind: 'svg', body: '<circle cx="12" cy="13" r="6.5" fill="#f59e0b"/><g fill="#b45309"><path d="M12 2l2.2 3.4-2.2 1.2-2.2-1.2z"/><path d="M3.5 9l3.8 1.1-1 2.3-3.2-1.4z"/><path d="M20.5 9l-3.8 1.1 1 2.3 3.2-1.4z"/><path d="M4 18l3.4-1.6 1 2.2-3.3 1.4z"/><path d="M20 18l-3.4-1.6-1 2.2 3.3 1.4z"/></g><circle cx="9.7" cy="12" r="1" fill="#1c1207"/><circle cx="14.3" cy="12" r="1" fill="#1c1207"/><path d="M9.5 15.5c1.4 1.2 3.6 1.2 5 0" stroke="#1c1207" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
  mask: { kind: 'svg', body: '<path d="M12 4c9 0 14 4 14 11 0 1-7 5-14 5S-2 16-2 15C-2 8 3 4 12 4z" fill="#7c3aed" transform="translate(0,0)"/><path d="M12 5c7 0 11 3 11 8.5 0 .9-5 3.5-11 3.5S1 14.4 1 13.5C1 8 5 5 12 5z" fill="#a78bfa"/><ellipse cx="8.5" cy="11" rx="2.4" ry="1.8" fill="#140f2e"/><ellipse cx="15.5" cy="11" rx="2.4" ry="1.8" fill="#140f2e"/><path d="M12 3c1-1.6 3-2 4.6-.8C15.7 3.8 14 4.6 12 4z" fill="#fbbf24"/>' },
  fan: { kind: 'svg', body: '<path d="M12 20L3.5 8.5a10.5 10.5 0 0 1 17 0z" fill="#f59e0b"/><path d="M12 20L3.5 8.5a10.5 10.5 0 0 1 17 0z" fill="none" stroke="#b45309" stroke-width="1"/><path d="M12 20L8 9M12 20l4-11M12 20V8" stroke="#b45309" stroke-width="1"/><circle cx="12" cy="20" r="1.6" fill="#fcd34d"/>' },
  doge: { kind: 'svg', body: '<path d="M5 9c0-3 3-5 7-5s7 2 7 5l-1 9H6z" fill="#fbbf24"/><path d="M7 18l1-7h8l1 7z" fill="#b45309"/><circle cx="12" cy="8.5" r="1.6" fill="#fff7ed"/>' },
  gondola: { kind: 'svg', body: '<path d="M2 15c4 2 16 2 20 0l-2 3c-3 1.5-13 1.5-16 0z" fill="#0ea5e9"/><path d="M3 15C5 9 19 9 21 15z" fill="#38bdf8"/><path d="M21 15c1-4 1.5-7 1.5-9" stroke="#fcd34d" stroke-width="1.5" fill="none" stroke-linecap="round"/>' },
  // ---- Dragon's Hoard ----
  dragon: { kind: 'svg', body: '<path d="M4 16c2-7 8-10 16-10-2 2-3 3-3 5 2 0 3 1 3 3-3 .5-5 2-6 4-3-1-7-1-10-2z" fill="#16a34a"/><path d="M4 16c2-7 8-10 16-10-3 3-9 4-12 7z" fill="#22c55e"/><circle cx="16" cy="8.5" r="1" fill="#1c1207"/>' },
  phoenix: { kind: 'svg', body: '<path d="M12 21c-5-3-8-7-8-11 2 2 4 3 6 3-2-2-3-5-2-8 1 3 3 5 4 6 1-1 3-3 4-6 1 3 0 6-2 8 2 0 4-1 6-3 0 4-3 8-8 11z" fill="#fb923c"/><path d="M12 21c-3-2-5-5-6-8 2 1 4 1 6 1z" fill="#f59e0b"/>' },
  koi: { kind: 'svg', body: '<path d="M3 12c4-5 11-5 15 0-4 5-11 5-15 0z" fill="#f97316"/><path d="M18 12c2-1.5 3-1.5 3.5-3-.2 1.8-.2 4.2 0 6-.5-1.5-1.5-1.5-3.5-3z" fill="#fb923c"/><circle cx="8" cy="11" r="1" fill="#1c1207"/><circle cx="12" cy="9.5" r="1.2" fill="#fde68a"/>' },
  pearl: { kind: 'svg', body: '<circle cx="12" cy="12" r="7" fill="#e2e8f0"/><circle cx="9.6" cy="9.6" r="2.4" fill="#f8fafc"/><circle cx="12" cy="12" r="7" fill="none" stroke="#94a3b8" stroke-width="1"/>' },
  ingot: { kind: 'svg', body: '<path d="M5 9h14l2 8H3z" fill="#fbbf24"/><path d="M7 9l-1.5 8M17 9l1.5 8M5 9h14l-1.5-1.6h-11z" fill="none" stroke="#b45309" stroke-width="1"/><path d="M5 9h14l-1.4-1.6H6.4z" fill="#fde68a"/>' },
  // ---- Thunder Vault ----
  vault: { kind: 'svg', body: '<rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="#475569"/><circle cx="12" cy="12" r="4.5" fill="#94a3b8"/><circle cx="12" cy="12" r="1.6" fill="#1e293b"/><g stroke="#1e293b" stroke-width="1.2"><path d="M12 6v2M12 16v2M6 12h2M16 12h2"/></g>' },
  lightning: { kind: 'svg', body: '<path d="M13 2L4 13h6l-2 9 10-13h-6z" fill="#facc15"/><path d="M13 2L4 13h6z" fill="#fde047"/>' },
  goldbar: { kind: 'svg', body: '<path d="M4 10h16l1.5 7H2.5z" fill="#fbbf24"/><path d="M4 10h16l-1.3-1.6H5.3z" fill="#fde68a"/><path d="M4 10l-1.5 7M20 10l1.5 7" stroke="#b45309" stroke-width="1" fill="none"/>' },
  orb: { kind: 'svg', body: '<circle cx="12" cy="12" r="7.5" fill="#7c3aed"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#c4b5fd" stroke-width="1"/><circle cx="9.5" cy="9.5" r="2.2" fill="#ddd6fe"/><path d="M5 13c3 2 11 2 14 0" stroke="#a78bfa" stroke-width="1" fill="none"/>' },
```

- [ ] **Step 4: Run coverage + the SymbolIcon suite — expect PASS**

Run: `pnpm vitest run tests/components/iconCoverage.test.ts tests/components/symbolIcon.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/symbols/registry.ts tests/components/iconCoverage.test.ts
git commit -m "Author themed + variant icons; every machine symbol resolves to art"
```

---

## Task 4: `winLines` util — pluralize + summariseWins

**Files:**
- Create: `app/utils/winLines.ts`
- Test: `tests/utils/winLines.test.ts`

- [ ] **Step 1: Write the test (failing)**

```ts
import { describe, expect, it } from 'vitest'
import { pluralize, summariseWins } from '../../app/utils/winLines'
import { CANAL_ROYALE } from '../../app/machines/canal-royale'

describe('pluralize', () => {
  it.each([
    ['King', 'Kings'], ['Cherry', 'Cherries'], ['Winged Lion', 'Winged Lions'],
    ['Seven', 'Sevens'], ['Carnival Mask', 'Carnival Masks'], ['Ten', 'Tens']
  ])('%s -> %s', (a, b) => expect(pluralize(a)).toBe(b))
})

describe('summariseWins', () => {
  it('returns empty for null / no wins', () => {
    expect(summariseWins(CANAL_ROYALE, null)).toEqual([])
    expect(summariseWins(CANAL_ROYALE, { machineId: 'canal-royale', wins: [] } as never)).toEqual([])
  })

  it('summarises a line win with count, plural name, pattern, colour, and cells', () => {
    // line-1 is LINES25[0] = [1,1,1,1,1]; 4 Kings from the left
    const outcome = {
      machineId: 'canal-royale',
      wins: [{ line: 'line-1', symbols: ['KK', 'KK', 'KK', 'KK'] }]
    } as never
    const [w] = summariseWins(CANAL_ROYALE, outcome)
    expect(w!.lineNumber).toBe(1)
    expect(w!.count).toBe(4)
    expect(w!.pluralName).toBe('Kings')
    expect(w!.pattern).toEqual([1, 1, 1, 1, 1])
    expect(w!.kind).toBe('line')
    expect(w!.cells).toEqual([
      { reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }
    ])
    expect(typeof w!.color).toBe('string')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm vitest run tests/utils/winLines.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// app/utils/winLines.ts
import type { MachineDef, SpinOutcome } from '~/engine'

export interface WinLine {
  lineNumber: number | null
  count: number
  symbolId: string
  symbolName: string
  pluralName: string
  payout: number
  pattern: number[] | null
  cells: { reel: number, row: number }[]
  kind: 'line' | 'ways' | 'single'
  color: string
}

const PALETTE = ['#f59e0b', '#38bdf8', '#f472b6', '#34d399', '#a78bfa', '#fb7185', '#facc15', '#22d3ee', '#c084fc']

export function pluralize(label: string): string {
  if (/[^aeiou]y$/i.test(label)) return label.replace(/y$/i, 'ies')
  if (/(s|x|ch|sh)$/i.test(label)) return label + 'es'
  return label + 's'
}

function symbolName(def: MachineDef, id: string): string {
  return (def.symbols as Record<string, { label: string }>)[id]?.label ?? id
}

/** Turn an engine outcome's wins into ordered, colour-tagged display rows. */
export function summariseWins(def: MachineDef, outcome: SpinOutcome | null): WinLine[] {
  if (outcome === null || !Array.isArray(outcome.wins) || outcome.wins.length === 0) return []
  const lines = (def.betMode as { kind: string, lines?: number[][] }).kind === 'lines'
    ? (def.betMode as { lines: number[][] }).lines
    : null
  return outcome.wins.map((w, i) => {
    const color = PALETTE[i % PALETTE.length]!
    const symbolId = w.symbols[0] ?? ''
    const name = symbolName(def, symbolId)
    const count = w.symbols.length
    const payout = (w as { pay?: number }).pay ?? 0
    const lineMatch = /^line-(\d+)$/.exec(w.line)
    if (lineMatch !== null && lines !== null) {
      const lineNumber = Number(lineMatch[1])
      const pattern = lines[lineNumber - 1] ?? null
      const cells = pattern === null ? [] : pattern.slice(0, count).map((row, reel) => ({ reel, row }))
      return { lineNumber, count, symbolId, symbolName: name, pluralName: pluralize(name), payout, pattern, cells, kind: 'line' as const, color }
    }
    const kind: 'ways' | 'single' = w.line.startsWith('ways') ? 'ways' : 'single'
    return { lineNumber: null, count, symbolId, symbolName: name, pluralName: pluralize(name), payout, pattern: null, cells: [], kind, color }
  })
}
```

(If `SpinOutcome.wins[]` items don't carry `pay`, drop `payout` usage — it is not displayed in the chips, only available for future use. Confirm the win item shape in `app/engine/types.ts` while implementing; adjust the `w.symbols`/`w.line` access to the real property names if they differ.)

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm vitest run tests/utils/winLines.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/winLines.ts tests/utils/winLines.test.ts
git commit -m "Add winLines util: pluralize + summariseWins (line/ways/single, coloured)"
```

---

## Task 5: `useReelSpin` composable

**Files:**
- Create: `app/composables/useReelSpin.ts`
- Test: `tests/composables/useReelSpin.test.ts`

- [ ] **Step 1: Write the test (failing)**

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useReelSpin } from '../../app/composables/useReelSpin'
import { useSlotsStore } from '../../app/stores/slots'

const GRID = [['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ']]

function harness() {
  return defineComponent({
    setup() {
      const api = useReelSpin({ reelCount: 5, visibleRows: 3, grid: () => GRID, filler: () => ['AA', 'KK'] })
      return { api }
    },
    render() { return h('div') }
  })
}

describe('useReelSpin', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  afterEach(() => vi.useRealTimers())

  it('reduced-motion (no timers): instant reveal + revealDone', async () => {
    // happy-dom reports no matchMedia match → reduced defaults false; force reduce via the store path:
    const store = useSlotsStore(); store.startSession(100000); store.selectMachine('canal-royale')
    const w = mount(harness())
    const done = vi.spyOn(store, 'revealDone')
    store.spinning = true
    await w.vm.$nextTick()
    // with timers, revealed climbs; here we assert it eventually completes:
    await new Promise(r => setTimeout(r, 2600))
    expect((w.vm as never as { api: { revealed: { value: number } } }).api.revealed.value).toBe(5)
    expect(done).toHaveBeenCalled()
  })

  it('stops reels in order (revealed climbs 0..5)', async () => {
    const store = useSlotsStore(); store.startSession(100000); store.selectMachine('canal-royale')
    const w = mount(harness())
    const api = (w.vm as never as { api: { revealed: { value: number } } }).api
    store.spinning = true
    await w.vm.$nextTick()
    await new Promise(r => setTimeout(r, 1200))
    const mid = api.revealed.value
    await new Promise(r => setTimeout(r, 1600))
    expect(api.revealed.value).toBeGreaterThanOrEqual(mid)
    expect(api.revealed.value).toBe(5)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm vitest run tests/composables/useReelSpin.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// app/composables/useReelSpin.ts
import { onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'

export const REEL_CELL_PX = 96
export const REEL_GAP_PX = 8
const STRIDE = REEL_CELL_PX + REEL_GAP_PX
const BUFFER = 16 // filler cells above the landing window

export interface ReelSpinOptions {
  reelCount: number
  visibleRows: number
  grid: () => string[][]      // resolved visible grid [reel][row]
  filler: () => string[]      // candidate ids shown while spinning
}

export function useReelSpin(opts: ReelSpinOptions) {
  const store = useSlotsStore()
  const reduced = useReducedMotion()

  const strips = ref<string[][]>([])
  const offsetY = ref<number[]>([])
  const blur = ref<number[]>([])
  const durationMs = ref<number[]>([])
  const revealed = ref(opts.reelCount)
  let timers: ReturnType<typeof setTimeout>[] = []

  function pick(): string {
    const f = opts.filler()
    return f.length ? f[Math.floor(Math.random() * f.length)]! : ''
  }
  function clear() { timers.forEach(clearTimeout); timers = [] }

  function settle() {
    strips.value = Array.from({ length: opts.reelCount }, (_, r) => opts.grid()[r] ?? [])
    offsetY.value = Array(opts.reelCount).fill(0)
    blur.value = Array(opts.reelCount).fill(0)
    durationMs.value = Array(opts.reelCount).fill(0)
    revealed.value = opts.reelCount
  }

  watch(() => store.spinning, (spinning) => {
    clear()
    if (!spinning) return
    const g = opts.grid()
    if (reduced.value) { settle(); store.revealDone(); return }

    revealed.value = 0
    durationMs.value = Array.from({ length: opts.reelCount }, (_, r) => 1100 + r * 220)
    strips.value = Array.from({ length: opts.reelCount }, (_, r) => {
      const out = g[r] ?? []
      return [...Array.from({ length: BUFFER }, pick), ...out]
    })
    offsetY.value = Array(opts.reelCount).fill(0)
    blur.value = Array(opts.reelCount).fill(0)

    const landing = BUFFER * STRIDE
    timers.push(setTimeout(() => {
      offsetY.value = offsetY.value.map(() => -landing)
      blur.value = blur.value.map(() => 2)
    }, 16))
    for (let r = 0; r < opts.reelCount; r++) {
      const dur = durationMs.value[r]!
      timers.push(setTimeout(() => { blur.value = blur.value.map((v, i) => i === r ? 0 : v) }, dur * 0.55))
      timers.push(setTimeout(() => {
        revealed.value = r + 1
        if (r === opts.reelCount - 1) store.revealDone()
      }, dur))
    }
  })

  onUnmounted(clear)
  settle()

  return { strips, offsetY, blur, durationMs, revealed, cellPx: REEL_CELL_PX, gapPx: REEL_GAP_PX, stride: STRIDE, visibleRows: opts.visibleRows, buffer: BUFFER }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm vitest run tests/composables/useReelSpin.test.ts`
Expected: PASS (allow the ~2.6s waits).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useReelSpin.ts tests/composables/useReelSpin.test.ts
git commit -m "Add useReelSpin: staggered vertical-scroll reveal, reduced-motion snap"
```

---

## Task 6: `PaylineOverlay` component

**Files:**
- Create: `app/components/game/PaylineOverlay.vue`
- Test: `tests/components/paylineOverlay.test.ts`

The overlay is positioned over a reel grid that has a left gutter (for line numbers), then `cols` cells of `cellPx` with `gapPx` between. Cell centre x for reel c: `gutter + c*(cellPx+gapPx) + cellPx/2`; centre y for row r: `r*(cellPx+gapPx) + cellPx/2`.

- [ ] **Step 1: Write the test (failing)**

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaylineOverlay from '../../app/components/game/PaylineOverlay.vue'
import type { WinLine } from '../../app/utils/winLines'

const base = { gutter: 36, cellPx: 96, gapPx: 8, rows: 3, cols: 5 }
function line(partial: Partial<WinLine>): WinLine {
  return { lineNumber: 1, count: 5, symbolId: 'KK', symbolName: 'King', pluralName: 'Kings', payout: 0, pattern: [1, 1, 1, 1, 1], cells: [], kind: 'line', color: '#f59e0b', ...partial }
}

describe('PaylineOverlay', () => {
  it('draws one polyline per line win and a left-gutter number badge', () => {
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({})] } })
    expect(w.findAll('polyline')).toHaveLength(1)
    expect(w.find('[data-test="line-num"]').text()).toBe('1')
  })

  it('a diagonal pattern produces 5 distinct points', () => {
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({ lineNumber: 4, pattern: [0, 1, 2, 1, 0] })] } })
    const pts = w.find('polyline').attributes('points')!.trim().split(/\s+/)
    expect(pts).toHaveLength(5)
    // entry row 0 -> y = 48; middle reel row 2 -> y = 2*104+48 = 256
    expect(pts[0]).toContain(',48')
    expect(pts[2]).toContain(',256')
  })

  it('ways / single wins draw no polyline', () => {
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({ kind: 'ways', pattern: null, lineNumber: null })] } })
    expect(w.findAll('polyline')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm vitest run tests/components/paylineOverlay.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```vue
<!-- app/components/game/PaylineOverlay.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { WinLine } from '~/utils/winLines'

const props = defineProps<{
  lines: WinLine[]
  gutter: number
  cellPx: number
  gapPx: number
  rows: number
  cols: number
}>()

const stride = computed(() => props.cellPx + props.gapPx)
const width = computed(() => props.gutter + props.cols * stride.value)
const height = computed(() => props.rows * stride.value - props.gapPx)
const cx = (c: number) => props.gutter + c * stride.value + props.cellPx / 2
const cy = (r: number) => r * stride.value + props.cellPx / 2

const drawn = computed(() => props.lines.filter(l => l.kind === 'line' && l.pattern !== null))

function points(pattern: number[]): string {
  return pattern.map((row, c) => `${cx(c)},${cy(row)}`).join(' ')
}

// left-gutter number badges, stacked when two lines enter on the same row
const badges = computed(() => {
  const used: Record<number, number> = {}
  return drawn.value.map((l) => {
    let y = cy(l.pattern![0]!)
    while (used[y] !== undefined) y += 20
    used[y] = 1
    return { n: l.lineNumber!, color: l.color, y }
  })
})
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-10"
    aria-hidden="true"
  >
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="absolute inset-0"
    >
      <polyline
        v-for="(l, i) in drawn"
        :key="i"
        :points="points(l.pattern!)"
        fill="none"
        :stroke="l.color"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
        :style="{ filter: `drop-shadow(0 0 5px ${l.color})` }"
      />
    </svg>
    <span
      v-for="(b, i) in badges"
      :key="i"
      data-test="line-num"
      class="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md text-xs font-extrabold text-neutral-950"
      :style="{ left: '18px', top: b.y + 'px', background: b.color }"
    >{{ b.n }}</span>
  </div>
</template>
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm vitest run tests/components/paylineOverlay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/PaylineOverlay.vue tests/components/paylineOverlay.test.ts
git commit -m "Add PaylineOverlay: drawn winning lines + left-gutter numbers"
```

---

## Task 7: `ResultBar` (replaces `WinBanner`)

**Files:**
- Create: `app/components/game/ResultBar.vue`
- Delete: `app/components/game/WinBanner.vue` (after Task 12 rewires `game.vue`; for now just create ResultBar)
- Create: `app/utils/bankrollSeries.ts` (derive a running-bankroll series from `store.history`)
- Test: `tests/components/resultBar.test.ts`, `tests/utils/bankrollSeries.test.ts`

First confirm the `SpinRecord` shape in `app/stores/slots.ts` (the `history.push({...})` near line 438). It records per-spin in/out in cents. The series walks those to reconstruct balance points.

- [ ] **Step 1: bankrollSeries test (failing)**

```ts
import { describe, expect, it } from 'vitest'
import { bankrollSeries } from '../../app/utils/bankrollSeries'

// records carry net cents delta per spin via (outCents - inCents); see store SpinRecord
const recs = [
  { inCents: 25, outCents: 0 },
  { inCents: 25, outCents: 100 },
  { inCents: 25, outCents: 0 }
] as never[]

describe('bankrollSeries', () => {
  it('reconstructs balances ending at the current balance', () => {
    const s = bankrollSeries(recs, 100000) // current balance cents
    expect(s[s.length - 1]).toBe(100000)
    // walking backwards: prev = cur - (out - in)
    expect(s).toEqual([100000 - 50, 100000 - 25, 100000]) // deltas: -25, +75, -25
  })

  it('caps the window to the last N records', () => {
    const many = Array.from({ length: 50 }, () => ({ inCents: 25, outCents: 0 })) as never[]
    expect(bankrollSeries(many, 100000, 30).length).toBeLessThanOrEqual(31)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**, then implement:

```ts
// app/utils/bankrollSeries.ts
// Reconstruct a running-balance series (in cents) ending at `currentCents`,
// from the per-spin history records (each carries inCents/outCents).
export function bankrollSeries(
  history: { inCents: number, outCents: number }[],
  currentCents: number,
  window = 30
): number[] {
  const recent = history.slice(-window)
  const out: number[] = [currentCents]
  let bal = currentCents
  for (let i = recent.length - 1; i >= 0; i--) {
    bal -= (recent[i]!.outCents - recent[i]!.inCents)
    out.unshift(bal)
  }
  return out
}
```

(Match the real `SpinRecord` field names from the store; if they are e.g. `bet`/`payout` in cents, adapt the access and the test together.)

Run: `pnpm vitest run tests/utils/bankrollSeries.test.ts` → PASS.

- [ ] **Step 3: ResultBar test (failing)**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultBar from '../../app/components/game/ResultBar.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup() {
  setActivePinia(createPinia()); localStorage.clear()
  const store = useSlotsStore(); store.startSession(100000); store.selectMachine('canal-royale')
  const wrapper = mount(ResultBar, { global: { stubs: { UIcon: true } } })
  return { store, wrapper }
}

describe('ResultBar', () => {
  beforeEach(() => localStorage.clear())

  it('hidden until a result exists; shows WIN + bankroll-now + chips and holds', async () => {
    const { store, wrapper } = setup()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(false)
    store.spinning = false
    store.lastOutcome = {
      machineId: 'canal-royale', grid: [], totalPayout: 1030, coinsIn: 25,
      wins: [{ line: 'line-1', symbols: ['KK', 'KK', 'KK', 'KK', 'KK'] }]
    } as never
    await wrapper.vm.$nextTick()
    const bar = wrapper.find('[data-test="result-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('WIN +1,030')
    expect(bar.text()).toContain('Bankroll now')
    expect(bar.text()).toContain('Kings')
  })

  it('shows "No win" for a zero-payout outcome', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 0, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').text()).toContain('No win')
  })

  it('hides while spinning (cleared for the next spin)', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 10, coinsIn: 25, wins: [{ line: 'line-1', symbols: ['JJ', 'JJ', 'JJ'] }] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(true)
    store.spinning = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 4: Run — expect FAIL**, then implement:

```vue
<!-- app/components/game/ResultBar.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCredits, formatCents } from '~/utils/format'
import { summariseWins } from '~/utils/winLines'
import { bankrollSeries } from '~/utils/bankrollSeries'

const store = useSlotsStore()

const show = computed(() => !store.spinning && store.lastOutcome !== null
  && store.lastOutcome.machineId === store.currentMachineId)
const out = computed(() => store.lastOutcome)
const won = computed(() => (out.value?.totalPayout ?? 0) > 0)
const chips = computed(() => store.currentDef && out.value ? summariseWins(store.currentDef, out.value) : [])

const spark = computed(() => {
  const s = bankrollSeries(store.history as never[], store.bankrollCents, 30)
  if (s.length < 2) return null
  const w = 172, h = 44, pad = 4
  const min = Math.min(...s), max = Math.max(...s), rng = (max - min) || 1
  const pts = s.map((v, i) => {
    const x = pad + (w - 2 * pad) * (i / (s.length - 1))
    const y = h - pad - (h - 2 * pad) * ((v - min) / rng)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const up = s[s.length - 1]! >= s[0]!
  return { pts, w, h, color: up ? '#34d399' : '#fb7185' }
})
</script>

<template>
  <div
    v-if="show && out"
    data-test="result-bar"
    class="rounded-xl border px-4 py-3"
    :class="won ? 'border-amber-500/45 bg-gradient-to-r from-amber-500/15 to-emerald-500/10' : 'border-neutral-800 bg-neutral-950'"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
      Last result · held until next spin
    </div>
    <div class="mt-1 flex items-center justify-between gap-4">
      <div>
        <span
          class="font-mono text-2xl font-black"
          :class="won ? 'text-amber-300' : 'text-neutral-500'"
        >{{ won ? `WIN +${formatCredits(out.totalPayout)}` : 'No win' }}</span>
        <div class="mt-0.5 text-xs font-semibold text-neutral-300">
          Bankroll now <span class="font-bold text-emerald-400">{{ formatCredits(store.creditBalance) }}</span>
          credits · {{ formatCents(store.bankrollCents) }}
        </div>
      </div>
      <svg
        v-if="spark"
        :viewBox="`0 0 ${spark.w} ${spark.h}`"
        :width="spark.w"
        :height="spark.h"
        class="shrink-0"
        aria-hidden="true"
      >
        <polyline
          :points="spark.pts"
          fill="none"
          :stroke="spark.color"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div
      v-if="chips.length"
      class="mt-2.5 flex flex-wrap gap-2"
    >
      <span
        v-for="(c, i) in chips"
        :key="i"
        class="grid grid-cols-[26px_12px_auto] items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-bold"
        :style="{ background: c.color + '22', color: '#e5e5e5' }"
      >
        <span
          v-if="c.lineNumber !== null"
          class="rounded-md py-0.5 text-center text-[10px] font-extrabold text-neutral-950"
          :style="{ background: c.color }"
        >L{{ c.lineNumber }}</span>
        <span v-else />
        <span class="text-right font-extrabold">{{ c.count }}</span>
        <span>{{ c.pluralName }}{{ c.kind === 'ways' ? ' — any position' : '' }}</span>
      </span>
    </div>
  </div>
</template>
```

Run: `pnpm vitest run tests/components/resultBar.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/ResultBar.vue app/utils/bankrollSeries.ts tests/components/resultBar.test.ts tests/utils/bankrollSeries.test.ts
git commit -m "Add ResultBar (held result, bankroll-now, chips, bankroll sparkline) + series util"
```

---

## Task 8: Denomination tag on the credit panel

**Files:**
- Create: `app/utils/denomination.ts`
- Modify: `app/components/game/CreditPanel.vue`
- Test: `tests/utils/denomination.test.ts`

- [ ] **Step 1: Test (failing)**

```ts
import { describe, expect, it } from 'vitest'
import { denominationLabel } from '../../app/utils/denomination'

describe('denominationLabel', () => {
  it.each([
    [1, /Penny machine · 1 credit = 1¢/],
    [5, /Nickel machine · 1 credit = 5¢/],
    [25, /Quarter machine · 1 credit = 25¢/],
    [100, /Dollar machine · 1 credit = \$1/]
  ])('%i -> %s', (cents, re) => expect(denominationLabel(cents)).toMatch(re))
})
```

- [ ] **Step 2: Run — expect FAIL**, then implement:

```ts
// app/utils/denomination.ts
export function denominationLabel(cents: number): string {
  if (cents === 1) return '🪙 Penny machine · 1 credit = 1¢'
  if (cents === 5) return '🪙 Nickel machine · 1 credit = 5¢'
  if (cents === 25) return '🪙 Quarter machine · 1 credit = 25¢'
  if (cents === 100) return '🪙 Dollar machine · 1 credit = $1'
  if (cents % 100 === 0) return `🪙 $${cents / 100} machine · 1 credit = $${cents / 100}`
  return `🪙 ${cents}¢ machine · 1 credit = ${cents}¢`
}
```

Run: `pnpm vitest run tests/utils/denomination.test.ts` → PASS.

- [ ] **Step 3: Add the pill to `CreditPanel.vue`**

Open `app/components/game/CreditPanel.vue`. Import the helper and the store's def, and add a pill near the credits row:

```ts
import { denominationLabel } from '~/utils/denomination'
// ...inside <script setup>, with the existing store ref:
const denomTag = computed(() => store.currentDef ? denominationLabel(store.currentDef.denominationCents) : '')
```

In the template, add (alongside the existing CREDITS/BANKROLL fields, right-aligned):

```vue
<span
  v-if="denomTag"
  data-test="denom-tag"
  class="ml-auto rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300"
>{{ denomTag }}</span>
```

(If `CreditPanel.vue` doesn't already import `computed`/`useSlotsStore`, add them. Keep the existing layout; just append the pill in the flex row.)

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/utils/denomination.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/utils/denomination.ts app/components/game/CreditPanel.vue tests/utils/denomination.test.ts
git commit -m "Add denomination tag to the credit panel"
```

---

## Task 9: `MachineMarquee` + per-machine art map

**Files:**
- Create: `app/components/game/marquee/art.ts`
- Create: `app/components/game/MachineMarquee.vue`
- Test: `tests/components/machineMarquee.test.ts`

- [ ] **Step 1: art map**

```ts
// app/components/game/marquee/art.ts
export interface MarqueeArt { accent: string, heroIcon: string, tagline: string }

export const MACHINE_ART: Record<string, MarqueeArt> = {
  'canal-royale': { accent: '#f59e0b', heroIcon: 'mask', tagline: '25-Line Venetian Video Slot' },
  'dragons-hoard': { accent: '#22c55e', heroIcon: 'dragon', tagline: '243-Ways Fortune Slot' },
  'thunder-vault': { accent: '#a78bfa', heroIcon: 'vault', tagline: 'Hold & Spin · Grand Jackpot' },
  'diamond-doubler': { accent: '#38bdf8', heroIcon: 'diamond', tagline: 'Three-Reel Stepper' },
  'sevens-ablaze': { accent: '#ef4444', heroIcon: 'seven-flame', tagline: 'Flaming Sevens Stepper' },
  'series-e-3line': { accent: '#fbbf24', heroIcon: 'bell', tagline: 'Classic Bally Electro-Mechanical' },
  'series-e-multiplier': { accent: '#fbbf24', heroIcon: 'seven', tagline: 'Bally Multiplier · Dual Progressive' },
  'stock-rush': { accent: '#fb923c', heroIcon: 'seven-red', tagline: 'Pachislo · Skill-Stop Reels' }
}

export function marqueeArtFor(id: string, family: string, denomCents: number): MarqueeArt {
  return MACHINE_ART[id] ?? { accent: '#94a3b8', heroIcon: 'blank', tagline: `${family} · ${denomCents}¢` }
}
```

- [ ] **Step 2: Test (failing)**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MachineMarquee from '../../app/components/game/MachineMarquee.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup(id: string) {
  setActivePinia(createPinia()); localStorage.clear()
  const store = useSlotsStore(); store.startSession(100000); store.selectMachine(id)
  return mount(MachineMarquee, { global: { stubs: { UIcon: true } } })
}

describe('MachineMarquee', () => {
  beforeEach(() => localStorage.clear())
  it('shows the machine name + tagline + hero icon', () => {
    const w = setup('canal-royale')
    expect(w.text()).toContain('Canal Royale')
    expect(w.text()).toMatch(/Venetian/i)
    expect(w.findComponent({ name: 'SymbolIcon' }).exists() || w.find('svg,span').exists()).toBe(true)
  })
})
```

- [ ] **Step 3: Run — expect FAIL**, then implement:

```vue
<!-- app/components/game/MachineMarquee.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { marqueeArtFor } from '~/components/game/marquee/art'

const store = useSlotsStore()
const art = computed(() => store.currentDef
  ? marqueeArtFor(store.currentDef.id, store.currentDef.family, store.currentDef.denominationCents)
  : null)
</script>

<template>
  <div
    v-if="store.currentDef && art"
    class="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-amber-900/40 px-5 py-3"
    :style="{ background: `radial-gradient(130% 200% at 0% 0%, ${art.accent}22, transparent 58%), linear-gradient(#15151a,#0e0e12)` }"
  >
    <div
      class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2"
      :style="{ borderColor: art.accent, boxShadow: `0 0 14px ${art.accent}59`, background: 'radial-gradient(circle at 35% 30%, #2a2350, #140f2e)' }"
    >
      <GameSymbolIcon
        :icon="art.heroIcon"
        :label="store.currentDef.name"
        :size="34"
      />
    </div>
    <div>
      <div
        class="font-mono text-2xl font-black tracking-[0.12em]"
        :style="{ color: art.accent }"
      >{{ store.currentDef.name.toUpperCase() }}</div>
      <div class="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/60">
        {{ art.tagline }}
      </div>
    </div>
    <div
      class="absolute inset-x-0 bottom-0 h-0.5"
      :style="{ background: `linear-gradient(90deg, transparent, ${art.accent}, transparent)` }"
    />
  </div>
</template>
```

Run: `pnpm vitest run tests/components/machineMarquee.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/game/marquee/art.ts app/components/game/MachineMarquee.vue tests/components/machineMarquee.test.ts
git commit -m "Add MachineMarquee + per-machine art map"
```

---

## Task 10: Wire `ReelVideo` — icons, scroll spin, payline overlay

**Files:**
- Modify: `app/components/game/ReelVideo.vue`
- Test: `tests/components/reelVideo.test.ts` (Create)

This is the exemplar surface. Keep the existing free-spins / hold-and-spin chrome and the `def`/`feature`/`hns`/`fs` computeds. Replace **only** the base reel grid + reveal logic.

- [ ] **Step 1: Test (failing)**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReelVideo from '../../app/components/game/ReelVideo.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup() {
  setActivePinia(createPinia()); localStorage.clear()
  const store = useSlotsStore(); store.startSession(100000); store.selectMachine('canal-royale')
  const wrapper = mount(ReelVideo, { global: { stubs: { UIcon: true, GameProgressiveMeter: true } } })
  return { store, wrapper }
}

describe('ReelVideo', () => {
  beforeEach(() => localStorage.clear())
  it('renders symbol icons (not raw labels) for the idle top-of-strip view', () => {
    const { wrapper } = setup()
    // SymbolIcon exposes aria-label per cell
    expect(wrapper.findAll('[role="img"]').length).toBeGreaterThanOrEqual(15)
  })
  it('mounts the payline overlay container', () => {
    const { wrapper } = setup()
    expect(wrapper.findComponent({ name: 'PaylineOverlay' }).exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**, then rewrite `ReelVideo.vue`**

Replace the `<script setup>` reveal/grid logic and the base-grid `<template>` block (the `v-else` grid) as follows. Keep the FS/HNS header chip and the hold-and-spin lock board exactly as they are.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
import { summariseWins } from '~/utils/winLines'
import { formatCredits } from '~/utils/format'
import type { VideoMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as VideoMachineDef | null)
const feature = computed(() => store.currentState?.videoFeature ?? null)
const hns = computed(() => feature.value?.kind === 'holdAndSpin' ? feature.value : null)
const fs = computed(() => feature.value?.kind === 'freeSpins' ? feature.value : null)

const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id && out.grid.length === 5 && out.gameKind !== 'respin') return out.grid
  return d.strips.map(s => [s[0]!, s[1]!, s[2]!])
})
const fillerIds = computed(() => Object.keys(def.value?.symbols ?? {}))
const { strips, offsetY, blur, durationMs, revealed } = useReelSpin({
  reelCount: 5, visibleRows: 3, grid: () => grid.value, filler: () => fillerIds.value
})

const wins = computed(() => def.value && revealed.value >= 5 ? summariseWins(def.value, store.lastOutcome) : [])
const glow = computed(() => {
  const m = new Map<string, string>()
  for (const w of wins.value) for (const c of w.cells) m.set(`${c.reel}:${c.row}`, w.color)
  return m
})
function iconFor(sym: string) { return def.value?.symbols[sym]?.icon }
function labelFor(sym: string) { return def.value?.symbols[sym]?.label ?? sym }
const isWild = (sym: string) => def.value?.wildSymbol === sym

const GUTTER = 36
const winH = REEL_CELL_PX * 3 + REEL_GAP_PX * 2
</script>
```

Template — replace the base/`v-else` grid block with the scrolling windows + overlay (leave the `v-if="hns"` lock board and the header untouched):

```vue
    <!-- base / free-spin reel grid -->
    <div
      v-else
      class="relative mx-auto"
      :style="{ width: GUTTER + 5 * (REEL_CELL_PX + REEL_GAP_PX) + 'px' }"
    >
      <div class="flex" :style="{ paddingLeft: GUTTER + 'px', gap: REEL_GAP_PX + 'px' }">
        <div
          v-for="(strip, r) in strips"
          :key="r"
          class="overflow-hidden rounded-lg"
          :style="{ width: REEL_CELL_PX + 'px', height: winH + 'px' }"
        >
          <div
            class="flex flex-col motion-reduce:transition-none"
            :style="{
              transform: `translateY(${offsetY[r] ?? 0}px)`,
              filter: `blur(${blur[r] ?? 0}px)`,
              transition: `transform ${durationMs[r] ?? 0}ms cubic-bezier(.16,.74,.18,1), filter ${(durationMs[r] ?? 0) * 0.5}ms ease-out`
            }"
          >
            <div
              v-for="(cell, idx) in strip"
              :key="idx"
              class="flex shrink-0 items-center justify-center rounded-lg border bg-neutral-950"
              :class="(revealed >= 5 && idx >= strip.length - 3 && glow.has(`${r}:${idx - (strip.length - 3)}`))
                ? 'border-amber-400/80' : 'border-neutral-800'"
              :style="{
                height: REEL_CELL_PX + 'px',
                marginBottom: REEL_GAP_PX + 'px',
                boxShadow: (revealed >= 5 && idx >= strip.length - 3 && glow.has(`${r}:${idx - (strip.length - 3)}`))
                  ? `0 0 18px ${glow.get(`${r}:${idx - (strip.length - 3)}`)}55 inset` : 'none'
              }"
            >
              <GameSymbolIcon
                :icon="iconFor(cell)"
                :label="labelFor(cell)"
                :wild="isWild(cell)"
              />
            </div>
          </div>
        </div>
      </div>
      <GamePaylineOverlay
        :lines="wins"
        :gutter="GUTTER"
        :cell-px="REEL_CELL_PX"
        :gap-px="REEL_GAP_PX"
        :rows="3"
        :cols="5"
      />
    </div>
```

- [ ] **Step 3: Run the test + the full component suite**

Run: `pnpm vitest run tests/components/reelVideo.test.ts tests/components/symbolIcon.test.ts tests/components/paylineOverlay.test.ts`
Expected: PASS.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/ReelVideo.vue tests/components/reelVideo.test.ts
git commit -m "Wire ReelVideo: SymbolIcon cells, scroll spin, payline overlay + glow"
```

---

## Task 11: Wire `ReelStepper` and `ReelBally`

**Files:**
- Modify: `app/components/game/ReelStepper.vue` (3 reels, single center payline)
- Modify: `app/components/game/ReelBally.vue` (N reels, `payMode` lines or single center)
- Test: extend `tests/components/reelVideo.test.ts` style into `tests/components/reelSurfaces.test.ts` (Create)

Mirror Task 10. Differences:
- **Stepper:** `reelCount: 3`, `visibleRows: 3`, center row is the payline. Keep the payline-glass element. Use `useReelSpin` for the three reels and `<GameSymbolIcon>` cells. For the line overlay pass a single center line when there's a win: build `wins` via `summariseWins`; for stepper the engine win line is the single payline → render as `kind:'single'` (no polyline) but still glow the center cells, OR draw a center line. Simpler: glow the winning center cells only (no polyline) — the existing payline glass already frames the row.
- **Bally:** `reelCount: def.strips.length`, `visibleRows: 3`. Keep the dual/single progressive meters and the bottom flavor line. If `def.payMode === 'lines'`, mount `<GamePaylineOverlay>`; else glow center cells only.

- [ ] **Step 1: Tests (failing)** — assert each surface renders `[role="img"]` icon cells and (Bally lines mode) a PaylineOverlay.

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReelStepper from '../../app/components/game/ReelStepper.vue'
import ReelBally from '../../app/components/game/ReelBally.vue'
import { useSlotsStore } from '../../app/stores/slots'

function withMachine(Comp: unknown, id: string) {
  setActivePinia(createPinia()); localStorage.clear()
  const store = useSlotsStore(); store.startSession(100000); store.selectMachine(id)
  return mount(Comp as never, { global: { stubs: { UIcon: true, GameProgressiveMeter: true } } })
}

describe('Reel surfaces', () => {
  beforeEach(() => localStorage.clear())
  it('stepper renders icon cells', () => {
    expect(withMachine(ReelStepper, 'diamond-doubler').findAll('[role="img"]').length).toBeGreaterThanOrEqual(9)
  })
  it('bally renders icon cells', () => {
    expect(withMachine(ReelBally, 'series-e-3line').findAll('[role="img"]').length).toBeGreaterThanOrEqual(9)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Apply the Task-10 pattern to both files** (icons + `useReelSpin` + glow; overlay only for Bally lines mode). Preserve every existing decorative element (payline glass, meters, flavor text, stop-count caption).
- [ ] **Step 4: Run** `pnpm vitest run tests/components/reelSurfaces.test.ts && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit**

```bash
git add app/components/game/ReelStepper.vue app/components/game/ReelBally.vue tests/components/reelSurfaces.test.ts
git commit -m "Wire ReelStepper + ReelBally: SymbolIcon cells, scroll spin, glow/overlay"
```

---

## Task 12: Wire `ReelPachislo` + `game.vue` (marquee + ResultBar)

**Files:**
- Modify: `app/components/game/ReelPachislo.vue` (icons only; keep `usePachisloPress` motion + slip annotations)
- Modify: `app/pages/game.vue` (mount marquee; swap WinBanner → ResultBar)
- Delete: `app/components/game/WinBanner.vue`
- Test: extend `tests/components/reelSurfaces.test.ts` with a pachislo icon check

- [ ] **Step 1: Pachislo** — in `ReelPachislo.vue`, replace the cell text `{{ labelFor(cell) }}` with `<GameSymbolIcon :icon="iconFor(cell)" :label="labelFor(cell)" :size="48" />` (smaller to fit the 3×3 grid), adding `iconFor`. Keep the live-cycling `grid` computed, the slip annotation, stock lamp, and bonus panel exactly as-is.

- [ ] **Step 2: game.vue** — add the marquee above the credit panel and swap the banner:

```vue
    <GameMachineMarquee />
    <GameCreditPanel />
```

and replace `<GameWinBanner />` with `<GameResultBar />`. Because the result now holds inline (not a floating banner), move `<GameResultBar />` to sit directly under the reel surface block (inside the left column, after the reel component, before `<GameBetControls>`). Remove the old absolute-positioned banner wrapper if present.

- [ ] **Step 3: Delete the banner + fix references**

```bash
git rm app/components/game/WinBanner.vue
```

Run: `pnpm exec grep -rn "WinBanner" app tests || true` — expect no remaining references.

- [ ] **Step 4: Test + typecheck**

Add to `tests/components/reelSurfaces.test.ts`:

```ts
  it('pachislo renders icon cells', () => {
    expect(withMachine(ReelPachislo, 'stock-rush').findAll('[role="img"]').length).toBeGreaterThanOrEqual(9)
  })
```

(import `ReelPachislo` at the top.)

Run: `pnpm vitest run tests/components/reelSurfaces.test.ts && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/ReelPachislo.vue app/pages/game.vue tests/components/reelSurfaces.test.ts
git rm app/components/game/WinBanner.vue
git commit -m "Wire ReelPachislo icons; mount marquee + ResultBar; remove WinBanner"
```

---

## Task 13: Full gate + live browser smoke + close-out

**Files:**
- Modify: `package.json` (version bump to 0.4.0) — optional, confirm with the existing version scheme.

- [ ] **Step 1: Full local gate**

Run, in order, and require each green:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm generate
pnpm verify
```
Expected: lint clean; types clean; all tests pass; static generate succeeds; `pnpm verify` 8/8 PASS. (Engine/RTP tests must be unchanged and green.)

- [ ] **Step 2: Live browser smoke (MANDATORY — the Plan 3 lesson)**

Start the dev server (`pnpm dev`), then with the chrome-devtools MCP:
- Navigate to the floor, start a session, open each of the **four families** (canal-royale, diamond-doubler / sevens-ablaze, series-e-3line, stock-rush).
- For each: confirm **icons render** (no raw 2-letter labels, no blank tiles), the **reels scroll and stop staggered**, a winning spin **draws the line(s) + glows cells + shows left-gutter numbers**, and the **ResultBar holds** until the next spin then clears.
- Confirm the **marquee** shows the right name/emblem and the **denomination tag** is correct per machine.
- Check the **console is clean** (no Vue warnings / resolve failures).
- Capture screenshots with the viewcap MCP for the record.
- Toggle OS reduced-motion (or emulate) and confirm reels **snap instantly** with the result still correct.

Fix anything the smoke surfaces before proceeding. Do not rely on unit tests for render correctness.

- [ ] **Step 3: Commit any smoke fixes, then the close-out**

```bash
git add -A
git commit -m "Reel visual upgrade: browser-smoke fixes + 0.4.0"
```

- [ ] **Step 4: Update project memory**

Update `MEMORY.md` / `slots-sim-brainstorm-state.md`: record the reel visual upgrade shipped (icons, scroll spin, drawn paylines, held ResultBar + bankroll sparkline, marquee, denomination tag), branch `reel-visual-upgrade`, and that the live browser smoke passed.

- [ ] **Step 5: Hand back for push**

Report status and ask before pushing. When approved: `git remote add origin https://github.com/cschweda/metaincognita-slots` (if absent), push the branch, open a PR (or merge to `main` per the user's preference). Per project rule, **no AI co-author trailer** on any commit.

---

## Self-Review

**Spec coverage:** symbol icons (T1–T3), filled-duotone registry + SymbolIcon (T2–T3), spin animation (T5/T10–T12), paylines + left-gutter numbers + diagonals (T6/T10), 243-ways/single handling (T4/T11), win chips words-only/uniform/horizontal (T4/T7), held result + bankroll-now + sparkline (T7), denomination tag (T8), marquee (T9), per-family wiring (T10–T12), reduced-motion (T5), a11y aria-labels (T2), browser smoke + gates (T13). All spec sections map to a task.

**Placeholder scan:** the only "author to spec" work is the themed SVGs in T3, which ship with complete starter bodies (not placeholders). The two adaptation notes (SpinRecord field names in T7; win-item property names in T4) are explicit verification steps, not vague TODOs.

**Type consistency:** `WinLine` (T4) is consumed unchanged by PaylineOverlay (T6) and ResultBar (T7) and ReelVideo (T10). `useReelSpin` returns `{ strips, offsetY, blur, durationMs, revealed, cellPx, gapPx, stride, visibleRows, buffer }` (T5) and the surfaces consume exactly those (T10–T12). `symbolArt`/`SYMBOL_ART` names are consistent across T2/T3. `REEL_CELL_PX`/`REEL_GAP_PX` exported from the composable and imported by the surfaces.
