# Plan 1: Engine Foundation + Vintage/Stepper Floor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the metaincognita-slots Nuxt 4 project and build the complete headless engine — RNG, types, award matching, Bally-EM + Telnaes-stepper evaluators, progressive controllers, exact-RTP calculator — with the four pre-calibrated machines (Diamond Doubler, Sevens Ablaze, Series E 3-Line, Series E Multiplier), full Vitest verification, and the `verify-floor` CLI.

**Architecture:** Everything under `app/engine/` is pure TypeScript with no Vue/Nuxt imports. Machines are pure data in `app/machines/`. The same award-matching functions are used by the spin evaluators AND the exact-RTP enumerator, so displayed math and gameplay math cannot diverge. Exact RTP is computed by enumerating symbol tuples with integer weights (alphabet ≤ 8, reels ≤ 5 → ≤ 32,768 tuples; all integer arithmetic stays far below 2^53).

**Tech Stack:** Nuxt 4.4 SPA (ssr:false), TypeScript strict, @nuxt/ui 4.6, Pinia 3 (installed, unused until Plan 3), Vitest 4, pnpm 10.33, tsx for CLI scripts.

**Spec:** `docs/superpowers/specs/2026-06-12-slots-simulator-design.md`

**Roadmap context:** This is Plan 1 of 4. Plan 2 = video + pachislo families. Plan 3 = UI (store, shell, floor, game page, X-ray, PAR sheet, history). Plan 4 = Sim Lab worker, learn page, CI polish, Netlify deploy. Each plan lands working, testable software.

**Conventions for every commit:** descriptive message, **NO AI co-author trailers** (user rule). Work on `main` (family convention — solo-dev repos commit to main). Run `pnpm test` AND `pnpm lint` before each commit (the eslint stylistic config may disagree with plan snippets — `pnpm exec eslint . --fix` then resolve the rest by hand; never change test semantics to satisfy style).

---

## Numbers provenance (read first)

The four machines below were **calibrated during planning by exact enumeration** (Python, integer/Fraction arithmetic — no simulation, no rounding). The TypeScript `exactRtp()` must reproduce these values exactly; the "frozen" tests assert them to 6 decimal places. **If a frozen test fails, the evaluator semantics diverged from this plan — fix the code, never the frozen number.**

| Machine | Frozen exact RTP | Hit freq | Key event |
|---|---|---|---|
| diamond-doubler | **94.744245%** per coin (= 117877/124416) | 14.667460% | P(3×DW) = 12/72³ = 1/31,104 |
| sevens-ablaze | **94.488115%** per coin @ 2 coins, meter at reset 2000 | 15.719307% | P(3×F7) = 27/72³ = 1/13,824 |
| series-e-3line | **89.035073%** per line (= 104285/117128), jackpot at live-average 3000 | 11.814445% | P(5×S7 run) = 1/22⁵ = 1/5,153,632 |
| series-e-multiplier | **89.126400%** per coin @ 3 coins (= 13926/15625); **85.030400%** @ 1–2 coins | 14.255872% (= 55687/390625) | P(4×S7 run) = 16/25⁴ = 1/24,414.06 |

Award-matching semantics that produced these numbers (the TS code in Tasks 3/6/8 encodes exactly this):

- **Bally-EM (`run`/`allOf` paytable):** awards match on **exact left-run length** (a left-run of 4 does NOT match a length-3 entry; every length is its own entry). `allOf` matches when every cell equals the symbol. First matching entry in paytable order wins (entries are mutually exclusive by construction, so order is belt-and-suspenders).
- **Stepper (max-pay-wins):** every entry is tested; the **highest pay wins**. `allWild` matches only all-wilds (flat pay, no multiplier). `allSame`/`anyOf` allow wild substitution but NOT all-wilds (guard: `wildCount < lineLength`), and multiply pay by `wildMultiplier^wildCount`. `count` entries count **actual** symbols only (no substitution, no multiplier).
- Uniform-stop machines: every visible row of a 22/25-stop reel is uniform, so all paylines have identical EV — the per-line frozen value applies to every line.
- Percent-meter breakage: a progressive hit pays `floor(meter)` and resets to exactly `reset`, discarding the sub-credit remainder (~1.8e-5 RTP per coin — far below every test tolerance). Real machines carry breakage on-meter (MGC rules); flagged as an authenticity backlog item for a later plan, not v0.1.

---

## File structure (Plan 1 complete map)

```
package.json  pnpm-workspace.yaml  nuxt.config.ts  tsconfig.json  vitest.config.ts
eslint.config.mjs  netlify.toml  .gitignore  .github/workflows/ci.yml
CHANGELOG.md  README.md
app/
  app.vue                       # minimal UApp shell
  assets/css/main.css           # tailwind + @nuxt/ui imports
  pages/index.vue               # stub: lists FLOOR with computed RTPs (proves engine works in-app)
  engine/
    rng.ts                      # mulberry32, cryptoSeed
    types.ts                    # all engine types (single source of truth)
    awards.ts                   # leftRun, ballyAwardForLine, bestStepperAward
    validate.ts                 # validateMachineDef
    exactRtp.ts                 # enumeration: rtp, hit freq, variance, per-entry breakdown
    ballyEm.ts                  # spinBallyEm
    stepper.ts                  # spinStepper
    progressive.ts              # dual/single/percent controllers (FO-5140 semantics)
    index.ts                    # spin() dispatch, initMachineState, simulateMachine
  machines/
    diamond-doubler.ts  sevens-ablaze.ts  series-e-3line.ts  series-e-multiplier.ts  index.ts
scripts/verify-floor.ts
tests/
  rng.test.ts  awards.test.ts  validate.test.ts  exactRtp.test.ts
  ballyEm.test.ts  progressive.test.ts  stepper.test.ts
  machines.test.ts  simulate.test.ts  convergence.test.ts
```

---

### Task 1: Scaffold the project

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `nuxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `netlify.toml`, `.gitignore`, `.github/workflows/ci.yml`, `app/app.vue`, `app/assets/css/main.css`, `app/pages/index.vue`, `CHANGELOG.md`

- [ ] **Step 1: Write config files**

`package.json`:

```json
{
  "name": "metaincognita-slots",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "lint": "eslint .",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "verify": "tsx scripts/verify-floor.ts"
  },
  "dependencies": {
    "@iconify-json/lucide": "^1.2.100",
    "@nuxt/ui": "^4.6.0",
    "@pinia/nuxt": "^0.11.3",
    "nuxt": "^4.4.2",
    "pinia": "^3.0.4",
    "tailwindcss": "^4.2.2"
  },
  "devDependencies": {
    "@nuxt/eslint": "^1.15.2",
    "@vitest/coverage-v8": "^4.1.2",
    "@vue/test-utils": "^2.4.6",
    "eslint": "^10.1.0",
    "happy-dom": "^20.8.9",
    "tsx": "^4.20.0",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2",
    "vue-tsc": "^3.2.6"
  },
  "packageManager": "pnpm@10.33.0"
}
```

`pnpm-workspace.yaml` (pnpm 10 build-script policy, copied from flameout):

```yaml
ignoredBuiltDependencies:
  - '@parcel/watcher'
  - '@tailwindcss/oxide'
  - esbuild
  - unrs-resolver
  - vue-demi
```

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  spaLoadingTemplate: true,

  compatibilityDate: '2025-01-15',

  nitro: {
    preset: 'netlify_static'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    clientBundle: {
      scan: true
    }
  }
})
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    testTimeout: 180_000
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app')
    }
  }
})
```

`eslint.config.mjs`:

```js
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
)
```

`netlify.toml`:

```toml
[build]
  command = "pnpm generate"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
```

(`script-src` needs `'unsafe-inline'`: a Nuxt SPA boots via inline scripts — color-mode pre-paint, the SPA loading template, and `window.__NUXT__.config` — none of which carry a nonce or hash. All six sibling repos ship this value; quality review on Task 1 confirmed `'self'` alone breaks the deployed app.)

```toml
```

`.gitignore`:

```
# Nuxt dev/build outputs
.output
.data
.nuxt
.nitro
.cache
dist

# Node dependencies
node_modules

# Logs
logs
*.log

# Misc
.DS_Store
.fleet
.idea

# Local env files
.env
.env.*
!.env.example

# Manuals (45 MB of scanned PDFs stay untracked)
docs/*.pdf
```

`.github/workflows/ci.yml`:

```yaml
name: ci

on: push

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Install pnpm
        uses: pnpm/action-setup@v5

      - name: Install node
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm run lint

      - name: Typecheck
        run: pnpm run typecheck

      - name: Test
        run: pnpm run test

      - name: Verify floor (1M-spin smoke)
        run: pnpm run verify -- --spins 1000000

      - name: Build
        run: pnpm run build
```

`app/app.vue`:

```vue
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

`app/assets/css/main.css`:

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', 'Courier New', monospace;
}
```

`app/pages/index.vue` (stub — replaced in Plan 3):

```vue
<script setup lang="ts">
// Placeholder floor listing. Real floor page lands in Plan 3.
const machines: { id: string, name: string }[] = []
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-mono">
    <h1 class="text-2xl text-amber-400 mb-4">
      Slots Simulator — engine milestone
    </h1>
    <p class="text-neutral-400 mb-6">
      Headless engine under construction. Run <code>pnpm verify</code> for the floor report.
    </p>
    <ul>
      <li v-for="m in machines" :key="m.id">{{ m.name }}</li>
    </ul>
  </div>
</template>
```

`CHANGELOG.md`:

```markdown
# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Project scaffold (Nuxt 4 SPA, family conventions).
- Headless engine: RNG, award matching, Bally-EM + stepper evaluators,
  FO-5140 progressive controllers, exact-RTP enumeration.
- Calibrated machines: Diamond Doubler, Sevens Ablaze, Series E 3-Line,
  Series E Multiplier.
- `pnpm verify` floor verification CLI.
```

- [ ] **Step 2: Install and verify the toolchain**

Run: `pnpm install`
Expected: completes; `nuxt prepare` runs as postinstall and generates `.nuxt/`.

Run: `pnpm test`
Expected: "No test files found" exit 0 — Vitest 4 exits 0 with `--passWithNoTests`? It does NOT by default; expected output is an error "No test files found". That is fine at this step; tests arrive in Task 2. Alternatively run `pnpm test -- --passWithNoTests` to see a clean pass.

Run: `pnpm dev` (briefly)
Expected: dev server boots at http://localhost:3000 showing the stub page. Ctrl-C after confirming.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Scaffold Nuxt 4 SPA with family conventions (pnpm, @nuxt/ui, Vitest, Netlify static)"
```

---

### Task 2: Seeded RNG

**Files:** Create `app/engine/rng.ts`, `tests/rng.test.ts`

- [ ] **Step 1: Write the failing tests** (`tests/rng.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { mulberry32, cryptoSeed } from '../app/engine/rng'

describe('mulberry32', () => {
  it('is reproducible for a given seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(Array.from({ length: 10 }, () => a()))
      .not.toEqual(Array.from({ length: 10 }, () => b()))
  })

  it('stays in [0, 1)', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 100_000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is uniform across 100 bins (chi-squared, df=99, p=0.001 crit 148.23)', () => {
    const r = mulberry32(20260612)
    const bins = new Array(100).fill(0)
    const n = 1_000_000
    for (let i = 0; i < n; i++) bins[Math.floor(r() * 100)]++
    const expected = n / 100
    const chi2 = bins.reduce((s, o) => s + (o - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(148.23)
  })
})

