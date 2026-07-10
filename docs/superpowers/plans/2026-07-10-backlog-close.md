# Backlog Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the remaining backlog per `docs/superpowers/specs/2026-07-10-backlog-close-design.md`: CI CSP smoke, `/learn/volatility` (+ house-edge worker migration), parked-bundle split, stepper/Bally fit-scale, README currency pass.

**Architecture:** Guard first (a real headless boot of `dist/` under the production `_headers` in GitHub Actions), then presentation on existing rails (`useFloorReports` generalizes the useExactRtp peek-then-await trick to the whole floor), then a module-graph cut (parked engines behind `~/engine/parked` with an exactRtp solver registry), then a composable reuse (`useFitScale` onto two more reel surfaces).

**Tech Stack:** Nuxt 4 / Vue 3 (package.json: nuxt ^4.4.2, vue ^3.5.38), vitest 4 + happy-dom, puppeteer-core (new devDep, no bundled browser), GitHub Actions ubuntu-latest (system Chrome), pnpm.

## Global Constraints

House standard (same as prior plans): no semicolons / single quotes / explicit return types on exports; per-task gate = `pnpm lint` + targeted `pnpm vitest run` with REAL exit codes; no dev/generate during check; conventional commits, no AI trailers; engine stays framework-pure (CI greps for it).

---

### Task 1: `scripts/csp-smoke.mjs` + CI wiring

**Files:** Create `scripts/csp-smoke.mjs`; modify `package.json` (script + devDep), `.github/workflows/ci.yml`.

- [ ] `pnpm add -D puppeteer-core`
- [ ] Write the script: spawn `smoke-serve.mjs` (env PORT, default 8791), locate Chrome (`CSP_SMOKE_CHROME` → `google-chrome`/`google-chrome-stable`/`chromium-browser`/`chromium` on PATH → macOS app bundle); missing → `CSP_SMOKE_REQUIRE=1` ? exit 1 : loud SKIP exit 0. Puppeteer connects, collects `console`/`pageerror` events, filters violations with `/Refused to|Content Security Policy/i`. Checks: `/` renders the floor `h1` (`SLOTS SIMULATOR`); `/learn/myths` shows `1 in 13,824` ≤ 20s (worker proof); `/sim-lab` shows `The math, before you spin` AND a `$` figure. Any violation or timeout → exit 1 with the offending messages printed. Always kill the server child.
- [ ] `package.json`: `"smoke:csp": "node scripts/csp-smoke.mjs"`.
- [ ] `ci.yml`: `Build` step → `pnpm run generate`; append step `CSP smoke — boot dist under the real headers` running `pnpm run smoke:csp` with `env: CSP_SMOKE_REQUIRE: 1`.
- [ ] Verify locally for real: `pnpm run smoke:csp` against the existing `dist/` → PASS output; then a NEGATIVE control: corrupt one CSP hash in `dist/_headers` (sed a digit), rerun → must FAIL with a Refused message; restore by regenerating `_headers` via `node scripts/csp-hashes.mjs`.
- [ ] `pnpm lint` → exit 0. Commit `feat(ci): headless CSP smoke — boot dist under real headers, workers proven, violations fail the build`.

### Task 2: `useFloorReports` + `/learn/volatility` + house-edge migration

**Files:** Create `app/composables/useFloorReports.ts`, `app/pages/learn/volatility.vue`; modify `app/pages/learn/house-edge.vue`, `app/pages/learn/index.vue` (11th card), `app/pages/learn/glossary.vue` (volatility + sd-per-coin links), `tests/components/learnPages.test.ts`.

**Interfaces:** `useFloorReports(): { reports: Ref<Map<string, ExactRtpReport>>, ready: Ref<boolean> }` keyed by def id, computed at `{ coins: def.maxCoins }` to match the house-edge page's existing figures.

