# Backlog Close — Design Spec (2026-07-10)

Owner directive: "implement the backlog, verify the README is current." Five
parts, ordered guard → content → perf → polish → docs.

## 1. Automated CSP smoke in CI (the guard)

The failure class is real and has happened twice: a CSP hash that doesn't
match the built inline scripts produces a **silent white screen at Nuxt boot**
in production. Static hash checks can't catch runtime-injected scripts (the
`RUNTIME_INJECTED` pin list exists precisely because they aren't in the HTML)
— only a real browser boot proves the site alive. Nothing in CI boots the
built site today.

**New `scripts/csp-smoke.mjs`** (node + `puppeteer-core` devDep — no bundled
browser; uses the system Chrome):

- Spawns the existing `scripts/smoke-serve.mjs` (real `dist/_headers`, the
  per-request re-read behavior already fixed) on an ephemeral port.
- Finds Chrome via `CSP_SMOKE_CHROME` env or well-known paths (ubuntu
  `google-chrome`/`chromium`, macOS app bundle). No Chrome → exit 0 with a
  loud SKIP **unless `CSP_SMOKE_REQUIRE=1`** (CI sets it — silence must not
  look like success there).
- Drives three pages and FAILS non-zero on any of:
  - `/` never renders the floor h1 (the white-screen signature);
  - `/learn/myths` never shows `1 in 13,824` (proves the rtp.worker loaded,
    ran 250k spins, and answered under `worker-src`);
  - `/sim-lab` never shows the live model panel with a dollar figure;
  - any console/page error matching `Refused to|Content Security Policy`
    (favicon 404 noise explicitly ignored).
- `package.json`: `"smoke:csp": "node scripts/csp-smoke.mjs"`.

**`.github/workflows/ci.yml`**: the Build step becomes `pnpm run generate`
(build + csp-hashes + prerendered `dist/` — a superset of `pnpm run build`),
followed by a new step running `pnpm run smoke:csp` with
`CSP_SMOKE_REQUIRE: 1` (ubuntu-latest ships Chrome). Netlify's gate is
untouched (its image has no Chrome; it deploys what CI already smoked).

## 2. `/learn/volatility` (the last learn page)

"Same toll, different ride": two machines can share an RTP while one pays
small-and-often and the other starves you between jackpot hits. Live, from
the exact reports (guidelines §2.2 — compute, never assert):

- A floor-wide table: machine, RTP, **sd/coin** (√`variancePerCoin`), and
  **N₀ = variance/edge²** — sortable story told by sorting on sd. Sevens
  Ablaze vs Diamond Doubler is the built-in punchline (≈0.25pp of RTP apart,
  wildly different sd), referenced in prose via the live rows.
- Headline: the ratio between the floor's wildest and tamest sd.
- Links: `/sim-lab` (watch the ride: survival curve, drawdowns),
  glossary anchors (`volatility`, `sd-per-coin`, `n0`).
- Glossary `volatility` and `sd-per-coin` entries gain links to the page.
- 12th hub card is wrong — **11th** (icon `i-lucide-activity`).

**New `app/composables/useFloorReports.ts`**: reactive per-floor exact
reports via `exactRtpAsync` + immediate `peekExactRtp` re-peek (the
useExactRtp trick generalized to a list) — cache-warm and no-Worker
environments fill synchronously, browsers fill from the rtp.worker.
**`house-edge.vue` migrates onto it**: it still computes 4×24⁵ video
enumerations synchronously in a `computed` today (it predates the worker
tranche — the last main-thread exact-math stall in the app).

## 3. Parked-bundle split (measured, then cut)

Measured: the parked engines ride the BOOT path today (the entry's static
import closure includes the chunk carrying `Flameout 21`/`seven-upgrade`
strings — `stores/slots.ts` imports the blackjack/lock spin functions
statically, `engine/index.ts` re-exports the parked API, `exactRtp.ts`
imports both parked RTP solvers, and `engine/sessions.ts` (with its parked
drivers) rides the barrel). ~58KB of parked source eagerly loaded to show a
floor it isn't on.

The cut, keeping every sync contract that matters:

- **New `app/engine/parked.ts`** — imports the four parked modules,
  registers their exactRtp solvers (below), re-exports the parked API. The
  ONLY static importers: `rtp.worker.ts`, `sim.worker.ts` (or sessions
  directly), node-side tests/verify.
- **`exactRtp.ts`** — drops the two static solver imports; adds
  `registerExactRtpSolver(family, solver)` + a registry consulted for
  non-floor families; unregistered → a clear throw naming
  `~/engine/parked`.
- **`engine/index.ts`** — stops re-exporting parked symbols; floor-only
  barrel. `engine/sessions.ts` leaves the barrel too (its consumers are
  sim.worker + tests + verify — all import it directly; main thread only
  ever used its types).
- **`freshBlackjackState`/`freshLockState`** move to a tiny
  `app/engine/sessionState.ts` (data factories, no logic) so
  `engine/restore.ts` and the store keep their SYNC restore path without
  dragging the engines. Old modules re-export them for compat.
- **`stores/slots.ts`** — the blackjack/lock ACTION branches
  (deal/stop/cash-out/lock stops) dynamic-import `~/engine/parked` (those
  actions are reachable only inside a legacy parked-machine session; actions
  become async, which templates don't observe).
- **`rtpClient.exactRtpAsync`** — for parked families with no Worker, await
  `import('~/engine/parked')` before the sync fallback (it's already async).
- Machine DEFS stay static (history/entryLabel need names synchronously;
  they're data).
- Acceptance: rebuild and assert the boot-path chunks contain neither
  `Flameout 21` nor `seven-upgrade`; record the byte delta in the CHANGELOG.

## 4. Stepper/Bally fit-scale

`ReelVideo` got `useFitScale` in the hardening pass; `ReelStepper` (3 cells)
and `ReelBally` (up to 5 reels, fixed px width) still hard-size and can clip
on narrow phones. Apply the same host-ref + compensated-scale pattern to
both. No math, no reel-logic changes.

## 5. Evaluated and NOT done (recorded so the backlog dies honestly)

- **Chrome primitives (gold-title/bulb)**: post-CabinetToolbar the 11 frames
  are ~120 lines each of genuinely bespoke SVG; shared primitives would save
  little and homogenize the one place the machines are supposed to be gaudy
  and distinct. Skip.
- **Machine-registry merge**: defs are pure data consumed by the engine and
  workers; chrome/symbols registries are component-land and already lazy
  with a Default fallback. Merging them would couple engine purity to Vue
  imports — the current "one def + one registry line" shape is the
  documented house pattern. Skip.
- **`useStopReelCabinet`**: Stock Rush is the only stop-reel machine left on
  the floor (the other two are parked); there is nothing to share yet.
  Revisit only if a second stop-reel machine ships.

## 6. README currency pass

Verify against the app as shipped: learn count (11 pages), volatility in the
learn list, the CI CSP smoke in Verification, mobile fit note if warranted;
CHANGELOG `[Unreleased]` entries for all of the above; versions cross-checked
against package.json (Nuxt 4 — owner's standing correction).

## Gates

House standard: per-task lint + targeted vitest (real exit codes); full
`pnpm check` once at the end; production-CSP browser smoke of the volatility
page + a run of the new `smoke:csp` script itself; commits stay local (push
only when the owner asks; timestamp rewrite before any push — everything
committed after 07:00 Friday is in-hours).
