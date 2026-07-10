# Hit or Bust — Reel Surface + Controls + Composable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Hit or Bust `blackjack-reel` machine into the playable UI — composable, reel surface, Deal/Hit/Stand controls, game page integration, and floor listing.

**Architecture:** Mirror the pachislo family pattern exactly: a thin `useBlackjackReel` composable (family-guard + computed gates + store action wrappers), a `ReelBlackjackReel.vue` surface that renders cards via `<GameSymbolIcon>`, a `BlackjackControls.vue` with Deal/Hit/Stand buttons, wired into `game.vue` beside the existing family chain. `BetControls.vue` slots pachislo-controls; we add a parallel slot for blackjack-reel controls (or a sibling conditional — whichever keeps BetControls.vue minimal). `index.vue` gains `blackjack-reel` in `FAMILY_ORDER`.

**Tech Stack:** Vue 3 Composition API, Pinia, TypeScript, Nuxt 4 auto-import, Tailwind CSS, Vitest + happy-dom

---

## File Map

| Action | Path |
|--------|------|
| Create | `app/composables/useBlackjackReel.ts` |
| Create | `app/components/game/ReelBlackjackReel.vue` |
| Create | `app/components/game/BlackjackControls.vue` |
| Modify | `app/pages/game.vue` |
| Modify | `app/pages/index.vue` |
| Create | `tests/components/blackjackControls.test.ts` |

---

### Task 1: `useBlackjackReel` composable

**Files:**
- Create: `app/composables/useBlackjackReel.ts`

- [ ] **Step 1: Write the file**

```typescript
// app/composables/useBlackjackReel.ts
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'

export function useBlackjackReel() {
  const store = useSlotsStore()

  const bj = computed(() => {
    const def = store.currentDef
    const state = store.currentState
    if (def === null || state === null || def.family !== 'blackjack-reel') return null
    return state.blackjackReel
  })

  const phase = computed(() => bj.value?.phase ?? 'idle')

  const canDeal = computed(() => {
    const def = store.currentDef
    if (def === null || def.family !== 'blackjack-reel') return false
    if (store.spinning) return false
    const p = phase.value
    if (p !== 'idle' && p !== 'resolved') return false
    return store.currentBet * def.denominationCents <= store.bankrollCents
  })

  const canHit = computed(() =>
    !store.spinning && phase.value === 'dealt'
  )

  const canStand = computed(() =>
    !store.spinning && phase.value === 'dealt'
  )

  function deal() {
    if (!canDeal.value) return
    store.dealHand()
    store.revealDone()
  }

  function hit() {
    if (!canHit.value) return
    store.hitCard()
    store.revealDone()
  }

  function stand() {
    if (!canStand.value) return
    store.standHand()
    store.revealDone()
  }

  return { bj, phase, canDeal, canHit, canStand, deal, hit, stand }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm typecheck 2>&1 | tail -20
```

Expected: 0 errors (or same baseline as before).

---

### Task 2: `ReelBlackjackReel.vue` reel surface

**Files:**
- Create: `app/components/game/ReelBlackjackReel.vue`

- [ ] **Step 1: Write the component**