```ts
// app/composables/useFloorReports.ts
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ExactRtpReport } from '~/engine'
import { FLOOR } from '~/machines'
import { exactRtpAsync, peekExactRtp } from '~/utils/rtpClient'

export function useFloorReports(): { reports: Ref<Map<string, ExactRtpReport>>, ready: Ref<boolean> } {
  const reports = ref<Map<string, ExactRtpReport>>(new Map())
  const ready = ref(false)
  const settle = (id: string, r: ExactRtpReport): void => {
    const next = new Map(reports.value)
    next.set(id, r)
    reports.value = next
    if (next.size === FLOOR.length) ready.value = true
  }
  for (const def of FLOOR) {
    const opts = { coins: def.maxCoins }
    const promise = exactRtpAsync(def, opts)
    const hit = peekExactRtp(def, opts) // fallback/warm cache fills synchronously
    if (hit !== null) settle(def.id, hit)
    else void promise.then(r => settle(def.id, r))
  }
  return { reports, ready }
}
```

- [ ] Tests first: volatility describe (mount + flushPromises → text has live `sd`, `N₀`-ish column, `/\d+\.\d+/` figures, 'ride', links to `/sim-lab`); house-edge test unchanged BUT add `await flushPromises()` if the fallback microtask needs it. Run → FAIL.
- [ ] Page: hub-standard layout; headline = wildest/tamest sd ratio (live); table Machine · RTP · sd/coin · N₀ sorted by sd desc; prose names the closest-RTP/widest-sd pair (Sevens Ablaze vs Diamond Doubler) using their live row values; footnote for pachislo attribution variance; links + glossary anchors.
- [ ] house-edge.vue: drop `exactRtp` import; `const { reports } = useFloorReports()`; rows computed from the map (guard empty → 'measuring…' state preserved by existing template? render rows only when present).
- [ ] Hub card after psychology: `{ to: '/learn/volatility', icon: 'i-lucide-activity', title: 'Volatility: same edge, different ride', blurb: '...' }`. Glossary: `volatility` + `sd-per-coin` entries gain `link: { to: '/learn/volatility', ... }`.
- [ ] Gate: `pnpm vitest run tests/components/learnPages.test.ts && pnpm lint`. Commit `feat(learn): volatility page — live sd/coin + N₀ floor table; house-edge exact math onto the worker path`.

### Task 3: Parked-bundle split

**Files:** Create `app/engine/parked.ts`, `app/engine/sessionState.ts`; modify `app/engine/exactRtp.ts`, `app/engine/index.ts`, `app/engine/blackjackReel.ts`, `app/engine/lockReel.ts`, `app/engine/restore.ts` (import swap), `app/engine/sessions.ts` (import parked API from `./parked`? NO — sessions keeps direct module imports, it just leaves the barrel), `app/stores/slots.ts`, `app/utils/rtpClient.ts`, `app/workers/rtp.worker.ts`, `app/workers/sim.worker.ts` (direct sessions import if it used the barrel), `scripts/verify-floor.ts` (parked import if it touches those families), affected tests' imports.

Key contracts:

```ts
// app/engine/exactRtp.ts (registry)
type ExactRtpSolver = (def: MachineDef, opts: ExactRtpOptions) => ExactRtpReport
const EXTRA_SOLVERS = new Map<string, ExactRtpSolver>()
export function registerExactRtpSolver(family: string, solver: ExactRtpSolver): void {
  EXTRA_SOLVERS.set(family, solver)
}
// in exactRtp() default branch:
//   const extra = EXTRA_SOLVERS.get(def.family)
//   if (extra) return extra(def, opts)
//   throw new Error(`exactRtp: family '${def.family}' is not loaded — import '~/engine/parked' first`)
```

```ts
// app/engine/parked.ts — the ONLY doorway to the parked engines.
// Static importers: workers, node tests/verify. The app dynamic-imports it.
import { blackjackReelExactRtp } from './blackjackReelRtp'
import { lockReelExactRtp } from './lockReelRtp'
import { registerExactRtpSolver } from './exactRtp'
registerExactRtpSolver('blackjack-reel', blackjackReelExactRtp)
registerExactRtpSolver('lock-reel', lockReelExactRtp)
export { dealReels, stopReel, cashOut, playBlackjackHand } from './blackjackReel'
export { makeOptimalStopFn } from './blackjackReelRtp'
export { dealStart, stopReel as lockStopReel, bonusStop, playLockRound } from './lockReel'
```

