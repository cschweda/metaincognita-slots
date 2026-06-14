# Per-Machine Cabinet Chrome — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap each machine's (unchanged) reel window in bespoke, gaudy, "weird-Vegas" decorative chrome — a per-machine cabinet surround — driven by a registry so future games get chrome too.

**Architecture:** A single `<GameMachineChrome>` wrapper sits around the reel surface in `game.vue`. It exposes per-machine palette CSS variables + an ambient backdrop on a padded "stage", and renders the active machine's chrome module (resolved via a registry, lazy-imported) as an absolutely-positioned, `aria-hidden`, `pointer-events:none` frame layer over a transparent center (so the reels show through and stay fully interactive). Each machine's chrome is a self-contained presentational SVG/CSS module; an unknown machine falls back to `DefaultChrome`. (Refinement of the spec: shared concerns live in the wrapper + CSS-var convention + one global reduced-motion guard, rather than a separate `ChromeFrame` scaffold component — leaner, same intent.)

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>` + TS, Tailwind v4, Vitest + @vue/test-utils + happy-dom. Chrome is hand-built CSS/SVG only (no external images → CSP-clean, light bundle).

**Spec:** `docs/superpowers/specs/2026-06-14-machine-chrome-design.md`

---

## Conventions (every task)

- **Per-task gates:** `pnpm lint` && `pnpm typecheck` && `pnpm test` (currently 359 tests passing; keep green; `pnpm lint` must show 0 errors — pre-existing warnings are fine).
- **Browser smoke** before any chrome-module task is "done": run the app, open the machine, confirm the chrome renders, is gaudy/distinct, the reels still spin & pay, console clean. **viewcap** screenshots.
- **Subtle motion:** ambient animation is gentle — `brightness` ≈ 1↔1.1, `translateY` ≤ 2–3px, soft opacity glow (≈ .6↔1), durations ≈ 3–6s `ease-in-out`. **No strobing or rapid blinking.** All animation is disabled under the global `prefers-reduced-motion` guard.
- **Decorative only:** chrome never changes reels/controls/engine; chrome roots are `aria-hidden` + `pointer-events:none`.
- Never touch blackjack. Push only when asked. Commit timestamps off-hours (today is Sunday — fine). No `Co-Authored-By` trailer. TDD where there's logic; chrome art is verified by browser smoke.

## File Structure

**Create**
- `app/components/game/chrome/theme.ts` — per-machine palette map + `chromeTheme(id)`.
- `app/components/game/chrome/registry.ts` — `chromeFor(id)` → lazy chrome component (or `DefaultChrome`).
- `app/components/game/chrome/DefaultChrome.vue` — generic accent-framed fallback.
- `app/components/game/chrome/RubyOfGargoyleChrome.vue` + eight more (one per machine).
- `app/components/game/MachineChrome.vue` — the wrapper (auto-imported as `<GameMachineChrome>`).
- `tests/components/machineChrome.test.ts`.

**Modify**
- `app/pages/game.vue` — wrap the four `<GameReelX>` in `<GameMachineChrome>`.
- `app/assets/css/main.css` — one global reduced-motion guard for chrome.
- `README.md`, `CHANGELOG.md`, `package.json` (version), branding (release task).

---

## Task 1: Foundation (theme, registry, fallback, wrapper, wiring)

**Files:** Create `app/components/game/chrome/theme.ts`, `registry.ts`, `DefaultChrome.vue`, `app/components/game/MachineChrome.vue`; modify `app/assets/css/main.css`, `app/pages/game.vue`; create `tests/components/machineChrome.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/machineChrome.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MachineChrome from '../../app/components/game/MachineChrome.vue'
import DefaultChrome from '../../app/components/game/chrome/DefaultChrome.vue'
import { chromeFor } from '../../app/components/game/chrome/registry'
import { chromeTheme } from '../../app/components/game/chrome/theme'
import { useSlotsStore } from '../../app/stores/slots'

describe('chromeTheme', () => {
  it('returns a per-machine palette and a fallback for unknown ids', () => {
    expect(chromeTheme('ruby-of-gargoyle').accent).toBe('#e11d48')
    const fb = chromeTheme('does-not-exist')
    expect(fb.accent).toBeTruthy()
    expect(fb.backdrop).toBeTruthy()
  })
})