```vue
<!-- app/components/game/ReelBlackjackReel.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSymbols } from '~/composables/useReelSymbols'
import { VOID_CARD } from '~/engine/blackjackReel'
import type { BlackjackReelMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as BlackjackReelMachineDef | null)
const bj = computed(() => store.currentState?.blackjackReel ?? null)

const { iconFor, labelFor } = useReelSymbols(def)

/** Up-to-5 card slots; null = not yet drawn, 'VOID' = bust-saved placeholder */
const slots = computed<(string | null)[]>(() => {
  const cards = bj.value?.cards ?? []
  const result: (string | null)[] = []
  for (let i = 0; i < 5; i++) {
    result.push(cards[i] ?? null)
  }
  return result
})

const totalDisplay = computed(() => {
  const state = bj.value
  if (state === null || state.phase === 'idle') return null
  if (state.busted) return 'BUST'
  if (state.isSoft && state.total <= 21) {
    const hard = state.total - 10
    return `${hard} / ${state.total}`
  }
  return String(state.total)
})

const multiplierDisplay = computed(() => {
  const state = bj.value
  if (state === null || state.multSum <= 0) return null
  return `×${state.multSum + 1}`
})
</script>

<template>
  <div
    v-if="def && bj"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <!-- Status badges row -->
    <div class="flex items-center justify-between text-[11px] font-mono min-h-[20px]">
      <div class="flex items-center gap-2">
        <span
          v-if="bj.saveHeld"
          class="rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 px-2 py-0.5"
          data-test="bust-save-badge"
        >
          BUST SAVE HELD
        </span>
        <span
          v-if="multiplierDisplay"
          class="rounded-full border border-violet-500/50 bg-violet-500/10 text-violet-300 px-2 py-0.5"
          data-test="multiplier-badge"
        >
          MULT {{ multiplierDisplay }}
        </span>
        <span
          v-if="bj.charlie"
          class="rounded-full border border-amber-500/50 bg-amber-500/10 text-amber-300 px-2 py-0.5 motion-safe:animate-pulse"
          data-test="charlie-badge"
        >
          FIVE-CARD CHARLIE!
        </span>
      </div>
      <span
        v-if="totalDisplay && !bj.busted"
        class="text-neutral-400"
      >
        Total: <span class="text-neutral-100">{{ totalDisplay }}</span>
      </span>
    </div>

    <!-- Card slots row -->
    <div
      class="flex gap-2 justify-center"
      aria-label="Hand cards"
    >
      <div
        v-for="(card, i) in slots"
        :key="i"
        class="h-20 w-16 rounded-lg border flex items-center justify-center"
        :class="[
          card === null
            ? 'border-neutral-800 bg-neutral-950 text-neutral-700'
            : card === 'VOID'
              ? 'border-neutral-700 bg-neutral-950/50 opacity-40'
              : bj.busted && i === bj.cards.length - 1
                ? 'border-red-500/60 bg-red-500/10'
                : 'border-neutral-700 bg-neutral-950 border-neutral-600'
        ]"
        :aria-label="card === null ? `Card slot ${i + 1} — not yet drawn` : card === 'VOID' ? 'Bust saved — voided card' : labelFor(card)"
      >
        <GameSymbolIcon
          v-if="card !== null && card !== 'VOID'"
          :icon="iconFor(card)"
          :label="labelFor(card)"
          :size="52"
        />
        <span
          v-else-if="card === 'VOID'"
          class="text-neutral-600 text-xs font-mono"
          aria-hidden="true"
        >VOID</span>
        <span
          v-else
          class="text-neutral-700 text-xl"
          aria-hidden="true"
        >·</span>
      </div>
    </div>

    <!-- Bust overlay -->
    <div
      v-if="bj.busted"
      class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-sm text-red-300 text-center"
      data-test="bust-panel"
    >
      BUST — hand lost
    </div>

    <!-- Win total when resolved and not busted -->
    <div
      v-if="bj.phase === 'resolved' && !bj.busted"
      class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-sm text-emerald-200 text-center"
      data-test="win-panel"
    >
      <template v-if="bj.charlie">
        Five-Card Charlie — Total {{ totalDisplay }}
        <template v-if="multiplierDisplay"> {{ multiplierDisplay }}</template>
      </template>
      <template v-else>
        Stand at {{ totalDisplay }}
        <template v-if="multiplierDisplay"> {{ multiplierDisplay }}</template>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm typecheck 2>&1 | tail -20
```

Expected: 0 errors.

---

### Task 3: `BlackjackControls.vue`

**Files:**
- Create: `app/components/game/BlackjackControls.vue`

- [ ] **Step 1: Write the component**

```vue
<!-- app/components/game/BlackjackControls.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const store = useSlotsStore()
const { phase, canDeal, canHit, canStand, deal, hit, stand } = useBlackjackReel()

const def = computed(() => {
  const d = store.currentDef
  return d?.family === 'blackjack-reel' ? d : null
})

const anteDisplay = computed(() => {
  if (def.value === null) return ''
  const coins = store.currentBet
  const cents = coins * def.value.denominationCents
  return `Ante: ${coins} coin${coins !== 1 ? 's' : ''} ($${(cents / 100).toFixed(2)})`
})
</script>

<template>
  <div
    v-if="def"
    class="flex items-center gap-2"
  >
    <span class="font-mono text-xs text-neutral-400 mr-1">{{ anteDisplay }}</span>

    <UButton
      data-test="deal"
      color="primary"
      size="lg"
      icon="i-lucide-play"
      :disabled="!canDeal"
      @click="deal"
    >
      Deal
    </UButton>

    <UButton
      data-test="hit"
      color="neutral"
      variant="solid"
      size="lg"
      icon="i-lucide-plus"
      :disabled="!canHit"
      :class="canHit ? 'ring-1 ring-amber-400/60' : ''"
      @click="hit"
    >
      Hit
    </UButton>

    <UButton
      data-test="stand"
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-hand"
      :disabled="!canStand"
      @click="stand"
    >
      Stand
    </UButton>

    <span
      v-if="phase === 'dealt'"
      class="text-[10px] text-amber-400 uppercase tracking-wider ml-1"
    >Hand in play</span>
    <span
      v-else-if="phase === 'resolved'"
      class="text-[10px] text-neutral-400 uppercase tracking-wider ml-1"
    >Hand resolved — deal again?</span>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm typecheck 2>&1 | tail -20
```