- [ ] Move `freshBlackjackState`/`freshLockState` bodies to `app/engine/sessionState.ts`; old homes re-export (`export { freshBlackjackState } from './sessionState'`) so tests/imports keep working; `restore.ts` + barrel import from `./sessionState`.
- [ ] Barrel: remove parked imports/re-exports; remove `sessions` re-exports if present (its consumers import `~/engine/sessions` directly — fix `sim.worker.ts`/tests if they used the barrel).
- [ ] Store: remove the two static parked imports; inside blackjack actions (`dealHand`/`stopReelAction`/`cashOut`-equivalents — locate by the removed symbols) and lock actions, `const parked = await import('~/engine/parked')`; actions become `async`.
- [ ] rtpClient: in `exactRtpAsync`'s no-Worker fallback AND the worker-crash `.catch`, if `def.family === 'blackjack-reel' || def.family === 'lock-reel'` → `await import('~/engine/parked')` first.
- [ ] `rtp.worker.ts`: add `import '~/engine/parked'`.
- [ ] Tests: new `tests/engine/parkedSplit.test.ts` — exactRtp on a FLOOR def works with NO parked import; exactRtp on `FLAMEOUT_21` after `import '~/engine/parked'` matches the frozen 89.9977%-family value already pinned elsewhere (reuse existing expectation source); unregistered-family error message names `~/engine/parked`. Existing suites stay green (they import leaf modules directly).
- [ ] Full targeted gate: `pnpm vitest run tests/blackjackReel.test.ts tests/blackjackReelRtp.test.ts tests/lockReel.test.ts tests/lockReelRtp.test.ts tests/engine/parkedSplit.test.ts tests/store.test.ts tests/utils/rtpClient.test.ts && pnpm lint`.
- [ ] Rebuild (`pnpm generate`) and assert the boot closure is clean: entry chunk + its statically-imported chunks contain neither `Flameout 21` nor `seven-upgrade`; record before/after chunk bytes for the CHANGELOG.
- [ ] Commit `perf(bundle): parked engines off the boot path — solver registry + ~/engine/parked doorway`.

### Task 4: Stepper/Bally fit-scale

**Files:** Modify `app/components/game/ReelStepper.vue`, `app/components/game/ReelBally.vue`; test additions in `tests/components/reelSurfaces.test.ts`.

- [ ] Mirror ReelVideo's integration exactly: compute the natural pixel width already used in the inline style, `const { host, scale } = useFitScale(NATURAL_W)`, wrap the fixed-width block in the host div with the compensated transform (copy ReelVideo's binding shape verbatim).
- [ ] Tests: surfaces still render all cells (existing assertions) and the host wrapper exists; happy-dom has no ResizeObserver — `useFitScale` already no-ops there (its own tests cover it).
- [ ] Gate: `pnpm vitest run tests/components/reelSurfaces.test.ts tests/composables/useFitScale.test.ts && pnpm lint`. Commit `fix(mobile): stepper and Bally reel windows fit-scale instead of clipping`.

### Task 5: README currency + CHANGELOG + full gate + smokes

- [ ] README: Learn item 7 → eleven pages + volatility sentence; Verification section gains the `smoke:csp` line (what it proves); confirm counts/claims against the app (11 learn pages, 39→41? — glossary unchanged this tranche unless links only); versions per package.json.
- [ ] CHANGELOG `## [Unreleased]`: Added (CI CSP smoke; volatility page), Changed (house-edge onto the worker path; stepper/Bally fit-scale), Performance (parked split w/ measured bytes), Notes (evaluated-and-skipped trio, one line).
- [ ] `pnpm check` (foreground exit code) → PASS. `pnpm generate` → `pnpm run smoke:csp` → PASS (this also live-verifies volatility via an added page check? No — keep script stable; drive volatility manually in the browser smoke below).
- [ ] Browser smoke (chrome-devtools MCP): `/learn/volatility` fills live sd table under CSP; house-edge still renders its table; narrow-viewport (390px) stepper + Bally pages don't overflow horizontally.
- [ ] Commit docs + this spec/plan pair. Report state (local commits, in-hours stamps → rewrite before any push).