describe('chromeFor', () => {
  it('falls back to DefaultChrome for an unknown machine', () => {
    expect(chromeFor('does-not-exist')).toBe(DefaultChrome)
  })
  it('returns a component (not the default) for a registered machine', () => {
    // ruby is registered in Task 2; until then this asserts the registry shape.
    expect(chromeFor('ruby-of-gargoyle')).toBeTruthy()
  })
})

describe('GameMachineChrome', () => {
  function setup(machineId: string) {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()
    store.startSession(1_000_000)
    store.selectMachine(machineId)
    return mount(MachineChrome, {
      slots: { default: '<div data-test="reels">REELS</div>' }
    })
  }
  it('renders the reel slot and a decorative, non-interactive chrome layer', () => {
    const w = setup('ruby-of-gargoyle')
    expect(w.find('[data-test="reels"]').exists()).toBe(true)        // game untouched
    const frame = w.find('.chrome-frame')
    expect(frame.exists()).toBe(true)
    expect(frame.attributes('aria-hidden')).toBe('true')
    expect(w.find('.chrome-stage').attributes('style')).toContain('--chrome-accent')
  })
})
```

- [ ] **Step 2: Run it — fails (modules missing).** `pnpm test machineChrome` → FAIL.

- [ ] **Step 3: Create `app/components/game/chrome/theme.ts`**

```ts
export interface ChromeTheme {
  accent: string
  secondary: string
  glow: string
  backdrop: string
}

const CHROME_THEME: Record<string, ChromeTheme> = {
  'ruby-of-gargoyle': { accent: '#e11d48', secondary: '#475569', glow: '#fb7185', backdrop: '#0c0810' },
  'canal-royale': { accent: '#f59e0b', secondary: '#0e7490', glow: '#fcd34d', backdrop: '#06181d' },
  'dragons-hoard': { accent: '#22c55e', secondary: '#f97316', glow: '#4ade80', backdrop: '#07120b' },
  'thunder-vault': { accent: '#a78bfa', secondary: '#38bdf8', glow: '#c4b5fd', backdrop: '#0b1020' },
  'diamond-doubler': { accent: '#38bdf8', secondary: '#e0f2fe', glow: '#7dd3fc', backdrop: '#0a1418' },
  'sevens-ablaze': { accent: '#ef4444', secondary: '#f59e0b', glow: '#fca5a5', backdrop: '#1a0a0a' },
  'series-e-3line': { accent: '#d4a017', secondary: '#f5e6c8', glow: '#e7c14a', backdrop: '#1a1208' },
  'series-e-multiplier': { accent: '#2dd4bf', secondary: '#94a3b8', glow: '#5eead4', backdrop: '#0a1a1a' },
  'stock-rush': { accent: '#fb923c', secondary: '#ec4899', glow: '#22d3ee', backdrop: '#0a0a12' }
}

const FALLBACK: ChromeTheme = { accent: '#94a3b8', secondary: '#64748b', glow: '#cbd5e1', backdrop: '#0a0a0a' }

export function chromeTheme(id: string): ChromeTheme {
  return CHROME_THEME[id] ?? FALLBACK
}
```

- [ ] **Step 4: Create `app/components/game/chrome/DefaultChrome.vue`**

```vue
<script setup lang="ts">
// Generic fallback chrome: a tasteful accent-framed surround using the wrapper's
// CSS vars. Decorative only (the wrapper sets aria-hidden + pointer-events:none).
</script>

<template>
  <div class="default-chrome">
    <div class="ring" />
  </div>
</template>

<style scoped>
.default-chrome { position: absolute; inset: 0; }
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow: 0 0 0 2px var(--chrome-accent) inset, 0 0 18px color-mix(in srgb, var(--chrome-accent) 40%, transparent) inset;
  animation: dc-breathe 5s ease-in-out infinite;
}
@keyframes dc-breathe { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.08); } }
</style>
```

- [ ] **Step 5: Create `app/components/game/chrome/registry.ts`**

```ts
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