Expected: 0 errors.

---

### Task 4: Wire into `game.vue`

**Files:**
- Modify: `app/pages/game.vue`

Key changes:
1. Add `<GameReelBlackjackReel>` to the `v-else-if` chain inside `<GameMachineChrome>`.
2. Add `<GameBlackjackControls>` for the blackjack-reel family inside `<GameBetControls>` via a new named slot or adjacent conditional.
3. Update `onKeydown` so Space = Hit during `dealt`, Deal during `idle`/`resolved`, and skip the blackjack-reel family from the generic `store.spinOnce()` path.

Because `BetControls.vue` already has a `#pachislo-controls` slot and renders the Spin button only when `def.family !== 'pachislo'`, we need a parallel exclusion for `blackjack-reel` and a slot for its controls.

**Step 1:** Update `BetControls.vue` to also hide the Spin button for `blackjack-reel` and add a `#blackjack-controls` slot:

In `app/components/game/BetControls.vue` change:
```vue
      <UButton
        v-if="def.family !== 'pachislo'"
        data-test="spin"
        ...
      >
```
to:
```vue
      <UButton
        v-if="def.family !== 'pachislo' && def.family !== 'blackjack-reel'"
        data-test="spin"
        ...
      >
```

Also add `<slot name="blackjack-controls" />` below the pachislo-controls slot.

- [ ] **Step 1: Edit BetControls.vue**

Edit `app/components/game/BetControls.vue` line 92 (the `v-if` on the spin button):
- Old: `v-if="def.family !== 'pachislo'"`
- New: `v-if="def.family !== 'pachislo' && def.family !== 'blackjack-reel'"`

And after `<slot name="pachislo-controls" />` add:
```vue
      <slot name="blackjack-controls" />
```

- [ ] **Step 2: Edit game.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const store = useSlotsStore()
const route = useRoute()
const parOpen = ref(false)
const { canDeal, canHit, deal, hit } = useBlackjackReel()

