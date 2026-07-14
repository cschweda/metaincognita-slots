# Theater Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen, gaudy "theater mode" for a single slots cabinet on `/game` — the machine and its big icons fill the screen; hold `` ` `` to peek the truth layer (pays + X-ray), tap to pin; a wake-on-interaction ghost bar keeps the hub exit reachable.

**Architecture:** The whole cabinet column scales as one block via a CSS `transform: scale(k)` inside a real-Fullscreen-API container (`TheaterStage`). A module-singleton composable (`useTheater`) owns all state (active, peek) so the toolbar button, the stage, the ghost bar, and the peek drawer share one instance — the same module-ref pattern the app already uses for audio mute. Everything that must be visible in fullscreen (ghost bar, peek drawer, side towers) lives *inside* the stage element, because the browser renders only the fullscreen subtree.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Pinia, Tailwind 4, Vitest + `@vue/test-utils` (happy-dom), the Fullscreen API.

## Global Constraints

- **Display only.** No change to any engine, RTP, paytable, outcome, or the `spinOnce`-books-the-outcome / anti-spoiler result-hold invariant. Copied verbatim from the spec.
- **Slots only.** The other eight suite games are untouched.
- **Theater applies to the `/game` cabinet**, not the floor, Sim Lab, or Learn.
- **Physical-key checks, not character checks:** use `KeyboardEvent.code` (`'Backquote'`, `'Escape'`, `'Space'`), matching `game.vue`'s existing `e.code === 'Space'` — a character check would break on non-US keyboards.
- **Reduced motion:** every animated flourish disarms under `prefers-reduced-motion`, following the existing `reducedMotion()` helper in `app/utils/audio.ts` and the `@media (prefers-reduced-motion: reduce)` block in `app/assets/css/main.css`. Reduced motion keeps the ghost bar **visible** (no auto-hide) and shows the peek layer instantly.
- **WCAG 2.5.3 (Label in Name):** any control with visible text must have an accessible name containing that text verbatim. The hub exit inside the ghost bar keeps `aria-label="METAINCOGNITA — exit the simulator, back to all the games"`.
- **No AI-attribution trailer** on any commit (repo-wide rule). End commit messages with the descriptive content only.
- **Commit after each task.** Local only — do not push (a commit-timestamp rewrite happens before any push, separately).

## Decisions locked from the spec's open questions

1. **Natural-size measurement:** `useTheaterScale` measures the scale host's `offsetWidth/offsetHeight` (unaffected by `transform`, so it always reports the natural layout size) against `window.innerWidth/innerHeight` (which equal the screen in fullscreen).
2. **`useFitScale` is NOT changed.** Theater uses a separate block scaler. Inside the block at natural layout, each reel's existing per-reel `useFitScale` sees its host at full base width, so it stays `1` — the two never fight.
3. **Side towers** are one shared component (`TheaterSideTowers`), rendered only for the narrow (`stepper`, `bally-em`) families.

## File map

| File | Responsibility |
|---|---|
| `app/composables/useTheater.ts` (new) | Singleton state: `active`, `peek`; `enter/exit`, fullscreen API, target registration, tap-vs-hold peek machine, body class. |
| `app/composables/useTheaterScale.ts` (new) | Pure `fitScale()` + a thin composable that measures host vs viewport and yields a capped scale. |
| `app/components/game/XrayContent.vue` (new) | The X-ray body, extracted from `XrayPanel.vue` so both the side panel and the peek drawer render it. |
| `app/components/game/XrayPanel.vue` (modify) | Becomes a thin gated card wrapping `<GameXrayContent/>`. |
| `app/components/game/TheaterSideTowers.vue` (new) | Decorative gold bulb-towers filling the dead width of narrow cabinets. |
| `app/components/game/TheaterStage.vue` (new) | Fullscreen target + scale host; hosts ghost bar, peek drawer, side towers inside itself; wraps the cabinet block via a slot. |
| `app/components/game/TheaterPeekLayer.vue` (new) | Translucent over-glass drawer: per-line pays + `<GameXrayContent/>`. |
| `app/components/game/TheaterGhostBar.vue` (new) | Wake-on-interaction bar: `<AppHubLink/>` + an ✕ Exit-theater button. |
| `app/components/game/CabinetToolbar.vue` (modify) | Add the enter-theater button. |
| `app/pages/game.vue` (modify) | Wrap both cabinet structures in `TheaterStage`; route `Backquote`/`Escape` to `useTheater`. |
| `app/assets/css/main.css` (modify) | `.theater-active` nav hiding, `:fullscreen` stage rules, reduced-motion disarm. |

---

### Task 1: `useTheater` composable — state, fullscreen, peek machine