// Internal: tasks register modules by mutating MODULES (kept in one place).
export function _registerChrome(id: string, loader: () => Promise<{ default: Component }>): void {
  MODULES[id] = loader
}
```

Note: subsequent tasks add a line to `MODULES` directly (not via `_registerChrome` at runtime) — see Task 2. `_registerChrome` exists only to make the registry's shape explicit and testable; the canonical registration is the literal `MODULES` entries.

Actually register statically — replace the empty `MODULES` with entries as each module lands. For Task 1 it stays `{}` (so every machine uses `DefaultChrome`, proving the system end-to-end). Remove `_registerChrome` if unused at lint time.

- [ ] **Step 6: Create `app/components/game/MachineChrome.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { chromeFor } from '~/components/game/chrome/registry'
import { chromeTheme } from '~/components/game/chrome/theme'

const store = useSlotsStore()
const machineId = computed(() => store.currentMachineId ?? '')
const chrome = computed(() => chromeFor(machineId.value))
const stageStyle = computed(() => {
  const t = chromeTheme(machineId.value)
  return {
    '--chrome-accent': t.accent,
    '--chrome-secondary': t.secondary,
    '--chrome-glow': t.glow,
    '--chrome-backdrop': t.backdrop,
    background: `radial-gradient(130% 100% at 50% 0%, ${t.accent}1a, ${t.backdrop})`
  }
})
</script>

<template>
  <div
    class="chrome-stage"
    :style="stageStyle"
  >
    <div class="chrome-inner">
      <slot />
    </div>
    <component
      :is="chrome"
      :key="machineId"
      class="chrome-frame"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.chrome-stage {
  position: relative;
  padding: clamp(12px, 4vw, 40px);
  border-radius: 1.25rem;
  overflow: hidden;
}
.chrome-inner {
  position: relative;
  z-index: 1;
}
/* The chrome module root receives this class + sits above the reels but is
   inert; its center is transparent so the reels show through. */
.chrome-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border-radius: inherit;
}
@media (max-width: 640px) {
  .chrome-stage { padding: clamp(8px, 3vw, 16px); }
}
</style>
```

- [ ] **Step 7: Add the global reduced-motion guard to `app/assets/css/main.css`** (append):

```css
/* Per-machine cabinet chrome is decorative; kill all of its ambient motion when
   the user prefers reduced motion. (.chrome-frame is set by GameMachineChrome.) */
