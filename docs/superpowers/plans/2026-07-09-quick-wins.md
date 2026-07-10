# Quick-Wins Tranche (2026-07-09 Audit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the ten small, owner-approved fixes from the 2026-07-09 improvement audit: harden the deploy gates, add the storage-reset notice, unify money formatting, derive RTP test assertions from the engine, close the game→learn teaching loop, complete the glossary, gloss the jargon, and dedupe the game-page toolbar/shells.

**Architecture:** Ten independent, individually-committable changes to an existing Nuxt 4 + Pinia + TypeScript educational slot simulator. No engine math changes. New shared code goes in `app/utils/` (formatters, learn-link map) and `app/components/game/` (toolbar); everything else is surgical edits to existing files.

**Tech Stack:** Nuxt 4 (auto-imported components: `app/components/game/Foo.vue` → `<GameFoo>`), Pinia, Vitest 4 (+@vue/test-utils, happy-dom for component tests via `// @vitest-environment happy-dom`), Tailwind 4, Netlify static deploy, pnpm.

## Global Constraints

- **Commit messages must NOT contain any `Co-Authored-By` / AI-attribution trailer** (user's global rule — overrides all defaults).
- **Rendered money strings must stay byte-identical** at every converted call site for the machines that exist today (parked cabinets are demo-contract surfaces; component tests assert dollar strings).
- **The phrase "all 243 ways" must survive rewording** — `tests/components/betControls.test.ts:37` asserts `/all 243 ways/i`.
- **All new user-facing copy defines jargon in plain English** (owner rule: the reader is a slots novice).
- **Per-task gate:** `pnpm lint` plus the targeted vitest files listed in the task. Full `pnpm check` runs once, in Task 10 (its `verify` step takes minutes at the default 5M spins — don't run it per-task).
- Component tests stub Nuxt UI primitives; copy the stub patterns given in each task verbatim.
- Node 22, pnpm. Repo root: `/Volumes/satechi/webdev/metaincognita-slots`.

---

### Task 1: Deploy gates — Netlify typecheck+verify, frozen installs

**Files:**
- Modify: `netlify.toml`
- Modify: `.github/workflows/ci.yml:22-23`

**Interfaces:**
- Consumes: existing package scripts (`lint`, `typecheck`, `test`, `verify`, `generate`).
- Produces: nothing other tasks rely on.

Why: Netlify builds independently of GitHub CI (no branch protection) and today deploys anything that passes lint+test — a push that breaks typecheck or the RTP reconciliation still ships. Also, both CI and Netlify run bare `pnpm install`, which may resolve fresh on bleeding-edge caret majors instead of installing the committed lockfile.

- [ ] **Step 1: Rewrite the `[build]` block of `netlify.toml`**

Replace lines 1-9 (the `[build]` and `[build.environment]` blocks) with:

```toml
[build]
  # Deploy gate: a push that fails lint, typecheck, tests, or the RTP
  # reconciliation must not deploy. Netlify builds independently of GitHub CI
  # (no branch protection), so it runs the same gates itself — verify at 250k
  # spins/machine keeps the build fast; the 3.5σ gate still catches gross
  # breaks (CI's deeper 1M-spin run happens in parallel on GitHub).
  command = "pnpm lint && pnpm typecheck && pnpm test && pnpm verify -- --spins 250000 && pnpm generate"
  publish = "dist"

[build.environment]
  # Match .github/workflows/ci.yml so Netlify never builds on a different Node.
  NODE_VERSION = "22"
  # Install exactly the committed lockfile — never resolve fresh on deploy.
  PNPM_FLAGS = "--frozen-lockfile"
```

Leave the rest of the file (redirects comment, `[[headers]]`) untouched.

- [ ] **Step 2: Freeze the CI install**

In `.github/workflows/ci.yml`, change the install step:

```yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
```

- [ ] **Step 3: Prove the new verify invocation works locally**

Run: `pnpm verify -- --spins 250000`
Expected: banner `spins/machine: 250,000`, ten `PASS` lines, exit 0.

- [ ] **Step 4: Prove the frozen install is currently satisfiable**

Run: `pnpm install --frozen-lockfile`
Expected: completes with no lockfile error (lockfile is in sync today).

- [ ] **Step 5: Commit**

```bash
git add netlify.toml .github/workflows/ci.yml
git commit -m "chore(deploy): Netlify gate runs typecheck+verify; frozen-lockfile installs"
```

---

### Task 2: Coverage thresholds

**Files:**
- Modify: `vitest.config.ts`
- Modify: `.github/workflows/ci.yml:31-32`

**Interfaces:**
- Consumes: `@vitest/coverage-v8` (already installed), `test:coverage` script (already defined).
- Produces: a coverage ratchet later tasks must not fall below (they won't — every task adds tested code).

Why: coverage is currently measured never and gated nowhere. Baseline measured 2026-07-09: **Statements 88.5 / Branches 79.89 / Functions 90.55 / Lines 91.89**. Thresholds sit ~2 points under baseline: a ratchet against silent regression, not a quality bar.

- [ ] **Step 1: Add the coverage block to `vitest.config.ts`**

Replace the `test:` object so the file reads:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    testTimeout: 180_000,
    coverage: {
      provider: 'v8',
      // Ratchet, not target: ~2 points under the 2026-07-09 baseline
      // (S 88.5 / B 79.9 / F 90.6 / L 91.9) so a change that silently
      // drops a tested area fails CI. Raise these as coverage grows.
      thresholds: {
        statements: 86,
        branches: 77,
        functions: 88,
        lines: 89
      }
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app')
    }
  }
})
```

- [ ] **Step 2: Gate CI on it**

In `.github/workflows/ci.yml`, change the Test step:

```yaml
      - name: Test (coverage-gated)
        run: pnpm run test:coverage
```

- [ ] **Step 3: Verify the gate passes at today's coverage**

Run: `pnpm test:coverage`
Expected: full suite green, coverage summary printed, exit 0 (no `ERROR: Coverage ... does not meet ... threshold`).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts .github/workflows/ci.yml
git commit -m "chore(test): enforce v8 coverage thresholds in CI"
```

---

### Task 3: Storage-reset notice

**Files:**
- Modify: `app/stores/slots.ts` (state block :71-84, `loadFromLocalStorage` :176-181, `peekSavedSession` :603-613, new action)
- Modify: `app/pages/index.vue` (banner in the `phase === 'floor'` template branch, :47-61)
- Modify: `tests/store.test.ts` (append a describe block)
- Create: `tests/components/storageNotice.test.ts`

**Interfaces:**
- Consumes: existing `STORAGE_KEY` export, `STORAGE_VERSION` module const.
- Produces: `store.storageNotice: boolean` state + `store.dismissStorageNotice(): void` action (the banner and its test use these exact names).