describe('cryptoSeed', () => {
  it('returns a uint32 and varies', () => {
    const s1 = cryptoSeed()
    const s2 = cryptoSeed()
    expect(Number.isInteger(s1)).toBe(true)
    expect(s1).toBeGreaterThanOrEqual(0)
    expect(s1).toBeLessThanOrEqual(0xFFFFFFFF)
    // astronomically unlikely to collide twice in a row AND with zero
    expect(s1 === s2 && s1 === 0).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/rng.test.ts`
Expected: FAIL — cannot resolve `../app/engine/rng`.

- [ ] **Step 3: Implement** (`app/engine/rng.ts`)

```ts
// Seeded PRNG — same algorithm family as metaincognita-flameout.
// mulberry32: fast, solid 32-bit generator; deterministic per seed so
// simulations and tests are exactly reproducible.

export type RandomFn = () => number

export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Crypto-quality seed for live play; sims pass fixed seeds instead. */
export function cryptoSeed(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0]!
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/rng.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/engine/rng.ts tests/rng.test.ts
git commit -m "Add seeded mulberry32 RNG with chi-squared uniformity test"
```

---

### Task 3: Engine types + award matching

**Files:** Create `app/engine/types.ts`, `app/engine/awards.ts`, `tests/awards.test.ts`

- [ ] **Step 1: Write the types** (`app/engine/types.ts`) — no test for pure type declarations; the compiler is the test.

```ts
// Single source of truth for engine types. Pure data + pure functions only —
// nothing in app/engine may import from Vue, Nuxt, or Pinia.

export type MachineFamily = 'stepper' | 'bally-em'
// Plan 2 extends this union with 'video' and 'pachislo'.

export type SymbolId = string

// ---------- paytables ----------

/** Stepper award. Resolution: every entry is tested, HIGHEST pay wins. */
export type StepperAward =
  | { id: string, kind: 'allWild', pay: number }
  | { id: string, kind: 'allSame', symbol: SymbolId, pay: number, progressiveAtMaxCoins?: boolean }
  | { id: string, kind: 'anyOf', symbols: SymbolId[], pay: number }
  | { id: string, kind: 'count', symbol: SymbolId, n: number, pay: number }

/**
 * Bally-EM award. Resolution: first matching entry wins; `run` matches on
 * EXACT left-run length (list every length separately).
 */
export type BallyAward =
  | { id: string, kind: 'run', symbol: SymbolId, length: number, pay: number, progressive?: 'live' | 'maxCoins' }
  | { id: string, kind: 'allOf', symbol: SymbolId, pay: number }
// progressive: 'live'      → pays the live meter of the dual controller (any coin level)
// progressive: 'maxCoins'  → pays the single meter at max coins, else pay × coins

// ---------- progressives (Bally FO-5140 semantics) ----------

export interface RateStep {
  /** live coins counted before one increment fires */
  coinsPer: number
  /** credits added per increment */
  amount: number
}

export interface MeterConfig {
  reset: number
  max: number
  rate1: RateStep
  /** once value >= rate1Limit, rate2 applies */
  rate1Limit: number
  rate2: RateStep
}

export interface DualProgressiveConfig {
  kind: 'dual'
  upper: MeterConfig
  lower: MeterConfig
  /** coins-in before the live jackpot toggles (FO-5140: 1–255) */
  coinsPerToggle: number
}

export interface SingleProgressiveConfig {
  kind: 'single'
  meter: MeterConfig
}

export interface PercentProgressiveConfig {
  kind: 'percent'
  reset: number
  max: number
  /** fraction of coin-in fed to the meter, e.g. 0.01 */
  feedRate: number
}

export type ProgressiveConfig
  = DualProgressiveConfig | SingleProgressiveConfig | PercentProgressiveConfig

export interface DualProgressiveState {
  kind: 'dual'
  upper: number
  lower: number
  live: 'upper' | 'lower'
  coinsTowardToggle: number
  /** live-coin counters per meter (FO-5140: NOT reset on jackpot hit) */
  upperCoins: number
  lowerCoins: number
}

export interface SingleProgressiveState {
  kind: 'single'
  value: number
  coins: number
}

export interface PercentProgressiveState {
  kind: 'percent'
  value: number
}

export type ProgressiveState
  = DualProgressiveState | SingleProgressiveState | PercentProgressiveState

// ---------- machines ----------

export interface MachineDefBase {
  id: string
  name: string
  family: MachineFamily
  /** denomination of one coin/credit, in cents */
  denominationCents: number
  maxCoins: number
  /** symbol id → display label (glyphs/art arrive in Plan 3) */
  symbols: Record<SymbolId, { label: string }>
  /** prose history connecting the machine to its real-world archetype */
  history: string
}

export interface StepperMachineDef extends MachineDefBase {
  family: 'stepper'
  /** physical strip per reel (length = physical stop count, e.g. 22) */
  physicalStrips: SymbolId[][]
  /**
   * Telnaes virtual reel per physical reel: array of physical stop indices.
   * The RNG draws uniformly over this array; symbol weights = how often each
   * symbol's stops appear here. (Telnaes patent US 4,448,419.)
   */
  virtualMaps: number[][]
  wildSymbol: SymbolId | null
  /** pay multiplier applied per wild in a winning allSame/anyOf line */
  wildMultiplier: number
  paytable: StepperAward[]
  progressive: PercentProgressiveConfig | null
}

export interface BallyEmMachineDef extends MachineDefBase {
  family: 'bally-em'
  /** physical stop count per reel (uniform random — no weighting, pre-Telnaes) */
  stops: number
  strips: SymbolId[][]
  /**
   * 'lines': coin k activates payline k (1=center, 2=+top, 3=+bottom), pays per line.
   * 'multiplier': center line only, pays × coins.
   */
  payMode: 'lines' | 'multiplier'
  paytable: BallyAward[]
  progressive: DualProgressiveConfig | SingleProgressiveConfig | null
}

export type MachineDef = StepperMachineDef | BallyEmMachineDef

// ---------- spin results ----------

export interface MachineSessionState {
  progressive: ProgressiveState | null
}

export interface RngDraw {
  label: string
  /** raw uniform in [0,1) */
  raw: number
  /** integer result derived from raw */
  value: number
  /** size of the integer range */
  range: number
}

export interface VirtualStopTrace {
  reel: number
  virtualIndex: number
  virtualSize: number
  physicalStop: number
  symbol: SymbolId
  /** entries in the virtual map landing on this symbol (the Telnaes weight) */
  weight: number
}

export interface SpinTrace {
  draws: RngDraw[]
  /** stepper only */
  virtualStops?: VirtualStopTrace[]
}

export interface LineWin {
  /** payline label: 'payline' (steppers), 'center' | 'top' | 'bottom' (bally) */
  line: string
  entryId: string
  symbols: SymbolId[]
  payCredits: number
  wildCount: number
  progressive: boolean
}

export interface ProgressiveEvent {
  type: 'hit'
  meter: 'upper' | 'lower' | 'single' | 'percent'
  amountCredits: number
}

export interface SpinOutcome {
  machineId: string
  family: MachineFamily
  coins: number
  /** physical stop index per reel */
  stops: number[]
  /** grid[reel] = visible symbols; bally rows [top, center, bottom], stepper [above, payline, below] */
  grid: SymbolId[][]
  wins: LineWin[]
  totalPayout: number
  progressiveEvents: ProgressiveEvent[]
  trace: SpinTrace
}
```

- [ ] **Step 2: Write the failing award tests** (`tests/awards.test.ts`)

These cases encode the exact semantics the frozen numbers were computed with.

```ts
import { describe, it, expect } from 'vitest'
import { leftRun, ballyAwardForLine, bestStepperAward } from '../app/engine/awards'
import type { BallyAward, StepperAward } from '../app/engine/types'

describe('leftRun', () => {
  it('counts the run from the left', () => {
    expect(leftRun(['S7', 'S7', 'BE'], 'S7')).toBe(2)
    expect(leftRun(['BE', 'S7', 'S7'], 'S7')).toBe(0)
    expect(leftRun(['S7', 'S7', 'S7'], 'S7')).toBe(3)
    expect(leftRun([], 'S7')).toBe(0)
  })
})

describe('ballyAwardForLine — exact-length run + allOf', () => {
  const pays: BallyAward[] = [
    { id: '7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 },
    { id: 'bars', kind: 'allOf', symbol: 'BAR', pay: 150 },
    { id: 'be3', kind: 'run', symbol: 'BE', length: 3, pay: 20 },
    { id: 'ch2', kind: 'run', symbol: 'CH', length: 2, pay: 5 },
    { id: 'ch1', kind: 'run', symbol: 'CH', length: 1, pay: 2 }
  ]

  it('matches an exact run', () => {
    expect(ballyAwardForLine(['S7', 'S7', 'S7'], pays)?.id).toBe('7x3')
  })

  it('a longer run does NOT match a shorter exact-length entry', () => {
    // 4-reel line, run of 4 sevens, but only a length-3 entry exists → no match
    const fourReel: BallyAward[] = [{ id: '7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 }]
    expect(ballyAwardForLine(['S7', 'S7', 'S7', 'S7'], fourReel)).toBeNull()
  })

  it('run must start at reel 1', () => {
    expect(ballyAwardForLine(['BE', 'S7', 'S7'], pays)).toBeNull()
  })

  it('allOf matches only a full line of the symbol', () => {
    expect(ballyAwardForLine(['BAR', 'BAR', 'BAR'], pays)?.id).toBe('bars')
    expect(ballyAwardForLine(['BAR', 'BAR', 'BE'], pays)).toBeNull()
  })

  it('cherry runs pay by exact length', () => {
    expect(ballyAwardForLine(['CH', 'BE', 'BAR'], pays)?.id).toBe('ch1')
    expect(ballyAwardForLine(['CH', 'CH', 'BAR'], pays)?.id).toBe('ch2')
  })
})

describe('bestStepperAward — max pay wins, wild doubling', () => {
  const paytable: StepperAward[] = [
    { id: '3dw', kind: 'allWild', pay: 1000 },
    { id: '3s7', kind: 'allSame', symbol: 'S7', pay: 80 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 40 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 25 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 10 },
    { id: '3ch', kind: 'allSame', symbol: 'CH', pay: 10 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B1', 'B2', 'B3'], pay: 5 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 5 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ]
  const def = { paytable, wildSymbol: 'DW', wildMultiplier: 2 }

  it('three wilds pay allWild flat (not allSame x multiplier)', () => {
    const r = bestStepperAward(['DW', 'DW', 'DW'], def)
    expect(r?.entry.id).toBe('3dw')
    expect(r?.payCredits).toBe(1000)
  })

  it('one wild doubles, two wilds quadruple', () => {
    expect(bestStepperAward(['B1', 'B1', 'DW'], def)?.payCredits).toBe(20)
    expect(bestStepperAward(['B1', 'DW', 'DW'], def)?.payCredits).toBe(40)
    expect(bestStepperAward(['S7', 'DW', 'S7'], def)?.payCredits).toBe(160)
  })

  it('mixed bars pay anyOf, wilds double it, but a pure triple beats it', () => {
    expect(bestStepperAward(['B1', 'B2', 'B3'], def)?.payCredits).toBe(5)
    expect(bestStepperAward(['B1', 'B2', 'DW'], def)?.payCredits).toBe(10) // anybar x2
    expect(bestStepperAward(['B1', 'B1', 'B1'], def)?.entry.id).toBe('3b1') // 10 > 5
  })

  it('count entries see actual symbols only — no wild help, no doubling', () => {
    expect(bestStepperAward(['CH', 'BL', 'BL'], def)?.payCredits).toBe(2)
    expect(bestStepperAward(['CH', 'CH', 'BL'], def)?.payCredits).toBe(5)
    // CH + 2 wilds: allSame CH (10) x4 = 40 beats count(CH,1) = 2
    expect(bestStepperAward(['CH', 'DW', 'DW'], def)?.payCredits).toBe(40)
  })

  it('wild + blanks pay nothing', () => {
    expect(bestStepperAward(['BL', 'DW', 'DW'], def)).toBeNull()
    expect(bestStepperAward(['BL', 'BL', 'BL'], def)).toBeNull()
  })

  it('works without a wild symbol', () => {
    const noWild = { paytable, wildSymbol: null, wildMultiplier: 1 }
    expect(bestStepperAward(['B1', 'B1', 'B1'], noWild)?.payCredits).toBe(10)
    expect(bestStepperAward(['B1', 'B1', 'DW'], noWild)).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- tests/awards.test.ts`
Expected: FAIL — cannot resolve `../app/engine/awards`.

- [ ] **Step 4: Implement** (`app/engine/awards.ts`)

```ts
import type { BallyAward, StepperAward, SymbolId } from './types'

export function leftRun(line: SymbolId[], symbol: SymbolId): number {
  let n = 0
  for (const s of line) {
    if (s === symbol) n++
    else break
  }
  return n
}

/** First matching entry wins. `run` matches EXACT left-run length. */
export function ballyAwardForLine(line: SymbolId[], paytable: BallyAward[]): BallyAward | null {
  for (const entry of paytable) {
    if (entry.kind === 'run') {
      if (leftRun(line, entry.symbol) === entry.length) return entry
    } else {
      if (line.every(s => s === entry.symbol)) return entry
    }
  }
  return null
}

export interface StepperLineResult {
  entry: StepperAward
  wildCount: number
  payCredits: number
}

interface StepperAwardContext {
  paytable: StepperAward[]
  wildSymbol: SymbolId | null
  wildMultiplier: number
}

/** Every entry tested; highest pay wins. See plan "Numbers provenance" for semantics. */
export function bestStepperAward(line: SymbolId[], def: StepperAwardContext): StepperLineResult | null {
  const wild = def.wildSymbol
  const nWild = wild === null ? 0 : line.filter(s => s === wild).length
  let best: StepperLineResult | null = null

  for (const entry of def.paytable) {
    let pay = 0
    let wildCount = 0

    if (entry.kind === 'allWild') {
      if (wild !== null && nWild === line.length) pay = entry.pay
    } else if (entry.kind === 'allSame') {
      if (nWild < line.length && line.every(s => s === entry.symbol || s === wild)) {
        wildCount = nWild
        pay = entry.pay * def.wildMultiplier ** wildCount
      }
    } else if (entry.kind === 'anyOf') {
      if (nWild < line.length && line.every(s => entry.symbols.includes(s) || s === wild)) {
        wildCount = nWild
        pay = entry.pay * def.wildMultiplier ** wildCount
      }
    } else {
      if (line.filter(s => s === entry.symbol).length === entry.n) pay = entry.pay
    }

    if (pay > 0 && (best === null || pay > best.payCredits)) {
      best = { entry, wildCount, payCredits: pay }
    }
  }
  return best
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- tests/awards.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/engine/types.ts app/engine/awards.ts tests/awards.test.ts
git commit -m "Add engine types and award matching (exact-run bally, max-pay stepper with wild doubling)"
```

---

### Task 4: Machine validation

**Files:** Create `app/engine/validate.ts`, `tests/validate.test.ts`

- [ ] **Step 1: Write the failing tests** (`tests/validate.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import type { StepperMachineDef, BallyEmMachineDef } from '../app/engine/types'

function tinyStepper(): StepperMachineDef {
  return {
    id: 'tiny', name: 'Tiny', family: 'stepper',
    denominationCents: 100, maxCoins: 1,
    symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
    physicalStrips: [['A', 'BL'], ['A', 'BL'], ['A', 'BL']],
    virtualMaps: [[0, 1], [0, 1], [0, 1]],
    wildSymbol: null, wildMultiplier: 1,
    paytable: [{ id: '3a', kind: 'allSame', symbol: 'A', pay: 8 }],
    progressive: null,
    history: 'test machine'
  }
}

function tinyBally(): BallyEmMachineDef {
  return {
    id: 'tiny-b', name: 'Tiny B', family: 'bally-em',
    denominationCents: 100, maxCoins: 3,
    symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
    stops: 2,
    strips: [['A', 'BL'], ['A', 'BL'], ['A', 'BL']],
    payMode: 'lines',
    paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 8 }],
    progressive: null,
    history: 'test machine'
  }
}

describe('validateMachineDef', () => {
  it('accepts a well-formed stepper', () => {
    expect(() => validateMachineDef(tinyStepper())).not.toThrow()
  })

  it('accepts a well-formed bally-em', () => {
    expect(() => validateMachineDef(tinyBally())).not.toThrow()
  })

  it('rejects virtual map index out of range', () => {
    const def = tinyStepper()
    def.virtualMaps[0] = [0, 99]
    expect(() => validateMachineDef(def)).toThrow(/virtual map/i)
  })

  it('rejects strips/virtualMaps reel count mismatch', () => {
    const def = tinyStepper()
    def.virtualMaps = [[0, 1], [0, 1]]
    expect(() => validateMachineDef(def)).toThrow(/reel count/i)
  })

  it('rejects paytable symbols missing from the symbol set', () => {
    const def = tinyStepper()
    def.paytable = [{ id: 'bad', kind: 'allSame', symbol: 'ZZ', pay: 5 }]
    expect(() => validateMachineDef(def)).toThrow(/unknown symbol/i)
  })

  it('rejects strip symbols missing from the symbol set', () => {
    const def = tinyBally()
    def.strips[0] = ['A', 'ZZ']
    expect(() => validateMachineDef(def)).toThrow(/unknown symbol/i)
  })

  it('rejects bally strip length mismatch with stops', () => {
    const def = tinyBally()
    def.strips[0] = ['A', 'BL', 'A']
    expect(() => validateMachineDef(def)).toThrow(/stops/i)
  })

  it('rejects allWild entry when machine has no wild', () => {
    const def = tinyStepper()
    def.paytable = [{ id: 'aw', kind: 'allWild', pay: 100 }]
    expect(() => validateMachineDef(def)).toThrow(/wild/i)
  })

  it('rejects anyOf entries listing the wild symbol (would double-apply the wild)', () => {
    const def = tinyStepper()
    def.symbols = { A: { label: 'A' }, W: { label: 'wild' }, BL: { label: 'blank' } }
    def.wildSymbol = 'W'
    def.paytable = [{ id: 'any', kind: 'anyOf', symbols: ['A', 'W'], pay: 5 }]
    expect(() => validateMachineDef(def)).toThrow(/anyOf/i)
  })

  it('rejects count entries targeting the wild symbol', () => {
    const def = tinyStepper()
    def.symbols = { A: { label: 'A' }, W: { label: 'wild' }, BL: { label: 'blank' } }
    def.wildSymbol = 'W'
    def.paytable = [{ id: 'cw', kind: 'count', symbol: 'W', n: 1, pay: 2 }]
    expect(() => validateMachineDef(def)).toThrow(/count/i)
  })

  it('rejects nonpositive pays', () => {
    const def = tinyStepper()
    def.paytable = [{ id: '3a', kind: 'allSame', symbol: 'A', pay: 0 }]
    expect(() => validateMachineDef(def)).toThrow(/pay/i)
  })

  it('rejects lines machines with maxCoins above the 3 supported paylines', () => {
    const def = tinyBally()
    def.maxCoins = 4
    expect(() => validateMachineDef(def)).toThrow(/lines/i)
  })

  it("rejects progressive 'live' awards without a dual progressive config", () => {
    const def = tinyBally()
    def.paytable = [{ id: 'jp', kind: 'run', symbol: 'A', length: 3, pay: 1, progressive: 'live' }]
    expect(() => validateMachineDef(def)).toThrow(/dual/i)
  })

  it("rejects progressive 'maxCoins' awards without a single progressive config", () => {
    const def = tinyBally()
    def.paytable = [{ id: 'jp', kind: 'run', symbol: 'A', length: 3, pay: 1000, progressive: 'maxCoins' }]
    expect(() => validateMachineDef(def)).toThrow(/single/i)
  })

  it('rejects progressiveAtMaxCoins awards without a percent progressive config', () => {
    const def = tinyStepper()
    def.paytable = [{ id: 'jp', kind: 'allSame', symbol: 'A', pay: 1000, progressiveAtMaxCoins: true }]
    expect(() => validateMachineDef(def)).toThrow(/percent/i)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- tests/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (`app/engine/validate.ts`)

```ts
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
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `pnpm test -- tests/validate.test.ts` → PASS.

```bash
git add app/engine/validate.ts tests/validate.test.ts
git commit -m "Add machine definition validation"
```

---

### Task 5: Exact-RTP enumeration

**Files:** Create `app/engine/exactRtp.ts`, `tests/exactRtp.test.ts`

The enumerator computes, per machine: RTP per coin, hit frequency, per-spin variance (per coin), and a per-entry breakdown — by enumerating all symbol tuples with **integer weights** and running them through the **same award functions** the evaluators use.

- [ ] **Step 1: Write the failing tests** (`tests/exactRtp.test.ts`)

The toy machines make every number hand-checkable.

```ts
import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import type { StepperMachineDef, BallyEmMachineDef } from '../app/engine/types'

// Toy stepper: 3 reels, 2-entry virtual map, strip [A, BL].
// P(A per reel) = 1/2 → P(AAA) = 1/8. Pay 8 → RTP = 100%, HF = 12.5%.
// Variance per coin: E[X^2] - E[X]^2 = 64/8 - 1 = 7.
const toyStepper: StepperMachineDef = {
  id: 'toy-s', name: 'Toy Stepper', family: 'stepper',
  denominationCents: 100, maxCoins: 1,
  symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
  physicalStrips: [['A', 'BL'], ['A', 'BL'], ['A', 'BL']],
  virtualMaps: [[0, 1], [0, 1], [0, 1]],
  wildSymbol: null, wildMultiplier: 1,
  paytable: [{ id: '3a', kind: 'allSame', symbol: 'A', pay: 8 }],
  progressive: null, history: 'toy'
}

// Toy bally: 3 reels x 4 uniform stops, strip [A, BL, BL, BL].
// P(A on a row per reel) = 1/4 → P(run of 3) = 1/64. Pay 32 → RTP = 50%.
const toyBally: BallyEmMachineDef = {
  id: 'toy-b', name: 'Toy Bally', family: 'bally-em',
  denominationCents: 100, maxCoins: 3,
  symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
  stops: 4,
  strips: [['A', 'BL', 'BL', 'BL'], ['A', 'BL', 'BL', 'BL'], ['A', 'BL', 'BL', 'BL']],
  payMode: 'lines',
  paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 32 }],
  progressive: null, history: 'toy'
}

describe('exactRtp — toy stepper', () => {
  it('computes RTP, hit frequency, variance exactly', () => {
    const r = exactRtp(toyStepper)
    expect(r.rtpPerCoin).toBeCloseTo(1.0, 12)
    expect(r.hitFrequency).toBeCloseTo(0.125, 12)
    expect(r.variancePerCoin).toBeCloseTo(7.0, 12)
  })

  it('breakdown lists per-entry probability and contribution', () => {
    const r = exactRtp(toyStepper)
    const e = r.breakdown.find(b => b.entryId === '3a')!
    expect(e.probability).toBeCloseTo(1 / 8, 12)
    expect(e.contribution).toBeCloseTo(1.0, 12)
  })
})

describe('exactRtp — toy bally', () => {
  it('computes per-line RTP exactly', () => {
    const r = exactRtp(toyBally)
    expect(r.rtpPerCoin).toBeCloseTo(0.5, 12)
    expect(r.hitFrequency).toBeCloseTo(1 / 64, 12)
  })

  it('multiplier machines: progressive maxCoins entry pays meter/coins at max', () => {
    const def: BallyEmMachineDef = {
      ...toyBally,
      id: 'toy-bp',
      payMode: 'multiplier',
      paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 32, progressive: 'maxCoins' }]
    }
    // At 1 coin: pays 32 → RTP 50%.
    expect(exactRtp(def, { coins: 1 }).rtpPerCoin).toBeCloseTo(0.5, 12)
    // At 3 coins with meter 240: pays 240 total = 80/coin → RTP = 80/64 = 125%.
    expect(exactRtp(def, { coins: 3, progressiveValues: { meter: 240 } }).rtpPerCoin)
      .toBeCloseTo(1.25, 12)
  })

  it('progressive "live" entries pay liveAverage', () => {
    const def: BallyEmMachineDef = {
      ...toyBally,
      id: 'toy-bl',
      paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 1, progressive: 'live' }]
    }
    const r = exactRtp(def, { progressiveValues: { liveAverage: 64 } })
    expect(r.rtpPerCoin).toBeCloseTo(1.0, 12)
  })
})

describe('exactRtp — wild doubling enumerates correctly', () => {
  // 3 reels, vmap of 4: strip [A, W, BL, BL], P(A)=P(W)=1/4.
  // allSame A pay 4, wildMultiplier 2, allWild pay 100.
  // Lines (per-reel symbol in {A,W,BL}): pay(AAA)=4 p=1/64; lines with one W:
  // 3 arrangements AAW p=1/64 each pay 8; AWW 3 arr pay 16; WWW pays 100 (allWild).
  // RTP = (1*4 + 3*8 + 3*16 + 1*100)/64 = 176/64 = 2.75
  const def: StepperMachineDef = {
    id: 'toy-w', name: 'Toy Wild', family: 'stepper',
    denominationCents: 100, maxCoins: 1,
    symbols: { A: { label: 'A' }, W: { label: 'wild' }, BL: { label: 'blank' } },
    physicalStrips: [['A', 'W', 'BL', 'BL'], ['A', 'W', 'BL', 'BL'], ['A', 'W', 'BL', 'BL']],
    virtualMaps: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],
    wildSymbol: 'W', wildMultiplier: 2,
    paytable: [
      { id: 'aw', kind: 'allWild', pay: 100 },
      { id: '3a', kind: 'allSame', symbol: 'A', pay: 4 }
    ],
    progressive: null, history: 'toy'
  }
  it('matches the hand calculation', () => {
    const r = exactRtp(def)
    expect(r.rtpPerCoin).toBeCloseTo(2.75, 12)
    expect(r.hitFrequency).toBeCloseTo(8 / 64, 12)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- tests/exactRtp.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** (`app/engine/exactRtp.ts`)

```ts
import type { BallyEmMachineDef, MachineDef, StepperMachineDef, SymbolId } from './types'
import { ballyAwardForLine, bestStepperAward } from './awards'

export interface ExactRtpOptions {
  /** coin level for multiplier/progressive-at-max machines (default: maxCoins) */
  coins?: number
  progressiveValues?: {
    /** value used for progressive:'maxCoins' / stepper progressiveAtMaxCoins entries (default: config reset) */
    meter?: number
    /** value used for progressive:'live' entries (default: average of dual resets) */
    liveAverage?: number
  }
}

export interface ExactRtpBreakdownEntry {
  entryId: string
  probability: number
  /** average credits per coin paid when it hits (after wild multipliers etc.) */
  avgPayPerCoin: number
  /** probability x avgPayPerCoin — summed = rtpPerCoin */
  contribution: number
}

export interface ExactRtpReport {
  rtpPerCoin: number
  hitFrequency: number
  variancePerCoin: number
  breakdown: ExactRtpBreakdownEntry[]
}

/** Per-reel integer weights for each symbol on the payline. */
function stepperWeights(def: StepperMachineDef): Map<SymbolId, number>[] {
  return def.virtualMaps.map((vmap, r) => {
    const strip = def.physicalStrips[r]!
    const w = new Map<SymbolId, number>()
    for (const idx of vmap) {
      const s = strip[idx]!
      w.set(s, (w.get(s) ?? 0) + 1)
    }
    return w
  })
}

/** Uniform stops: weight of a symbol on any row = its count in the strip. */
function ballyWeights(def: BallyEmMachineDef): Map<SymbolId, number>[] {
  return def.strips.map((strip) => {
    const w = new Map<SymbolId, number>()
    for (const s of strip) w.set(s, (w.get(s) ?? 0) + 1)
    return w
  })
}

/**
 * Exact per-coin RTP by full enumeration of symbol tuples with integer weights.
 * Uses the SAME award functions as the spin evaluators, so display math and
 * gameplay math cannot diverge. Weight products are integers << 2^53; pays may
 * be fractional for odd progressive meters (meter/coins), but every sum stays
 * exact to far beyond the 6-decimal frozen-test tolerance.
 */
export function exactRtp(def: MachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  const coins = opts.coins ?? def.maxCoins
  const weights = def.family === 'stepper' ? stepperWeights(def) : ballyWeights(def)
  const totals = weights.map(w => [...w.values()].reduce((a, b) => a + b, 0))
  const denom = totals.reduce((a, b) => a * b, 1)

  // resolve progressive pay values (per total award, not per coin)
  let meterValue = opts.progressiveValues?.meter
  let liveAverage = opts.progressiveValues?.liveAverage
  if (def.family === 'stepper') {
    meterValue ??= def.progressive?.reset
  } else if (def.progressive?.kind === 'single') {
    meterValue ??= def.progressive.meter.reset
  } else if (def.progressive?.kind === 'dual') {
    liveAverage ??= (def.progressive.upper.reset + def.progressive.lower.reset) / 2
  }

  /** pay PER COIN for a line of symbols at the given coin level */
  const payPerCoin = (line: SymbolId[]): { pay: number, entryId: string } | null => {
    if (def.family === 'stepper') {
      const r = bestStepperAward(line, def)
      if (r === null) return null
      const e = r.entry
      if (e.kind === 'allSame' && e.progressiveAtMaxCoins === true && coins === def.maxCoins) {
        return { pay: (meterValue ?? 0) / coins, entryId: e.id }
      }
      return { pay: r.payCredits, entryId: e.id }
    }
    const e = ballyAwardForLine(line, def.paytable)
    if (e === null) return null
    // narrow to 'run' before touching .progressive — allOf entries lack it
    if (e.kind === 'run' && e.progressive === 'live') return { pay: (liveAverage ?? 0), entryId: e.id }
    if (e.kind === 'run' && e.progressive === 'maxCoins') {
      return coins === def.maxCoins
        ? { pay: (meterValue ?? 0) / coins, entryId: e.id }
        : { pay: e.pay, entryId: e.id }
    }
    return { pay: e.pay, entryId: e.id }
  }

  const alphabet = weights.map(w => [...w.entries()])
  const reels = alphabet.length
  const line: SymbolId[] = new Array(reels).fill('')

  let evNum = 0 // sum of weightProduct x pay
  let ev2Num = 0 // sum of weightProduct x pay^2
  let hitNum = 0 // sum of weightProduct over paying lines
  const byEntry = new Map<string, { pNum: number, evNum: number }>()

  const recurse = (reel: number, weightProduct: number) => {
    if (reel === reels) {
      const res = payPerCoin(line)
      if (res !== null && res.pay > 0) {
        evNum += weightProduct * res.pay
        ev2Num += weightProduct * res.pay * res.pay
        hitNum += weightProduct
        const slot = byEntry.get(res.entryId) ?? { pNum: 0, evNum: 0 }
        slot.pNum += weightProduct
        slot.evNum += weightProduct * res.pay
        byEntry.set(res.entryId, slot)
      }
      return
    }
    for (const [sym, w] of alphabet[reel]!) {
      line[reel] = sym
      recurse(reel + 1, weightProduct * w)
    }
  }
  recurse(0, 1)

  const rtpPerCoin = evNum / denom
  return {
    rtpPerCoin,
    hitFrequency: hitNum / denom,
    variancePerCoin: ev2Num / denom - rtpPerCoin * rtpPerCoin,
    breakdown: [...byEntry.entries()].map(([entryId, v]) => ({
      entryId,
      probability: v.pNum / denom,
      avgPayPerCoin: v.evNum / v.pNum,
      contribution: v.evNum / denom
    })).sort((a, b) => b.contribution - a.contribution)
  }
}
```

Note: `variancePerCoin` here is the variance of the **per-line, per-coin** pay. The line on uniform-row bally machines is the center line; multi-line correlation is handled in the convergence task (Task 10) by testing lines machines at 1 coin.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `pnpm test -- tests/exactRtp.test.ts` → PASS.

```bash
git add app/engine/exactRtp.ts tests/exactRtp.test.ts
git commit -m "Add exact-RTP enumeration with variance and per-entry breakdown"
```

---

### Task 6: Bally-EM evaluator + both Series E machines

**Files:** Create `app/engine/ballyEm.ts`, `app/machines/series-e-3line.ts`, `app/machines/series-e-multiplier.ts`, `tests/ballyEm.test.ts`, `tests/machines.test.ts`

- [ ] **Step 1: Write the machine definitions** (data first — they are inputs to the tests)

`app/machines/series-e-3line.ts`:

```ts
import type { BallyEmMachineDef } from '../engine/types'

/**
 * Modeled on the Bally Model E-1202 "3 Line Pay — Progressive" (Manual 7050,
 * 1981): 5 reels x 22 uniform physical stops, 3 paylines, dollar machine,
 * crowned by the 1989 FO-5140 Double Progressive controller. Outcomes are
 * uniform random stops — no weighting existed in this hardware; RTP emerges
 * purely from strip composition x paytable.
 *
 * Frozen exact math (plan calibration): RTP 89.035073% per line
 * (= 104285/117128 with jackpot at live-average 3000), HF 11.814445%,
 * P(5xS7) = 1/22^5 = 1/5,153,632.
 */
export const SERIES_E_3LINE: BallyEmMachineDef = {
  id: 'series-e-3line',
  name: 'Series E 3-Line',
  family: 'bally-em',
  denominationCents: 100,
  maxCoins: 3,
  symbols: {
    S7: { label: 'Seven' },
    BAR: { label: 'Bar' },
    BE: { label: 'Bell' },
    PL: { label: 'Plum' },
    OR: { label: 'Orange' },
    CH: { label: 'Cherry' },
    BL: { label: 'Blank' }
  },
  stops: 22,
  strips: [
    ['BE', 'PL', 'S7', 'OR', 'BE', 'BAR', 'BE', 'OR', 'PL', 'BL', 'OR', 'OR', 'BL', 'BE', 'OR', 'BL', 'PL', 'CH', 'BL', 'PL', 'CH', 'BL'],
    ['PL', 'BE', 'BAR', 'S7', 'OR', 'PL', 'PL', 'OR', 'OR', 'BL', 'CH', 'BE', 'BL', 'BE', 'PL', 'BL', 'PL', 'OR', 'BL', 'OR', 'BE', 'BL'],
    ['PL', 'BAR', 'OR', 'S7', 'OR', 'BE', 'PL', 'PL', 'BE', 'BL', 'CH', 'BE', 'BL', 'PL', 'OR', 'BL', 'OR', 'PL', 'BL', 'BE', 'OR', 'BL'],
    ['PL', 'BE', 'PL', 'OR', 'BE', 'OR', 'PL', 'OR', 'S7', 'BL', 'PL', 'BE', 'BL', 'PL', 'CH', 'BL', 'BE', 'BAR', 'BL', 'OR', 'OR', 'BL'],
    ['OR', 'PL', 'CH', 'BE', 'CH', 'PL', 'OR', 'CH', 'OR', 'S7', 'BE', 'BE', 'OR', 'OR', 'OR', 'BL', 'PL', 'BAR', 'BL', 'BE', 'PL', 'BL']
  ],
  payMode: 'lines',
  paytable: [
    { id: 's7x5', kind: 'run', symbol: 'S7', length: 5, pay: 1, progressive: 'live' },
    { id: 's7x4', kind: 'run', symbol: 'S7', length: 4, pay: 500 },
    { id: 's7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 },
    { id: 'bars', kind: 'allOf', symbol: 'BAR', pay: 200 },
    { id: 'bex5', kind: 'run', symbol: 'BE', length: 5, pay: 250 },
    { id: 'bex4', kind: 'run', symbol: 'BE', length: 4, pay: 75 },
    { id: 'bex3', kind: 'run', symbol: 'BE', length: 3, pay: 22 },
    { id: 'plx5', kind: 'run', symbol: 'PL', length: 5, pay: 150 },
    { id: 'plx4', kind: 'run', symbol: 'PL', length: 4, pay: 40 },
    { id: 'plx3', kind: 'run', symbol: 'PL', length: 3, pay: 15 },
    { id: 'orx5', kind: 'run', symbol: 'OR', length: 5, pay: 75 },
    { id: 'orx4', kind: 'run', symbol: 'OR', length: 4, pay: 30 },
    { id: 'orx3', kind: 'run', symbol: 'OR', length: 3, pay: 12 },
    { id: 'chx5', kind: 'run', symbol: 'CH', length: 5, pay: 25 },
    { id: 'chx4', kind: 'run', symbol: 'CH', length: 4, pay: 20 },
    { id: 'chx3', kind: 'run', symbol: 'CH', length: 3, pay: 10 },
    { id: 'chx2', kind: 'run', symbol: 'CH', length: 2, pay: 5 },
    { id: 'chx1', kind: 'run', symbol: 'CH', length: 1, pay: 2 }
  ],
  progressive: {
    kind: 'dual',
    upper: { reset: 5000, max: 20000, rate1: { coinsPer: 5, amount: 1 }, rate1Limit: 9000, rate2: { coinsPer: 20, amount: 1 } },
    lower: { reset: 1000, max: 5000, rate1: { coinsPer: 20, amount: 1 }, rate1Limit: 2500, rate2: { coinsPer: 50, amount: 1 } },
    coinsPerToggle: 1
  },
  history: 'Replica of the Bally Model E-1202 dollar progressive (Parts Catalog 7050, April 1981). '
    + 'Five reels of 22 uniform mechanical stops read optically — the CPU only reads and pays, so every stop is a true 1-in-22. '
    + 'The twin jackpot meters alternate per coin played, exactly as the 1989 FO-5140 Double Progressive controller worked.'
}
```

Strip composition (verified during calibration — symbol counts per reel out of 22):

| Reel | S7 | BAR | BE | PL | OR | CH | BL |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 4 | 4 | 5 | 2 | 5 |
| 2 | 1 | 1 | 4 | 5 | 5 | 1 | 5 |
| 3 | 1 | 1 | 4 | 5 | 5 | 1 | 5 |
| 4 | 1 | 1 | 4 | 5 | 5 | 1 | 5 |
| 5 | 1 | 1 | 4 | 4 | 6 | 3 | 3 |

`app/machines/series-e-multiplier.ts`:

```ts
import type { BallyEmMachineDef } from '../engine/types'

/**
 * Modeled on the Bally Model E-1203 "3 Coin Mult. — Progressive" (Manual 7050,
 * 1981): 4 reels x 25 uniform physical stops, single center payline, 1-3 coin
 * multiplier; the progressive jackpot (4 sevens) only pays at max coins.
 *
 * Frozen exact math (plan calibration): RTP 89.126400% per coin at 3 coins
 * (= 13926/15625 with meter at reset 6000); 85.030400% at 1-2 coins —
 * the 4.1-point gap IS the "always max-coin on progressives" lesson.
 * HF 14.255872% (= 55687/390625), P(4xS7) = 16/25^4 = 1/24,414.
 */
export const SERIES_E_MULTIPLIER: BallyEmMachineDef = {
  id: 'series-e-multiplier',
  name: 'Series E Multiplier',
  family: 'bally-em',
  denominationCents: 100,
  maxCoins: 3,
  symbols: {
    S7: { label: 'Seven' },
    BAR: { label: 'Bar' },
    BE: { label: 'Bell' },
    PL: { label: 'Plum' },
    OR: { label: 'Orange' },
    CH: { label: 'Cherry' },
    BL: { label: 'Blank' }
  },
  stops: 25,
  strips: [
    ['OR', 'S7', 'BE', 'BE', 'OR', 'S7', 'PL', 'PL', 'BE', 'PL', 'BE', 'CH', 'BL', 'OR', 'CH', 'BL', 'PL', 'OR', 'BL', 'BAR', 'PL', 'BL', 'OR', 'CH', 'BL'],
    ['PL', 'CH', 'BE', 'OR', 'OR', 'CH', 'OR', 'OR', 'CH', 'BE', 'PL', 'BE', 'BE', 'PL', 'OR', 'S7', 'OR', 'PL', 'BL', 'S7', 'BAR', 'BL', 'PL', 'BAR', 'BL'],
    ['BAR', 'PL', 'PL', 'CH', 'S7', 'BE', 'BE', 'OR', 'OR', 'BE', 'OR', 'OR', 'CH', 'BAR', 'S7', 'PL', 'BAR', 'BE', 'BL', 'OR', 'PL', 'BL', 'CH', 'OR', 'BL'],
    ['OR', 'S7', 'OR', 'PL', 'BAR', 'S7', 'BE', 'PL', 'PL', 'PL', 'OR', 'OR', 'BAR', 'PL', 'PL', 'BL', 'BE', 'CH', 'BL', 'OR', 'BE', 'BL', 'OR', 'BE', 'BL']
  ],
  payMode: 'multiplier',
  paytable: [
    { id: 's7x4', kind: 'run', symbol: 'S7', length: 4, pay: 1000, progressive: 'maxCoins' },
    { id: 's7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 },
    { id: 'bars', kind: 'allOf', symbol: 'BAR', pay: 150 },
    { id: 'bex4', kind: 'run', symbol: 'BE', length: 4, pay: 100 },
    { id: 'bex3', kind: 'run', symbol: 'BE', length: 3, pay: 20 },
    { id: 'plx4', kind: 'run', symbol: 'PL', length: 4, pay: 60 },
    { id: 'plx3', kind: 'run', symbol: 'PL', length: 3, pay: 14 },
    { id: 'orx4', kind: 'run', symbol: 'OR', length: 4, pay: 30 },
    { id: 'orx3', kind: 'run', symbol: 'OR', length: 3, pay: 10 },
    { id: 'chx4', kind: 'run', symbol: 'CH', length: 4, pay: 20 },
    { id: 'chx3', kind: 'run', symbol: 'CH', length: 3, pay: 10 },
    { id: 'chx2', kind: 'run', symbol: 'CH', length: 2, pay: 5 },
    { id: 'chx1', kind: 'run', symbol: 'CH', length: 1, pay: 2 }
  ],
  progressive: {
    kind: 'single',
    meter: { reset: 6000, max: 25000, rate1: { coinsPer: 4, amount: 1 }, rate1Limit: 8000, rate2: { coinsPer: 8, amount: 1 } }
  },
  history: 'Replica of the Bally Model E-1203 dollar multiplier (Parts Catalog 7050, April 1981). '
    + 'Four reels of 25 uniform stops, "Play One to Three Dollars" — pays multiply with coins, '
    + 'but the progressive sevens only pay the meter on the third coin. At one coin the same '
    + 'machine returns about four points less: the cheapest lesson on this floor.'
}
```

Strip composition (counts per reel out of 25):

| Reel | S7 | BAR | BE | PL | OR | CH | BL |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 1 | 4 | 5 | 5 | 3 | 5 |
| 2 | 2 | 2 | 4 | 5 | 6 | 3 | 3 |
| 3 | 2 | 3 | 4 | 4 | 6 | 3 | 3 |
| 4 | 2 | 2 | 4 | 6 | 6 | 1 | 4 |

- [ ] **Step 2: Write the failing evaluator tests** (`tests/ballyEm.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { spinBallyEm } from '../app/engine/ballyEm'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import type { MachineSessionState } from '../app/engine/types'

/** RNG stub: returns values that make floor(v * stops) land on the wanted stops. */
function riggedStops(stops: number[], stopCount: number) {
  let i = 0
  return () => (stops[i++]! + 0.5) / stopCount
}

/** stop index such that the CENTER row (stop+1) shows the strip's first S7 */
function stopForCenterSymbol(strip: string[], symbol: string): number {
  const idx = strip.indexOf(symbol)
  return (idx - 1 + strip.length) % strip.length
}

function freshState(def: typeof SERIES_E_3LINE | typeof SERIES_E_MULTIPLIER): MachineSessionState {
  if (def.progressive?.kind === 'dual') {
    return {
      progressive: {
        kind: 'dual', upper: def.progressive.upper.reset, lower: def.progressive.lower.reset,
        live: 'upper', coinsTowardToggle: 0, upperCoins: 0, lowerCoins: 0
      }
    }
  }
  if (def.progressive?.kind === 'single') {
    return { progressive: { kind: 'single', value: def.progressive.meter.reset, coins: 0 } }
  }
  return { progressive: null }
}

describe('spinBallyEm — grid and lines', () => {
  it('grid rows are [top, center, bottom] = strip[stop], strip[stop+1], strip[stop+2]', () => {
    const def = SERIES_E_3LINE
    const rng = riggedStops([0, 0, 0, 0, 0], 22)
    const out = spinBallyEm(def, freshState(def), 1, rng)
    out.grid.forEach((col, r) => {
      const strip = def.strips[r]!
      expect(col).toEqual([strip[0], strip[1], strip[2]])
    })
  })

  it('1 coin pays center line only; 3 coins pay center, top, bottom', () => {
    const def = SERIES_E_3LINE
    // place a cherry on reel 1 TOP row: stop = index of CH
    const chTop = def.strips[0]!.indexOf('CH')
    // reels 2-5 stops chosen at blanks so no other win interferes on any row:
    // find a stop on each reel where rows show no CH/S7 runs from reel 1 —
    // any stop works because awards need runs starting at reel 1; reel-1 rows:
    // top=CH (run1 on top line), center/bottom = whatever follows.
    const stops = [chTop, 0, 0, 0, 0]
    const oneCoin = spinBallyEm(def, freshState(def), 1, riggedStops(stops, 22))
    // top line not active at 1 coin
    expect(oneCoin.wins.every(w => w.line !== 'top')).toBe(true)

    const threeCoin = spinBallyEm(def, freshState(def), 3, riggedStops(stops, 22))
    const topWin = threeCoin.wins.find(w => w.line === 'top')
    expect(topWin?.entryId).toBe('chx1')
    expect(topWin?.payCredits).toBe(2)
  })
})

describe('spinBallyEm — progressive paths (rigged)', () => {
  it('E-1202: 5xS7 on center pays the LIVE meter and resets it', () => {
    const def = SERIES_E_3LINE
    const stops = def.strips.map(strip => stopForCenterSymbol(strip, 'S7'))
    const state = freshState(def)
    // make the lower jackpot live and inflate it to prove it pays current value
    const prog = state.progressive as Extract<NonNullable<MachineSessionState['progressive']>, { kind: 'dual' }>
    prog.live = 'lower'
    prog.lower = 1234
    const out = spinBallyEm(def, state, 1, riggedStops(stops, 22))
    const jackpotWin = out.wins.find(w => w.entryId === 's7x5')!
    expect(jackpotWin.progressive).toBe(true)
    expect(jackpotWin.payCredits).toBe(1234)
    expect(out.progressiveEvents).toEqual([{ type: 'hit', meter: 'lower', amountCredits: 1234 }])
    expect(prog.lower).toBe(def.progressive!.kind === 'dual' ? def.progressive!.lower.reset : 0)
  })

  it('E-1203: 4xS7 pays meter at 3 coins, 1000 x coins below max', () => {
    const def = SERIES_E_MULTIPLIER
    const stops = def.strips.map(strip => stopForCenterSymbol(strip, 'S7'))
    const at1 = spinBallyEm(def, freshState(def), 1, riggedStops(stops, 25))
    expect(at1.totalPayout).toBe(1000)
    expect(at1.progressiveEvents).toEqual([])

    const state3 = freshState(def)
    const at3 = spinBallyEm(def, state3, 3, riggedStops(stops, 25))
    expect(at3.totalPayout).toBe(6000)
    expect(at3.progressiveEvents).toEqual([{ type: 'hit', meter: 'single', amountCredits: 6000 }])
    expect((state3.progressive as { value: number }).value).toBe(6000) // reset
  })

  it('multiplier machine pays x coins on normal wins', () => {
    const def = SERIES_E_MULTIPLIER
    // center row all bells: find stop where center = BE on each reel
    const stops = def.strips.map(strip => stopForCenterSymbol(strip, 'BE'))
    // rig only reels 1-3 to bells; reel 4 to a blank-centered stop so run is exactly 3
    const blankStop = stopForCenterSymbol(def.strips[3]!, 'BL')
    const out = spinBallyEm(def, freshState(def), 2, riggedStops([stops[0]!, stops[1]!, stops[2]!, blankStop], 25))
    const win = out.wins.find(w => w.entryId === 'bex3')!
    expect(win.payCredits).toBe(40) // 20 x 2 coins
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test -- tests/ballyEm.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** (`app/engine/ballyEm.ts`)

```ts
import type {
  BallyEmMachineDef, LineWin, MachineSessionState, ProgressiveEvent,
  RngDraw, SpinOutcome, SymbolId
} from './types'
import type { RandomFn } from './rng'
import { ballyAwardForLine } from './awards'

const LINE_ROWS: Record<string, number> = { center: 1, top: 0, bottom: 2 }
const LINES_FOR_COINS = [['center'], ['center', 'top'], ['center', 'top', 'bottom']]

/**
 * Spin a uniform-stop Bally-EM machine. Mutates state.progressive on a
 * progressive hit (meter resets); coin-in feeding happens OUTSIDE spin
 * (simulateMachine / the Pinia store tick the controller per coin).
 */
export function spinBallyEm(
  def: BallyEmMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }

  const draws: RngDraw[] = []
  const stops = def.strips.map((_, r) => {
    const raw = rand()
    const value = Math.floor(raw * def.stops)
    draws.push({ label: `reel${r + 1}-stop`, raw, value, range: def.stops })
    return value
  })

  const grid: SymbolId[][] = def.strips.map((strip, r) => {
    const s = stops[r]!
    return [strip[s]!, strip[(s + 1) % def.stops]!, strip[(s + 2) % def.stops]!]
  })

  const lines = def.payMode === 'lines' ? LINES_FOR_COINS[coins - 1]! : ['center']
  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []

  for (const lineName of lines) {
    const row = LINE_ROWS[lineName]!
    const lineSymbols = grid.map(col => col[row]!)
    const entry = ballyAwardForLine(lineSymbols, def.paytable)
    if (entry === null) continue

    let payCredits: number
    let isProgressive = false

    if (entry.kind === 'run' && entry.progressive === 'live' && state.progressive?.kind === 'dual') {
      const prog = state.progressive
      const meter = prog.live
      payCredits = meter === 'upper' ? prog.upper : prog.lower
      const cfg = def.progressive!
      if (cfg.kind === 'dual') {
        if (meter === 'upper') prog.upper = cfg.upper.reset
        else prog.lower = cfg.lower.reset
      }
      progressiveEvents.push({ type: 'hit', meter, amountCredits: payCredits })
      isProgressive = true
    } else if (entry.kind === 'run' && entry.progressive === 'maxCoins' && coins === def.maxCoins
      && state.progressive?.kind === 'single') {
      const prog = state.progressive
      payCredits = Math.floor(prog.value)
      if (def.progressive?.kind === 'single') prog.value = def.progressive.meter.reset
      progressiveEvents.push({ type: 'hit', meter: 'single', amountCredits: payCredits })
      isProgressive = true
    } else {
      payCredits = def.payMode === 'multiplier' ? entry.pay * coins : entry.pay
    }

    wins.push({
      line: lineName, entryId: entry.id, symbols: lineSymbols,
      payCredits, wildCount: 0, progressive: isProgressive
    })
  }

  return {
    machineId: def.id,
    family: 'bally-em',
    coins,
    stops,
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents,
    trace: { draws }
  }
}
```

- [ ] **Step 5: Write the frozen-math tests** (`tests/machines.test.ts` — this file grows in Task 8)

```ts
import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { validateMachineDef } from '../app/engine/validate'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'

describe('series-e-3line — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SERIES_E_3LINE)).not.toThrow()
  })

  it('strip counts match the calibrated composition', () => {
    const counts = SERIES_E_3LINE.strips.map((strip) => {
      const c: Record<string, number> = {}
      strip.forEach((s) => { c[s] = (c[s] ?? 0) + 1 })
      return c
    })
    expect(counts[0]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 4, OR: 5, CH: 2, BL: 5 })
    expect(counts[1]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 5, OR: 5, CH: 1, BL: 5 })
    expect(counts[2]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 5, OR: 5, CH: 1, BL: 5 })
    expect(counts[3]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 5, OR: 5, CH: 1, BL: 5 })
    expect(counts[4]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 4, OR: 6, CH: 3, BL: 3 })
  })

  it('FROZEN: exact RTP per line = 89.035073% with jackpot at live-average 3000', () => {
    const r = exactRtp(SERIES_E_3LINE)
    expect(r.rtpPerCoin).toBeCloseTo(0.89035073, 6)
    expect(r.hitFrequency).toBeCloseTo(0.11814445, 6)
  })

  it('FROZEN: P(5xS7) = 1/5,153,632', () => {
    const r = exactRtp(SERIES_E_3LINE)
    const jp = r.breakdown.find(b => b.entryId === 's7x5')!
    expect(jp.probability).toBeCloseTo(1 / 5153632, 12)
  })
})

describe('series-e-multiplier — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SERIES_E_MULTIPLIER)).not.toThrow()
  })

  it('FROZEN: exact RTP = 89.126400% at 3 coins, 85.030400% at 1 coin', () => {
    expect(exactRtp(SERIES_E_MULTIPLIER, { coins: 3 }).rtpPerCoin).toBeCloseTo(0.891264, 6)
    expect(exactRtp(SERIES_E_MULTIPLIER, { coins: 1 }).rtpPerCoin).toBeCloseTo(0.850304, 6)
    expect(exactRtp(SERIES_E_MULTIPLIER, { coins: 3 }).hitFrequency).toBeCloseTo(0.14255872, 6)
  })

  it('FROZEN: P(4xS7) = 16/390625', () => {
    const r = exactRtp(SERIES_E_MULTIPLIER, { coins: 3 })
    const jp = r.breakdown.find(b => b.entryId === 's7x4')!
    expect(jp.probability).toBeCloseTo(16 / 390625, 12)
  })
})
```

- [ ] **Step 6: Run all the new tests**

Run: `pnpm test -- tests/ballyEm.test.ts tests/machines.test.ts`
Expected: PASS. If a FROZEN test fails, the evaluator/enumerator semantics differ from the plan's "Numbers provenance" section — debug the code against those rules; do not adjust frozen numbers.

- [ ] **Step 7: Commit**

```bash
git add app/engine/ballyEm.ts app/machines/series-e-3line.ts app/machines/series-e-multiplier.ts tests/ballyEm.test.ts tests/machines.test.ts
git commit -m "Add Bally-EM evaluator and both Series E machines with frozen exact-RTP tests"
```

---

### Task 7: Progressive controllers (FO-5140 semantics)

**Files:** Create `app/engine/progressive.ts`, `tests/progressive.test.ts`

Semantics from the Bally FO-5140 manual (docs/Bally Double Progressive Inst.pdf, book pp.5–10):
- Each coin-in is processed under the currently **live** meter, then the toggle counter advances; at `coinsPerToggle` the live meter swaps.
- Each meter has its own live-coin counter; when it reaches the active rate's `coinsPer`, the meter increments by `amount` (clipped at `max` — increments freeze, counters keep cycling).
- Once a meter's value ≥ `rate1Limit`, `rate2` applies.
- On a jackpot hit the meter resets to `reset`; toggle and coin counters are **intentionally NOT reset** (per the manual).

- [ ] **Step 1: Write the failing tests** (`tests/progressive.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import {
  initProgressiveState, addCoinToProgressive
} from '../app/engine/progressive'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import type { DualProgressiveConfig, DualProgressiveState, SingleProgressiveState } from '../app/engine/types'

const DUAL: DualProgressiveConfig = {
  kind: 'dual',
  upper: { reset: 5000, max: 20000, rate1: { coinsPer: 5, amount: 1 }, rate1Limit: 9000, rate2: { coinsPer: 20, amount: 1 } },
  lower: { reset: 1000, max: 5000, rate1: { coinsPer: 20, amount: 1 }, rate1Limit: 2500, rate2: { coinsPer: 50, amount: 1 } },
  coinsPerToggle: 1
}

describe('dual progressive — FO-5140 worked example', () => {
  it('10 coins: odd coins live=upper, upper increments at its 5th live coin', () => {
    const st = initProgressiveState(DUAL) as DualProgressiveState
    expect(st.live).toBe('upper')
    for (let i = 0; i < 10; i++) addCoinToProgressive(st, DUAL)
    // upper saw coins 1,3,5,7,9 (5 live coins) -> one increment of 1
    expect(st.upper).toBe(5001)
    // lower saw 5 live coins, needs 20 -> no increment
    expect(st.lower).toBe(1000)
    // after 10 toggles, live is back to upper
    expect(st.live).toBe('upper')
  })

  it('rate2 applies once value >= rate1Limit', () => {
    const st = initProgressiveState(DUAL) as DualProgressiveState
    st.upper = 9000 // at limit -> rate2 (20 live coins per +1)
    for (let i = 0; i < 19 * 2; i++) addCoinToProgressive(st, DUAL) // 19 live-upper coins
    expect(st.upper).toBe(9000)
    addCoinToProgressive(st, DUAL) // 20th live-upper coin (coin 39 overall, odd => upper)
    expect(st.upper).toBe(9001)
  })

  it('clips at max and keeps cycling counters', () => {
    const st = initProgressiveState(DUAL) as DualProgressiveState
    st.upper = DUAL.upper.max
    for (let i = 0; i < 200; i++) addCoinToProgressive(st, DUAL)
    expect(st.upper).toBe(DUAL.upper.max)
    expect(st.lower).toBeGreaterThan(1000) // lower still incremented (100 live coins / 20 = 5)
    expect(st.lower).toBe(1005)
  })

  it('coinsPerToggle > 1 holds the live meter for N coins', () => {
    const cfg: DualProgressiveConfig = { ...DUAL, coinsPerToggle: 3 }
    const st = initProgressiveState(cfg) as DualProgressiveState
    addCoinToProgressive(st, cfg)
    addCoinToProgressive(st, cfg)
    expect(st.live).toBe('upper')
    addCoinToProgressive(st, cfg) // 3rd coin completes the toggle window
    expect(st.live).toBe('lower')
  })
})

describe('single progressive', () => {
  it('increments by rate1 then rate2 past the limit', () => {
    const cfg = SERIES_E_MULTIPLIER.progressive!
    if (cfg.kind !== 'single') throw new Error('expected single')
    const st = initProgressiveState(cfg) as SingleProgressiveState
    // rate1: +1 per 4 coins
    for (let i = 0; i < 4; i++) addCoinToProgressive(st, cfg)
    expect(st.value).toBe(6001)
    // jump to limit: rate2 = +1 per 8 coins
    st.value = 8000
    for (let i = 0; i < 7; i++) addCoinToProgressive(st, cfg)
    expect(st.value).toBe(8000)
    addCoinToProgressive(st, cfg)
    expect(st.value).toBe(8001)
  })
})

```

The percent-feed and break-even-identity tests live in Task 8 (they need the `SEVENS_ABLAZE` machine) — Task 8 appends them to this file, keeping the suite green after every commit.

- [ ] **Step 2: Implement** (`app/engine/progressive.ts`)

```ts
import type {
  MeterConfig, ProgressiveConfig, ProgressiveState
} from './types'

export function initProgressiveState(cfg: ProgressiveConfig): ProgressiveState {
  if (cfg.kind === 'dual') {
    return {
      kind: 'dual', upper: cfg.upper.reset, lower: cfg.lower.reset,
      live: 'upper', coinsTowardToggle: 0, upperCoins: 0, lowerCoins: 0
    }
  }
  if (cfg.kind === 'single') {
    return { kind: 'single', value: cfg.meter.reset, coins: 0 }
  }
  return { kind: 'percent', value: cfg.reset }
}

function activeRate(value: number, m: MeterConfig) {
  return value >= m.rate1Limit ? m.rate2 : m.rate1
}

function tickMeter(value: number, coins: number, m: MeterConfig): { value: number, coins: number } {
  const rate = activeRate(value, m)
  coins += 1
  if (coins >= rate.coinsPer) {
    coins = 0
    // clip at max — increments freeze, counters keep cycling (FO-5140 p.9)
    value = Math.min(value + rate.amount, m.max)
  }
  return { value, coins }
}

/**
 * Process one coin-in. Mutates state. FO-5140 semantics: the coin counts
 * toward the LIVE meter, then the toggle counter advances.
 */
export function addCoinToProgressive(state: ProgressiveState, cfg: ProgressiveConfig): void {
  if (state.kind === 'dual' && cfg.kind === 'dual') {
    if (state.live === 'upper') {
      const r = tickMeter(state.upper, state.upperCoins, cfg.upper)
      state.upper = r.value
      state.upperCoins = r.coins
    } else {
      const r = tickMeter(state.lower, state.lowerCoins, cfg.lower)
      state.lower = r.value
      state.lowerCoins = r.coins
    }
    state.coinsTowardToggle += 1
    if (state.coinsTowardToggle >= cfg.coinsPerToggle) {
      state.coinsTowardToggle = 0
      state.live = state.live === 'upper' ? 'lower' : 'upper'
    }
    return
  }
  if (state.kind === 'single' && cfg.kind === 'single') {
    const r = tickMeter(state.value, state.coins, cfg.meter)
    state.value = r.value
    state.coins = r.coins
    return
  }
  if (state.kind === 'percent' && cfg.kind === 'percent') {
    state.value = Math.min(state.value + cfg.feedRate, cfg.max)
    return
  }
  throw new Error(`progressive state/config kind mismatch: ${state.kind} vs ${cfg.kind}`)
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm exec vitest run tests/progressive.test.ts`
Expected: PASS (5 tests: 4 dual + 1 single). Full suite stays green.

- [ ] **Step 4: Commit**

```bash
git add app/engine/progressive.ts tests/progressive.test.ts
git commit -m "Add FO-5140 progressive controllers (dual toggle, single, percent feed)"
```

---

### Task 8: Stepper evaluator + Diamond Doubler + Sevens Ablaze

**Files:** Create `app/engine/stepper.ts`, `app/machines/diamond-doubler.ts`, `app/machines/sevens-ablaze.ts`, `tests/stepper.test.ts`; Modify `tests/machines.test.ts`

- [ ] **Step 1: Write the machine data files**

`app/machines/diamond-doubler.ts`:

```ts
import type { StepperMachineDef } from '../engine/types'

/**
 * Double Diamond archetype: 3 reels, single payline, wild that doubles
 * (one wild 2x, two wilds 4x), weighted VIRTUAL reels over 22 physical stops
 * (Telnaes patent US 4,448,419) — 72 virtual entries per reel.
 *
 * Frozen exact math (plan calibration): RTP 94.744245% per coin
 * (= 117877/124416), HF 14.667460%, P(3xDW) = 12/72^3 = 1/31,104.
 * Pays are linear in coins (1-3): per-coin RTP identical at every coin level.
 */
export const DIAMOND_DOUBLER: StepperMachineDef = {
  id: 'diamond-doubler',
  name: 'Diamond Doubler',
  family: 'stepper',
  denominationCents: 100,
  maxCoins: 3,
  symbols: {
    DW: { label: 'Diamond Wild' },
    S7: { label: 'Seven' },
    B3: { label: 'Triple Bar' },
    B2: { label: 'Double Bar' },
    B1: { label: 'Single Bar' },
    CH: { label: 'Cherry' },
    BL: { label: 'Blank' }
  },
  physicalStrips: [
    ['DW', 'B1', 'S7', 'BL', 'B1', 'CH', 'BL', 'B3', 'B2', 'BL', 'B2', 'B3', 'BL', 'CH', 'B1', 'BL', 'B1', 'B2', 'BL', 'B3', 'S7', 'BL'],
    ['B1', 'B2', 'B2', 'BL', 'S7', 'CH', 'BL', 'B3', 'CH', 'BL', 'B2', 'B1', 'BL', 'B3', 'B1', 'BL', 'S7', 'B1', 'BL', 'DW', 'B3', 'BL'],
    ['B3', 'DW', 'B2', 'BL', 'B1', 'S7', 'BL', 'B1', 'CH', 'BL', 'B1', 'B1', 'BL', 'S7', 'B2', 'BL', 'B2', 'CH', 'BL', 'B3', 'B3', 'BL']
  ],
  virtualMaps: [
    [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 6, 6, 6, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 12, 12, 12, 12, 12, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 18, 18, 18, 19, 20, 21, 21, 21, 21, 21],
    [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 5, 6, 6, 6, 6, 6, 6, 7, 7, 8, 9, 9, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 12, 13, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 17, 17, 17, 18, 18, 18, 18, 18, 19, 19, 20, 21, 21, 21, 21, 21],
    [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 17, 18, 18, 18, 18, 18, 19, 19, 20, 21, 21, 21, 21, 21]
  ],
  wildSymbol: 'DW',
  wildMultiplier: 2,
  paytable: [
    { id: '3dw', kind: 'allWild', pay: 1000 },
    { id: '3s7', kind: 'allSame', symbol: 'S7', pay: 80 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 40 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 25 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 10 },
    { id: '3ch', kind: 'allSame', symbol: 'CH', pay: 10 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B1', 'B2', 'B3'], pay: 5 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 5 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ],
  progressive: null,
  history: 'A classic 1990s wild-multiplier stepper in the Double Diamond mold. The reels you watch have '
    + '22 physical stops, but the RNG picks from 72 weighted virtual entries per reel — the 1984 Telnaes '
    + 'patent that made big jackpots (and engineered near-misses) possible on small reels.'
}
```

Virtual-map symbol weights (entries out of 72, verified during calibration):

| Reel | DW | S7 | B3 | B2 | B1 | CH | BL |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 3 | 5 | 8 | 14 | 2 | 37 |
| 2 | 2 | 3 | 5 | 8 | 13 | 2 | 39 |
| 3 | 2 | 3 | 5 | 8 | 14 | 2 | 38 |

`app/machines/sevens-ablaze.ts`:

```ts
import type { StepperMachineDef } from '../engine/types'

/**
 * Blazing 7s archetype: 3 reels, single payline, 2-coin stepper whose top
 * award (3 flaming sevens) pays a percentage-fed PROGRESSIVE at max coins
 * (reset 2000 credits, 1.0% of coin-in feeds the meter) and 1000 at 1 coin.
 *
 * Frozen exact math (plan calibration): RTP 94.488115% per coin at 2 coins
 * with the meter at reset (long-run ~95.49% including the 1.0% feed),
 * HF 15.719307%, P(3xF7) = 27/72^3 = 1/13,824.
 */
export const SEVENS_ABLAZE: StepperMachineDef = {
  id: 'sevens-ablaze',
  name: 'Sevens Ablaze',
  family: 'stepper',
  denominationCents: 100,
  maxCoins: 2,
  symbols: {
    F7: { label: 'Flaming Seven' },
    S7: { label: 'Red Seven' },
    B3: { label: 'Triple Bar' },
    B2: { label: 'Double Bar' },
    B1: { label: 'Single Bar' },
    CH: { label: 'Cherry' },
    BL: { label: 'Blank' }
  },
  physicalStrips: [
    ['CH', 'B2', 'S7', 'BL', 'B2', 'B2', 'BL', 'B3', 'S7', 'BL', 'B3', 'F7', 'BL', 'B3', 'B1', 'BL', 'B1', 'B1', 'BL', 'B1', 'CH', 'BL'],
    ['CH', 'F7', 'S7', 'BL', 'B3', 'B1', 'BL', 'B3', 'B1', 'BL', 'B3', 'B1', 'BL', 'B2', 'B1', 'BL', 'B2', 'B2', 'BL', 'S7', 'CH', 'BL'],
    ['B1', 'B3', 'B1', 'BL', 'B3', 'B2', 'BL', 'CH', 'CH', 'BL', 'B2', 'S7', 'BL', 'B2', 'F7', 'BL', 'S7', 'B1', 'BL', 'B3', 'B1', 'BL']
  ],
  virtualMaps: [
    [0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 20, 21, 21, 21, 21],
    [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 18, 18, 19, 19, 19, 20, 21, 21, 21, 21],
    [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 8, 9, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21]
  ],
  wildSymbol: null,
  wildMultiplier: 1,
  paytable: [
    { id: '3f7', kind: 'allSame', symbol: 'F7', pay: 1000, progressiveAtMaxCoins: true },
    { id: '3s7', kind: 'allSame', symbol: 'S7', pay: 200 },
    { id: 'mix7', kind: 'anyOf', symbols: ['F7', 'S7'], pay: 50 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 60 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 30 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 15 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B1', 'B2', 'B3'], pay: 5 },
    { id: '3ch', kind: 'count', symbol: 'CH', n: 3, pay: 20 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 5 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ],
  progressive: {
    kind: 'percent',
    reset: 2000,
    max: 100_000,
    feedRate: 0.01
  },
  history: 'A Blazing 7s-style two-coin progressive stepper. One percent of every coin in feeds the meter; '
    + 'the flaming sevens only pay it on the second coin. The meter\'s break-even point — where this becomes '
    + 'a positive-EV machine — is computable, and this simulator computes it for you.'
}
```

Virtual-map symbol weights (entries out of 72):

| Reel | F7 | S7 | B3 | B2 | B1 | CH | BL |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 5 | 7 | 11 | 14 | 2 | 30 |
| 2 | 3 | 6 | 7 | 8 | 13 | 2 | 33 |
| 3 | 3 | 6 | 7 | 8 | 16 | 2 | 30 |

- [ ] **Step 2: Write the failing evaluator tests** (`tests/stepper.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { spinStepper } from '../app/engine/stepper'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import { mulberry32 } from '../app/engine/rng'
import type { MachineSessionState } from '../app/engine/types'

/** rig virtual indices: floor(v * 72) lands on the wanted entries */
function riggedVirtual(indices: number[]) {
  let i = 0
  return () => (indices[i++]! + 0.5) / 72
}

function noProg(): MachineSessionState {
  return { progressive: null }
}

describe('spinStepper — virtual to physical mapping', () => {
  it('payline symbol = strip[vmap[virtualIndex]], grid = [above, payline, below]', () => {
    const def = DIAMOND_DOUBLER
    const out = spinStepper(def, noProg(), 1, riggedVirtual([0, 0, 0]))
    out.stops.forEach((stop, r) => {
      expect(stop).toBe(def.virtualMaps[r]![0])
      const strip = def.physicalStrips[r]!
      const len = strip.length
      expect(out.grid[r]).toEqual([
        strip[(stop - 1 + len) % len], strip[stop], strip[(stop + 1) % len]
      ])
    })
  })

  it('records virtual-stop trace with Telnaes weights', () => {
    const def = DIAMOND_DOUBLER
    // virtual index 0 on reel 1 -> physical 0 = DW, weight 3 (3 entries land on DW)
    const out = spinStepper(def, noProg(), 1, riggedVirtual([0, 0, 0]))
    const t = out.trace.virtualStops![0]!
    expect(t.virtualIndex).toBe(0)
    expect(t.virtualSize).toBe(72)
    expect(t.symbol).toBe('DW')
    expect(t.weight).toBe(3)
  })

  it('pays are linear in coins', () => {
    const def = DIAMOND_DOUBLER
    // all three reels: first B1 entry in each vmap.
    // Find a virtual index per reel whose strip symbol is B1.
    const idx = def.virtualMaps.map((vmap, r) =>
      vmap.findIndex(p => def.physicalStrips[r]![p] === 'B1'))
    const at1 = spinStepper(def, noProg(), 1, riggedVirtual(idx))
    const at3 = spinStepper(def, noProg(), 3, riggedVirtual(idx))
    expect(at1.totalPayout).toBe(10)
    expect(at3.totalPayout).toBe(30)
  })
})

describe('spinStepper — sevens-ablaze progressive', () => {
  function f7Indices() {
    return SEVENS_ABLAZE.virtualMaps.map((vmap, r) =>
      vmap.findIndex(p => SEVENS_ABLAZE.physicalStrips[r]![p] === 'F7'))
  }

  it('3xF7 at 1 coin pays fixed 1000, no progressive event', () => {
    const out = spinStepper(SEVENS_ABLAZE, {
      progressive: { kind: 'percent', value: 2500 }
    }, 1, riggedVirtual(f7Indices()))
    expect(out.totalPayout).toBe(1000)
    expect(out.progressiveEvents).toEqual([])
  })

  it('3xF7 at max coins pays the meter (floored) and resets it', () => {
    const state: MachineSessionState = { progressive: { kind: 'percent', value: 2500.75 } }
    const out = spinStepper(SEVENS_ABLAZE, state, 2, riggedVirtual(f7Indices()))
    expect(out.totalPayout).toBe(2500)
    expect(out.progressiveEvents).toEqual([{ type: 'hit', meter: 'percent', amountCredits: 2500 }])
    expect((state.progressive as { value: number }).value).toBe(2000)
  })
})

describe('spinStepper — distribution sanity (chi-squared on virtual draws)', () => {
  it('200k draws on reel 1 match uniform over 72 virtual entries (df=71, p=0.001 crit 112.32)', () => {
    const def = DIAMOND_DOUBLER
    const rand = mulberry32(424242)
    const bins = new Array(72).fill(0)
    const n = 200_000
    for (let i = 0; i < n; i++) {
      const out = spinStepper(def, noProg(), 1, rand)
      bins[out.trace.virtualStops![0]!.virtualIndex]++
    }
    const expected = n / 72
    const chi2 = bins.reduce((s, o) => s + (o - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(112.32)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test -- tests/stepper.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** (`app/engine/stepper.ts`)

```ts
import type {
  LineWin, MachineSessionState, ProgressiveEvent, RngDraw,
  SpinOutcome, StepperMachineDef, SymbolId, VirtualStopTrace
} from './types'
import type { RandomFn } from './rng'
import { bestStepperAward } from './awards'

/**
 * Telnaes weight of a symbol on a reel = entries in the virtual map showing it.
 * Memoized per def — spins run in multi-million-spin simulation loops, so the
 * O(virtualMap) count must not execute per spin.
 */
const weightCache = new WeakMap<StepperMachineDef, Map<SymbolId, number>[]>()

function reelWeights(def: StepperMachineDef): Map<SymbolId, number>[] {
  let cached = weightCache.get(def)
  if (cached === undefined) {
    cached = def.virtualMaps.map((vmap, r) => {
      const strip = def.physicalStrips[r]!
      const w = new Map<SymbolId, number>()
      for (const p of vmap) {
        const s = strip[p]!
        w.set(s, (w.get(s) ?? 0) + 1)
      }
      return w
    })
    weightCache.set(def, cached)
  }
  return cached
}

/**
 * Spin a Telnaes-stepper. The RNG draws uniformly over the virtual map; the
 * mapped physical stop is what the player sees. Mutates state.progressive on
 * a progressive hit; coin-in feeding happens outside spin.
 */
export function spinStepper(
  def: StepperMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }

  const draws: RngDraw[] = []
  const virtualStops: VirtualStopTrace[] = []
  const stops: number[] = []
  const line: SymbolId[] = []

  def.virtualMaps.forEach((vmap, r) => {
    const raw = rand()
    const virtualIndex = Math.floor(raw * vmap.length)
    draws.push({ label: `reel${r + 1}-virtual`, raw, value: virtualIndex, range: vmap.length })
    const physicalStop = vmap[virtualIndex]!
    const symbol = def.physicalStrips[r]![physicalStop]!
    stops.push(physicalStop)
    line.push(symbol)
    virtualStops.push({
      reel: r, virtualIndex, virtualSize: vmap.length,
      physicalStop, symbol, weight: reelWeights(def)[r]!.get(symbol)!
    })
  })

  const grid: SymbolId[][] = def.physicalStrips.map((strip, r) => {
    const s = stops[r]!
    const len = strip.length
    return [strip[(s - 1 + len) % len]!, strip[s]!, strip[(s + 1) % len]!]
  })

  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []
  const result = bestStepperAward(line, def)

  if (result !== null) {
    const e = result.entry
    let payCredits: number
    let isProgressive = false
    if (e.kind === 'allSame' && e.progressiveAtMaxCoins === true
      && coins === def.maxCoins && state.progressive?.kind === 'percent') {
      const prog = state.progressive
      payCredits = Math.floor(prog.value)
      if (def.progressive !== null) prog.value = def.progressive.reset
      progressiveEvents.push({ type: 'hit', meter: 'percent', amountCredits: payCredits })
      isProgressive = true
    } else {
      payCredits = result.payCredits * coins
    }
    wins.push({
      line: 'payline', entryId: e.id, symbols: [...line],
      payCredits, wildCount: result.wildCount, progressive: isProgressive
    })
  }

  return {
    machineId: def.id,
    family: 'stepper',
    coins,
    stops,
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents,
    trace: { draws, virtualStops }
  }
}
```

- [ ] **Step 5: Add the frozen-math tests** — append to `tests/machines.test.ts`:

```ts
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'

describe('diamond-doubler — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(DIAMOND_DOUBLER)).not.toThrow()
  })

  it('virtual map weights match the calibrated composition', () => {
    const weights = DIAMOND_DOUBLER.virtualMaps.map((vmap, r) => {
      const c: Record<string, number> = {}
      vmap.forEach((p) => {
        const s = DIAMOND_DOUBLER.physicalStrips[r]![p]!
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    expect(weights[0]).toEqual({ DW: 3, S7: 3, B3: 5, B2: 8, B1: 14, CH: 2, BL: 37 })
    expect(weights[1]).toEqual({ DW: 2, S7: 3, B3: 5, B2: 8, B1: 13, CH: 2, BL: 39 })
    expect(weights[2]).toEqual({ DW: 2, S7: 3, B3: 5, B2: 8, B1: 14, CH: 2, BL: 38 })
  })

  it('FROZEN: exact RTP = 94.744245% (117877/124416), HF = 14.667460%', () => {
    const r = exactRtp(DIAMOND_DOUBLER)
    expect(r.rtpPerCoin).toBeCloseTo(117877 / 124416, 10)
    expect(r.rtpPerCoin).toBeCloseTo(0.94744245, 6)
    expect(r.hitFrequency).toBeCloseTo(0.14667460, 6)
  })

  it('FROZEN: P(3xDW) = 12/373248 = 1/31104', () => {
    const r = exactRtp(DIAMOND_DOUBLER)
    expect(r.breakdown.find(b => b.entryId === '3dw')!.probability).toBeCloseTo(1 / 31104, 12)
  })
})

describe('sevens-ablaze — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SEVENS_ABLAZE)).not.toThrow()
  })

  it('virtual map weights match the calibrated composition', () => {
    const weights = SEVENS_ABLAZE.virtualMaps.map((vmap, r) => {
      const c: Record<string, number> = {}
      vmap.forEach((p) => {
        const s = SEVENS_ABLAZE.physicalStrips[r]![p]!
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    expect(weights[0]).toEqual({ F7: 3, S7: 5, B3: 7, B2: 11, B1: 14, CH: 2, BL: 30 })
    expect(weights[1]).toEqual({ F7: 3, S7: 6, B3: 7, B2: 8, B1: 13, CH: 2, BL: 33 })
    expect(weights[2]).toEqual({ F7: 3, S7: 6, B3: 7, B2: 8, B1: 16, CH: 2, BL: 30 })
  })

  it('FROZEN: exact RTP @2 coins, meter at reset = 94.488115%, HF = 15.719307%', () => {
    const r = exactRtp(SEVENS_ABLAZE, { coins: 2 })
    expect(r.rtpPerCoin).toBeCloseTo(0.94488115, 6)
    expect(r.hitFrequency).toBeCloseTo(0.15719307, 6)
  })

  it('FROZEN: P(3xF7) = 27/373248 = 1/13824; at 1 coin RTP uses fixed 1000', () => {
    const r2 = exactRtp(SEVENS_ABLAZE, { coins: 2 })
    expect(r2.breakdown.find(b => b.entryId === '3f7')!.probability).toBeCloseTo(1 / 13824, 12)
    // At 1 coin the F7 award is the fixed 1000/coin = same per-coin value as
    // the reset meter (2000/2): identical per-coin RTP by design.
    const r1 = exactRtp(SEVENS_ABLAZE, { coins: 1 })
    expect(r1.rtpPerCoin).toBeCloseTo(r2.rtpPerCoin, 10)
  })
})
```

- [ ] **Step 6: Append the machine-dependent progressive tests** to `tests/progressive.test.ts` (moved here from Task 7 so the suite stays green between tasks). Add these imports at the top alongside the existing ones, then the two describes at the end of the file:

```ts
import { exactRtp } from '../app/engine/exactRtp'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import type { PercentProgressiveState } from '../app/engine/types'
```

```ts
describe('percent progressive', () => {
  it('feeds exactly feedRate per coin', () => {
    const cfg = SEVENS_ABLAZE.progressive!
    const st = initProgressiveState(cfg) as PercentProgressiveState
    for (let i = 0; i < 100; i++) addCoinToProgressive(st, cfg)
    expect(st.value).toBeCloseTo(cfg.reset + 100 * cfg.feedRate, 9)
  })

  it('clips at max', () => {
    const cfg = SEVENS_ABLAZE.progressive!
    const st = initProgressiveState(cfg) as PercentProgressiveState
    st.value = cfg.max - 0.005
    addCoinToProgressive(st, cfg)
    addCoinToProgressive(st, cfg)
    expect(st.value).toBe(cfg.max)
  })
})

describe('single progressive — clip at max', () => {
  it('freezes increments but keeps cycling its counter', () => {
    const cfg = SERIES_E_MULTIPLIER.progressive!
    if (cfg.kind !== 'single') throw new Error('expected single')
    const st = initProgressiveState(cfg) as SingleProgressiveState
    st.value = cfg.meter.max
    // at max >= rate1Limit, rate2 applies (8 coins per increment); 40 coins = 5 full cycles
    for (let i = 0; i < 40; i++) addCoinToProgressive(st, cfg)
    expect(st.value).toBe(cfg.meter.max)
    expect(st.coins).toBe(0)
  })
})

describe('break-even meter identity (self-validating, no hand constants)', () => {
  it('sevens-ablaze: RTP at the computed break-even meter is exactly 100%', () => {
    const def = SEVENS_ABLAZE
    const pJackpot = exactRtp(def, { progressiveValues: { meter: 0 } })
    // rtp(M) = rtpEx + P(jp) * M / coins  =>  M_be = coins * (1 - rtpEx) / P(jp)
    const jpEntry = exactRtp(def).breakdown.find(b => b.entryId === '3f7')!
    const rtpEx = pJackpot.rtpPerCoin
    const beMeter = def.maxCoins * (1 - rtpEx) / jpEntry.probability
    expect(beMeter).toBeGreaterThan(3500)
    expect(beMeter).toBeLessThan(3550)
    const atBe = exactRtp(def, { progressiveValues: { meter: beMeter } })
    expect(atBe.rtpPerCoin).toBeCloseTo(1.0, 10)
  })
})
```

- [ ] **Step 7: Run everything**

Run: `pnpm test` and `pnpm lint`
Expected: ALL green, including the appended progressive tests and the break-even identity test.

- [ ] **Step 8: Commit**

```bash
git add app/engine/stepper.ts app/machines/diamond-doubler.ts app/machines/sevens-ablaze.ts tests/stepper.test.ts tests/machines.test.ts tests/progressive.test.ts
git commit -m "Add Telnaes stepper evaluator, Diamond Doubler and Sevens Ablaze with frozen exact-RTP tests"
```

---

### Task 9: Engine facade — spin dispatch, machine state, batch simulation

**Files:** Create `app/engine/index.ts`, `app/machines/index.ts`, `tests/simulate.test.ts`; Modify `app/pages/index.vue`

- [ ] **Step 1: Write the failing tests** (`tests/simulate.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { addCoinToProgressive, initMachineState, simulateMachine, spin } from '../app/engine'
import { FLOOR } from '../app/machines'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { mulberry32 } from '../app/engine/rng'

describe('FLOOR', () => {
  it('contains the four Plan-1 machines, all valid', () => {
    expect(FLOOR.map(m => m.id).sort()).toEqual([
      'diamond-doubler', 'series-e-3line', 'series-e-multiplier', 'sevens-ablaze'
    ])
  })
})

describe('spin dispatch', () => {
  it('routes families to the right evaluator', () => {
    const s1 = spin(DIAMOND_DOUBLER, initMachineState(DIAMOND_DOUBLER), 1, mulberry32(1))
    expect(s1.family).toBe('stepper')
    const s2 = spin(SERIES_E_3LINE, initMachineState(SERIES_E_3LINE), 1, mulberry32(1))
    expect(s2.family).toBe('bally-em')
  })
})

describe('initMachineState', () => {
  it('initializes progressive meters at reset', () => {
    const st = initMachineState(SERIES_E_3LINE)
    expect(st.progressive?.kind).toBe('dual')
    if (st.progressive?.kind === 'dual') {
      expect(st.progressive.upper).toBe(5000)
      expect(st.progressive.lower).toBe(1000)
    }
    expect(initMachineState(DIAMOND_DOUBLER).progressive).toBeNull()
  })
})

describe('simulateMachine', () => {
  it('is reproducible by seed', () => {
    const a = simulateMachine(DIAMOND_DOUBLER, { spins: 10_000, coins: 1, seed: 7, progressiveMode: 'static' })
    const b = simulateMachine(DIAMOND_DOUBLER, { spins: 10_000, coins: 1, seed: 7, progressiveMode: 'static' })
    expect(a.rtp).toBe(b.rtp)
    expect(a.totalOut).toBe(b.totalOut)
  })

  it('accounts coin-in and payouts coherently', () => {
    const r = simulateMachine(DIAMOND_DOUBLER, { spins: 50_000, coins: 3, seed: 11, progressiveMode: 'static' })
    expect(r.totalIn).toBe(50_000 * 3)
    expect(r.rtp).toBeCloseTo(r.totalOut / r.totalIn, 12)
    expect(r.hitRate).toBeGreaterThan(0.10)
    expect(r.hitRate).toBeLessThan(0.20)
    expect(r.maxDrawdown).toBeGreaterThan(0)
  })

  it('live progressive mode feeds meters and pays above static on average', () => {
    // E-1203 jackpot is ~1/24k: 500k spins at 3 coins gives ~20 hits.
    const def = FLOOR.find(m => m.id === 'series-e-multiplier')!
    const live = simulateMachine(def, { spins: 500_000, coins: 3, seed: 13, progressiveMode: 'live' })
    expect(live.jackpotHits).toBeGreaterThan(5)
    // meters grew before each hit, so payout >= the static-reset accounting
    const stat = simulateMachine(def, { spins: 500_000, coins: 3, seed: 13, progressiveMode: 'static' })
    expect(live.totalOut).toBeGreaterThanOrEqual(stat.totalOut)
  })
})

describe('FO-5140 counter persistence across a jackpot hit', () => {
  it('dual toggle/coin counters continue through a hit; only the hit meter resets', () => {
    const def = SERIES_E_3LINE
    const state = initMachineState(def)
    const prog = state.progressive
    if (prog?.kind !== 'dual' || def.progressive?.kind !== 'dual') throw new Error('expected dual')
    // 7 coins, coinsPerToggle 1: upper sees coins 1,3,5,7 (counter 4 of 5); live ends 'lower'
    for (let i = 0; i < 7; i++) addCoinToProgressive(prog, def.progressive)
    expect(prog.upperCoins).toBe(4)
    expect(prog.live).toBe('lower')
    // force 5xS7 on the center line via rigged stops
    const stops = def.strips.map((strip) => {
      const idx = strip.indexOf('S7')
      return (idx - 1 + strip.length) % strip.length
    })
    let i = 0
    const rigged = () => (stops[i++]! + 0.5) / def.stops
    const out = spin(def, state, 1, rigged)
    expect(out.progressiveEvents).toHaveLength(1)
    // the LIVE (lower) meter paid and reset; counters and live did NOT reset
    expect(prog.lower).toBe(def.progressive.lower.reset)
    expect(prog.upperCoins).toBe(4)
    expect(prog.live).toBe('lower')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- tests/simulate.test.ts` → FAIL.

- [ ] **Step 3: Implement** (`app/engine/index.ts`)

```ts
import type { MachineDef, MachineSessionState, SpinOutcome } from './types'
import type { RandomFn } from './rng'
import { mulberry32 } from './rng'
import { spinStepper } from './stepper'
import { spinBallyEm } from './ballyEm'
import { initProgressiveState, addCoinToProgressive } from './progressive'

export * from './types'
export { mulberry32, cryptoSeed } from './rng'
export { exactRtp } from './exactRtp'
export type { ExactRtpReport, ExactRtpOptions, ExactRtpBreakdownEntry } from './exactRtp'
export { validateMachineDef } from './validate'
export { initProgressiveState, addCoinToProgressive } from './progressive'

export function initMachineState(def: MachineDef): MachineSessionState {
  return { progressive: def.progressive === null ? null : initProgressiveState(def.progressive) }
}

export function spin(
  def: MachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  return def.family === 'stepper'
    ? spinStepper(def, state, coins, rand)
    : spinBallyEm(def, state, coins, rand)
}

export interface SimOptions {
  spins: number
  coins: number
  seed: number
  /**
   * 'static': meters never fed — progressive awards pay reset values, making
   *           results directly comparable to exactRtp at-reset numbers.
   * 'live':   meters fed per coin-in (FO-5140 / percent semantics) and pay
   *           their grown values.
   */
  progressiveMode: 'static' | 'live'
}

export interface SimResult {
  machineId: string
  spins: number
  coins: number
  totalIn: number
  totalOut: number
  rtp: number
  hitRate: number
  jackpotHits: number
  /** deepest credits-below-peak point of the cumulative net curve */
  maxDrawdown: number
  byEntry: Record<string, number>
}

export function simulateMachine(def: MachineDef, opts: SimOptions): SimResult {
  const rand = mulberry32(opts.seed)
  const state = initMachineState(def)
  let totalOut = 0
  let hits = 0
  let jackpotHits = 0
  let net = 0
  let peak = 0
  let maxDrawdown = 0
  const byEntry: Record<string, number> = {}

  for (let i = 0; i < opts.spins; i++) {
    if (opts.progressiveMode === 'live' && def.progressive !== null && state.progressive !== null) {
      for (let c = 0; c < opts.coins; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    const out = spin(def, state, opts.coins, rand)
    totalOut += out.totalPayout
    if (out.wins.length > 0) hits++
    jackpotHits += out.progressiveEvents.length
    for (const w of out.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
    net += out.totalPayout - opts.coins
    if (net > peak) peak = net
    if (peak - net > maxDrawdown) maxDrawdown = peak - net
  }

  const totalIn = opts.spins * opts.coins
  return {
    machineId: def.id,
    spins: opts.spins,
    coins: opts.coins,
    totalIn,
    totalOut,
    rtp: totalOut / totalIn,
    hitRate: hits / opts.spins,
    jackpotHits,
    maxDrawdown,
    byEntry
  }
}
```

`app/machines/index.ts`:

```ts
import type { MachineDef } from '../engine/types'
import { DIAMOND_DOUBLER } from './diamond-doubler'
import { SEVENS_ABLAZE } from './sevens-ablaze'
import { SERIES_E_3LINE } from './series-e-3line'
import { SERIES_E_MULTIPLIER } from './series-e-multiplier'

export const FLOOR: MachineDef[] = [
  DIAMOND_DOUBLER,
  SEVENS_ABLAZE,
  SERIES_E_3LINE,
  SERIES_E_MULTIPLIER
]
```

Update `app/pages/index.vue` to prove the engine runs in-app:

```vue
<script setup lang="ts">
import { FLOOR } from '~/machines'
import { exactRtp } from '~/engine'

const rows = FLOOR.map(m => ({
  id: m.id,
  name: m.name,
  family: m.family,
  rtp: (exactRtp(m).rtpPerCoin * 100).toFixed(4) + '%'
}))
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-mono">
    <h1 class="text-2xl text-amber-400 mb-4">
      Slots Simulator — engine milestone
    </h1>
    <p class="text-neutral-400 mb-6">
      Headless engine online. Full floor UI lands in a later milestone; run
      <code>pnpm verify</code> for the verification report.
    </p>
    <table class="text-sm">
      <thead>
        <tr class="text-neutral-500 text-left">
          <th class="pr-6">Machine</th><th class="pr-6">Family</th><th>Exact RTP</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td class="pr-6">{{ r.name }}</td>
          <td class="pr-6">{{ r.family }}</td>
          <td class="text-emerald-400">{{ r.rtp }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 4: Run tests + boot the app**

Run: `pnpm test` → ALL PASS.
Run: `pnpm dev` briefly → the stub page lists 4 machines with their exact RTPs (94.7442%, 94.4881%, 89.0351%, 89.1264%). Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add app/engine/index.ts app/machines/index.ts tests/simulate.test.ts app/pages/index.vue
git commit -m "Add engine facade: spin dispatch, machine state init, seeded batch simulation"
```

---### Task 10: Convergence suite (simulation vs exact math)

**Files:** Create `tests/convergence.test.ts`

Statistical design: for N seeded spins we assert `|simRtp − exactRtp| < 3.5 × sqrt(variancePerCoin / N)`. The divisor is N (spins), NOT N × coins: on coins-linear machines (steppers, multiplier mode) every coin of a spin pays the identical per-coin amount — within-spin coins are perfectly correlated, so coins contribute no additional independent samples. (`lines` mode at >1 coin has near-independent rows instead, which is exactly why the strict block tests the lines machine at 1 coin only.) With fixed seeds the test is deterministic — it either always passes or the engine is wrong. 3.5σ keeps the false-trip probability ~5e-4 per machine if you ever change seeds; if a new seed lands outside, bump the seed once and note it — do NOT widen the band.

Multi-line correlation note: `variancePerCoin` is per-line variance, so lines machines (E-1202) are convergence-tested at **1 coin** (single line). A separate looser assertion covers 3-coin play (mean is unaffected by row correlation; only variance is).

- [ ] **Step 1: Write the tests** (`tests/convergence.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { exactRtp, simulateMachine } from '../app/engine'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import type { MachineDef } from '../app/engine'

interface Case {
  def: MachineDef
  coins: number
  spins: number
  seed: number
}

// E-1202 static mode pays 5000/1000 alternating (mean 3000 = the exact
// liveAverage); its realized jackpot variance differs from the flat-3000
// enumeration, but P(hit) = 1/5.15M makes the effect ~0 at this N.
const CASES: Case[] = [
  { def: DIAMOND_DOUBLER, coins: 1, spins: 4_000_000, seed: 1001 },
  { def: SEVENS_ABLAZE, coins: 2, spins: 4_000_000, seed: 1002 },
  { def: SERIES_E_3LINE, coins: 1, spins: 2_000_000, seed: 1003 },
  { def: SERIES_E_MULTIPLIER, coins: 3, spins: 2_000_000, seed: 1004 }
]

describe('convergence: simulation reproduces exact math', () => {
  for (const c of CASES) {
    it(`${c.def.id} @${c.coins} coin(s), ${c.spins.toLocaleString()} spins`, () => {
      const exact = exactRtp(c.def, { coins: c.coins })
      const sim = simulateMachine(c.def, {
        spins: c.spins, coins: c.coins, seed: c.seed, progressiveMode: 'static'
      })
      // SE divisor is spins, not spins x coins: per-coin pay is identical for
      // every coin of a spin on these machines (coins-linear), so within-spin
      // coins are perfectly correlated and add no independent samples
      const se = Math.sqrt(exact.variancePerCoin / c.spins)
      expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(3.5 * se)
      // hit frequency: binomial SE
      const hfSe = Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / c.spins)
      expect(Math.abs(sim.hitRate - exact.hitFrequency)).toBeLessThan(3.5 * hfSe)
    })
  }

  it('series-e-3line at 3 coins converges to the same per-coin RTP (loose band, correlated lines)', () => {
    const exact = exactRtp(SERIES_E_3LINE, { coins: 3 })
    // seed deliberately distinct from the strict 1-coin case above
    const sim = simulateMachine(SERIES_E_3LINE, {
      spins: 2_000_000, coins: 3, seed: 1005, progressiveMode: 'static'
    })
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(0.01)
  })

  it('jackpots actually occur at the expected rate (series-e-multiplier)', () => {
    // P(4xS7) = 1/24,414 -> lambda ~82 hits in 2M spins (sigma ~9). Bounds sit
    // ~3 sigma out so the fixed seed never flakes, yet both a half-rate and a
    // double-rate jackpot regression land outside the band.
    const sim = simulateMachine(SERIES_E_MULTIPLIER, {
      spins: 2_000_000, coins: 3, seed: 1004, progressiveMode: 'static'
    })
    expect(sim.jackpotHits).toBeGreaterThan(55)
    expect(sim.jackpotHits).toBeLessThan(110)
  })
})
```

- [ ] **Step 2: Run** — these are the heaviest tests in the suite (~30–90s total locally).

Run: `pnpm test -- tests/convergence.test.ts`
Expected: PASS. If a band fails: the evaluator or enumerator has a real bug (the same award code feeds both paths, so a mismatch means stop-drawing, coin handling, or progressive accounting diverged — debug there).

If slower CI hardware pushes any single test past the 180s timeout, halve the 4M cases via `const N = process.env.CI ? 2_000_000 : 4_000_000` — do not loosen the σ bands (they scale with N automatically).

- [ ] **Step 3: Commit**

```bash
git add tests/convergence.test.ts
git commit -m "Add seeded convergence suite: simulations match exact math within 3.5 sigma"
```

---

### Task 11: verify-floor CLI + README

**Files:** Create `scripts/verify-floor.ts`, `README.md`; Modify `CHANGELOG.md`

- [ ] **Step 1: Implement the CLI** (`scripts/verify-floor.ts`)

```ts
/**
 * Headless floor verification — the family's non-graphical statistical
 * component (compare: holdem scripts/simulate.ts, craps unit suites).
 *
 *   pnpm verify                     # 5M spins per machine
 *   pnpm verify -- --spins 1000000  # custom N
 *   pnpm verify -- --seed 42
 *
 * Exit code 0 when every machine lands inside its 3.5-sigma band, 1 otherwise.
 */
import { exactRtp, simulateMachine } from '../app/engine'
import { validateMachineDef } from '../app/engine/validate'
import { FLOOR } from '../app/machines'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || i + 1 >= process.argv.length) return fallback
  return Number(process.argv[i + 1])
}

const spins = arg('spins', 5_000_000)
const seed = arg('seed', 20260612)

const pct = (x: number) => (x * 100).toFixed(4).padStart(9) + '%'

console.log('=== metaincognita-slots floor verification ===')
console.log(`spins/machine: ${spins.toLocaleString()}   base seed: ${seed}\n`)
console.log('machine               coins   exact RTP    sim RTP      Δ           HF exact     HF sim      jackpots  σ-band')

let allPass = true

FLOOR.forEach((def, i) => {
  validateMachineDef(def)
  const coins = def.family === 'bally-em' && def.payMode === 'lines' ? 1 : def.maxCoins
  const exact = exactRtp(def, { coins })
  const sim = simulateMachine(def, { spins, coins, seed: seed + i, progressiveMode: 'static' })
  // SE divisor is spins alone: within-spin coins are perfectly correlated on
  // coins-linear machines (see tests/convergence.test.ts)
  const se = Math.sqrt(exact.variancePerCoin / spins)
  const delta = Math.abs(sim.rtp - exact.rtpPerCoin)
  const pass = delta < 3.5 * se
  allPass &&= pass
  console.log(
    `${def.id.padEnd(22)}${String(coins).padStart(3)}   ${pct(exact.rtpPerCoin)}  ${pct(sim.rtp)}  ${pct(delta)}  ${pct(exact.hitFrequency)}  ${pct(sim.hitRate)}  ${String(sim.jackpotHits).padStart(8)}  ${pass ? 'PASS' : 'FAIL'}`
  )
})

console.log(allPass
  ? '\nPASS: every machine is inside its 3.5-sigma statistical band.'
  : '\nFAIL: at least one machine fell outside its band — engine bug or band misconfiguration.')
process.exit(allPass ? 0 : 1)
```

- [ ] **Step 2: Run it**

Run: `pnpm verify -- --spins 1000000`
Expected output shape (numbers will match frozen values within bands):

```
=== metaincognita-slots floor verification ===
spins/machine: 1,000,000   base seed: 20260612

machine               coins   exact RTP    sim RTP      Δ           HF exact     HF sim      jackpots  σ-band
diamond-doubler         1     94.7442%    94.7xxx%     0.0xxx%     14.6675%    14.6xxx%         0  PASS
sevens-ablaze           2     94.4881%    94.4xxx%     0.0xxx%     15.7193%    15.7xxx%        xx  PASS
series-e-3line          1     89.0351%    89.0xxx%     0.0xxx%     11.8144%    11.8xxx%         0  PASS
series-e-multiplier     3     89.1264%    89.1xxx%     0.0xxx%     14.2559%    14.2xxx%        xx  PASS

PASS: every machine is inside its 3.5-sigma statistical band.
```

- [ ] **Step 3: Write `README.md`**

```markdown
# Metaincognita Slots

An educational slot machine simulator — part of the Metaincognita Casino
family (hold'em, video poker, craps, blackjack, flameout). Play authentic
machine archetypes, then see exactly what the casino never shows you: the
reel strips, the Telnaes virtual-reel weights, the engineered near-misses,
and the precise mathematics of the house edge.

**Status: engine milestone.** The headless engine, four calibrated machines,
and the statistical verification harness are complete. The playable UI,
X-ray mode, Sim Lab, and learn pages land in subsequent milestones.

## The floor (so far)

| Machine | Family | Format | Exact RTP |
|---|---|---|---|
| Diamond Doubler | Telnaes stepper | 3 reels, wild 2x/4x multiplier | 94.7442% |
| Sevens Ablaze | Telnaes stepper | 3 reels, 2-coin, percent-fed progressive | 94.4881% @ reset + 1%/coin-in feed |
| Series E 3-Line | Vintage Bally (E-1202 replica) | 5 reels x 22 uniform stops, 3 lines, dual toggling progressive | 89.0351% per line |
| Series E Multiplier | Vintage Bally (E-1203 replica) | 4 reels x 25 uniform stops, 1-3 coin multiplier | 89.1264% @ 3 coins / 85.0304% @ 1 |

Every RTP shown is **computed** from the machine definition by exact
enumeration (`exactRtp`) — never asserted — and verified by seeded
multi-million-spin simulation.

## Verification

```bash
pnpm install
pnpm test          # unit + frozen-calibration + convergence suites
pnpm verify        # headless floor verification report (5M spins/machine)
```

## Tech

Nuxt 4 SPA (ssr:false) - TypeScript strict - @nuxt/ui + Tailwind 4 -
Pinia - Vitest - pnpm. The engine (`app/engine/`) is pure TypeScript with
no framework imports; machines (`app/machines/`) are pure data.

## Sources

Machine behavior is grounded in period documentation (see `docs/`): the
Bally Series E service manual (Fey, 1995), Bally Manual 7050 parts catalog
(1981, models E-1202/E-1203), the Bally FO-5140 Double Progressive
instructions (1989), Bally Manual 6000 (1979, electromechanical), the
Massachusetts Gaming Commission Slot Machine Activity Manual v8 (2022),
and a pachislo owner's manual (2006). Weighted virtual reels follow the
Telnaes patent (US 4,448,419, 1984). Reel strips and weights are original
designs calibrated to documented real-world targets.
```

- [ ] **Step 4: Update CHANGELOG.md** — replace the `## [Unreleased]` section with:

```markdown
## [0.1.0] - 2026-06-12

### Added
- Project scaffold: Nuxt 4 SPA with family conventions (pnpm, @nuxt/ui,
  Tailwind 4, Pinia, Vitest, Netlify static preset, strict CSP).
- Headless engine (`app/engine/`): seeded mulberry32 RNG, award matching,
  uniform-stop Bally-EM evaluator, Telnaes virtual-reel stepper evaluator,
  FO-5140 progressive controllers (dual toggle / single / percent feed),
  exact-RTP enumeration with variance and per-entry breakdown, machine
  validation, seeded batch simulation.
- Four calibrated machines with frozen exact math: Diamond Doubler
  (94.7442%), Sevens Ablaze (94.4881% @ reset), Series E 3-Line (89.0351%),
  Series E Multiplier (89.1264% @ 3 coins).
- Verification: frozen-calibration tests, chi-squared RNG/distribution
  tests, 3.5-sigma convergence suite, `pnpm verify` floor report CLI.
```

- [ ] **Step 5: Full gate + commit**

Run: `pnpm lint` → clean (fix any stylistic nits it reports).
Run: `pnpm typecheck` → clean.
Run: `pnpm test` → all pass.
Run: `pnpm verify -- --spins 1000000` → PASS.

```bash
git add scripts/verify-floor.ts README.md CHANGELOG.md
git commit -m "Add verify-floor CLI, README, and 0.1.0 changelog"
```

---

### Task 12: Close out the milestone

- [ ] **Step 1:** Run the complete gate one last time: `pnpm lint && pnpm typecheck && pnpm test && pnpm verify`
Expected: every stage green.

- [ ] **Step 2:** Review `git log --oneline` — should read as a clean narrative (scaffold → rng → types/awards → validation → exactRtp → bally + machines → progressives → stepper + machines → facade → convergence → CLI/docs).

- [ ] **Step 3:** Tag the milestone:

```bash
git tag -a v0.1.0 -m "Engine foundation: 4 calibrated machines, exact math, verification harness"
```

- [ ] **Step 4:** Report completion, including the `pnpm verify` output table, and stop. Plan 2 (video slots + pachislo) is a separate plan document.

---

## Self-review checklist (run after writing, before execution)

- Spec coverage for Plan-1 scope: engine purity ✓ (no Vue imports in app/engine), machines-as-data ✓, computed-not-asserted RTP ✓, rngTrace ✓ (draws + virtualStops; near-miss analysis deferred to Plan 3 per spec's "derived from the trace"), FO-5140 controller ✓ (incl. counters-not-reset), seeded mulberry32 ✓, convergence + chi-squared + CLI ✓, family conventions ✓.
- Frozen numbers are internally consistent: DD 117877/124416 = 0.94744245 ✓; E-1202 104285/117128 = 0.89035073 ✓; E-1203 13926/15625 = 0.891264 ✓; SA jackpot p = 27/72³: reel F7 weights 3·3·3 = 27 ✓; DD allWild p = 3·2·2/72³ = 12/373248 = 1/31104 ✓.
- Type-name consistency: `RandomFn`, `MachineSessionState`, `SpinOutcome`, `bestStepperAward`, `ballyAwardForLine`, `exactRtp`, `simulateMachine`, `initMachineState`, `addCoinToProgressive`, `initProgressiveState` — used with identical signatures across Tasks 3–11.