**Files:**
- Create: `app/composables/useTheater.ts`
- Test: `tests/composables/useTheater.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type PeekMode = 'off' | 'held' | 'pinned'
  function useTheater(): {
    active: Ref<boolean>          // read-only in practice
    peek: Ref<PeekMode>
    peeking: ComputedRef<boolean> // peek !== 'off'
    setTarget: (el: HTMLElement | null) => void
    enter: () => void
    exit: () => void
    toggle: () => void
    peekPress: () => void         // keydown / pointerdown on the glass
    peekRelease: () => void       // keyup / pointerup
  }
  const TAP_MS = 250
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/composables/useTheater.test.ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheater } from '../../app/composables/useTheater'

describe('useTheater', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const t = useTheater()
    t.exit() // reset the singleton between tests
    t.peek.value = 'off'
  })
  afterEach(() => vi.useRealTimers())

  it('enter requests fullscreen on the registered target and flags active', () => {
    const t = useTheater()
    const el = document.createElement('div')
    const req = vi.fn().mockResolvedValue(undefined)
    // jsdom/happy-dom don't implement fullscreen — stub it
    ;(el as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = req
    t.setTarget(el)
    t.enter()
    expect(t.active.value).toBe(true)
    expect(req).toHaveBeenCalledOnce()
    expect(document.body.classList.contains('theater-active')).toBe(true)
  })

  it('exit clears active, peek, and the body class', () => {
    const t = useTheater()
    t.setTarget(document.createElement('div'))
    t.enter()
    t.peek.value = 'pinned'
    t.exit()
    expect(t.active.value).toBe(false)
    expect(t.peek.value).toBe('off')
    expect(document.body.classList.contains('theater-active')).toBe(false)
  })

  it('a quick press-release is a TAP → pins the peek layer', () => {
    const t = useTheater()
    t.peekPress()
    expect(t.peek.value).toBe('held')       // shows immediately
    vi.advanceTimersByTime(100)             // under TAP_MS
    t.peekRelease()
    expect(t.peek.value).toBe('pinned')
  })

  it('a long press-release is a HOLD → gone on release', () => {
    const t = useTheater()
    t.peekPress()
    vi.advanceTimersByTime(400)             // over TAP_MS
    t.peekRelease()
    expect(t.peek.value).toBe('off')
  })

  it('pressing while pinned closes it (tap to dismiss)', () => {
    const t = useTheater()
    t.peek.value = 'pinned'
    t.peekPress()
    expect(t.peek.value).toBe('off')
    t.peekRelease() // no-op, must not reopen
    expect(t.peek.value).toBe('off')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/composables/useTheater.test.ts`
Expected: FAIL — `Cannot find module '../../app/composables/useTheater'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/composables/useTheater.ts
import { computed, ref } from 'vue'

export type PeekMode = 'off' | 'held' | 'pinned'
export const TAP_MS = 250

// Module-singleton state (same pattern as utils/audio.ts mute): every caller
// shares one instance so the toolbar, stage, ghost bar and peek drawer agree.
const active = ref(false)
const peek = ref<PeekMode>('off')
let target: HTMLElement | null = null
let pressStart = 0
let pressArmed = false

function onFullscreenChange(): void {
  // Browser's own Esc / fullscreen-exit affordance fired — mirror it.
  if (active.value && document.fullscreenElement === null) exit()
}

function enter(): void {
  if (active.value) return
  active.value = true
  document.body.classList.add('theater-active')
  document.addEventListener('fullscreenchange', onFullscreenChange)
  // CSS theater mode works even if the API is unavailable/denied.
  target?.requestFullscreen?.().catch(() => {})
}

function exit(): void {
  if (!active.value) return
  active.value = false
  peek.value = 'off'
  document.body.classList.remove('theater-active')
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (document.fullscreenElement !== null) document.exitFullscreen?.().catch(() => {})
}

function peekPress(): void {
  if (peek.value === 'pinned') { peek.value = 'off'; pressArmed = false; return }
  peek.value = 'held'
  pressStart = Date.now()
  pressArmed = true
}

function peekRelease(): void {
  if (!pressArmed) return
  pressArmed = false
  if (peek.value !== 'held') return
  peek.value = Date.now() - pressStart < TAP_MS ? 'pinned' : 'off'
}

export function useTheater() {
  return {
    active,
    peek,
    peeking: computed(() => peek.value !== 'off'),
    setTarget: (el: HTMLElement | null) => { target = el },
    enter,
    exit,
    toggle: () => (active.value ? exit() : enter()),
    peekPress,
    peekRelease
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/composables/useTheater.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm vitest run tests/composables/useTheater.test.ts
git add app/composables/useTheater.ts tests/composables/useTheater.test.ts
git commit -m "feat(theater): useTheater — state, fullscreen, hold/tap peek machine"
```

---

### Task 2: `useTheaterScale` composable — fit the cabinet block to the screen

**Files:**
- Create: `app/composables/useTheaterScale.ts`
- Test: `tests/composables/useTheaterScale.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  ```ts
  function fitScale(natW: number, natH: number, availW: number, availH: number, cap: number): number
  function useTheaterScale(active: Ref<boolean>, cap?: number): { host: Ref<HTMLElement | null>, scale: Ref<number> }
  // default cap = 2.4
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/composables/useTheaterScale.test.ts
import { describe, expect, it } from 'vitest'
import { fitScale } from '../../app/composables/useTheaterScale'