Why: today a saved session with the wrong `v` is silently discarded — a returning user after a storage-shape change just loses bankroll/history with no explanation. The version check lives in two places: `loadFromLocalStorage` (the load path) and `peekSavedSession` (the boot-time gate in `index.vue:11` / `game.vue:41` — this is the one that actually fires on reload, because peek returning false means resume is never called). Both must set the flag.

- [ ] **Step 1: Write the failing store tests**

Append to `tests/store.test.ts` (top-level, alongside the other describes; the file already imports `useSlotsStore`, `STORAGE_KEY`, `createPinia`/`setActivePinia` — if `STORAGE_KEY` is not imported yet, add it to the existing import from `../app/stores/slots`):

```ts
describe('storage version notice', () => {
  it('flags an incompatible save on peek AND on load, and can be dismissed', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, bankrollCents: 5000 }))
    const store = useSlotsStore()
    expect(store.storageNotice).toBe(false)

    expect(store.peekSavedSession()).toBe(false) // the boot-time gate
    expect(store.storageNotice).toBe(true)

    store.dismissStorageNotice()
    expect(store.storageNotice).toBe(false)

    expect(store.loadFromLocalStorage()).toBe(false) // the load path
    expect(store.storageNotice).toBe(true)
  })

  it('does not flag a valid save, an empty slot, or unparseable garbage', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()

    expect(store.peekSavedSession()).toBe(false) // empty slot
    expect(store.storageNotice).toBe(false)

    store.startSession(10_000) // writes a valid v1 save
    expect(store.peekSavedSession()).toBe(true)
    expect(store.storageNotice).toBe(false)

    localStorage.setItem(STORAGE_KEY, 'not json {{{')
    expect(store.peekSavedSession()).toBe(false)
    expect(store.storageNotice).toBe(false) // corrupt ≠ incompatible: stay silent
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run tests/store.test.ts -t "storage version notice"`
Expected: FAIL — `storageNotice` undefined / `dismissStorageNotice is not a function`.

- [ ] **Step 3: Implement in the store**

In `app/stores/slots.ts`:

(a) Add to state (after `liveAnnouncement: ''` in the state object):

```ts
    liveAnnouncement: '',
    // A saved session existed but its storage version didn't match — it was
    // left alone (not loaded); the floor shows a one-time explanation.
    // Transient: never persisted, cleared by dismiss or any $reset.
    storageNotice: false
```

(b) In `loadFromLocalStorage`, split the guard at :181. Replace:

```ts
        if (data === null || typeof data !== 'object' || data.v !== STORAGE_VERSION) return false
```

with:

```ts
        if (data === null || typeof data !== 'object') return false
        if (data.v !== STORAGE_VERSION) {
          // A save exists but from a different storage version. v1 is the only
          // shape ever shipped, so there is nothing to migrate yet — flag it so
          // the floor can tell the player instead of silently starting fresh.
          // (When v2 lands, migrate here instead of flagging.)
          this.storageNotice = true
          return false
        }
```

(c) Replace `peekSavedSession` with:

```ts
    /** True when valid-looking session data exists, WITHOUT loading it. */
    peekSavedSession(): boolean {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return false
        const data = JSON.parse(raw) as { v?: unknown } | null
        const ok = data !== null && typeof data === 'object' && data.v === STORAGE_VERSION
        // This peek is the boot-time gate (index/game onMounted): when a save
        // exists but the version is wrong, load will never run — flag it here.
        if (!ok && data !== null && typeof data === 'object') this.storageNotice = true
        return ok
      } catch {
        return false
      }
    },
```

(d) Add the dismiss action (after `peekSavedSession`):

```ts
    dismissStorageNotice() {
      this.storageNotice = false
    },
```

- [ ] **Step 4: Run the store tests to verify they pass**

Run: `pnpm vitest run tests/store.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Write the failing banner test**

Create `tests/components/storageNotice.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IndexPage from '../../app/pages/index.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  FloorFeaturedMachine: true,
  FloorBankrollSetup: true,
  FloorMachineCard: true,
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }
}