@media (prefers-reduced-motion: reduce) {
  .chrome-frame, .chrome-frame * {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 8: Wire into `app/pages/game.vue`** — wrap the four reel components (the `<div class="space-y-3">` block). Replace the four `<GameReelX .../>` tags with:

```vue
        <GameMachineChrome>
          <GameReelVideo
            v-if="store.currentDef?.family === 'video'"
            :key="store.currentMachineId ?? ''"
          />
          <GameReelStepper
            v-else-if="store.currentDef?.family === 'stepper'"
            :key="store.currentMachineId ?? ''"
          />
          <GameReelBally
            v-else-if="store.currentDef?.family === 'bally-em'"
            :key="store.currentMachineId ?? ''"
          />
          <GameReelPachislo
            v-else-if="store.currentDef?.family === 'pachislo'"
            :key="store.currentMachineId ?? ''"
          />
        </GameMachineChrome>
```

Leave `<GameResultBar />` and `<GameBetControls>` exactly as they are, below the chrome.

- [ ] **Step 9: Run the test — passes.** `pnpm test machineChrome` → PASS. Then gates: `pnpm lint && pnpm typecheck && pnpm test`.

- [ ] **Step 10: Browser smoke.** `pnpm dev` → open each family (e.g. `/game?m=ruby-of-gargoyle`, `?m=diamond-doubler`, `?m=stock-rush`, `?m=series-e-3line` — needs a started session). Confirm every machine now shows the `DefaultChrome` accent frame around the reels, the reels still spin (space/Spin) and pay, and the console is clean. viewcap one screenshot.

- [ ] **Step 11: Commit.**

```bash
git add app/components/game/chrome/theme.ts app/components/game/chrome/registry.ts app/components/game/chrome/DefaultChrome.vue app/components/game/MachineChrome.vue app/assets/css/main.css app/pages/game.vue tests/components/machineChrome.test.ts
git commit -m "feat(chrome): per-machine cabinet chrome system + default frame"
```

---

## Task 2: Ruby of Gargoyle chrome (gothic) — the module pattern

**Files:** Create `app/components/game/chrome/RubyOfGargoyleChrome.vue`; modify `registry.ts`.

This is the **reference module**; later machines copy its structure (single root → receives `.chrome-frame` + `aria-hidden` from the wrapper; draws a frame ring + ornaments around a transparent center; styles via the `--chrome-*` vars; subtle keyframes).

- [ ] **Step 1: Create `RubyOfGargoyleChrome.vue`**

```vue
<script setup lang="ts">
// Gothic cathedral surround for Ruby of Gargoyle. Decorative only.
</script>

<template>
  <div class="ruby">
    <div class="ring" />
    <svg
      class="arches"
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
    >
      <path
        d="M28 44 Q28 8 48 8 Q68 8 68 44 M132 44 Q132 8 152 8 Q172 8 172 44"
        fill="none"
        :stroke="'var(--chrome-secondary)'"
        stroke-width="3"
        opacity="0.45"
      />
    </svg>
    <span class="gargoyle left">👹</span>
    <span class="gargoyle right">👹</span>
    <span class="eye">👁️</span>
    <span class="gem g1">❖</span>
    <span class="gem g2">❖</span>
    <span class="plate">◈ RUBY OF GARGOYLE ◈</span>
  </div>
</template>

<style scoped>
.ruby { position: absolute; inset: 0; }
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #1c1118 inset,
    0 0 0 7px #3a2630 inset,
    0 0 26px color-mix(in srgb, var(--chrome-accent) 55%, transparent) inset;
  animation: ruby-breathe 5s ease-in-out infinite;
}
.arches { position: absolute; top: 0; left: 0; right: 0; height: 44px; }
.gargoyle {
  position: absolute;
  top: 2px;
  font-size: 26px;
  filter: drop-shadow(0 2px 3px #000);
  animation: ruby-bob 5.5s ease-in-out infinite;
}
.gargoyle.left { left: 6px; }
.gargoyle.right { right: 6px; animation-delay: .4s; }
.eye {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  animation: ruby-eye 4s ease-in-out infinite;
}
.gem { position: absolute; color: var(--chrome-accent); font-size: 12px; opacity: .8; }
.gem.g1 { left: 4px; top: 48%; }
.gem.g2 { right: 4px; top: 48%; }
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-glow);
  font: 900 11px ui-monospace, monospace;
  letter-spacing: .18em;
  text-shadow: 0 0 8px var(--chrome-accent);
}
/* subtle */
@keyframes ruby-breathe { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.1); } }
@keyframes ruby-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes ruby-eye { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
</style>
```

- [ ] **Step 2: Register it** in `app/components/game/chrome/registry.ts` — set:

```ts
const MODULES: Record<string, () => Promise<{ default: Component }>> = {
  'ruby-of-gargoyle': () => import('./RubyOfGargoyleChrome.vue')
}
```

- [ ] **Step 3: Gates.** `pnpm lint && pnpm typecheck && pnpm test` (the existing `chromeFor('ruby-of-gargoyle')` test still passes; it now returns the async module).

- [ ] **Step 4: Browser smoke.** `pnpm dev` → `/game?m=ruby-of-gargoyle` (start a session first). Confirm: stone ring, cathedral arches, two gargoyles, the Eye, gem cabochons, crimson breathing glow; reels spin & pay through it; subtle motion; console clean. Toggle OS reduced-motion → animation stops. viewcap screenshot.

- [ ] **Step 5: Commit.**

```bash
git add app/components/game/chrome/RubyOfGargoyleChrome.vue app/components/game/chrome/registry.ts
git commit -m "feat(chrome): Ruby of Gargoyle gothic cabinet"
```

---

## Task 3: Stock Rush chrome (pachinko neon) — second exemplar

**Files:** Create `app/components/game/chrome/StockRushChrome.vue`; modify `registry.ts`.

Opposite end of the vibe range from Ruby (validates the system spans gothic→neon). Follow Task 2's structure. Motif: triple-neon tube frame, kanji "big win" signboard, a slow chasing row of bulbs, a torii ⛩️ and lucky cat 🐱 at the base.

- [ ] **Step 1: Create `StockRushChrome.vue`** — single root `.stock`; an inner `.tube` ring using layered `box-shadow` glows in `--chrome-accent` (orange), `--chrome-secondary` (magenta), `--chrome-glow` (cyan); a top `.sign` (`大当り · STOCK RUSH`) with soft text-shadow; a `.bulbs` row of 4 small dots animated with a **gentle** staggered fade (`opacity .5↔1`, not hard blink); `⛩️` and `🐱` spans at the bottom corners with a slow bob. Use the same subtle keyframe ranges as Task 2. Example for the bulbs (subtle):

```css
.bulb { width: 6px; height: 6px; border-radius: 50%; animation: sr-glow 2.4s ease-in-out infinite; }
.bulb:nth-child(2) { animation-delay: .6s; }
.bulb:nth-child(3) { animation-delay: 1.2s; }
.bulb:nth-child(4) { animation-delay: 1.8s; }
@keyframes sr-glow { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
```

- [ ] **Step 2: Register** `'stock-rush': () => import('./StockRushChrome.vue')` in `MODULES`.
- [ ] **Step 3: Gates.** `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 4: Browser smoke** `/game?m=stock-rush` — neon frame, kanji sign, gently pulsing bulbs (no strobe), torii + cat; 3 reels spin & stop normally; reduced-motion stops it; console clean. viewcap screenshot. **Aesthetic review checkpoint** (gothic + neon both look great → proceed to the rest).
- [ ] **Step 5: Commit** `feat(chrome): Stock Rush pachinko-neon cabinet`.

---

## Tasks 4–10: the remaining seven machines

Each task = one module following the Task 2 pattern (single root, frame ring + ornaments around a transparent center, `--chrome-*` vars, subtle keyframes), one `MODULES` registry line, gates, browser smoke at `/game?m=<id>`, and a commit `feat(chrome): <Machine> cabinet`. Use the machine's palette from `theme.ts`. Keep motion subtle and reduced-motion-safe (global guard already covers it). No external assets.

- [ ] **Task 4 — `CanalRoyaleChrome.vue` (`canal-royale`):** baroque carnival gold. Ornaments: gold scrollwork corners (SVG curls in `--chrome-glow`), masquerade masks `🎭` at the top corners (slow bob), fluted gold side rails (vertical gradient bars), a gentle gold-shimmer sweep across the ring (`@keyframes` moving a soft `linear-gradient` highlight, ~4s), title plate `★ CANAL ROYALE ★`. Venetian-teal (`--chrome-secondary`) showing through the stage backdrop.

- [ ] **Task 5 — `DragonsHoardChrome.vue` (`dragons-hoard`):** a dragon `🐲`/`🐉` perched at top-center (slow bob) "breathing" a softly flickering `🔥` (opacity ~.7↔1, gentle — not the harsh flicker from the mockup), a scaled emerald border (SVG scale arcs along the sides in `--chrome-accent`), a row of coins `🪙` along the bottom lip with a slow shimmer, title `DRAGON'S HOARD`.

- [ ] **Task 6 — `ThunderVaultChrome.vue` (`thunder-vault`):** riveted brushed-steel frame (CSS gradient ring + small rivet dots at intervals), a couple of violet/electric-blue lightning bolts (SVG zig-zag paths in `--chrome-accent`/`--chrome-secondary`) across the top with a slow glow pulse, a vault-dial motif (concentric circles) in a top corner, neon Grand-style glow. Title `THUNDER VAULT`.

- [ ] **Task 7 — `DiamondDoublerChrome.vue` (`diamond-doubler`):** cool ice-and-chrome. Frosted facet shapes (SVG polygons in `--chrome-glow` at low opacity) at the corners, silver rails, a slow prismatic gleam sweep, restrained sparkle dots. The cleanest/coldest of the set. Title `DIAMOND DOUBLER`.

- [ ] **Task 8 — `SevensAblazeChrome.vue` (`sevens-ablaze`):** flames licking up from the bottom edge (layered SVG/CSS flame shapes in `--chrome-accent`/`--chrome-secondary` with a gentle height/opacity flicker), ember dots drifting up slowly, charred dark frame, hot red/orange glow. Title `SEVENS ABLAZE`.

- [ ] **Task 9 — `SeriesE3LineChrome.vue` (`series-e-3line`):** 1960s Bally warm brass + cream bakelite. Brass gradient ring, a small bell finial `🔔` centered on top, cream corner inlays, walnut tone via the stage backdrop, a soft tungsten glow. The **least animated** (period-correct, calm). Title `SERIES E`.

- [ ] **Task 10 — `SeriesEMultiplierChrome.vue` (`series-e-multiplier`):** the same Bally era but **cool turquoise** (`--chrome-accent` = `#2dd4bf`) + chrome, with red (`#ef4444`) multiplier numerals `×2 ×3` as a side ornament — deliberately distinct from Series E 3-Line so the two Ballys no longer look identical. Title `SERIES E · MULTIPLIER`.

After Task 10, every machine has a bespoke module; `DefaultChrome` remains only for future/unknown machines.

---

## Task 11: Polish — responsive, reduced-motion, a11y, production CSP

- [ ] **Step 1: Responsive pass.** In the browser at a narrow (≈375px) width, visit 3–4 machines: confirm the chrome scales, ornaments don't overlap/cover the reels, and the playable area is intact. If anything crowds the reels, tighten that module's ornament sizes/positions with `clamp()` or hide non-essential ornaments under `@media (max-width: 640px)`. Re-smoke.
- [ ] **Step 2: Reduced-motion.** With OS "reduce motion" on, visit 3–4 machines and confirm all chrome animation is static (the global guard in `main.css`). 
- [ ] **Step 3: a11y audit.** Build + serve, run lightcap `run_a11y` on `/game` for ≥2 machines (a started session + `?m=`), confirm **100/100** and that the chrome adds no violations (it's `aria-hidden`).
- [ ] **Step 4: Production CSP smoke.** `pnpm generate`, serve `dist/` with the `_headers` CSP applied, open 2–3 machines, run a spin: confirm **no CSP violations** in the console (chrome is inline SVG/CSS, so none expected) and the worker/app still behave.
- [ ] **Step 5: Gates** `pnpm lint && pnpm typecheck && pnpm test`; commit any responsive/a11y fixes (`a11y: ...` / `fix(chrome): ...`).

---

## Task 12: Docs & release

- [ ] **Step 1:** Bump `package.json` to `0.7.0`.
- [ ] **Step 2:** `CHANGELOG.md` — `0.7.0` entry: per-machine cabinet chrome (nine bespoke gaudy frames + registry/fallback for future games; reels/controls/engine untouched; CSS/SVG only, reduced-motion-safe, a11y-preserving). Match existing changelog format; date 2026-06-14.
- [ ] **Step 3:** `README.md` — add per-machine chrome to the feature list / "what's inside"; reread end-to-end for order/consistency.
- [ ] **Step 4:** Branding: refresh og-image tagline / social meta if it enumerates features (optional; only if it would otherwise be stale).
- [ ] **Step 5:** Gates `pnpm lint && pnpm typecheck && pnpm test`; final full browser smoke of all nine machines (viewcap screenshots); commit `docs: v0.7.0 — per-machine cabinet chrome`.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** chrome-only wrapper not touching reels/controls (Task 1 + game.vue wrap) ✓; nine bespoke frames (Tasks 2–10) ✓; registry + `DefaultChrome` fallback for future games (Task 1, 2-step registration) ✓; CSS/SVG-only, no external assets (all modules) ✓; subtle ambient motion gated by reduced-motion (per-module subtle keyframes + global guard in main.css, Task 1 step 7) ✓; `aria-hidden` + `pointer-events:none` decorative layer (MachineChrome) ✓; responsive degradation + a11y 100/100 + CSP-clean (Task 11) ✓; two-Bally distinction via turquoise palette (theme.ts + Task 10) ✓; exemplar-first rollout (Tasks 2–3 then 4–10) ✓; docs/version (Task 12) ✓.
- **Type consistency:** `ChromeTheme`/`chromeTheme(id)` (theme.ts) consumed by MachineChrome; `chromeFor(id): Component` (registry.ts) consumed by MachineChrome + tests; `MODULES` registry literal extended by each module task; `.chrome-frame`/`.chrome-stage`/`.chrome-inner` class names + `--chrome-accent/secondary/glow/backdrop` vars consistent across wrapper, modules, and the main.css guard.
- **Placeholder scan:** foundation + Ruby are full code; Stock Rush + Tasks 4–10 are per-machine art specs (exact palette, motif, ornament list, technique, registry line, smoke) verified by browser smoke — the deliberate approach for bespoke visual art, not placeholders.
- **Note:** Task 1 Step 5 leaves a stray `_registerChrome`; the implementer should omit it (use the literal `MODULES` entries) unless a test references it — flagged inline.