describe('fitScale', () => {
  it('a wide (5-reel) block binds on width and fills', () => {
    // natural 1000x560 into a 1920x1080 screen: width ratio 1.92, height 1.93, cap 2.4
    expect(fitScale(1000, 560, 1920, 1080, 2.4)).toBeCloseTo(1.92, 2)
  })
  it('a narrow (3-reel) block binds on height', () => {
    // natural 560x620 into 1920x1080: width 3.43, height 1.74 -> height wins
    expect(fitScale(560, 620, 1920, 1080, 2.4)).toBeCloseTo(1.742, 2)
  })
  it('never exceeds the cap (no ballooning on a 4K display)', () => {
    expect(fitScale(300, 300, 3840, 2160, 2.4)).toBe(2.4)
  })
  it('degenerate sizes read as 1 (pre-layout / hidden)', () => {
    expect(fitScale(0, 0, 1920, 1080, 2.4)).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/composables/useTheaterScale.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/composables/useTheaterScale.ts
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** Largest scale that fits a natural natW×natH block into availW×availH, capped. */
export function fitScale(natW: number, natH: number, availW: number, availH: number, cap: number): number {
  if (natW <= 0 || natH <= 0) return 1
  return Math.min(cap, availW / natW, availH / natH)
}

/**
 * Scale the theater cabinet block to fill the screen. `host.offsetWidth/Height`
 * is the NATURAL layout size — CSS transforms don't affect it — so we can measure
 * once and scale visually without feedback. Available size is the viewport, which
 * equals the screen while the stage is in real fullscreen.
 */
export function useTheaterScale(active: Ref<boolean>, cap = 2.4) {
  const host = ref<HTMLElement | null>(null)
  const scale = ref(1)
  let ro: ResizeObserver | null = null

  const measure = (): void => {
    if (!active.value || host.value === null) { scale.value = 1; return }
    scale.value = fitScale(
      host.value.offsetWidth, host.value.offsetHeight,
      window.innerWidth, window.innerHeight, cap
    )
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && host.value !== null) {
      ro = new ResizeObserver(measure)
      ro.observe(host.value)
    }
    window.addEventListener('resize', measure)
  })
  onBeforeUnmount(() => {
    ro?.disconnect(); ro = null
    window.removeEventListener('resize', measure)
  })
  watch(active, measure)

  return { host, scale }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/composables/useTheaterScale.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useTheaterScale.ts tests/composables/useTheaterScale.test.ts
git commit -m "feat(theater): useTheaterScale — fit the cabinet block to the screen, capped"
```

---

### Task 3: Extract `XrayContent` so the peek drawer can reuse the X-ray

**Files:**
- Create: `app/components/game/XrayContent.vue`
- Modify: `app/components/game/XrayPanel.vue`
- Test: `tests/components/xrayContent.test.ts` (new), and the existing X-ray tests must stay green.

**Interfaces:**
- Produces: `<GameXrayContent />` — the X-ray body (header + callouts + sparkline + presses/virtual/draws/internals + wheel-truth + parked panel), with NO outer card chrome and NO `store.settings.xray` gate. Auto-imported as `GameXrayContent`.

**Why:** `XrayPanel.vue` gates its whole body on `store.settings.xray && def` and wraps it in side-panel card styling. The peek drawer needs the same body without that gate and with different container styling. Extracting the body keeps one source of truth (DRY) — otherwise the two would drift.

- [ ] **Step 1: Create `XrayContent.vue`** — move the entire `<script setup>` computeds (lines 1–121 of `XrayPanel.vue`) and the inner markup (everything currently inside the gated `<div>` — the header block through `<LazyGameXrayParkedPanel/>`, i.e. current lines 129–389) into a new component whose root is a `<div class="space-y-4 text-xs" data-test="xray-content">`. Keep every existing `data-test` (`rtp-dot`, `wheel-truth-panel`) and every class exactly as-is.

- [ ] **Step 2: Slim `XrayPanel.vue` to a gated wrapper**

```vue
<!-- app/components/game/XrayPanel.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'

const store = useSlotsStore()
const def = computed(() => store.currentDef)
</script>

<template>
  <div
    v-if="store.settings.xray && def"
    class="rounded-xl bg-neutral-900 border border-amber-500/25 p-4"
    data-test="xray"
  >
    <GameXrayContent />
  </div>
</template>
```

- [ ] **Step 3: Write the reuse test**

```ts
// tests/components/xrayContent.test.ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import XrayContent from '../../app/components/game/XrayContent.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = { UIcon: true, LazyGameXrayParkedPanel: true }

describe('XrayContent', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('renders the X-ray body with no settings.xray gate (usable in the peek drawer)', () => {
    const store = useSlotsStore()
    store.selectMachine('canal-royale')
    store.settings.xray = false // gate is OFF, content must still render
    const w = mount(XrayContent, { global: { stubs } })
    expect(w.find('[data-test="xray-content"]').exists()).toBe(true)
    expect(w.text()).toMatch(/X-ray/i)
  })
})
```

- [ ] **Step 4: Run the new test AND the existing X-ray suite**

Run: `pnpm vitest run tests/components/xrayContent.test.ts tests/components/sessionSidebar.test.ts`
Then the whole component band to catch any XrayPanel consumer that stubbed the old body:
Run: `pnpm vitest run tests/components`
Expected: PASS. If any existing test stubbed `GameXrayContent` implicitly and now finds an empty panel, add `GameXrayContent` to that test's non-stub list (mount the real child).

- [ ] **Step 5: Commit**

```bash
git add app/components/game/XrayContent.vue app/components/game/XrayPanel.vue tests/components/xrayContent.test.ts
git commit -m "refactor(xray): extract XrayContent so the theater peek drawer can reuse it"
```

---

### Task 4: `TheaterSideTowers` — gaudy gold fill for narrow cabinets

**Files:**
- Create: `app/components/game/TheaterSideTowers.vue`
- Test: `tests/components/theaterSideTowers.test.ts`

**Interfaces:**
- Produces: `<GameTheaterSideTowers />` — two decorative, `aria-hidden` gold towers (left + right) of lit bulbs. Purely visual.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/theaterSideTowers.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TheaterSideTowers from '../../app/components/game/TheaterSideTowers.vue'

describe('TheaterSideTowers', () => {
  it('renders two aria-hidden towers (decorative only)', () => {
    const w = mount(TheaterSideTowers)
    const towers = w.findAll('[data-test="side-tower"]')
    expect(towers).toHaveLength(2)
    expect(w.find('[aria-hidden="true"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/theaterSideTowers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component.** Decorative bulb-towers; the visual polish (bulb count, glow, chase timing) is tuned in the browser-smoke task — this establishes the structure and the reduced-motion contract.

```vue
<!-- app/components/game/TheaterSideTowers.vue -->
<!-- Fills the dead width beside a 3-reel cabinet in theater so it reads as a
     lavish Vegas machine, not three lonely symbols. Purely decorative. -->
<template>
  <div
    class="theater-towers"
    aria-hidden="true"
  >
    <div
      v-for="side in ['left', 'right']"
      :key="side"
      class="theater-tower"
      :class="`theater-tower--${side}`"
      data-test="side-tower"
    >
      <span
        v-for="n in 9"
        :key="n"
        class="theater-bulb"
      />
    </div>
  </div>
</template>

<style scoped>
.theater-towers { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.theater-tower {
  position: absolute; top: 0; bottom: 0; width: clamp(40px, 10vw, 140px);
  display: flex; flex-direction: column; align-items: center; justify-content: space-evenly;
  background: linear-gradient(180deg, #3a2708, #16100333);
  box-shadow: inset 0 0 40px rgba(212, 168, 71, 0.35);
}
.theater-tower--left { left: 0; }
.theater-tower--right { right: 0; }
.theater-bulb {
  width: clamp(8px, 1.4vw, 18px); aspect-ratio: 1; border-radius: 999px;
  background: radial-gradient(circle at 35% 30%, #fff2c4, #f6c453 55%, #b57d1e);
  box-shadow: 0 0 12px 3px rgba(255, 200, 90, 0.75);
  animation: theater-bulb-pulse 1.1s ease-in-out infinite;
}
.theater-tower--right .theater-bulb { animation-delay: 0.55s; }
@keyframes theater-bulb-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .theater-bulb { animation: none; opacity: 0.9; }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/theaterSideTowers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/game/TheaterSideTowers.vue tests/components/theaterSideTowers.test.ts
git commit -m "feat(theater): TheaterSideTowers — gaudy gold fill for narrow cabinets"
```

---

### Task 5: `TheaterPeekLayer` — the translucent truth drawer

**Files:**
- Create: `app/components/game/TheaterPeekLayer.vue`
- Test: `tests/components/theaterPeekLayer.test.ts`

**Interfaces:**
- Consumes: `useTheater().peeking` (Task 1), `<GameXrayContent/>` (Task 3), `useSlotsStore()`.
- Produces: `<GameTheaterPeekLayer />` — self-gates on `peeking`; a translucent over-glass drawer showing the current spin's per-line pays and the X-ray content. (Winning paylines already draw on the glass via the reel component, so they are NOT redrawn here.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/theaterPeekLayer.test.ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheaterPeekLayer from '../../app/components/game/TheaterPeekLayer.vue'
import { useTheater } from '../../app/composables/useTheater'

const stubs = { GameXrayContent: true }

describe('TheaterPeekLayer', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); useTheater().exit() })

  it('renders nothing while peek is off', () => {
    const w = mount(TheaterPeekLayer, { global: { stubs } })
    expect(w.find('[data-test="peek-layer"]').exists()).toBe(false)
  })

  it('renders the X-ray content when peeking', async () => {
    const t = useTheater()
    t.peek.value = 'pinned'
    const w = mount(TheaterPeekLayer, { global: { stubs } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="peek-layer"]').exists()).toBe(true)
    expect(w.findComponent({ name: 'GameXrayContent' }).exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/theaterPeekLayer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```vue
<!-- app/components/game/TheaterPeekLayer.vue -->
<!-- The truth layer. Hold ` (or press-and-hold the glass) and this washes over
     the cabinet: the guts the casino never shows. Winning paylines already draw
     on the reel face, so this adds the pays + the X-ray, not the lines. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useTheater } from '~/composables/useTheater'
import { summariseWins } from '~/utils/winLines'
import { formatCredits } from '~/utils/format'

const store = useSlotsStore()
const { peeking } = useTheater()

// summariseWins returns WinLine[]: { count, symbolName, pluralName, payout,
// color, cells, kind, ... } — see app/utils/winLines.ts. NOT { label, credits }.
const pays = computed(() => {
  const def = store.currentDef
  if (def === null || store.lastOutcome === null) return []
  return summariseWins(def, store.lastOutcome)
})
</script>

<template>
  <transition name="peek">
    <div
      v-if="peeking"
      class="theater-peek"
      data-test="peek-layer"
    >
      <div class="theater-peek-inner">
        <div
          v-if="pays.length"
          class="theater-peek-pays"
        >
          <span
            v-for="(p, i) in pays"
            :key="i"
            class="theater-peek-pay"
            :style="{ color: p.color }"
          >
            {{ p.count }}× {{ p.pluralName }} · {{ formatCredits(p.payout) }}
          </span>
        </div>
        <GameXrayContent />
      </div>
    </div>
  </transition>
</template>

<style scoped>
.theater-peek {
  position: absolute; inset: 0; z-index: 3; display: flex; align-items: flex-end;
  justify-content: center; pointer-events: none;
}
.theater-peek-inner {
  pointer-events: auto; width: min(680px, 92%); max-height: 78%; overflow-y: auto;
  margin-bottom: 3vh; padding: 16px 18px; border-radius: 16px;
  background: rgba(8, 11, 20, 0.82); backdrop-filter: blur(8px);
  border: 1px solid rgba(212, 168, 71, 0.4); box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
}
.theater-peek-pays { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 12px;
  font: 700 13px ui-monospace, monospace; }
.peek-enter-active, .peek-leave-active { transition: opacity 0.14s ease; }
.peek-enter-from, .peek-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .peek-enter-active, .peek-leave-active { transition: none; }
}
</style>
```

> **Confirmed against `app/utils/winLines.ts`:** `summariseWins` returns `WinLine[]` with `{ lineNumber, count, symbolId, symbolName, pluralName, payout, pattern, cells, kind, color }`. The template above uses `count`, `pluralName`, `payout`, `color` — all real fields. This is the same call `ReelVideo.vue` makes, and `GamePaylineOverlay` there renders off `wins` independent of the X-ray setting, which is why the peek drawer does not redraw the lines.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/theaterPeekLayer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/game/TheaterPeekLayer.vue tests/components/theaterPeekLayer.test.ts
git commit -m "feat(theater): TheaterPeekLayer — translucent pays + X-ray truth drawer"
```

---

### Task 6: `TheaterGhostBar` — the wake-on-interaction exit

**Files:**
- Create: `app/components/game/TheaterGhostBar.vue`
- Test: `tests/components/theaterGhostBar.test.ts`

**Interfaces:**
- Consumes: `<AppHubLink/>` (existing, unchanged), `useTheater().exit`.
- Produces: `<GameTheaterGhostBar />` — a slim top bar with the hub exit + an ✕ Exit-theater button. Sleeps after ~3s; wakes on `pointermove`/`pointerdown`/`keydown`. Under reduced motion it stays visible.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/theaterGhostBar.test.ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheaterGhostBar from '../../app/components/game/TheaterGhostBar.vue'
import { useTheater } from '../../app/composables/useTheater'

const stubs = {
  UIcon: true,
  AppHubLink: { template: '<a data-test="hub-link" href="https://metaincognita.com" aria-label="METAINCOGNITA — exit the simulator, back to all the games">METAINCOGNITA</a>' }
}

describe('TheaterGhostBar', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('carries the hub exit AND a distinct exit-theater control', () => {
    const w = mount(TheaterGhostBar, { global: { stubs } })
    const hub = w.find('[data-test="hub-link"]')
    expect(hub.attributes('href')).toBe('https://metaincognita.com')
    expect(hub.attributes('aria-label')).toContain('METAINCOGNITA') // WCAG 2.5.3
    const exit = w.find('[data-test="exit-theater"]')
    expect(exit.exists()).toBe(true)
    expect(exit.element).not.toBe(hub.element) // two different controls
  })

  it('the exit-theater button calls useTheater().exit', async () => {
    const t = useTheater()
    t.setTarget(document.createElement('div'))
    t.enter()
    const w = mount(TheaterGhostBar, { global: { stubs } })
    await w.find('[data-test="exit-theater"]').trigger('click')
    expect(t.active.value).toBe(false)
  })

  it('sleeps after the idle timeout, wakes on interaction', async () => {
    const w = mount(TheaterGhostBar, { global: { stubs } })
    expect(w.find('[data-test="ghost-bar"]').classes()).toContain('is-awake')
    vi.advanceTimersByTime(3500)
    await w.vm.$nextTick()
    expect(w.find('[data-test="ghost-bar"]').classes()).not.toContain('is-awake')
    window.dispatchEvent(new Event('pointermove'))
    await w.vm.$nextTick()
    expect(w.find('[data-test="ghost-bar"]').classes()).toContain('is-awake')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/theaterGhostBar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```vue
<!-- app/components/game/TheaterGhostBar.vue -->
<!-- Theater is chrome-free by default; move the mouse or tap and this slim bar
     wakes for a few seconds so you can always leave — to the floor via the hub
     exit, or back to the normal cabinet via ✕. Reduced motion keeps it visible. -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { reducedMotion } from '~/utils/audio'
import { useTheater } from '~/composables/useTheater'

const { exit } = useTheater()
const awake = ref(true)
const still = reducedMotion()
let timer: ReturnType<typeof setTimeout> | null = null

function wake(): void {
  awake.value = true
  if (still) return // reduced motion: never auto-hide
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => { awake.value = false }, 3000)
}
const events = ['pointermove', 'pointerdown', 'keydown'] as const

onMounted(() => {
  wake()
  for (const e of events) window.addEventListener(e, wake)
})
onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
  for (const e of events) window.removeEventListener(e, wake)
})
</script>

<template>
  <div
    class="theater-ghost"
    :class="{ 'is-awake': awake }"
    data-test="ghost-bar"
  >
    <AppHubLink />
    <button
      type="button"
      class="theater-ghost-exit"
      data-test="exit-theater"
      @click="exit"
    >
      <UIcon
        name="i-lucide-x"
        class="w-4 h-4"
        aria-hidden="true"
      />
      <span>Exit theater</span>
    </button>
  </div>
</template>

<style scoped>
.theater-ghost {
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; background: linear-gradient(180deg, rgba(6, 8, 15, 0.85), transparent);
  opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
}
.theater-ghost.is-awake { opacity: 1; pointer-events: auto; }
.theater-ghost-exit {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  font: 700 12px ui-monospace, monospace; color: #e7e2d4;
  background: rgba(30, 24, 12, 0.7); border: 1px solid rgba(212, 168, 71, 0.5);
}
.theater-ghost-exit:hover { color: #fff; border-color: rgba(212, 168, 71, 0.9); }
.theater-ghost-exit:focus-visible { outline: 2px solid rgba(212, 168, 71, 0.8); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .theater-ghost { transition: none; opacity: 1; pointer-events: auto; }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/theaterGhostBar.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/game/TheaterGhostBar.vue tests/components/theaterGhostBar.test.ts
git commit -m "feat(theater): TheaterGhostBar — wake-on-interaction exit carrying the hub link"
```

---

### Task 7: `TheaterStage` — the fullscreen + scale container

**Files:**
- Create: `app/components/game/TheaterStage.vue`
- Test: `tests/components/theaterStage.test.ts`

**Interfaces:**
- Consumes: `useTheater` (Task 1), `useTheaterScale` (Task 2), `<GameTheaterGhostBar/>` (Task 6), `<GameTheaterPeekLayer/>` (Task 5), `<GameTheaterSideTowers/>` (Task 4).
- Produces: `<GameTheaterStage :narrow="boolean"><!-- cabinet block --></GameTheaterStage>`. Registers itself as the fullscreen target; applies the scale transform to the slotted block; hosts the ghost bar, peek drawer, and (when narrow) side towers **inside** the fullscreen element.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/theaterStage.test.ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheaterStage from '../../app/components/game/TheaterStage.vue'
import { useTheater } from '../../app/composables/useTheater'

const stubs = {
  GameTheaterGhostBar: { template: '<div data-test="ghost" />' },
  GameTheaterPeekLayer: { template: '<div data-test="peek" />' },
  GameTheaterSideTowers: { template: '<div data-test="towers" />' }
}

describe('TheaterStage', () => {
  beforeEach(() => { setActivePinia(createPinia()); useTheater().exit() })

  it('renders the slotted cabinet always; ghost + peek only when active', async () => {
    const w = mount(TheaterStage, {
      props: { narrow: false },
      slots: { default: '<div data-test="cab">CAB</div>' },
      global: { stubs }
    })
    expect(w.find('[data-test="cab"]').exists()).toBe(true)
    expect(w.find('[data-test="ghost"]').exists()).toBe(false)
    useTheater().enter()
    await w.vm.$nextTick()
    expect(w.find('[data-test="ghost"]').exists()).toBe(true)
    expect(w.find('[data-test="peek"]').exists()).toBe(true)
  })

  it('shows side towers only for narrow machines in theater', async () => {
    const w = mount(TheaterStage, {
      props: { narrow: true },
      slots: { default: '<div>CAB</div>' },
      global: { stubs }
    })
    useTheater().enter()
    await w.vm.$nextTick()
    expect(w.find('[data-test="towers"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/theaterStage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```vue
<!-- app/components/game/TheaterStage.vue -->
<!-- Wraps a cabinet block. In theater it becomes the fullscreen element, scales
     the block to fill the screen, and hosts everything that must be visible in
     fullscreen (ghost bar, peek drawer, side towers) INSIDE itself — the browser
     renders only the fullscreen subtree. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTheater } from '~/composables/useTheater'
import { useTheaterScale } from '~/composables/useTheaterScale'

defineProps<{ narrow: boolean }>()

const { active, setTarget, peekPress, peekRelease } = useTheater()
const stageEl = ref<HTMLElement | null>(null)
const { host, scale } = useTheaterScale(active)

const blockStyle = computed(() => active.value ? { transform: `scale(${scale.value})` } : {})

onMounted(() => setTarget(stageEl.value))
onBeforeUnmount(() => setTarget(null))
</script>

<template>
  <div
    ref="stageEl"
    class="theater-stage"
    :class="{ 'is-theater': active }"
    @pointerdown="active && peekPress()"
    @pointerup="active && peekRelease()"
  >
    <GameTheaterGhostBar v-if="active" />
    <GameTheaterSideTowers v-if="active && narrow" />
    <div
      ref="host"
      class="theater-block"
      :style="blockStyle"
    >
      <slot />
    </div>
    <GameTheaterPeekLayer v-if="active" />
  </div>
</template>

<style scoped>
.theater-stage.is-theater {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(212, 168, 71, 0.16), transparent 60%),
    radial-gradient(90% 70% at 50% 110%, rgba(0, 120, 140, 0.24), transparent 65%),
    #04060d;
}
.theater-stage.is-theater .theater-block { transform-origin: center center; }
/* pointer-hold on the glass = peek; but never hijack clicks on the controls */
.theater-stage.is-theater :where(button, a, input, select) { pointer-events: auto; }
</style>
```

> **Implementer note:** the `@pointerdown`/`@pointerup` peek gesture must not fire when the user is pressing an actual control (Spin, bet, exit). Guard in the browser-smoke task; if it misbehaves, scope the pointer peek to the glass area only (a dedicated `.theater-glass` region) rather than the whole stage. The keyboard `` ` `` path (Task 8) is the primary gesture; pointer-hold is the touch convenience.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/theaterStage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/game/TheaterStage.vue tests/components/theaterStage.test.ts
git commit -m "feat(theater): TheaterStage — fullscreen target + block scaler + in-stage chrome"
```

---

### Task 8: Wire it into the cabinet — toolbar button, game.vue, nav hide, smoke

**Files:**
- Modify: `app/components/game/CabinetToolbar.vue`
- Modify: `app/pages/game.vue`
- Modify: `app/assets/css/main.css`
- Test: `tests/components/cabinetToolbar.test.ts` (extend), plus live browser smoke.

**Interfaces:**
- Consumes: everything from Tasks 1–7.

- [ ] **Step 1: Add the enter-theater button to the toolbar (test first).** Extend `tests/components/cabinetToolbar.test.ts` with:

```ts
it('has a theater button that enters theater mode', async () => {
  const t = useTheater() // import { useTheater } from '../../app/composables/useTheater'
  t.setTarget(document.createElement('div'))
  const w = mount(CabinetToolbar, { global: { stubs } })
  const btn = w.find('[data-test="enter-theater"]')
  expect(btn.exists()).toBe(true)
  await btn.trigger('click')
  expect(t.active.value).toBe(true)
  t.exit()
})
```

- [ ] **Step 2: Implement the toolbar button.** In `CabinetToolbar.vue`, add to the script `import { useTheater } from '~/composables/useTheater'` and `const theater = useTheater()`, and add this button before `<GameParSheetModal>`:

```vue
<UButton
  color="neutral"
  variant="outline"
  size="xs"
  icon="i-lucide-expand"
  :aria-pressed="theater.active.value"
  data-test="enter-theater"
  @click="theater.toggle()"
>
  Theater
</UButton>
```

- [ ] **Step 3: Wrap both cabinet structures in `game.vue`.** In the **cascade** branch, wrap the main cabinet:

```vue
<div class="cab-page-main">
  <GameTheaterStage :narrow="false">
    <GameReelCascade :key="store.currentMachineId ?? ''" />
  </GameTheaterStage>
</div>
```

In the **standard-shell** branch, wrap the left column (the `<div class="space-y-3">` holding marquee→chrome→result→bet-controls) and mark narrow families:

```vue
<GameTheaterStage :narrow="store.currentDef?.family === 'stepper' || store.currentDef?.family === 'bally-em'">
  <div class="space-y-3">
    <!-- existing GameMachineChrome … GameResultBar … GameBetControls block, unchanged -->
  </div>
</GameTheaterStage>
```

(Leave the two parked branches — `lock-reel`, `blackjack-reel` — untouched; they are off the floor.)

- [ ] **Step 4: Route the peek/exit keys in `game.vue`.** Extend `onKeydown` and add a keyup listener. Add near the top of `<script setup>`: `import { useTheater } from '~/composables/useTheater'` and `const theater = useTheater()`. At the very start of `onKeydown(e)` (before the Space/Enter logic):

```ts
if (e.code === 'Escape' && theater.active.value) { theater.exit(); return }
if (e.code === 'Backquote' && theater.active.value) { e.preventDefault(); if (!e.repeat) theater.peekPress(); return }
```

Add a keyup handler and register/unregister it alongside `onKeydown`:

```ts
function onKeyup(e: KeyboardEvent) {
  if (e.code === 'Backquote') theater.peekRelease()
}
// in onMounted:  window.addEventListener('keyup', onKeyup)
// in onUnmounted: window.removeEventListener('keyup', onKeyup); theater.exit()
```

> The existing `Space`/`Enter` spin path is unchanged and keeps working inside the fullscreen element (the listener is on `window`, which is inside the fullscreen document). `theater.exit()` in `onUnmounted` guarantees leaving `/game` never strands you in fullscreen.

- [ ] **Step 5: Hide the app nav in theater (CSS).** Append to `app/assets/css/main.css`:

```css
/* Theater mode: the stage is a fixed full-viewport layer; hide the app chrome
   beneath it. Real fullscreen already hides everything outside the stage — this
   covers the CSS-only fallback when the Fullscreen API is unavailable/denied. */
body.theater-active nav { display: none; }
body.theater-active { overflow: hidden; }
```

- [ ] **Step 6: Run the unit tests**

Run: `pnpm vitest run tests/components/cabinetToolbar.test.ts`
Expected: PASS (existing + the new theater button test).

- [ ] **Step 7: Full gates**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: lint clean (pre-existing `SymbolIcon.vue` v-html warning only), typecheck exit 0, all tests pass.

- [ ] **Step 8: Live browser smoke (this is a display feature — green units don't prove it renders).** Serve the built site and drive it:

```bash
pnpm generate && pnpm smoke   # serves dist/ at http://localhost:8788 under the real _headers
```

Then, in a real browser (viewcap for screenshots, Chrome MCP to drive), verify on a **video** machine (Canal Royale) and a **stepper** (Diamond Doubler):
  - Click **Theater** → the cabinet fills the screen; symbols are big; the app nav is gone.
  - Video machine fills edge-to-edge; the stepper is centered with lit **side towers** (Frame).
  - Hold `` ` `` → the peek drawer washes in with pays + X-ray; release → gone. Tap `` ` `` → pins; tap again → closes.
  - Move the mouse → the **ghost bar** wakes with METAINCOGNITA + ✕ Exit theater, then fades.
  - **Esc** exits theater; the nav and hub exit return.
  - **Space** still spins inside theater; on Stock Rush, **1/2/3** still stop reels.
  - Screenshot theater at 1280×720 and 390×844 for the record.

- [ ] **Step 9: a11y check**

Run axe (axecap/lightcap) on `/game` in theater with the peek drawer pinned. Confirm: the Theater button exposes `aria-pressed`; the ghost bar's hub exit keeps its verbatim label; side towers/bulbs are `aria-hidden`; no new contrast failures on the gold-on-dark ghost bar.

- [ ] **Step 10: Commit**

```bash
git add app/components/game/CabinetToolbar.vue app/pages/game.vue app/assets/css/main.css tests/components/cabinetToolbar.test.ts
git commit -m "feat(theater): enter from the toolbar, wire the peek/exit keys, hide the nav"
```

---

## Post-implementation

- [ ] **CHANGELOG.** Add a `### Added` entry under `[Unreleased]` describing theater mode (hold-`-to-peek, the ghost-bar hub exit). Update the README `## Playing it` walkthrough with a theater step if it reads naturally.
- [ ] **Manual polish pass.** The spec calls out that eyeballing all 11 cabinets at 2–3× is the bulk of the real work — hairline borders, bulb sizes, and letter-spacing that read at 556px can look thin doubled. Budget a browser session per family after the mechanics land.
- [ ] Do **not** push. A commit-timestamp rewrite off business hours happens before any push, separately.

## Self-review notes (checked against the spec)

- **Every spec section maps to a task:** edge-to-edge scaling → Tasks 2, 7; Frame + side-towers for narrow families → Tasks 4, 7; hold-`/tap-to-pin truth layer → Tasks 1, 5; ghost-bar exit resolving the hub-exit tension → Task 6; reuse of X-ray data (and paylines-already-on-glass refinement) → Tasks 3, 5; entry + key wiring + nav hide → Task 8; reduced motion + a11y → Tasks 4, 6, 8; scope (display-only, slots-only, `/game`-only, pachislo keys) → Task 8 smoke.
- **Resolved spec open-questions:** measurement via `offsetWidth` (Task 2); `useFitScale` untouched (Task 2 note); shared `TheaterSideTowers` (Task 4).
- **Type consistency:** `useTheater` exposes `active`, `peek`, `peeking`, `setTarget`, `enter`, `exit`, `toggle`, `peekPress`, `peekRelease` — the same names are consumed in Tasks 5, 6, 7, 8. `useTheaterScale` yields `{ host, scale }`, consumed in Task 7.
- **Assumption verified during self-review, not left to the implementer:** `summariseWins` returns `WinLine[]` (`{ count, symbolName, pluralName, payout, color, cells, kind, … }`) — confirmed against `app/utils/winLines.ts`; Task 5's template uses the real fields. A first draft assumed `{ label, credits }` and would have failed typecheck; fixed inline. Confirmed too that `GamePaylineOverlay` renders off win-detection, independent of `store.settings.xray`, so the peek drawer correctly does not redraw paylines.