describe('storage-reset notice banner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('is absent by default, shown when flagged, and dismissible', async () => {
    const store = useSlotsStore()
    const w = mount(IndexPage, { global: { stubs } })
    expect(w.find('[data-test="storage-notice"]').exists()).toBe(false)

    store.storageNotice = true
    await w.vm.$nextTick()
    const banner = w.find('[data-test="storage-notice"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text().toLowerCase()).toContain('older version')

    await banner.find('button').trigger('click')
    expect(store.storageNotice).toBe(false)
    expect(w.find('[data-test="storage-notice"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run tests/components/storageNotice.test.ts`
Expected: FAIL — `[data-test="storage-notice"]` never appears.

- [ ] **Step 7: Add the banner to `app/pages/index.vue`**

Inside `<template v-if="store.phase === 'floor'">` (line 47), insert as the FIRST child (before `<FloorFeaturedMachine>`):

```html
        <div
          v-if="store.storageNotice"
          data-test="storage-notice"
          role="status"
          class="flex items-start justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 text-left"
        >
          <p class="leading-relaxed">
            Your saved session came from an older version of this app and couldn't
            be restored — the floor starts fresh. (The bankroll was never real
            money, so nothing of value was lost.)
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            aria-label="Dismiss notice"
            @click="store.dismissStorageNotice()"
          />
        </div>
```

- [ ] **Step 8: Run the banner test to verify it passes**

Run: `pnpm vitest run tests/components/storageNotice.test.ts tests/components/floorFirstRun.test.ts`
Expected: PASS (both — floorFirstRun guards the first-run layout this edit sits inside).

- [ ] **Step 9: Lint and commit**

```bash
pnpm lint
git add app/stores/slots.ts app/pages/index.vue tests/store.test.ts tests/components/storageNotice.test.ts
git commit -m "feat(store): tell the player when an incompatible save couldn't be restored"
```

---

### Task 4: Money-format unification

**Files:**
- Modify: `app/utils/format.ts`, `tests/format.test.ts`
- Modify: `app/composables/useLockReel.ts` (:40-49 delete `money`, :81, :144, :149, :151-156, :160, :264)
- Modify: `app/composables/useBlackjackReel.ts` (:60, :61-64, :80)
- Modify: `app/utils/outcomeText.ts` (:14, :31, :33-35, credit `toLocaleString` sites)
- Modify: `app/composables/useCascade.ts` (the `classify` local `dollars`, ~:98)
- Modify: `app/components/game/ReelCascade.vue` (:32-33 `usd`/`usdCents`)
- Modify: `app/components/game/XrayPanel.vue` (:91 `toDollars`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `formatCentsExact(cents: number): string` (always `$X.XX`, sign outside: `-$12.50`) and `formatCentsCompact(cents: number): string` (`25¢` / `$1` / `$1.25`) exported from `~/utils/format` — later tasks and future code use these instead of hand-rolling.

Why: money rendering is hand-rolled ~7×, and the implementations disagree (`25¢` vs `$0.25` vs `$—`). Two canonical styles cover every site: **exact** (result cards, narration, EV readouts) and **compact** (the lock-reel cash deck, moved verbatim from `useLockReel`'s local `money()`). Every conversion below is byte-identical for the machines that exist today — component tests asserting dollar strings must stay green untouched.

- [ ] **Step 1: Write the failing formatter tests**

Append to `tests/format.test.ts` (it already imports from `../app/utils/format`; extend that import with the two new names):

```ts
describe('formatCentsExact', () => {
  it('always renders two decimals with the sign outside the $', () => {
    expect(formatCentsExact(0)).toBe('$0.00')
    expect(formatCentsExact(25)).toBe('$0.25')
    expect(formatCentsExact(100)).toBe('$1.00')
    expect(formatCentsExact(123456)).toBe('$1234.56')
    expect(formatCentsExact(-1250)).toBe('-$12.50')
  })
})

describe('formatCentsCompact', () => {
  it('renders sub-dollar as cents, whole dollars bare, fractional with 2 places', () => {
    expect(formatCentsCompact(25)).toBe('25¢')
    expect(formatCentsCompact(99)).toBe('99¢')
    expect(formatCentsCompact(100)).toBe('$1')
    expect(formatCentsCompact(500)).toBe('$5')
    expect(formatCentsCompact(125)).toBe('$1.25')
    expect(formatCentsCompact(0)).toBe('0¢')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/format.test.ts`
Expected: FAIL — `formatCentsExact is not a function`.

- [ ] **Step 3: Implement in `app/utils/format.ts`**

Append:

```ts
/**
 * Exact money: always two decimals, sign outside the $ ("$4.00", "-$12.50").
 * The result-card / narration / EV-readout style — never rounds cents away.
 */
export function formatCentsExact(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

/**
 * Compact cabinet money: sub-dollar shows cents ("25¢"), whole dollars drop
 * the decimals ("$1"), the rest keeps two places ("$1.25") — so a cash deck
 * never shows "$0.25" or "$1.00". (Moved verbatim from useLockReel's money().)
 */
export function formatCentsCompact(cents: number): string {
  if (cents < 100) return `${Math.round(cents)}¢`
  const d = cents / 100
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert `useLockReel.ts`**

- Add import: `import { formatCentsCompact } from '~/utils/format'`
- Delete the local `money()` function (lines 40-49, including its doc comment).
- Replace every `money(` call with `formatCentsCompact(` — sites: `creditsToDollars` (:81), `collectDollars` (:144), `betDollars` (:149), `betChips` (:160), `resultOutcome`'s `banked` (:264).
- Replace `minDollars` body (:151-156):

```ts
  const minDollars = computed((): string => {
    const d = def.value
    if (d === null) return '—'
    return formatCentsCompact(d.denominationCents)
  })
```

(Byte-identical for the real def: denomination is 25¢ → `25¢` either way.)

- [ ] **Step 6: Convert `useBlackjackReel.ts`**

- Add import: `import { formatCentsExact } from '~/utils/format'`
- `:60` → `const cashValueDollars = computed(() => formatCentsExact(cashValueCents.value))`
- `:61-64` →

```ts
  const anteDollars = computed((): string => {
    const d = def.value
    return d === null ? '$0.00' : formatCentsExact(betCoins.value * d.denominationCents)
  })
```

- `:80` (inside `altitudeMarks`) → `dollars: formatCentsExact(betCoins.value * m * d.denominationCents),`
- Leave `betChips`' `` `$${c}` `` (:87) alone — it formats coin counts, not cents.

- [ ] **Step 7: Convert `app/utils/outcomeText.ts`**

- Add import: `import { formatCentsExact, formatCredits } from '~/utils/format'`
- Lock branch `:14` → `const dollars = (credits: number): string => formatCentsExact(credits * def.denominationCents)`
- `:23` `collect.credits.toLocaleString('en-US')` → `formatCredits(collect.credits)`
- `:27` `Math.floor(bankrollCents / def.denominationCents).toLocaleString('en-US')` → `formatCredits(Math.floor(bankrollCents / def.denominationCents))`
- Blackjack branch `:31` → same `dollars` replacement as :14
- `:33-35`: replace each `dollars(bankrollCents / def.denominationCents)` with `formatCentsExact(bankrollCents)` (same value, straight route)
- `:41, :47, :48, :56, :64, :66`: each `X.toLocaleString('en-US')` → `formatCredits(X)`

- [ ] **Step 8: Convert the cascade pair + XrayPanel**

`app/composables/useCascade.ts` — add `formatCentsExact` to its imports from `~/utils/format` (or create the import), then in `classify` replace the local helper line

```ts
    const dollars = (c: number): string => '$' + (c / 100).toFixed(2)
```

with

```ts
    const dollars = (c: number): string => formatCentsExact(c)
```

`app/components/game/ReelCascade.vue` (:32-33) — add `formatCentsExact` to the imports and replace:

```ts
const usd = (credits: number): string => formatCentsExact(credits * (c.def.value?.denominationCents ?? 1))
const usdCents = (cents: number): string => formatCentsExact(cents)
```

(Temple's denomination is 1¢, so `usd` is byte-identical today — and no longer silently wrong for a future cascade machine at a bigger denom.)

`app/components/game/XrayPanel.vue` (:91) — add `formatCentsExact` to the existing `~/utils/format` import and replace:

```ts
    const toDollars = (perCoin: number): string => formatCentsExact(perCoin * bj.ante * d.denominationCents)
```

- [ ] **Step 9: Run every suite that asserts money strings**

Run: `pnpm vitest run tests/format.test.ts tests/store.test.ts tests/components`
Expected: PASS with zero assertion edits — if any dollar-string assertion fails, the conversion changed output; fix the conversion, never the assertion.

- [ ] **Step 10: Lint and commit**

```bash
pnpm lint
git add app/utils/format.ts app/utils/outcomeText.ts app/composables/useLockReel.ts app/composables/useBlackjackReel.ts app/composables/useCascade.ts app/components/game/ReelCascade.vue app/components/game/XrayPanel.vue tests/format.test.ts
git commit -m "refactor(format): one money formatter family — retire 7 hand-rolled dollar strings"
```

---

### Task 5: Derive displayed-RTP assertions from the engine

**Files:**
- Modify: `tests/machines-pachislo.test.ts` (add an engine-side freeze)
- Modify: `tests/components/parSheet.test.ts` (:30-42 stock-rush, :83-92 lock-reel)
- Modify: `tests/components/xrayLockReel.test.ts` (:34)

**Interfaces:**
- Consumes: `exactRtp` from `../../app/engine`, `formatPercent` from `../../app/utils/format`.
- Produces: nothing.

Why: the component tests hardcode `'91.5013%'` / `'94.5073%'` — strings that drift silently if the engine changes. Fix has two halves: (1) the *engine-side* exact value must be frozen in an engine test (lock-reel already is, `tests/machines-lockreel.test.ts:156` → `0.9450725862575409`; stock-rush is NOT — add it), then (2) the *component* tests derive their expected string from `exactRtp` the same way the component does, so they test render-parity, not a transcription.

- [ ] **Step 1: Print the exact stock-rush default-level RTP**

Run:

```bash
pnpm tsx -e "import { exactRtp } from './app/engine'; import { STOCK_RUSH } from './app/machines/stock-rush'; console.log(exactRtp(STOCK_RUSH).rtpPerCoin.toFixed(16))"
```

Expected: a number ≈ `0.915013…` (the PAR sheet shows it as 91.5013%). Record the full printed value — call it `R` below.

- [ ] **Step 2: Freeze it engine-side**

In `tests/machines-pachislo.test.ts`, inside the top-level describe (mirroring `tests/machines-lockreel.test.ts:154-156`; add imports for `exactRtp` from `../app/engine` and `STOCK_RUSH` from `../app/machines/stock-rush` if not present):

```ts
  it('freezes the exact default-level rtpPerCoin', () => {
    // The published number (README, PAR sheet: 91.5013%). If this moves, the
    // machine's math changed — update docs deliberately, never casually.
    expect(exactRtp(STOCK_RUSH).rtpPerCoin).toBeCloseTo(R, 6) // R = value from Step 1
  })
```

Run: `pnpm vitest run tests/machines-pachislo.test.ts` → PASS.

- [ ] **Step 3: Derive the parSheet assertions**

In `tests/components/parSheet.test.ts`, add imports:

```ts
import { exactRtp } from '../../app/engine'
import { formatPercent } from '../../app/utils/format'
```

Stock-rush test (:30-42): change the destructure to `const { store, wrapper } = setup('stock-rush')` and replace

```ts
    expect(wrapper.text()).toContain('91.5013%')
```

with

```ts
    // Derived exactly the way the modal computes it (ParSheetModal.vue:35-38);
    // the engine-side frozen value lives in tests/machines-pachislo.test.ts.
    const report = exactRtp(store.currentDef!, { oddsLevel: store.currentState!.pachislo!.oddsLevel })
    expect(report.rtpPerCoin).toBeGreaterThan(0.5) // guard against a degenerate derivation
    expect(report.rtpPerCoin).toBeLessThan(1.05)
    expect(wrapper.text()).toContain(formatPercent(report.rtpPerCoin, 4))
```

Lock-reel math test (:83-92): change the destructure to `const { store, wrapper } = setup('stop-and-lock-777')` and replace

```ts
    expect(text).toContain('94.5073%')
```

with

```ts
    // Engine-side frozen value: tests/machines-lockreel.test.ts:154-156.
    const report = exactRtp(store.currentDef!, { coins: store.currentBet })
    expect(report.rtpPerCoin).toBeGreaterThan(0.5)
    expect(report.rtpPerCoin).toBeLessThan(1.05)
    expect(text).toContain(formatPercent(report.rtpPerCoin, 4))
```

- [ ] **Step 4: Derive the xrayLockReel assertion**

In `tests/components/xrayLockReel.test.ts`, the panel renders `formatPercent(lockOdds.rtpPerCoin, 4)` from `lockReelExactRtp` (XrayPanel.vue:122,447). Add the same two imports as Step 3 (adjust relative paths to `../../app/...`), locate how the test obtains its machine def/store, and replace line 34's

```ts
    expect(text).toContain('94.5073%') // RTP
```

with

```ts
    const report = exactRtp(store.currentDef!, { coins: store.currentBet })
    expect(text).toContain(formatPercent(report.rtpPerCoin, 4)) // engine-frozen in machines-lockreel.test.ts
```

(If the test file has no `store` in scope at that line, derive from the def it already imports: `exactRtp(STOP_AND_LOCK_777, { coins: 1 })` — the store's default lock-reel bet is 1 coin, `app/stores/slots.ts:57-64`.)

- [ ] **Step 5: Run and verify**

Run: `pnpm vitest run tests/machines-pachislo.test.ts tests/components/parSheet.test.ts tests/components/xrayLockReel.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint
git add tests/machines-pachislo.test.ts tests/components/parSheet.test.ts tests/components/xrayLockReel.test.ts
git commit -m "test(rtp): freeze stock-rush engine RTP; derive displayed-RTP assertions from the engine"
```

---

### Task 6: Glossary — anchors, 11 new headwords, nav link

**Files:**
- Modify: `app/pages/learn/glossary.vue`
- Modify: `app/layouts/default.vue` (:20-24 `navItems`)
- Modify: `tests/components/learnPages.test.ts` (glossary describe, :120-139)

**Interfaces:**
- Consumes: nothing.
- Produces: per-entry anchor ids on `/learn/glossary` — **Tasks 7 and 8 link to `#rtp`, `#hit-frequency`, `#volatility`**; ids are the kebab-case values listed in Step 3.

Why: the glossary is reachable from exactly one place (the /learn hub card) and is missing ~11 terms the app's own UI displays (Bankroll, Wild, Multiplier, EV, Risk of ruin, Drawdown, sd/coin, Flag/Stock/Slip, jackpot tiers).

- [ ] **Step 1: Write the failing tests**

In `tests/components/learnPages.test.ts`, add to the `describe('glossary', ...)` block:

```ts
  it('defines the terms the app itself displays', () => {
    const w = mount(Glossary, { global: { stubs } })
    const t = w.text().toLowerCase()
    for (const term of [
      'bankroll', 'drawdown', 'expected value', 'wild', 'multiplier',
      'risk of ruin', 'standard deviation', 'flag', 'stock', 'slip',
      'jackpot tiers'
    ]) {
      expect(t, `glossary must define "${term}"`).toContain(term)
    }
  })

  it('gives every entry a unique anchor id for deep links', () => {
    const w = mount(Glossary, { global: { stubs } })
    const ids = w.findAll('dl > div').map(d => d.attributes('id'))
    expect(ids.length).toBeGreaterThanOrEqual(29)
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    for (const anchor of ['rtp', 'hit-frequency', 'volatility', 'house-edge', 'drawdown']) {
      expect(ids, `anchor "${anchor}" must exist`).toContain(anchor)
    }
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/learnPages.test.ts -t glossary`
Expected: FAIL (missing terms, missing ids).

- [ ] **Step 3: Extend `glossary.vue`**

(a) Interface gains an id: `interface Entry { id: string, term: string, def: string, link?: { to: string, label: string } }`

(b) Give every EXISTING entry its id, in place: `coin-in`, `credits`, `denomination`, `free-spins`, `hit-frequency`, `hold-and-spin`, `house-edge`, `ldw`, `near-miss`, `par-sheet`, `payline`, `progressive`, `rtp`, `scatter`, `skill-stop`, `tumble`, `virtual-reel`, `volatility`, `ways`.

(c) Insert these 11 new entries in alphabetical order by `term`:

```ts
  { id: 'bankroll', term: 'Bankroll', def: 'The money you walked in with — the pot every bet drains and every win refills. All slot math is written against it: the house edge grinds a fixed share of everything wagered out of it, quietly, over time.', link: { to: '/learn/house-edge', label: 'the grind, quantified' } },
  { id: 'drawdown', term: 'Drawdown (max drawdown)', def: 'How far below your session\'s best point you have sunk — peak minus now. "Max drawdown" is the deepest that dip ever got: the stomach-drop number that decides whether a session felt survivable.' },
  { id: 'ev', term: 'Expected value (EV)', def: 'The long-run average of a bet: every outcome weighted by its probability. A $1 spin at 90% RTP has an EV of −10¢ — the fee you pay for the ride, invisible per spin, inevitable per thousand.' },
  { id: 'flag', term: 'Flag (pachislo)', def: 'The internal lottery result drawn the instant you bet on a pachislo machine — it decides whether this game may pay before you touch a button. Your stops just carry out the verdict.', link: { to: '/learn/pachislo', label: 'the lottery and the slip' } },
  { id: 'jackpot-tiers', term: 'Jackpot tiers (Mini / Minor / Major / Grand)', def: 'The ladder of prizes many machines dangle, small to huge. The small tiers hit often enough to keep hope alive; the Grand exists mostly to be photographed.' },
  { id: 'multiplier', term: 'Multiplier', def: 'A factor applied to a win (×2, ×5…). Machines differ on whether several multipliers add (2+3 = ×5) or multiply (2×3 = ×6) — the difference is enormous, and the marquee rarely says which.', link: { to: '/learn/gargoyles-eye', label: 'additive vs multiplicative, worked' } },
  { id: 'risk-of-ruin', term: 'Risk of ruin', def: 'The probability you lose the whole bankroll before you stop. Not a feeling — a measurable number: run thousands of simulated sessions and count the busts.', link: { to: '/sim-lab', label: 'measure it live' } },
  { id: 'sd-per-coin', term: 'Standard deviation (sd/coin)', def: 'The volatility number on the machine cards: how far one spin\'s result typically swings from the average, per coin bet. Higher sd = wilder ride at the same RTP.' },
  { id: 'slip', term: 'Slip (pachislo)', def: 'The machine\'s quiet correction after a skill stop: it may slide the reel up to four symbols past where you pressed, so the outcome obeys the flag lottery — not your timing.', link: { to: '/learn/pachislo', label: 'watch the slip work' } },
  { id: 'stock', term: 'Stock (pachislo)', def: 'A bonus the lottery has already awarded but the machine is still holding back, to be released a few games later. Stock-era machines used it to smooth payouts — and to make streaks feel real.', link: { to: '/learn/pachislo', label: 'the stock meter, live' } },
  { id: 'wild', term: 'Wild', def: 'A symbol that stands in for others to complete a win — and often multiplies the pay when it does. Wilds are why paytables have footnotes.' }
```

(d) In the template, anchor each entry:

```html
      <div
        v-for="e in entries"
        :id="e.id"
        :key="e.term"
        class="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 scroll-mt-4"
      >
```

- [ ] **Step 4: Add the nav link**

In `app/layouts/default.vue`, extend `navItems`:

```ts
const navItems = [
  { to: '/sim-lab', icon: 'i-lucide-flask-conical', label: 'Sim Lab' },
  { to: '/learn', icon: 'i-lucide-book-open', label: 'Learn' },
  { to: '/learn/glossary', icon: 'i-lucide-book-a', label: 'Glossary' },
  { to: '/history', icon: 'i-lucide-scroll-text', label: 'History' }
]
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/components/learnPages.test.ts`
Expected: PASS (including the pre-existing ≥15-dt and vocabulary tests).

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint
git add app/pages/learn/glossary.vue app/layouts/default.vue tests/components/learnPages.test.ts
git commit -m "feat(learn): glossary anchors + 11 missing headwords + bottom-nav link"
```

---

### Task 7: game→learn links + stat-label glossary anchors

**Files:**
- Create: `app/utils/learnLink.ts`
- Create: `tests/utils/learnLink.test.ts`
- Create: `tests/components/sessionSidebar.test.ts`
- Modify: `app/components/game/SessionSidebar.vue`
- Modify: `app/components/game/CascadeXray.vue`

**Interfaces:**
- Consumes: glossary anchors from Task 6 (`#rtp`, `#hit-frequency`, `#volatility`).
- Produces: `learnLink(def: MachineDef): { to: string, label: string }` from `~/utils/learnLink`.

Why: learn pages link to machines, but no cabinet links back to its explainer — the highest-value/lowest-effort item in the audit. The sidebar "Machine intel" tab (which already shows `def.history` + the stats) gets a contextual link; Temple of Gold has no sidebar, so its always-on teaching panel (`CascadeXray`) gets one too.

- [ ] **Step 1: Write the failing util test**

Create `tests/utils/learnLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { learnLink } from '../../app/utils/learnLink'
import { ALL_MACHINES } from '../../app/machines'

const LEARN_ROUTES = [
  '/learn/house-edge', '/learn/telnaes-reels', '/learn/gargoyles-eye',
  '/learn/hold-and-spin', '/learn/pachislo', '/learn/cascade-tumble',
  '/learn/ldw-near-miss', '/learn/glossary'
]

describe('learnLink', () => {
  it('maps every machine (floor + parked) to an existing learn page', () => {
    for (const def of ALL_MACHINES) {
      const link = learnLink(def)
      expect(LEARN_ROUTES, `${def.id} → ${link.to}`).toContain(link.to)
      expect(link.label.length).toBeGreaterThan(0)
    }
  })

  it('sends machines with their own deep-dive there first', () => {
    const byId = (id: string) => learnLink(ALL_MACHINES.find(d => d.id === id)!)
    expect(byId('ruby-of-gargoyle').to).toBe('/learn/gargoyles-eye')
    expect(byId('dragons-hoard').to).toBe('/learn/hold-and-spin')
    expect(byId('thunder-vault').to).toBe('/learn/hold-and-spin')
    expect(byId('stock-rush').to).toBe('/learn/pachislo')
    expect(byId('diamond-doubler').to).toBe('/learn/telnaes-reels')
    expect(byId('temple-of-gold').to).toBe('/learn/cascade-tumble')
    expect(byId('canal-royale').to).toBe('/learn/ldw-near-miss')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/utils/learnLink.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/utils/learnLink.ts`**

```ts
// app/utils/learnLink.ts
// Every cabinet points back at the /learn explainer that demystifies it — the
// game→learn half of the teaching loop (the learn→game half lives on the learn
// pages themselves).
import type { MachineDef } from '~/engine'

export interface LearnLink { to: string, label: string }

/** Machines whose own feature has a dedicated deep-dive page. */
const BY_ID: Record<string, LearnLink> = {
  'ruby-of-gargoyle': { to: '/learn/gargoyles-eye', label: 'how the Gargoyle\'s Eye multiplier adds up' },
  'dragons-hoard': { to: '/learn/hold-and-spin', label: 'the hold & spin fill math' },
  'thunder-vault': { to: '/learn/hold-and-spin', label: 'the hold & spin fill math' }
}

const BY_FAMILY: Record<MachineDef['family'], LearnLink> = {
  'stepper': { to: '/learn/telnaes-reels', label: 'how virtual reels build near misses' },
  'video': { to: '/learn/ldw-near-miss', label: 'losses disguised as wins, measured live' },
  'bally-em': { to: '/learn/house-edge', label: 'the house edge, machine by machine' },
  'pachislo': { to: '/learn/pachislo', label: 'the flag lottery behind skill stop' },
  'cascade': { to: '/learn/cascade-tumble', label: 'the tumble math' },
  'blackjack-reel': { to: '/learn/house-edge', label: 'the house edge, machine by machine' },
  'lock-reel': { to: '/learn/hold-and-spin', label: 'the hold & spin fill math' }
}

export function learnLink(def: MachineDef): LearnLink {
  return BY_ID[def.id] ?? BY_FAMILY[def.family]
}
```

Run: `pnpm vitest run tests/utils/learnLink.test.ts` → PASS.

- [ ] **Step 4: Write the failing sidebar test**

Create `tests/components/sessionSidebar.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SessionSidebar from '../../app/components/game/SessionSidebar.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }
}

function setup(machineId: string) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100_000)
  store.selectMachine(machineId)
  return { store, wrapper: mount(SessionSidebar, { global: { stubs } }) }
}

describe('SessionSidebar', () => {
  beforeEach(() => localStorage.clear())

  it('machine tab links to the machine\'s learn page', async () => {
    const { wrapper } = setup('diamond-doubler')
    const tab = wrapper.findAll('button').find(b => b.text().includes('Machine intel'))!
    await tab.trigger('click')
    const link = wrapper.find('[data-test="learn-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/learn/telnaes-reels')
  })

  it('stat labels deep-link into the glossary', async () => {
    const { wrapper } = setup('diamond-doubler')
    const tab = wrapper.findAll('button').find(b => b.text().includes('Machine intel'))!
    await tab.trigger('click')
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/learn/glossary#rtp')
    expect(hrefs).toContain('/learn/glossary#hit-frequency')
    expect(hrefs).toContain('/learn/glossary#volatility')
  })
})
```

Run: `pnpm vitest run tests/components/sessionSidebar.test.ts` → FAIL.

- [ ] **Step 5: Extend `SessionSidebar.vue`**

Script: add `import { learnLink } from '~/utils/learnLink'` and

```ts
const learn = computed(() => def.value === null ? null : learnLink(def.value))
```

Template — machine tab (`v-else-if="def"` div): after the closing `</table>` of the intel table, append:

```html
      <NuxtLink
        v-if="learn"
        :to="learn.to"
        data-test="learn-link"
        class="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline underline-offset-2"
      >
        <UIcon
          name="i-lucide-book-open"
          class="w-3 h-3"
        />
        Learn: {{ learn.label }} →
      </NuxtLink>
```

And wrap the three machine-tab stat labels in glossary links (keep the `th` classes as-is; the link goes inside):

```html
              Exact RTP  →  <NuxtLink to="/learn/glossary#rtp" class="underline decoration-dotted underline-offset-2 hover:text-amber-300">Exact RTP</NuxtLink>
              Hit frequency  →  <NuxtLink to="/learn/glossary#hit-frequency" class="underline decoration-dotted underline-offset-2 hover:text-amber-300">Hit frequency</NuxtLink>
              Volatility  →  <NuxtLink to="/learn/glossary#volatility" class="underline decoration-dotted underline-offset-2 hover:text-amber-300">Volatility</NuxtLink>
```

Run: `pnpm vitest run tests/components/sessionSidebar.test.ts` → PASS.

- [ ] **Step 6: Give Temple of Gold its link (no sidebar there)**

In `app/components/game/CascadeXray.vue`, after the last `</section>` (the "See the math" card, before the root `</div>`), append:

```html
    <p class="cx-foot">
      <NuxtLink
        to="/learn/cascade-tumble"
        class="cx-learn"
      >📖 Learn: the tumble math — why exact cascade RTP is hard →</NuxtLink>
    </p>
```

And in its `<style scoped>`, after `.cx-foot`:

```css
.cx-learn { color: #ffd24a; text-decoration: underline; text-underline-offset: 2px; }
.cx-learn:hover { color: #ffe58a; }
```

- [ ] **Step 7: Lint, run, commit**

```bash
pnpm lint
pnpm vitest run tests/utils/learnLink.test.ts tests/components/sessionSidebar.test.ts tests/components/learnPages.test.ts
git add app/utils/learnLink.ts app/components/game/SessionSidebar.vue app/components/game/CascadeXray.vue tests/utils/learnLink.test.ts tests/components/sessionSidebar.test.ts
git commit -m "feat(learn): every cabinet links to its explainer; sidebar stats deep-link the glossary"
```

---

### Task 8: Inline jargon glosses

**Files:**
- Modify: `app/components/game/BetControls.vue` (:9-16)
- Modify: `app/components/floor/MachineCard.vue` (:119-129)
- Modify: `app/components/lab/LabStatCards.vue`
- Create: `tests/components/labStatCards.test.ts`
- Verify: `tests/components/betControls.test.ts` still green

**Interfaces:**
- Consumes: glossary route from Task 6.
- Produces: nothing.

Why: the owner's rule is "always define jargon in plain English at point of use." Three offenders: BetControls' fixed-bet reasons ("243 ways", "stock-era"), MachineCard's bare stat labels (inside a `<button>`, so links are illegal HTML — use `title` tooltips), and the Sim Lab stat cards ("Risk of ruin", "Max drawdown" as bare numbers).

- [ ] **Step 1: Reword BetControls' fixed-bet reasons**

In `app/components/game/BetControls.vue` replace the three returns in `fixedReason` (:12-14):

```ts
  if (d.family === 'video' && d.betMode.kind === 'ways') return 'Fixed bet — one price buys all 243 ways (any left-to-right match can pay)'
  if (d.family === 'video' && d.fixedBet) return 'Fixed bet — the bonus features only arm when every line is covered'
  if (d.family === 'pachislo') return `Full bet required — real pachislo machines only enter the bonus lottery at the full ${d.maxCoins}-token bet`
```

Run: `pnpm vitest run tests/components/betControls.test.ts`
Expected: PASS (the `/all 243 ways/i` assertion still matches).

- [ ] **Step 2: Tooltip the MachineCard stat labels**

In `app/components/floor/MachineCard.vue` (:123-127), the card is a `<button>` — links inside are invalid HTML, so gloss with `title`:

```html
      <span class="text-neutral-400" title="Return to player — the share of all wagers this machine pays back over the long run">RTP</span><span class="text-emerald-400 text-right">{{ formatPercent(intel.rtp, 4) }}</span>
      <span class="text-neutral-400" title="How often a spin pays anything at all — including 'wins' smaller than the bet">Hit freq</span><span class="text-neutral-300 text-right">{{ formatPercent(intel.hitFrequency) }}</span>
      <span class="text-neutral-400" title="How wild the ride is at the same RTP — standard deviation per coin bet">Volatility</span><span class="text-neutral-300 text-right">{{ intel.sdPerCoin.toFixed(2) }} sd/coin</span>
      <template v-if="intel.topAwardProbability !== null">
        <span class="text-neutral-400" title="Odds of this machine's biggest prize at the current bet">Top award</span><span class="text-neutral-300 text-right">{{ formatOdds(intel.topAwardProbability) }}</span>
      </template>
```

- [ ] **Step 3: Write the failing LabStatCards test**

Create `tests/components/labStatCards.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LabStatCards from '../../app/components/lab/LabStatCards.vue'
import type { SimLabResult } from '../../app/engine/sessions'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

// Only the fields the card grid reads matter for this display test.
const result = {
  machineId: 'diamond-doubler',
  riskOfRuin: 0.25,
  pctAhead: 0.3,
  medianEnd: 50,
  meanEnd: 60,
  avgSpins: 120,
  avgMaxDrawdown: 40,
  empiricalRtp: 0.9,
  houseEdge: 0.1
} as unknown as SimLabResult

describe('LabStatCards', () => {
  it('glosses every stat in plain English and links the glossary', () => {
    setActivePinia(createPinia())
    const w = mount(LabStatCards, { props: { result }, global: { stubs } })
    // every card carries a plain-English title gloss
    const cards = w.findAll('[data-test="lab-stat"]')
    expect(cards.length).toBe(8)
    for (const c of cards) {
      expect((c.attributes('title') ?? '').length, `${c.text()} needs a gloss`).toBeGreaterThan(20)
    }
    // and the footer points at the glossary
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/learn/glossary')
  })
})
```

Run: `pnpm vitest run tests/components/labStatCards.test.ts` → FAIL.

- [ ] **Step 4: Gloss LabStatCards**

Replace `app/components/lab/LabStatCards.vue`'s `cards` computed and template:

```ts
const cards = computed(() => [
  { label: 'Risk of ruin', value: formatPercent(props.result.riskOfRuin), tone: 'rose', gloss: 'The share of simulated sessions that lost the whole bankroll before stopping' },
  { label: 'Ended ahead', value: formatPercent(props.result.pctAhead), tone: 'emerald', gloss: 'The share of sessions that walked away with more than they started' },
  { label: 'Median end', value: formatCents(toCents(props.result.medianEnd)), tone: 'neutral', gloss: 'Half the sessions ended with less than this, half with more' },
  { label: 'Mean end', value: formatCents(toCents(props.result.meanEnd)), tone: 'neutral', gloss: 'The average ending bankroll across all simulated sessions' },
  { label: 'Avg session length', value: `${Math.round(props.result.avgSpins)} spins`, tone: 'neutral', gloss: 'Average paid spins before a session ended (bust, goal, or spin cap)' },
  { label: 'Avg max drawdown', value: formatCents(toCents(props.result.avgMaxDrawdown)), tone: 'amber', gloss: 'Average deepest dip below a session\'s best point — the stomach-drop number' },
  { label: 'Empirical RTP', value: formatPercent(props.result.empiricalRtp, 2), tone: 'neutral', gloss: 'What these simulated sessions actually paid back, as a share of all coin-in' },
  { label: 'House edge', value: formatPercent(props.result.houseEdge, 2), tone: 'amber', gloss: 'One minus RTP: the share of every wager the machine keeps, on average' }
])
```

Template — wrap the grid so a footer fits, add `data-test` + `:title`:

```html
<template>
  <div class="space-y-2">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="c in cards"
        :key="c.label"
        data-test="lab-stat"
        :title="c.gloss"
        class="rounded-xl bg-neutral-900/70 border border-neutral-800 px-3 py-2"
      >
        <div class="text-[10px] uppercase tracking-widest text-neutral-400">
          {{ c.label }}
        </div>
        <div
          class="text-lg font-mono"
          :class="toneClass[c.tone]"
        >
          {{ c.value }}
        </div>
      </div>
    </div>
    <p class="text-[10px] text-neutral-500">
      Hover any card for a plain-English definition — or read the
      <NuxtLink
        to="/learn/glossary"
        class="text-amber-400/80 hover:text-amber-300 underline underline-offset-2"
      >glossary</NuxtLink>.
    </p>
  </div>
</template>
```

- [ ] **Step 5: Run, lint, commit**

```bash
pnpm vitest run tests/components/labStatCards.test.ts tests/components/betControls.test.ts tests/components/labForm.test.ts
pnpm lint
git add app/components/game/BetControls.vue app/components/floor/MachineCard.vue app/components/lab/LabStatCards.vue tests/components/labStatCards.test.ts
git commit -m "feat(copy): plain-English glosses where jargon appears at point of use"
```

---

### Task 9: One CabinetToolbar + one cabinet page shell

**Files:**
- Create: `app/components/game/CabinetToolbar.vue` (auto-imports as `<GameCabinetToolbar>`)
- Create: `tests/components/cabinetToolbar.test.ts`
- Modify: `app/pages/game.vue` (script :8-11 area, four toolbar blocks :76-97/:112-134/:152-174/:187-210, style block :252-345)

**Interfaces:**
- Consumes: `store.settings.xray`, `store.setXray`, `GameParSheetModal`.
- Produces: `<GameCabinetToolbar />` used by all four family shells.

Why: the identical X-ray + PAR toolbar is copy-pasted 4× in `game.vue`, and the three bespoke page shells' CSS is byte-identical except one background and one sidebar width. Nothing else in the app references the `.tg-page`/`.sl-page`/`.l21-page` class families (verified 2026-07-09), so the merge is contained to this file.

- [ ] **Step 1: Write the failing component test**

Create `tests/components/cabinetToolbar.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CabinetToolbar from '../../app/components/game/CabinetToolbar.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  GameParSheetModal: { props: ['open'], template: '<div data-test="par-modal" :data-open="String(open)" />' }
}

describe('CabinetToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('toggles the store X-ray flag and mirrors it on aria-pressed', async () => {
    const store = useSlotsStore()
    const w = mount(CabinetToolbar, { global: { stubs } })
    const xray = w.findAll('button').find(b => b.text().includes('X-ray'))!
    expect(xray.attributes('aria-pressed')).toBe('false')
    await xray.trigger('click')
    expect(store.settings.xray).toBe(true)
    expect(xray.attributes('aria-pressed')).toBe('true')
  })

  it('opens the PAR sheet modal', async () => {
    const w = mount(CabinetToolbar, { global: { stubs } })
    expect(w.find('[data-test="par-modal"]').attributes('data-open')).toBe('false')
    const par = w.findAll('button').find(b => b.text().includes('PAR sheet'))!
    await par.trigger('click')
    expect(w.find('[data-test="par-modal"]').attributes('data-open')).toBe('true')
  })
})
```

Run: `pnpm vitest run tests/components/cabinetToolbar.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implement the component**

Create `app/components/game/CabinetToolbar.vue`:

```vue
<!-- app/components/game/CabinetToolbar.vue -->
<!-- The X-ray toggle + PAR-sheet button + modal every cabinet page shows.
     One component so the four family shells can't drift apart. -->
<script setup lang="ts">
import { ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'

const store = useSlotsStore()
const parOpen = ref(false)
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2">
    <UButton
      :color="store.settings.xray ? 'primary' : 'neutral'"
      :variant="store.settings.xray ? 'solid' : 'outline'"
      :aria-pressed="store.settings.xray"
      size="xs"
      icon="i-lucide-scan-line"
      @click="store.setXray(!store.settings.xray)"
    >
      X-ray
    </UButton>
    <UButton
      color="neutral"
      variant="outline"
      size="xs"
      icon="i-lucide-file-spreadsheet"
      @click="parOpen = true"
    >
      PAR sheet
    </UButton>
    <GameParSheetModal v-model:open="parOpen" />
  </div>
</template>
```

Run: `pnpm vitest run tests/components/cabinetToolbar.test.ts` → PASS.

- [ ] **Step 3: Rewire `game.vue`'s template + script**

- Script: delete `const parOpen = ref(false)` (:9) and drop `ref` from the vue import if now unused.
- Replace each of the three bespoke `<div class="tg-side-tools">…</div>` / `sl-side-tools` / `l21-side-tools` blocks (each containing the two UButtons + `GameParSheetModal`) with exactly:

```html
        <GameCabinetToolbar />
```

- Replace the standard shell's toolbar block (:187-210, the `<div class="flex items-center justify-end">…</div>` wrapper and everything inside) with exactly:

```html
    <GameCabinetToolbar />
```

- [ ] **Step 4: Merge the three page shells**

Template class renames:
- `class="tg-page"` → `class="cab-page cab-page--tg"`; `tg-page-grid`→`cab-page-grid`; `tg-page-main`→`cab-page-main`; `tg-page-side`→`cab-page-side`
- `class="sl-page"` → `class="cab-page cab-page--sl"`; same grid/main/side renames
- `class="l21-page"` → `class="cab-page cab-page--l21"`; same renames

Replace the ENTIRE `<style scoped>` block with:

```css
/* One full-bleed cabinet shell for the three bespoke pages — each modifier
   sets only its backdrop and sidebar width. */
.cab-page {
  position: relative;
  min-height: 100%;
  padding: 24px 14px 40px;
  background: var(--cab-bg);
}
.cab-page-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 1024px) {
  .cab-page-grid { grid-template-columns: minmax(0, 1fr) var(--cab-side, 300px); }
}
.cab-page-main { min-width: 0; }
.cab-page-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Temple of Gold — Aztec-gold temple backdrop */
.cab-page--tg { --cab-bg: radial-gradient(120% 90% at 50% 0%, #4a3410 0%, #2a1c06 40%, #0c0802 100%); --cab-side: 320px; }
/* Stop & Lock 777 — steel-room backdrop */
.cab-page--sl { --cab-bg: radial-gradient(120% 90% at 50% 0%, #3a4250 0%, #20252e 42%, #0c0f15 100%); }
/* Flameout 21 — the demo's green-felt backdrop */
.cab-page--l21 { --cab-bg: radial-gradient(120% 90% at 50% 0%, #15725a 0%, #0c4a37 38%, #04221a 100%); }
```

- [ ] **Step 5: Typecheck + component suite (game.vue has no page test — the type layer is its gate)**

Run: `pnpm typecheck && pnpm vitest run tests/components`
Expected: both clean.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint
git add app/components/game/CabinetToolbar.vue app/pages/game.vue tests/components/cabinetToolbar.test.ts
git commit -m "refactor(game): one CabinetToolbar + one cabinet page shell (was 4x + 3x copies)"
```

---

### Task 10: Full gates, CHANGELOG, browser smoke

**Files:**
- Modify: `CHANGELOG.md` (Unreleased section)

- [ ] **Step 1: CHANGELOG entries**

Add under the existing `## [Unreleased]` heading (create the subsections if absent, matching the file's existing style):

```markdown
### Added
- Storage-version notice: an incompatible saved session now explains itself on the floor instead of silently starting fresh.
- Glossary: 11 new headwords the UI already used (bankroll, drawdown, EV, flag/stock/slip, jackpot tiers, multiplier, risk of ruin, sd/coin, wild), per-term anchor ids, and a bottom-nav Glossary link.
- Game→learn loop: every cabinet's sidebar (and Temple of Gold's teaching panel) links to its family's /learn explainer; sidebar stat labels deep-link into the glossary.
- Plain-English glosses at point of use: bet-control fixed-bet reasons, floor-card stat tooltips, Sim Lab stat-card tooltips + glossary footer.

### Changed
- Netlify deploy gate now runs typecheck + a 250k-spin verify (was lint+test only); CI and Netlify install with a frozen lockfile.
- CI test step enforces v8 coverage thresholds (S86/B77/F88/L89 — ~2pts under the 2026-07-09 baseline).
- Money formatting unified into formatCentsExact/formatCentsCompact; seven hand-rolled dollar renderers retired (rendered output unchanged).
- PAR-sheet/X-ray RTP test assertions are derived from the engine (stock-rush's exact RTP is now frozen engine-side, like lock-reel's).
- game.vue: the four copy-pasted X-ray/PAR toolbars are one CabinetToolbar component; the three bespoke page shells share one .cab-page CSS family.
```

- [ ] **Step 2: The full repo gate**

Run: `pnpm check`
Expected: lint clean, typecheck clean, all tests pass, `verify` 10/10 at 5M spins. This is the owner's own gate — do not skip pieces.

- [ ] **Step 3: Browser smoke (render bugs don't show up in unit tests — repo lesson)**

Start `pnpm dev`, then verify in a real browser:
1. Floor: no notice banner; nav shows Sim Lab / Learn / Glossary / History; Glossary link works and anchors scroll (`/learn/glossary#rtp`).
2. DevTools console: `localStorage.setItem('slots-simulator-session', JSON.stringify({v: 99}))` → reload → amber notice appears; Dismiss removes it.
3. Start a session → Diamond Doubler: toolbar X-ray toggles panel, PAR sheet opens (strips/paytable/math tabs), sidebar "Machine intel" shows the Learn link → follows to /learn/telnaes-reels; stat labels navigate to glossary anchors.
4. Temple of Gold: page background/layout unchanged, toolbar works, CascadeXray footer Learn link present, spin once (result strings render normally).
5. Sim Lab: run a small sim → stat cards show tooltips on hover, glossary footer link present.
6. Bet controls on Canal Royale + Stock Rush show the reworded fixed-bet reasons.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG for the 2026-07-09 quick-wins tranche"
```

**NOT pushed** — the owner pushes explicitly, after the off-hours commit-timestamp pass.