function onKeydown(e: KeyboardEvent) {
  if (e.code !== 'Space' || e.repeat) return
  const target = e.target as HTMLElement | null
  if (target !== null && ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (store.currentDef?.family === 'pachislo') return // pachislo spins via its own controls
  if (store.currentDef?.family === 'blackjack-reel') {
    e.preventDefault()
    if (canHit.value) hit()
    else if (canDeal.value) deal()
    return
  }
  e.preventDefault()
  store.spinOnce()
}
// ... rest unchanged
```

And in the template, add the reel surface and controls:
```vue
          <GameReelBlackjackReel
            v-else-if="store.currentDef?.family === 'blackjack-reel'"
            :key="store.currentMachineId ?? ''"
          />
```

Inside `<GameBetControls>`:
```vue
          <template
            v-if="store.currentDef?.family === 'blackjack-reel'"
            #blackjack-controls
          >
            <GameBlackjackControls />
          </template>
```

- [ ] **Step 3: Typecheck**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm typecheck 2>&1 | tail -20
```

Expected: 0 errors.

---

### Task 5: `index.vue` — add blackjack-reel to floor

**Files:**
- Modify: `app/pages/index.vue`

- [ ] **Step 1: Edit `FAMILY_ORDER` and `FAMILY_HEADING`**

Change:
```typescript
const FAMILY_ORDER = ['video', 'stepper', 'bally-em', 'pachislo'] as const
const FAMILY_HEADING: Record<string, string> = {
  'video': 'Video slots',
  'stepper': 'Telnaes steppers (1984)',
  'bally-em': 'Vintage Bally Series E (1979)',
  'pachislo': 'Pachislo skill-stop'
}
```

To:
```typescript
const FAMILY_ORDER = ['video', 'stepper', 'bally-em', 'pachislo', 'blackjack-reel'] as const
const FAMILY_HEADING: Record<string, string> = {
  'video': 'Video slots',
  'stepper': 'Telnaes steppers (1984)',
  'bally-em': 'Vintage Bally Series E (1979)',
  'pachislo': 'Pachislo skill-stop',
  'blackjack-reel': 'Blackjack reel'
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm typecheck 2>&1 | tail -10
```

---

### Task 6: Tests — `blackjackControls.test.ts`

**Files:**
- Create: `tests/components/blackjackControls.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { mulberry32 } from '../../app/engine'
import { setLiveRand } from '../../app/utils/liveRand'
import BlackjackControls from '../../app/components/game/BlackjackControls.vue'
import { useSlotsStore } from '../../app/stores/slots'

let active: { unmount: () => void } | null = null

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  setLiveRand(mulberry32(2026))
  const store = useSlotsStore()
  store.startSession(1_000_000)
  store.selectMachine('hit-or-bust')
  const wrapper = mount(BlackjackControls, {
    global: {
      stubs: {
        UIcon: true,
        UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }
      }
    }
  })
  active = wrapper
  return { store, wrapper }
}

describe('BlackjackControls', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    active?.unmount()
    active = null
  })

  it('Deal enabled, Hit and Stand disabled in idle phase', () => {
    const { wrapper } = setup()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="hit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="stand"]').attributes('disabled')).toBeDefined()
  })

  it('Deal calls store.dealHand then revealDone, transitions to dealt phase', async () => {
    const { store, wrapper } = setup()
    expect(store.currentState!.blackjackReel!.phase).toBe('idle')
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('dealt')
    expect(store.currentState!.blackjackReel!.cards).toHaveLength(2)
    expect(store.spinning).toBe(false) // revealDone cleared it
  })

  it('Hit and Stand enabled after Deal, Deal disabled', async () => {
    const { wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="hit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="stand"]').attributes('disabled')).toBeUndefined()
  })

  it('Hit draws a card and keeps dealt phase if hand continues', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    const cardsBefore = store.currentState!.blackjackReel!.cards.length
    // Hit may or may not resolve depending on RNG — just check a card was added or phase resolved
    await wrapper.find('[data-test="hit"]').trigger('click')
    const bj = store.currentState!.blackjackReel!
    const cardCount = bj.cards.length
    // Either we got another card or the hand resolved
    expect(cardCount === cardsBefore + 1 || bj.phase === 'resolved').toBe(true)
    expect(store.spinning).toBe(false) // revealDone cleared it
  })

  it('Stand resolves the hand immediately', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.find('[data-test="stand"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    expect(store.spinning).toBe(false)
  })

  it('Deal re-enabled after resolved, starts a new hand', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.find('[data-test="stand"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    // After resolution, deal should be re-enabled
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('dealt')
  })

  it('Deal disabled when bankroll < ante', async () => {
    const { store, wrapper } = setup()
    store.bankrollCents = 1 // below any ante
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm test -- --reporter=verbose tests/components/blackjackControls.test.ts 2>&1 | tail -30
```

Expected: all tests pass.

---

### Task 7: Full gate — lint + typecheck + test

- [ ] **Step 1: Lint**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm lint 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 2: Typecheck**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: Full test suite**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && pnpm test 2>&1 | tail -20
```

Expected: ≥444 tests pass, 0 failures.

---

### Task 8: Commit

- [ ] **Step 1: Stage and commit**

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && git add \
  app/composables/useBlackjackReel.ts \
  app/components/game/ReelBlackjackReel.vue \
  app/components/game/BlackjackControls.vue \
  app/components/game/BetControls.vue \
  app/pages/game.vue \
  app/pages/index.vue \
  tests/components/blackjackControls.test.ts
```

```bash
cd /Volumes/satechi/webdev/metaincognita-slots && git commit -m "feat(ui): Hit or Bust reel surface + Deal/Hit/Stand controls"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: `useBlackjackReel.ts` — composable with `phase`, `canDeal`, `canHit`, `canStand`, `deal()`, `hit()`, `stand()`, family guard
- ✅ Task 2: `ReelBlackjackReel.vue` — up-to-5 card slots via `<GameSymbolIcon>`, total display (soft/hard), multiplier badge, Bust-Save badge, Charlie flourish, bust panel
- ✅ Task 3: `BlackjackControls.vue` — Deal/Hit/Stand buttons with `data-test` attrs, ante display, disabled tracking
- ✅ Task 4: `game.vue` + `BetControls.vue` — reel surface in family chain, controls in slot, Space key → Hit (dealt) or Deal (idle/resolved), `blackjack-reel` excluded from `spinOnce()`
- ✅ Task 5: `index.vue` — `blackjack-reel` added to `FAMILY_ORDER` and `FAMILY_HEADING`
- ✅ Task 6: `blackjackControls.test.ts` — Deal→Hit→Stand states, disabled tracking, bankroll check
- ✅ Task 7: lint + typecheck + full test gate

**Placeholder scan:** None found — all code blocks are complete.

**Type consistency:** `useBlackjackReel` uses `store.dealHand()`/`hitCard()`/`standHand()` (exact store action names confirmed). `BlackjackControls.vue` imports `useBlackjackReel` and destructures `{ phase, canDeal, canHit, canStand, deal, hit, stand }` matching composable return. `ReelBlackjackReel.vue` uses `VOID_CARD` from `~/engine/blackjackReel` (confirmed exported). `BlackjackReelMachineDef` type import from `~/engine` (re-exported there).
