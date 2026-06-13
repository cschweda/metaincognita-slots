# Plan 2: Video Slots + Pachislo Families — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the headless engine with the `video` family (lines, 243-ways, scatters, free spins, hold-and-spin) and the `pachislo` family (flag lottery, stock queues, bounded skill-stop control, six odds levels), add the four pre-calibrated machines (Canal Royale, Dragon's Hoard, Thunder Vault, Stock Rush), and verify everything to the same exact-math + convergence standard as Plan 1 — finishing the 8-machine floor at v0.2.0.

**Architecture:** Same contract as Plan 1: machines are pure data, `spin()` dispatches by family, and the exact-RTP calculator shares award-evaluation helpers with the spin evaluators so display math and gameplay math cannot diverge. Two new wrinkles: (1) video features (free spins, hold-and-spin respins) span multiple `spin()` calls via `MachineSessionState` — `SpinOutcome` gains `gameKind`, `coinsIn`, and `featureEvents` so the simulator/UI can account for zero-cost feature spins; (2) video strips are deliberately compact (24 cells) so the **full 24⁵ = 7,962,624-state cycle is exactly enumerable in TypeScript** — `exactRtp` computes video hit frequency and variance from the complete joint distribution, with feature moments folded in analytically (Wald identity for retriggers, branching-process second moments, absorbing Markov chain for hold-and-spin). Pachislo RTP is a closed-form renewal quotient; its skill-stop control is deterministic and exhaustively verified (all 21³ press triples) to never produce a win without a flag and never lose a flag.

**Tech Stack:** unchanged — Nuxt 4.4 SPA, TypeScript strict, Vitest 4, pnpm 10.33, tsx. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-12-slots-simulator-design.md`

**Roadmap context:** Plan 2 of 4. Plan 1 (engine + 4 machines, v0.1.0) is complete. Plan 3 = UI (Pinia store owns per-coin `addCoinToProgressive` feeds, floor/game/X-ray/PAR/history). Plan 4 = Sim Lab worker (will need `simulateMachine` progress/cancel/initial-state params for chunking — deliberately NOT added here, YAGNI until the worker exists), learn page, deploy.

**Conventions for every commit:** descriptive message, **NO AI co-author trailers** (user rule). Work on `main`. Run `pnpm test` AND `pnpm lint` before each commit (`pnpm exec eslint . --fix` first, resolve the rest by hand; never change test semantics to satisfy style).

---

## Numbers provenance (read first)

The four machines below were **calibrated during planning by exact enumeration and closed-form analysis** (Python, integer/Fraction arithmetic over the complete 24⁵ video cycles and the pachislo renewal equation — no simulation, no rounding). The TypeScript `exactRtp()` must reproduce these values; frozen tests assert them to 6 decimal places. **If a frozen test fails, the evaluator semantics diverged from this plan — fix the code, never the frozen number.**

| Machine | Frozen exact RTP | Hit freq | variancePerCoin | Key event |
|---|---|---|---|---|
| canal-royale | **92.455942%** per coin (= 628217093/679477248, any line count) | 55.534306% @25 lines (= 122833/221184) | 8.792463 | P(free spins) = 29/4096; P(5×LI on a line) = 1/31,104 |
| dragons-hoard | **93.995040%** per coin (= 94747/100800) | 53.553376% (= 236903/442368) | 10.696426 | retrigger q = 29/4096 → E[total free spins] = 4096/483 ≈ 8.4803 |
| thunder-vault | **90.294753%** per coin @ grand reset 5000 | 41.289906% (= 68495/165888) | 29.259962 | P(6+ orbs) = 449/55296; Grand ≈ 1/5,138 spins |
| stock-rush L4 | **91.5013%** (= 9920919/10842379) @ 3 tokens | 21.2341% (= 3479/16384) | sd ≈ 8.909/token (attribution) | BIG = 1/277.7 (59/16384); E[BIG gross] = 34595/81 ≈ 427.1 tokens |

Stock Rush, all six operator levels (3 tokens; manual bands from Pachislo How-To Manual p.11 — every level lands in band):

| Level | bell /16384 | exact RTP | band | HF |
|---|---|---|---|---|
| 1 | 86 | 7073619/10717403 = **66.0012%** | 65–67 | 3167/16384 = 19.3298% |
| 2 | 212 | 2612958/3579425 = **72.9994%** | 72–74 | 3298/16384 = 20.1294% |
| 3 | 303 | 2871048/3589537 = **79.9838%** | 79–81 | 3396/16384 = 20.7275% |
| 4 | 371 | 9920919/10842379 = **91.5013%** | 88–95 | 3479/16384 = 21.2341% |
| 5 | 551 | 3855318/3636857 = **106.0069%** | 105–107 | 3674/16384 = 22.4243% |
| 6 | 670 | 775932/646595 = **120.0028%** | 115–125 | 3812/16384 = 23.2666% |

### Video semantics that produced these numbers (Tasks 4–8 encode exactly this)

- **Grid:** 5 reels × 3 rows, strip length 24, stop drawn uniform; `grid[reel][row] = strip[(stop + row) % 24]`. `stops[r]` is the **top-row** strip index (same convention as bally-em).
- **Line wins (canal-royale, thunder-vault):** 25 fixed patterns (`LINES25`, rows per reel). Coins = active lines, patterns `0..coins-1`. A line is **anchored on reel 1**: anchor = cell 0 (wild never appears on reel-1 strips — validator-enforced); run = maximal prefix of cells equal to anchor-or-wild; pay = the paytable entry with that exact symbol and run length (entries exist for lengths 3–5); per line bet of 1 coin. No wild multiplier. Scatter/orb cells never match an anchor (they have no paytable entries).
- **Ways wins (dragons-hoard):** for each paying symbol, `n[r]` = count of symbol-or-wild cells in reel r's 3-cell window; run = maximal prefix with all `n[r] ≥ 1`; if run ≥ 3, win = `pay(symbol, run) × ∏ n[r]` credits. Each symbol pays only its longest run; wins sum across symbols. Total bet 25 buys all 243 ways.
- **Scatter:** scatters appear on designated reels (c=1 per strip), strip-spaced ≥ 3 apart so a window shows **at most one** scatter ⇒ P(visible on a reel) = exactly 3/24. k = number of reels showing a scatter; pays are `pays[k] × total bet`; k ≥ 3 also triggers free spins.
- **Free spins:** replay the triggering bet at cost 0. Canal: 10 spins at ×2 (all wins doubled, scatters pay but do NOT retrigger). Dragon's Hoard: 8 spins at ×1, retriggers add 8 (uncapped — the Wald identity E[T] = 8/(1−8q) assumes this). RTP factor: Canal = (1 + 20·P_tr); DH = 1/(1 − 8q) = 4096/3864.
- **Hold-and-spin (thunder-vault):** orb symbols carry credit values drawn per orb from a weighted table at landing. T = total orbs visible (per-reel window counts 0–2 from the strip clusters); T ≥ 6 locks them and starts 3 respins over the 15-cell grid. Each respin, every unlocked cell independently lands an orb with probability **2/24**; any new orb resets the counter to 3; filling all 15 pays the **Grand** (percent progressive; valued at reset 5000 for exactRtp). The feature pays the sum of all locked orb values once, at feature end. Orbs pay nothing in the base game.
- **Hit frequency** = P(base game has any line/ways/scatter win OR feature trigger). Free spins/respins are not base games.
- **variancePerCoin** = Var(full cycle payout per coin of the triggering bet), where a cycle = one base game plus its complete feature. Feature moments are exact: free-spin totals via i.i.d./branching second-moment identities using E[B²] and E[B·1_trigger] from the joint cycle; hold-and-spin via the absorbing Markov chain over (locked count, respins left) and orb-value moments. Convergence SE = √(variancePerCoin / baseSpins), exactly as Plan 1 (the whole cycle is one renewal sample).
- **Per-coin RTP is invariant to the line count** on canal-royale (each line has identical EV because every row's marginal distribution is the strip composition; scatter pays scale with total bet) — tested at coins 1 vs 25.

### Pachislo semantics that produced these numbers (Tasks 10–12 encode exactly this)

- **Hardware:** 3 reels × 21 stops; press positions drawn uniform (the sim's "player"); the reel **slips 0–4 stops forward** from the press; rows: stop s shows `strip[s]`/`strip[s+1]`/`strip[s+2]` (top/center/bottom). Lines: 1 token = center; 2 = + top + bottom; 3 = + both diagonals (manual §2.1).
- **Lottery:** one draw per normal game over /16384: cherry-top/mid/bot (167 each), watermelon 256, replay 2245 (≈1/7.30, level-independent like the real regulation), bell (per level, table above), REG and BIG (per level). The flag — not the player — decides what can win: **the spin's outcome value is fully determined at draw time**.
- **Stock invariant (the core lesson):** drawn flags are queued (smalls FIFO, bonuses FIFO) and **never lost**. Each game the control targets the front small flag, else the front bonus flag: it searches the 125 stop combinations in slip order and picks the first that realizes the target **with no other paying combo**; if none exists, the first with no paying combo at all (flag stays queued — "stocked"). Player timing therefore shifts *when* wins land, never the long-run RTP: RTP = Σ(flag value)/Σ(cost) is timing-free. Exhaustively verified in planning (and re-verified in vitest): **for every one of 21³ = 9,261 press triples × every token count, a no-win stop combo exists** — zero avoidance failures. Full-grid realization service rates (descriptive, frozen): bell 6082/9261 ≈ 65.67%, replay ≈ 33.04%, watermelon ≈ 19.22%, REG ≈ 18.46%, BIG 845/9261 ≈ 9.12%, cherry 5/7 per row.
- **Combos** (center line): bell BE×3 pays 15; watermelon WM×3 pays 8; replay RP×3 → next game free (same bet); REG = R7 R7 BB pays 15 then 8 JAC games; BIG = R7 R7 R7 pays 15 then 3 rounds of 8 JAC games with 2 increased-odds interludes between rounds (manual §3.1: "15 tokens + 8 guaranteed wins" / "15 tokens + 24 guaranteed wins in 3 rounds"). **Cherry** is a reel-1-only win whose flag includes the target row; it pays 2 per active line through that cell — at 3 tokens corner rows cross 2 lines (pay 4) and the middle row 1 (pay 2), E = 10/3; at 2 tokens every row pays 2; at 1 token only the center row pays (E = 2/3 — a flagged top-row cherry is *wasted* at 1 token; that's the max-bet lesson, surfaced in the X-ray).
- **JAC game:** costs 1 token, pays 15, guaranteed: the 15 is awarded by the bonus state machine, the reels are presentation (control lines bells best-effort). Same decoupling for interlude bell pays. This keeps bonus EV exact: REG gross = 15 + 8×15 = 135 (cost 8); BIG gross = 15 + 24×15 + 15·(interlude bells).
- **Interlude** ("bonus period with increased odds … continues until you hit a free game", manual §3.1): each game costs 1 token; lottery /16: bell 8/16 (pays 15), end 4/16, nothing 4/16; the interlude also ends at 5 bells. Exact moments: E[bells] = 422/243 ≈ 1.7366, E[games] = 844/243 ≈ 3.4733 ⇒ E[BIG gross] = 375 + 30·(422/243) = **34595/81 ≈ 427.1 tokens**, hard ceiling 525 = **35 payouts × 15** — exactly the manual's "up to 35 payouts (500 tokens)".
- **RTP (renewal quotient, per level at 3 tokens):**
  `OUT = p_ch·E_ch + p_wm·8 + p_bell·15 + p_reg·135 + p_big·(375 + 30·E[bells])`
  `IN = 3·(1 − p_rp) + p_reg·8 + p_big·(24 + 2·E[games])`
  `RTP = OUT / IN` — replays make one future game free (accounted in IN), so a replay flag is worth exactly its bet.
- **HF** = Σ p_flag over all non-NONE flags (queue conservation: every drawn flag is realized exactly once, eventually; the realization game is the "hit"). A realized replay or a pay-0 cherry counts as a hit (flag-realized event), matching this definition.
- **variancePerCoin (pachislo) is attribution variance** — the variance of the per-lottery-draw *value* distribution per token (bonus flows attributed to the drawing game). It describes volatility for the UI; it is NOT a valid i.i.d. convergence SE because bonus flows actually spread over later games. Convergence tests therefore use **block-empirical SE** (split the run into ≥100 blocks, SE = sd(block RTPs)/√blocks).
- Carried Plan-1 authenticity note: percent-meter breakage (hits pay `floor(meter)`, sub-credit remainder discarded ~1.8e-5 RTP) still applies to Thunder Vault's Grand; real machines carry breakage on-meter. Still deferred beyond v0.2.

### Plan-1 review backlog folded into this plan

1. Family dispatch ternaries → exhaustive `switch` with `never` checks (Task 1 — first commit).
2. Static-mode dual-progressive semantics — **decision: keep current behavior** (static mode never advances the FO-5140 toggle, so a static jackpot pays the upper reset; the +0.039% modeled gap is documented in `tests/convergence.test.ts`). No code change; decision recorded here.
3. Naming: `SimResult.hitRate` → `hitFrequency` (aligns with `ExactRtpReport`); JSDoc for `byEntry` (Task 1).
4. `verify-floor` `--spins`/`--seed` NaN guard (Task 2); jackpot-column footnote (Task 15).
5. Bally physical-stop χ² test, coins-out-of-range throw tests, `exactRtp` coins guard (Task 2).
6. Vitest `environment: 'node'` (Task 1 — engine suites need no DOM; Plan 3 adds per-suite environments for components).
7. `SpinOutcome.stops` semantics comment (Task 1).

---

## File structure (Plan 2 complete map)

```
app/
  engine/
    types.ts            # MODIFY: video + pachislo defs, feature states, GameKind, FeatureEvent,
                        #         coinsIn/gameKind/featureEvents on SpinOutcome, presses trace
    index.ts            # MODIFY: exhaustive spin() switch, initMachineState v2, simulateMachine v2
    exactRtp.ts         # MODIFY: family switch → enumerate (stepper/bally) | video | pachislo; coins guard
    validate.ts         # MODIFY: exhaustive switch + video + pachislo rules
    videoAwards.ts      # CREATE: LINES25, cellAt, evalLine, evalWays, scatterCount, orbWindowCells
    video.ts            # CREATE: spinVideo — base/free-spin/respin state machine
    videoRtp.ts         # CREATE: videoExactRtp — closed forms + full 24^5 joint cycle + feature moments
    pachislo.ts         # CREATE: spinPachislo — lottery, queues, control/slip, bonus rounds
    pachisloRtp.ts      # CREATE: pachisloExactRtp + interludeMoments (renewal closed form)
  machines/
    canal-royale.ts     # CREATE   dragons-hoard.ts  # CREATE   thunder-vault.ts  # CREATE
    stock-rush.ts       # CREATE   index.ts          # MODIFY: FLOOR = 8 machines
scripts/verify-floor.ts # MODIFY: family-aware coins, NaN guard, pachislo block-SE, footnote
vitest.config.ts        # MODIFY: environment 'node'
tests/
  videoAwards.test.ts   # CREATE   video.test.ts        # CREATE   videoRtp.test.ts   # CREATE
  machines-video.test.ts# CREATE   pachislo.test.ts     # CREATE   pachisloRtp.test.ts# CREATE
  machines-pachislo.test.ts # CREATE
  ballyEm.test.ts       # MODIFY: + stop-distribution χ²     simulate.test.ts # MODIFY: v2 fields
  exactRtp.test.ts      # MODIFY: + coins guard       stepper.test.ts  # MODIFY: + throw tests
  convergence.test.ts   # MODIFY: + 3 video cases + pachislo block-SE cases
CHANGELOG.md            # MODIFY   README.md           # MODIFY   package.json # MODIFY: 0.2.0
```

Evaluator/helper purity rule is unchanged: nothing under `app/engine/` imports Vue/Nuxt/Pinia.

---

### Task 1: Plan-1 backlog refactor (exhaustive dispatch, naming, node env)

**Files:**
- Modify: `vitest.config.ts`
- Modify: `app/engine/index.ts`
- Modify: `app/engine/exactRtp.ts:62`
- Modify: `app/engine/validate.ts:14,54`
- Modify: `app/engine/types.ts:196-197`
- Modify: `scripts/verify-floor.ts:44` (hitRate → hitFrequency usage)
- Modify: `tests/simulate.test.ts`, `tests/convergence.test.ts` (hitRate → hitFrequency usages)

- [ ] **Step 1: Switch vitest to the node environment**

In `vitest.config.ts` replace `environment: 'happy-dom'` with:

```ts
    environment: 'node',
```

(happy-dom stays in devDependencies; Plan 3 will scope DOM environments per component suite.)

- [ ] **Step 2: Run the suite to confirm the environment change is invisible to engine tests**

Run: `pnpm test`
Expected: all 86 tests pass, startup measurably faster.

- [ ] **Step 3: Exhaustive family dispatch + naming + comments**

In `app/engine/index.ts` replace the `spin` body's ternary with an exhaustive switch (this is the pattern Tasks 5/10 extend — adding a family then FAILS typecheck until every switch handles it):

```ts
export function spin(
  def: MachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  switch (def.family) {
    case 'stepper':
      return spinStepper(def, state, coins, rand)
    case 'bally-em':
      return spinBallyEm(def, state, coins, rand)
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
}
```

In `app/engine/index.ts` rename `SimResult.hitRate` to `hitFrequency` (vocabulary now matches `ExactRtpReport.hitFrequency`) and document `byEntry`:

```ts
export interface SimResult {
  machineId: string
  spins: number
  coins: number
  totalIn: number
  totalOut: number
  rtp: number
  /** fraction of spins with at least one win (vocabulary matches ExactRtpReport.hitFrequency) */
  hitFrequency: number
  jackpotHits: number
  /** deepest credits-below-peak point of the cumulative net curve */
  maxDrawdown: number
  /** win COUNT per paytable entry id — multiple wins of one entry in a spin all count */
  byEntry: Record<string, number>
}
```

Update its assignment in `simulateMachine` (`hitRate: hits / opts.spins` → `hitFrequency: hits / opts.spins`) and every usage: `scripts/verify-floor.ts` (`sim.hitRate` → `sim.hitFrequency`), `tests/simulate.test.ts`, `tests/convergence.test.ts` (`sim.hitRate` → `sim.hitFrequency`).

In `app/engine/exactRtp.ts` replace `const weights = def.family === 'stepper' ? stepperWeights(def) : ballyWeights(def)` with:

```ts
  let weights: Map<SymbolId, number>[]
  switch (def.family) {
    case 'stepper':
      weights = stepperWeights(def)
      break
    case 'bally-em':
      weights = ballyWeights(def)
      break
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
```

In `app/engine/validate.ts` replace the `if (def.family === 'stepper') { ... } else { ... }` split with `switch (def.family) { case 'stepper': ...; break; case 'bally-em': ...; break; default: never-throw }` (same bodies, same never pattern).

In `app/engine/types.ts` replace the `stops` JSDoc with:

```ts
  /**
   * Strip stop index per reel. Semantics by family: bally-em & video = the
   * TOP-ROW cell index (rows are stop, stop+1, stop+2); stepper = the payline
   * cell index (rows are stop-1, stop, stop+1); pachislo = the top-row cell
   * index AFTER control/slip resolution.
   */
  stops: number[]
```

- [ ] **Step 4: Lint, typecheck, test**

Run: `pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test`
Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Refactor family dispatch to exhaustive switches; rename hitRate to hitFrequency; node test env"
```

---

### Task 2: Plan-1 backlog test hardening

**Files:**
- Modify: `tests/ballyEm.test.ts` (χ² + throw test)
- Modify: `tests/stepper.test.ts` (throw test)
- Modify: `tests/exactRtp.test.ts` (coins guard)
- Modify: `app/engine/exactRtp.ts` (coins guard)
- Modify: `scripts/verify-floor.ts` (NaN guard)

- [ ] **Step 1: Write the failing tests**

Append to `tests/ballyEm.test.ts`:

```ts
describe('physical-stop distribution (uniform, pre-Telnaes)', () => {
  it('chi-squared over 200k spins stays under the df=21 critical value', () => {
    // E-1202 reel 1 has 22 uniform stops -> df = 21; chi2_0.999(21) = 46.80.
    // Fixed seed makes this deterministic; bound 50 leaves slack while a
    // weighted reel (any stop +/-30% off uniform) lands in the thousands.
    const def = SERIES_E_3LINE
    const state = initMachineState(def)
    const rand = mulberry32(777)
    const counts = new Array<number>(def.stops).fill(0)
    const spins = 200_000
    for (let i = 0; i < spins; i++) {
      const out = spinBallyEm(def, state, 1, rand)
      counts[out.stops[0]!]!++
    }
    const expected = spins / def.stops
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(50)
  })

  it('throws when coins are out of range', () => {
    const state = initMachineState(SERIES_E_3LINE)
    expect(() => spinBallyEm(SERIES_E_3LINE, state, 0, mulberry32(1))).toThrow(/out of range/)
    expect(() => spinBallyEm(SERIES_E_3LINE, state, 4, mulberry32(1))).toThrow(/out of range/)
  })
})
```

(Add the needed imports at the top of the file if missing: `initMachineState`, `mulberry32` from `'../app/engine'`, `SERIES_E_3LINE` from `'../app/machines/series-e-3line'`.)

Append to `tests/stepper.test.ts`:

```ts
describe('coin range', () => {
  it('throws when coins are out of range', () => {
    const state = initMachineState(DIAMOND_DOUBLER)
    expect(() => spinStepper(DIAMOND_DOUBLER, state, 0, mulberry32(1))).toThrow(/out of range/)
    expect(() => spinStepper(DIAMOND_DOUBLER, state, 4, mulberry32(1))).toThrow(/out of range/)
  })
})
```

Append to `tests/exactRtp.test.ts`:

```ts
describe('coins guard', () => {
  it('rejects coin levels the machine does not support', () => {
    expect(() => exactRtp(DIAMOND_DOUBLER, { coins: 0 })).toThrow(/out of range/)
    expect(() => exactRtp(DIAMOND_DOUBLER, { coins: 4 })).toThrow(/out of range/)
  })
})
```

- [ ] **Step 2: Run to verify the new exactRtp test fails (spin throws already exist)**

Run: `pnpm test -- exactRtp`
Expected: FAIL — exactRtp currently accepts any coins.

- [ ] **Step 3: Implement the exactRtp guard**

In `app/engine/exactRtp.ts`, right after `const coins = opts.coins ?? def.maxCoins`:

```ts
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
```

- [ ] **Step 4: verify-floor argument guard**

In `scripts/verify-floor.ts` replace the `arg` helper with:

```ts
function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || i + 1 >= process.argv.length) return fallback
  const n = Number(process.argv[i + 1])
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`--${name} must be a positive number, got "${process.argv[i + 1]}"`)
    process.exit(2)
  }
  return n
}
```

- [ ] **Step 5: Full gate, quick verify smoke**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm verify -- --spins 100000`
Expected: all green; verify exits 0 with a 4-machine PASS table. Also check `pnpm verify -- --spins banana` exits 2 with the error message.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Harden Plan-1 surfaces: bally stop chi-squared, coin-range throw tests, exactRtp coins guard, verify-floor arg guard"
```

---

### Task 3: Types for the video + pachislo families

**Files:**
- Modify: `app/engine/types.ts`
- Modify: `app/engine/index.ts` (initMachineState v2, temporary not-implemented switch arms)
- Modify: `app/engine/validate.ts`, `app/engine/exactRtp.ts` (temporary not-implemented arms)

The temporary `throw new Error('implemented in a later Plan-2 task')` arms keep typecheck green at this commit; Tasks 5–12 replace them. No frozen math here — this task is pure contract.

- [ ] **Step 1: Extend `app/engine/types.ts`**

Replace `export type MachineFamily = 'stepper' | 'bally-em'` (and its Plan-2 comment) with:

```ts
export type MachineFamily = 'stepper' | 'bally-em' | 'video' | 'pachislo'
```

Append after the Bally award types:

```ts
/** Video line/ways award: exact run length 3..5 anchored on reel 1. */
export interface VideoPayEntry {
  id: string
  symbol: SymbolId
  length: 3 | 4 | 5
  /** per 1-coin line bet (lines mode) or per way-unit (ways mode) */
  pay: number
}

export interface ScatterConfig {
  symbol: SymbolId
  /** pays by count of reels showing the scatter, x TOTAL bet */
  pays: Record<number, number>
  /** visible-reel count that triggers free spins (null = pays only) */
  triggerCount: number | null
}

export interface FreeSpinsConfig {
  count: number
  multiplier: number
  /** another triggerCount scatters during free spins adds `count` more spins */
  retrigger: boolean
}

export interface OrbValueEntry {
  /** credits at maxCoins bet */
  credits: number
  weight: number
  label?: 'mini' | 'minor' | 'major'
}

export interface HoldAndSpinConfig {
  orbSymbol: SymbolId
  /** total visible orbs that lock and start the feature (15-cell grid) */
  triggerCount: number
  respins: number
  /** per unlocked cell, per respin: P(orb) = respinOrbNumer / respinOrbDenom */
  respinOrbNumer: number
  respinOrbDenom: number
  orbValues: OrbValueEntry[]
  /** filling all 15 cells pays the percent progressive (the Grand) */
}
```

Append after `BallyEmMachineDef`:

```ts
export interface VideoMachineDef extends MachineDefBase {
  family: 'video'
  /** 5 circular strips; window = 3 consecutive cells; all strips same length */
  strips: SymbolId[][]
  /**
   * 'lines': coins = active line count, lines[i] = row per reel (0 top..2 bottom).
   * 'ways': left-anchored any-adjacent ways; maxCoins buys all ways.
   */
  betMode: { kind: 'lines', lines: number[][] } | { kind: 'ways' }
  /** true => spin() only accepts coins === maxCoins (feature-bearing machines) */
  fixedBet: boolean
  /** never on reel-1 strips (anchoring rule, validator-enforced) */
  wildSymbol: SymbolId | null
  scatter: ScatterConfig | null
  freeSpins: FreeSpinsConfig | null
  holdAndSpin: HoldAndSpinConfig | null
  paytable: VideoPayEntry[]
  /** Thunder Vault Grand; null for machines without one */
  progressive: PercentProgressiveConfig | null
}

export type PachisloFlag
  = 'cherry-top' | 'cherry-mid' | 'cherry-bot' | 'watermelon' | 'bell' | 'replay' | 'reg' | 'big'

/** Per-level lottery rates, integer counts out of 16384. */
export interface PachisloLevelRates {
  bell: number
  reg: number
  big: number
}

export interface PachisloMachineDef extends MachineDefBase {
  family: 'pachislo'
  /** 3 strips x 21 stops */
  strips: SymbolId[][]
  /** max forward slip from the press position (4 on real hardware) */
  slip: number
  /** which symbol plays which role in combos/control */
  roles: {
    cherry: SymbolId
    watermelon: SymbolId
    bell: SymbolId
    replay: SymbolId
    seven: SymbolId
    /** REG combo = seven seven bar */
    bar: SymbolId
    blank: SymbolId
  }
  /** level-independent lottery rates /16384 (cherry is per ROW; x3 rows total) */
  baseRates: { cherryPerRow: number, watermelon: number, replay: number }
  /** index 0..5 = operator levels 1..6 */
  oddsLevels: PachisloLevelRates[]
  /** 1-based; the level a fresh session starts at */
  defaultOddsLevel: number
  pays: { cherryPerLine: number, watermelon: number, bell: number, bonusLined: number }
  jac: { perRound: number, pay: number, cost: number }
  bigRounds: number
  interlude: { bellWeight: number, endWeight: number, weightDenom: number, bellPay: number, maxBells: number, cost: number }
  progressive: null
}

export type MachineDef = StepperMachineDef | BallyEmMachineDef | VideoMachineDef | PachisloMachineDef
```

(Delete the old two-family `MachineDef` line.) Append the session/outcome extensions after `MachineSessionState`'s current definition, replacing it:

```ts
export type VideoFeatureState
  = | {
    kind: 'freeSpins'
    remaining: number
    multiplier: number
    /** the triggering bet, replayed at cost 0 */
    coins: number
  }
  | {
    kind: 'holdAndSpin'
    /** 15 cells (cell = reel*3 + row); null = unlocked */
    locked: ({ credits: number, label?: 'mini' | 'minor' | 'major' } | null)[]
    respins: number
    coins: number
  }

export interface PachisloBonusState {
  type: 'reg' | 'big'
  /** 1-based JAC round */
  round: number
  jacLeft: number
  /** non-null while playing an increased-odds interlude (between BIG rounds) */
  interlude: { index: 1 | 2, bells: number } | null
}

export interface PachisloSessionState {
  /** 1-based operator level, set by the in-app operator key */
  oddsLevel: number
  /** stocked small flags, FIFO (cherry rows, watermelon, bell, replay) */
  smallQueue: PachisloFlag[]
  /** stocked bonus flags, FIFO */
  bonusQueue: ('reg' | 'big')[]
  /** a realized replay makes the next normal game free */
  replayNext: boolean
  bonus: PachisloBonusState | null
}

export interface MachineSessionState {
  progressive: ProgressiveState | null
  videoFeature: VideoFeatureState | null
  pachislo: PachisloSessionState | null
}
```

Append after `ProgressiveEvent`:

```ts
/**
 * 'base' = paid video spin; 'free-spin'/'respin' = zero-cost feature spins;
 * 'normal' = paid (or replay-free) pachislo lottery game; 'jac'/'interlude' =
 * pachislo bonus games. Steppers/bally are always 'base'. Simulation counts
 * cycles over base/normal games only.
 */
export type GameKind = 'base' | 'free-spin' | 'respin' | 'normal' | 'jac' | 'interlude'

export type FeatureEvent
  = | { type: 'free-spins-triggered', count: number, multiplier: number }
    | { type: 'free-spins-retriggered', added: number, remaining: number }
    | { type: 'free-spin-consumed', remaining: number }
    | { type: 'orbs-locked', cells: number[], credits: number[] }
    | { type: 'respins-reset', respins: number }
    | { type: 'respin-missed', remaining: number }
    | { type: 'hold-and-spin-ended', totalCredits: number, filled: boolean }
    | { type: 'flag-drawn', flag: PachisloFlag }
    | { type: 'flag-stocked', flag: PachisloFlag, queueDepth: number }
    | { type: 'flag-realized', flag: PachisloFlag }
    | { type: 'replay-granted' }
    | { type: 'bonus-started', bonus: 'reg' | 'big' }
    | { type: 'jac-round-complete', round: number }
    | { type: 'interlude-started', index: 1 | 2 }
    | { type: 'interlude-ended', index: 1 | 2, bells: number }
    | { type: 'bonus-ended', bonus: 'reg' | 'big' }
```

Extend `SpinTrace` with the pachislo control trace (after `virtualStops`):

```ts
  /** pachislo only: per reel — where the player pressed, where control stopped, why */
  presses?: { reel: number, press: number, stop: number, slipUsed: number, target: string | null }[]
```

Extend `SpinOutcome` (after `coins`):

```ts
  gameKind: GameKind
  /** actual cost of THIS spin: 0 for free spins/respins/replay games, jac/interlude cost during bonuses */
  coinsIn: number
```

and (after `progressiveEvents`):

```ts
  featureEvents: FeatureEvent[]
```

- [ ] **Step 2: Update the facade and stubs so typecheck passes**

`app/engine/index.ts` — `initMachineState` v2:

```ts
export function initMachineState(def: MachineDef): MachineSessionState {
  return {
    progressive: def.progressive === null ? null : initProgressiveState(def.progressive),
    videoFeature: null,
    pachislo: def.family === 'pachislo'
      ? {
          oddsLevel: def.defaultOddsLevel,
          smallQueue: [],
          bonusQueue: [],
          replayNext: false,
          bonus: null
        }
      : null
  }
}
```

Add to the `spin()` switch (before `default`):

```ts
    case 'video':
    case 'pachislo':
      throw new Error(`${def.family} family lands later in Plan 2`)
```

Add the same two temporary arms to the switches in `app/engine/exactRtp.ts` and `app/engine/validate.ts`.

`spinStepper` and `spinBallyEm` must now populate the three new `SpinOutcome` fields — in both evaluators add to the returned object:

```ts
    gameKind: 'base',
    coinsIn: coins,
    featureEvents: [],
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green — existing tests don't reference the new fields yet, and the union widening compiles because every switch has the temporary arms.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add video and pachislo families to the engine type system"
```

---

### Task 4: Video award helpers

**Files:**
- Create: `app/engine/videoAwards.ts`
- Create: `tests/videoAwards.test.ts`

These helpers are consumed by BOTH `spinVideo` (Task 5) and `videoExactRtp` (Task 8) — the shared-math rule that keeps gameplay and display honest.

- [ ] **Step 1: Write the failing tests**

`tests/videoAwards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  LINES25, cellAt, evalLine, evalWays, orbCells, scatterVisibleCount
} from '../app/engine/videoAwards'
import type { VideoMachineDef } from '../app/engine/types'

// Tiny 6-cell strips keep expectations hand-checkable; evaluators are
// length-agnostic (the 24-cell rule is a validator concern, Task 9).
const WAYS_DEF = {
  family: 'video',
  strips: [
    ['DR', 'KK', 'KK', 'QQ', 'DR', 'QQ'],
    ['WD', 'QQ', 'DR', 'KK', 'QQ', 'KK'],
    ['DR', 'QQ', 'KK', 'WD', 'QQ', 'KK'],
    ['QQ', 'KK', 'DR', 'QQ', 'KK', 'QQ'],
    ['KK', 'QQ', 'QQ', 'DR', 'KK', 'QQ']
  ],
  betMode: { kind: 'ways' },
  wildSymbol: 'WD',
  scatter: null,
  holdAndSpin: null,
  paytable: [
    { id: 'dr3', symbol: 'DR', length: 3, pay: 20 },
    { id: 'dr4', symbol: 'DR', length: 4, pay: 60 },
    { id: 'dr5', symbol: 'DR', length: 5, pay: 250 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 5 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 10 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 25 }
  ]
} as unknown as VideoMachineDef

describe('LINES25', () => {
  it('is 25 distinct 5-reel row patterns, center line first', () => {
    expect(LINES25).toHaveLength(25)
    expect(LINES25[0]).toEqual([1, 1, 1, 1, 1])
    const seen = new Set(LINES25.map(p => p.join('')))
    expect(seen.size).toBe(25)
    for (const p of LINES25) {
      expect(p).toHaveLength(5)
      for (const row of p) expect([0, 1, 2]).toContain(row)
    }
  })
})

describe('cellAt', () => {
  it('wraps the circular strip', () => {
    expect(cellAt(['A', 'B', 'C'], 2, 0)).toBe('C')
    expect(cellAt(['A', 'B', 'C'], 2, 1)).toBe('A')
    expect(cellAt(['A', 'B', 'C'], 2, 2)).toBe('B')
  })
})

describe('evalLine', () => {
  const def = { paytable: WAYS_DEF.paytable, wildSymbol: 'WD' as string | null }
  it('pays the exact run length anchored on reel 1', () => {
    expect(evalLine(['DR', 'DR', 'DR', 'KK', 'QQ'], def)!.entry.id).toBe('dr3')
    expect(evalLine(['DR', 'DR', 'DR', 'DR', 'KK'], def)!.entry.id).toBe('dr4')
    expect(evalLine(['DR', 'DR', 'DR', 'DR', 'DR'], def)!.entry.id).toBe('dr5')
  })
  it('substitutes wilds after the anchor and counts them', () => {
    const r = evalLine(['DR', 'WD', 'DR', 'WD', 'KK'], def)!
    expect(r.entry.id).toBe('dr4')
    expect(r.wildCount).toBe(2)
  })
  it('returns null for runs under 3, wild anchors, and unknown anchors', () => {
    expect(evalLine(['DR', 'DR', 'KK', 'DR', 'DR'], def)).toBeNull()
    expect(evalLine(['WD', 'DR', 'DR', 'DR', 'DR'], def)).toBeNull()
    expect(evalLine(['SC', 'SC', 'SC', 'SC', 'SC'], def)).toBeNull()
  })
})

describe('evalWays', () => {
  it('multiplies per-reel symbol-or-wild counts over the run', () => {
    // windows at stops 0: r1 [DR,KK,KK], r2 [WD,QQ,DR], r3 [DR,QQ,KK],
    // r4 [QQ,KK,DR], r5 [KK,QQ,QQ]
    const wins = evalWays(WAYS_DEF, [0, 0, 0, 0, 0])
    const dr = wins.find(w => w.entry.symbol === 'DR')!
    // DR-or-WD counts: 1,2,1,1,0 -> run stops at 4, ways 1*2*1*1 = 2
    expect(dr.entry.id).toBe('dr4')
    expect(dr.ways).toBe(2)
    expect(dr.payCredits).toBe(120)
    const kk = wins.find(w => w.entry.symbol === 'KK')!
    // KK-or-WD counts: 2,1,1,1,1 -> run 5, ways 2
    expect(kk.entry.id).toBe('kk5')
    expect(kk.payCredits).toBe(50)
  })
  it('requires the symbol on reel 1 (anchored) and run >= 3', () => {
    // stop r1 window [QQ,DR,KK]... QQ has no paytable entries -> only DR/KK probed
    const wins = evalWays(WAYS_DEF, [3, 1, 1, 1, 1])
    // r1 window [QQ,DR,QQ]: DR count 1; r2 [QQ,DR,KK]: 1; r3 [QQ,KK,WD]: 1 (wild);
    // r4 [KK,DR,QQ]: 1; r5 [QQ,QQ,DR]: 1 -> DR run 5 ways 1
    const dr = wins.find(w => w.entry.symbol === 'DR')!
    expect(dr.ways).toBe(1)
    // KK: r1 window [QQ,DR,QQ] has 0 KK -> no KK win despite later reels
    expect(wins.find(w => w.entry.symbol === 'KK')).toBeUndefined()
  })
})

describe('scatter and orb windows', () => {
  const def = {
    ...WAYS_DEF,
    strips: [
      ['SC', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'SC', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'OR'],
      ['AA', 'OR', 'AA', 'AA', 'AA', 'AA']
    ],
    scatter: { symbol: 'SC', pays: { 3: 2 }, triggerCount: 3 },
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 6, respins: 3,
      respinOrbNumer: 2, respinOrbDenom: 24, orbValues: [{ credits: 25, weight: 1 }],
      emptySymbol: 'EM'
    }
  } as unknown as VideoMachineDef
  it('counts at most one scatter per reel window', () => {
    // r1 stop 0 window [SC,AA,AA] -> 1; r2 stop 0 [AA,AA,SC] -> 1; rest 0
    expect(scatterVisibleCount(def, [0, 0, 0, 0, 0])).toBe(2)
    expect(scatterVisibleCount(def, [1, 3, 0, 0, 0])).toBe(0)
  })
  it('reports orb cells as reel*3+row', () => {
    // r4 stop 5 window [OR,OR,OR] (wraps 5,0,1) -> cells 9,10,11; r5 stop 0 [AA,OR,AA] -> cell 13
    expect(orbCells(def, [1, 1, 0, 5, 0]).map(o => o.cell)).toEqual([9, 10, 11, 13])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- videoAwards`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `app/engine/videoAwards.ts`**

```ts
import type { SymbolId, VideoMachineDef, VideoPayEntry } from './types'

/**
 * The classic 25-line geometry shared by the lines-mode machines (row per
 * reel, 0 = top, 2 = bottom). Coins activate lines 0..coins-1; line 1 is the
 * center line, so a 1-coin spin plays exactly the center.
 */
export const LINES25: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 2, 1, 0, 1],
  [1, 0, 1, 2, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1], [0, 2, 2, 2, 0], [2, 0, 0, 0, 2]
]

/** Cell shown at `row` (0..2) when the reel stopped with `stop` as its top cell. */
export function cellAt(strip: SymbolId[], stop: number, row: number): SymbolId {
  return strip[(stop + row) % strip.length]!
}

export interface VideoLineWin {
  entry: VideoPayEntry
  wildCount: number
}

/**
 * Left-anchored exact-run line evaluation. The anchor is cell 0 (wild never
 * appears on reel-1 strips); the run extends through anchor-or-wild cells;
 * the paytable entry with that exact run length pays. Runs under 3 have no
 * entries and return null.
 */
export function evalLine(
  cells: SymbolId[],
  def: { paytable: VideoPayEntry[], wildSymbol: SymbolId | null }
): VideoLineWin | null {
  const anchor = cells[0]!
  if (anchor === def.wildSymbol) return null
  let run = 1
  while (
    run < cells.length
    && (cells[run] === anchor || (def.wildSymbol !== null && cells[run] === def.wildSymbol))
  ) run++
  const entry = def.paytable.find(e => e.symbol === anchor && e.length === run)
  if (entry === undefined) return null
  let wildCount = 0
  for (let i = 1; i < run; i++) {
    if (cells[i] === def.wildSymbol) wildCount++
  }
  return { entry, wildCount }
}

export interface VideoWaysWin {
  entry: VideoPayEntry
  ways: number
  payCredits: number
}

/**
 * 243-ways evaluation: per paying symbol, n[r] = count of symbol-or-wild cells
 * in reel r's window; the maximal prefix with all n[r] >= 1 is the run; the
 * win is pay x prod(n[r]). Anchored: reel 1 must show the symbol itself
 * (wilds never appear on reel-1 strips). Each symbol pays only its longest run.
 */
export function evalWays(def: VideoMachineDef, stops: number[]): VideoWaysWin[] {
  const wins: VideoWaysWin[] = []
  const seen = new Set<SymbolId>()
  for (const probe of def.paytable) {
    if (seen.has(probe.symbol)) continue
    seen.add(probe.symbol)
    let run = 0
    let ways = 1
    for (let r = 0; r < def.strips.length; r++) {
      let n = 0
      for (let row = 0; row < 3; row++) {
        const c = cellAt(def.strips[r]!, stops[r]!, row)
        if (c === probe.symbol || (def.wildSymbol !== null && c === def.wildSymbol)) n++
      }
      if (n === 0) break
      run++
      ways *= n
    }
    if (run < 3) continue
    const entry = def.paytable.find(e => e.symbol === probe.symbol && e.length === run)
    if (entry === undefined) continue
    wins.push({ entry, ways, payCredits: entry.pay * ways })
  }
  return wins
}

/** Number of reels whose window shows the scatter (spacing >= 3 keeps it 0/1 per reel). */
export function scatterVisibleCount(def: VideoMachineDef, stops: number[]): number {
  if (def.scatter === null) return 0
  let k = 0
  for (let r = 0; r < def.strips.length; r++) {
    for (let row = 0; row < 3; row++) {
      if (cellAt(def.strips[r]!, stops[r]!, row) === def.scatter.symbol) {
        k++
        break
      }
    }
  }
  return k
}

export interface OrbCellHit {
  /** 15-cell grid index = reel * 3 + row */
  cell: number
  reel: number
  row: number
}

export function orbCells(def: VideoMachineDef, stops: number[]): OrbCellHit[] {
  if (def.holdAndSpin === null) return []
  const out: OrbCellHit[] = []
  for (let r = 0; r < def.strips.length; r++) {
    for (let row = 0; row < 3; row++) {
      if (cellAt(def.strips[r]!, stops[r]!, row) === def.holdAndSpin.orbSymbol) {
        out.push({ cell: r * 3 + row, reel: r, row })
      }
    }
  }
  return out
}
```

Note: Task 7 needs `emptySymbol: SymbolId` on `HoldAndSpinConfig` (respin grids render locked orbs vs empty cells). Add it to the interface in `app/engine/types.ts` now:

```ts
  /** what unlocked cells show in respin grids (declared in symbols, never on strips) */
  emptySymbol: SymbolId
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- videoAwards`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add video award helpers: 25-line geometry, anchored line/ways eval, scatter and orb windows"
```

---

### Task 5: Video evaluator — base game

**Files:**
- Create: `app/engine/video.ts`
- Create: `tests/video.test.ts`
- Modify: `app/engine/index.ts` (wire the `case 'video'` arm)

- [ ] **Step 1: Write the failing tests**

`tests/video.test.ts` — a scripted RandomFn makes state-machine behavior deterministic without seed archaeology:

```ts
import { describe, it, expect } from 'vitest'
import { spinVideo } from '../app/engine/video'
import { initMachineState } from '../app/engine'
import type { RandomFn } from '../app/engine/rng'
import type { VideoMachineDef } from '../app/engine/types'

/** RandomFn replaying a fixed list of raws (throws if over-consumed). */
function scripted(vals: number[]): RandomFn {
  let i = 0
  return () => {
    if (i >= vals.length) throw new Error(`rng over-consumed at draw ${i}`)
    return vals[i++]!
  }
}
/** raw that makes floor(raw * range) === idx */
const at = (idx: number, range: number) => (idx + 0.5) / range

// 6-cell lines machine: line 1 = center. Strips put a DR run across the
// center when every reel stops at 0; reel 2 cell 1 is WD; scatters on
// reels 1/2/4 at cell 3 (visible from stops 1,2,3).
const LINES_DEF = {
  id: 'test-lines',
  name: 'Test Lines',
  family: 'video',
  denominationCents: 1,
  maxCoins: 3,
  symbols: {
    DR: { label: 'Dragon' }, KK: { label: 'King' }, QQ: { label: 'Queen' },
    WD: { label: 'Wild' }, SC: { label: 'Scatter' }
  },
  strips: [
    ['KK', 'DR', 'KK', 'SC', 'QQ', 'QQ'],
    ['QQ', 'DR', 'KK', 'SC', 'QQ', 'WD'],
    ['KK', 'DR', 'QQ', 'KK', 'QQ', 'KK'],
    ['QQ', 'DR', 'KK', 'SC', 'QQ', 'KK'],
    ['KK', 'DR', 'QQ', 'KK', 'QQ', 'QQ']
  ],
  betMode: {
    kind: 'lines',
    lines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2]]
  },
  fixedBet: false,
  wildSymbol: 'WD',
  scatter: { symbol: 'SC', pays: { 3: 2 }, triggerCount: 3 },
  freeSpins: { count: 10, multiplier: 2, retrigger: false },
  holdAndSpin: null,
  paytable: [
    { id: 'dr3', symbol: 'DR', length: 3, pay: 20 },
    { id: 'dr4', symbol: 'DR', length: 4, pay: 60 },
    { id: 'dr5', symbol: 'DR', length: 5, pay: 250 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 5 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 10 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 25 }
  ],
  progressive: null,
  history: 'test'
} as unknown as VideoMachineDef

describe('spinVideo base game', () => {
  it('pays an anchored center-line run with correct grid and trace', () => {
    const state = initMachineState(LINES_DEF)
    // all reels stop at 0: center row = cell 1 = DR on every reel
    const out = spinVideo(LINES_DEF, state, 1, scripted([at(0, 6), at(0, 6), at(0, 6), at(0, 6), at(0, 6)]))
    expect(out.gameKind).toBe('base')
    expect(out.coinsIn).toBe(1)
    expect(out.stops).toEqual([0, 0, 0, 0, 0])
    expect(out.grid[0]).toEqual(['KK', 'DR', 'KK'])
    expect(out.wins).toHaveLength(1)
    expect(out.wins[0]!.entryId).toBe('dr5')
    expect(out.totalPayout).toBe(250)
    expect(out.trace.draws).toHaveLength(5)
    expect(state.videoFeature).toBeNull()
  })

  it('only evaluates active lines (coins = line count)', () => {
    const state = initMachineState(LINES_DEF)
    // top row at these stops reads KK,KK,KK,KK,KK -> kk5 on line 2 (top),
    // while the center line shows DR,SC,DR,SC,DR -> run 1, no center win
    const stops = [0, 2, 0, 2, 0]
    const rngFor = () => scripted(stops.map(s => at(s, 6)))
    const one = spinVideo(LINES_DEF, initMachineState(LINES_DEF), 1, rngFor())
    expect(one.wins.find(w => w.line === 'line-2')).toBeUndefined()
    const two = spinVideo(LINES_DEF, initMachineState(LINES_DEF), 2, rngFor())
    const win = two.wins.find(w => w.line === 'line-2')!
    expect(win.entryId).toBe('kk5')
  })

  it('pays scatters x total bet and arms free spins', () => {
    const state = initMachineState(LINES_DEF)
    // stops 1,1,x,1,x put SC (cell 3) in windows of reels 1,2,4
    const out = spinVideo(LINES_DEF, state, 3, scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    const sc = out.wins.find(w => w.line === 'scatter')!
    expect(sc.entryId).toBe('sc3')
    expect(sc.payCredits).toBe(2 * 3)
    expect(out.featureEvents).toContainEqual({ type: 'free-spins-triggered', count: 10, multiplier: 2 })
    expect(state.videoFeature).toEqual({ kind: 'freeSpins', remaining: 10, multiplier: 2, coins: 3 })
  })

  it('rejects out-of-range and fixed-bet-violating coin counts', () => {
    const state = initMachineState(LINES_DEF)
    expect(() => spinVideo(LINES_DEF, state, 0, scripted([]))).toThrow(/out of range/)
    expect(() => spinVideo(LINES_DEF, state, 4, scripted([]))).toThrow(/out of range/)
    const fixed = { ...LINES_DEF, fixedBet: true } as VideoMachineDef
    expect(() => spinVideo(fixed, initMachineState(fixed), 1, scripted([]))).toThrow(/fixed bet/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- tests/video.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `app/engine/video.ts` (base game; feature arms land in Tasks 6–7)**

```ts
import type {
  FeatureEvent, LineWin, MachineSessionState, RngDraw,
  SpinOutcome, SymbolId, VideoFeatureState, VideoMachineDef
} from './types'
import type { RandomFn } from './rng'
import { cellAt, evalLine, evalWays, orbCells, scatterVisibleCount } from './videoAwards'

interface DrawnOrb {
  cell: number
  credits: number
  label?: 'mini' | 'minor' | 'major'
}

/** Weighted orb-value draw; one RNG draw per orb, traced per cell. */
function drawOrbValue(def: VideoMachineDef, rand: RandomFn, draws: RngDraw[], cell: number): DrawnOrb {
  const table = def.holdAndSpin!.orbValues
  const total = table.reduce((s, e) => s + e.weight, 0)
  const raw = rand()
  const pick = Math.floor(raw * total)
  draws.push({ label: `orb-value-cell${cell}`, raw, value: pick, range: total })
  let acc = 0
  for (const e of table) {
    acc += e.weight
    if (pick < acc) return { cell, credits: e.credits, label: e.label }
  }
  const last = table[table.length - 1]!
  return { cell, credits: last.credits, label: last.label }
}

interface VideoSpinEval {
  draws: RngDraw[]
  stops: number[]
  grid: SymbolId[][]
  wins: LineWin[]
  scatterCount: number
  orbs: DrawnOrb[]
}

/**
 * One reel spin + award evaluation, shared by base and free spins.
 * `coins` = active lines (lines mode) / the full bet (ways mode); the
 * multiplier scales every win (free-spin x2 etc.). Scatter pays are
 * `pays[k] x total bet` = pays[k] x coins.
 */
function evaluateVideoSpin(
  def: VideoMachineDef,
  coins: number,
  multiplier: number,
  rand: RandomFn
): VideoSpinEval {
  const draws: RngDraw[] = []
  const stops = def.strips.map((strip, r) => {
    const raw = rand()
    const value = Math.floor(raw * strip.length)
    draws.push({ label: `reel${r + 1}-stop`, raw, value, range: strip.length })
    return value
  })
  const grid = def.strips.map((strip, r) =>
    [0, 1, 2].map(row => cellAt(strip, stops[r]!, row)))

  const wins: LineWin[] = []
  if (def.betMode.kind === 'lines') {
    for (let li = 0; li < coins; li++) {
      const pattern = def.betMode.lines[li]!
      const cells = pattern.map((row, r) => grid[r]![row]!)
      const res = evalLine(cells, def)
      if (res !== null) {
        wins.push({
          line: `line-${li + 1}`, entryId: res.entry.id, symbols: cells,
          payCredits: res.entry.pay * multiplier, wildCount: res.wildCount, progressive: false
        })
      }
    }
  } else {
    for (const w of evalWays(def, stops)) {
      wins.push({
        line: `ways-x${w.ways}`, entryId: w.entry.id,
        symbols: new Array<SymbolId>(w.entry.length).fill(w.entry.symbol),
        payCredits: w.payCredits * multiplier, wildCount: 0, progressive: false
      })
    }
  }

  const scatterCount = scatterVisibleCount(def, stops)
  if (def.scatter !== null) {
    const pay = def.scatter.pays[scatterCount]
    if (pay !== undefined) {
      wins.push({
        line: 'scatter', entryId: `sc${scatterCount}`,
        symbols: new Array<SymbolId>(scatterCount).fill(def.scatter.symbol),
        payCredits: pay * coins * multiplier, wildCount: 0, progressive: false
      })
    }
  }

  const orbs = def.holdAndSpin === null
    ? []
    : orbCells(def, stops).map(o => drawOrbValue(def, rand, draws, o.cell))
  return { draws, stops, grid, wins, scatterCount, orbs }
}

function videoBaseSpin(
  def: VideoMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  const ev = evaluateVideoSpin(def, coins, 1, rand)
  const featureEvents: FeatureEvent[] = []

  if (
    def.scatter !== null && def.scatter.triggerCount !== null && def.freeSpins !== null
    && ev.scatterCount >= def.scatter.triggerCount
  ) {
    state.videoFeature = {
      kind: 'freeSpins',
      remaining: def.freeSpins.count,
      multiplier: def.freeSpins.multiplier,
      coins
    }
    featureEvents.push({
      type: 'free-spins-triggered', count: def.freeSpins.count, multiplier: def.freeSpins.multiplier
    })
  }

  if (def.holdAndSpin !== null && ev.orbs.length >= def.holdAndSpin.triggerCount) {
    const locked: ({ credits: number, label?: 'mini' | 'minor' | 'major' } | null)[]
      = new Array(15).fill(null)
    for (const o of ev.orbs) locked[o.cell] = { credits: o.credits, label: o.label }
    state.videoFeature = { kind: 'holdAndSpin', locked, respins: def.holdAndSpin.respins, coins }
    featureEvents.push({
      type: 'orbs-locked', cells: ev.orbs.map(o => o.cell), credits: ev.orbs.map(o => o.credits)
    })
  }

  return {
    machineId: def.id,
    family: 'video',
    coins,
    gameKind: 'base',
    coinsIn: coins,
    stops: ev.stops,
    grid: ev.grid,
    wins: ev.wins,
    totalPayout: ev.wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [],
    featureEvents,
    trace: { draws: ev.draws }
  }
}

/**
 * Video family dispatch. Feature state on MachineSessionState routes
 * free-spin and respin calls; base spins validate the bet.
 */
export function spinVideo(
  def: VideoMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  const feature = state.videoFeature
  if (feature !== null) {
    throw new Error('feature spins land in Tasks 6-7')
  }
  if (def.fixedBet && coins !== def.maxCoins) {
    throw new Error(`${def.id}: fixed bet machine requires ${def.maxCoins} coins`)
  }
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  return videoBaseSpin(def, state, coins, rand)
}
```

Wire the facade arm — in `app/engine/index.ts` replace the temporary `case 'video':` throw with:

```ts
    case 'video':
      return spinVideo(def, state, coins, rand)
```

(import `spinVideo` from `./video`; keep the `case 'pachislo':` throw for now).

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/video.test.ts`
Expected: PASS (the fixed-bet/feature throws satisfy the remaining branches).

- [ ] **Step 5: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add video base-game evaluator: lines, ways, scatter pays, feature arming"
```

---

### Task 6: Video free spins

**Files:**
- Modify: `app/engine/video.ts`
- Modify: `tests/video.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tests/video.test.ts`)

```ts
describe('free spins', () => {
  const trigger = (def: VideoMachineDef, coins: number) => {
    const state = initMachineState(def)
    spinVideo(def, state, coins, scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    expect(state.videoFeature?.kind).toBe('freeSpins')
    return state
  }

  it('replays the triggering bet at cost 0 with the multiplier applied', () => {
    const state = trigger(LINES_DEF, 3)
    // center dr5 again, now during free spins
    const out = spinVideo(LINES_DEF, state, 99 /* ignored during features */,
      scripted([at(0, 6), at(0, 6), at(0, 6), at(0, 6), at(0, 6)]))
    expect(out.gameKind).toBe('free-spin')
    expect(out.coinsIn).toBe(0)
    expect(out.coins).toBe(3)
    expect(out.wins[0]!.payCredits).toBe(250 * 2)
    expect(out.featureEvents).toContainEqual({ type: 'free-spin-consumed', remaining: 9 })
  })

  it('counts down and clears the feature after the last spin', () => {
    const state = trigger(LINES_DEF, 1)
    for (let i = 9; i >= 0; i--) {
      const out = spinVideo(LINES_DEF, state, 1,
        scripted([at(4, 6), at(4, 6), at(4, 6), at(4, 6), at(4, 6)]))
      expect(out.featureEvents).toContainEqual({ type: 'free-spin-consumed', remaining: i })
    }
    expect(state.videoFeature).toBeNull()
  })

  it('does not retrigger when retrigger is false, but pays the scatters', () => {
    const state = trigger(LINES_DEF, 1)
    const out = spinVideo(LINES_DEF, state, 1,
      scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    expect(out.wins.find(w => w.line === 'scatter')!.payCredits).toBe(2 * 1 * 2)
    expect(out.featureEvents.some(e => e.type === 'free-spins-retriggered')).toBe(false)
    expect((state.videoFeature as { remaining: number }).remaining).toBe(9)
  })

  it('retriggers add count when enabled', () => {
    const retrig = {
      ...LINES_DEF,
      freeSpins: { count: 8, multiplier: 1, retrigger: true }
    } as VideoMachineDef
    const state = trigger(retrig, 1)
    const out = spinVideo(retrig, state, 1,
      scripted([at(1, 6), at(1, 6), at(0, 6), at(1, 6), at(0, 6)]))
    // retrigger fires BEFORE the consume decrement: 8 + 8 - 1 = 15
    expect(out.featureEvents).toContainEqual({ type: 'free-spins-retriggered', added: 8, remaining: 16 })
    expect(out.featureEvents).toContainEqual({ type: 'free-spin-consumed', remaining: 15 })
  })
})
```

- [ ] **Step 2: Run to verify the feature throw fails these tests**

Run: `pnpm test -- tests/video.test.ts`
Expected: FAIL on the new describe block ("feature spins land in Tasks 6-7").

- [ ] **Step 3: Implement the free-spin arm**

In `app/engine/video.ts` add:

```ts
function freeSpinSpin(
  def: VideoMachineDef,
  state: MachineSessionState,
  feature: VideoFeatureState & { kind: 'freeSpins' },
  rand: RandomFn
): SpinOutcome {
  const ev = evaluateVideoSpin(def, feature.coins, feature.multiplier, rand)
  const featureEvents: FeatureEvent[] = []

  if (
    def.scatter !== null && def.scatter.triggerCount !== null && def.freeSpins !== null
    && def.freeSpins.retrigger && ev.scatterCount >= def.scatter.triggerCount
  ) {
    feature.remaining += def.freeSpins.count
    featureEvents.push({
      type: 'free-spins-retriggered', added: def.freeSpins.count, remaining: feature.remaining
    })
  }

  feature.remaining -= 1
  featureEvents.push({ type: 'free-spin-consumed', remaining: feature.remaining })
  if (feature.remaining === 0) state.videoFeature = null

  return {
    machineId: def.id,
    family: 'video',
    coins: feature.coins,
    gameKind: 'free-spin',
    coinsIn: 0,
    stops: ev.stops,
    grid: ev.grid,
    wins: ev.wins,
    totalPayout: ev.wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [],
    featureEvents,
    trace: { draws: ev.draws }
  }
}
```

and route it in `spinVideo`:

```ts
  if (feature !== null) {
    if (feature.kind === 'freeSpins') return freeSpinSpin(def, state, feature, rand)
    throw new Error('hold-and-spin respins land in Task 7')
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/video.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add video free-spin state machine with multipliers and retriggers"
```

---

### Task 7: Hold-and-spin feature

**Files:**
- Modify: `app/engine/video.ts`
- Modify: `app/engine/types.ts` (stops JSDoc gains "video respins: empty array")
- Modify: `tests/video.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tests/video.test.ts`)

```ts
describe('hold-and-spin', () => {
  const HNS_DEF = {
    id: 'test-hns',
    name: 'Test HNS',
    family: 'video',
    denominationCents: 1,
    maxCoins: 5,
    symbols: { AA: { label: 'Ace' }, OR: { label: 'Orb' }, EM: { label: 'Empty' } },
    strips: [
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA']
    ],
    betMode: { kind: 'lines', lines: [[1, 1, 1, 1, 1]] },
    fixedBet: true,
    wildSymbol: null,
    scatter: null,
    freeSpins: null,
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 6, respins: 3,
      respinOrbNumer: 2, respinOrbDenom: 24,
      orbValues: [{ credits: 25, weight: 1 }],
      emptySymbol: 'EM'
    },
    paytable: [],
    progressive: { kind: 'percent', reset: 5000, max: 50000, feedRate: 0.01 },
    history: 'test'
  } as unknown as VideoMachineDef

  const HIT = 0.01   // floor(0.01 * 24) = 0 < 2 -> orb lands
  const MISS = 0.5   // floor(0.5 * 24) = 12 -> no orb
  const VAL = 0.0    // single-entry value table

  /** trigger with 6 orbs: reels 1-3 stop at 5 -> windows [AA,OR,OR] -> cells 1,2 / 4,5 / 7,8 */
  const trigger = () => {
    const state = initMachineState(HNS_DEF)
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6), VAL, VAL, VAL, VAL, VAL, VAL]
    const out = spinVideo(HNS_DEF, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({
      type: 'orbs-locked', cells: [1, 2, 4, 5, 7, 8], credits: [25, 25, 25, 25, 25, 25]
    })
    expect(state.videoFeature?.kind).toBe('holdAndSpin')
    return state
  }

  it('locks triggering orbs without paying them in the base game', () => {
    const state = trigger()
    const f = state.videoFeature as { kind: 'holdAndSpin', locked: ({ credits: number } | null)[], respins: number }
    expect(f.respins).toBe(3)
    expect(f.locked.filter(c => c !== null)).toHaveLength(6)
  })

  it('ends after three consecutive missed respins and pays the lump', () => {
    const state = trigger()
    // 9 unlocked cells x 3 respins, all misses
    for (let r = 0; r < 2; r++) {
      const out = spinVideo(HNS_DEF, state, 5, scripted(new Array(9).fill(MISS)))
      expect(out.gameKind).toBe('respin')
      expect(out.coinsIn).toBe(0)
      expect(out.totalPayout).toBe(0)
      expect(out.featureEvents).toContainEqual({ type: 'respin-missed', remaining: 2 - r })
    }
    const last = spinVideo(HNS_DEF, state, 5, scripted(new Array(9).fill(MISS)))
    expect(last.featureEvents).toContainEqual({ type: 'respin-missed', remaining: 0 })
    expect(last.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 150, filled: false })
    expect(last.totalPayout).toBe(150)
    expect(state.videoFeature).toBeNull()
  })

  it('a new orb resets the counter to 3', () => {
    const state = trigger()
    // first unlocked cell (0) hits, others miss: draws = HIT, VAL, then 8 misses
    const out = spinVideo(HNS_DEF, state, 5, scripted([HIT, VAL, ...new Array(8).fill(MISS)]))
    expect(out.featureEvents).toContainEqual({ type: 'orbs-locked', cells: [0], credits: [25] })
    expect(out.featureEvents).toContainEqual({ type: 'respins-reset', respins: 3 })
    const f = state.videoFeature as { respins: number }
    expect(f.respins).toBe(3)
  })

  it('filling all 15 pays the Grand from the percent meter and resets it', () => {
    const state = trigger()
    state.progressive = { kind: 'percent', value: 5555.75 }
    // every one of the 9 unlocked cells hits: 9 x (HIT, VAL)
    const draws: number[] = []
    for (let i = 0; i < 9; i++) draws.push(HIT, VAL)
    const out = spinVideo(HNS_DEF, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 375, filled: true })
    expect(out.wins.find(w => w.entryId === 'hold-and-spin')!.payCredits).toBe(375)
    expect(out.wins.find(w => w.entryId === 'grand')!.payCredits).toBe(5555)
    expect(out.progressiveEvents).toEqual([{ type: 'hit', meter: 'percent', amountCredits: 5555 }])
    expect(out.totalPayout).toBe(375 + 5555)
    expect(state.progressive).toEqual({ kind: 'percent', value: 5000 })
    expect(state.videoFeature).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- tests/video.test.ts`
Expected: FAIL — "hold-and-spin respins land in Task 7".

- [ ] **Step 3: Implement the respin arm**

In `app/engine/video.ts` add (and import `ProgressiveEvent` from `./types`):

```ts
function holdAndSpinRespin(
  def: VideoMachineDef,
  state: MachineSessionState,
  feature: VideoFeatureState & { kind: 'holdAndSpin' },
  rand: RandomFn
): SpinOutcome {
  const cfg = def.holdAndSpin!
  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  const newCells: number[] = []
  const newCredits: number[] = []

  for (let cell = 0; cell < 15; cell++) {
    if (feature.locked[cell] !== null) continue
    const raw = rand()
    const value = Math.floor(raw * cfg.respinOrbDenom)
    draws.push({ label: `cell${cell}-respin`, raw, value, range: cfg.respinOrbDenom })
    if (value < cfg.respinOrbNumer) {
      const orb = drawOrbValue(def, rand, draws, cell)
      feature.locked[cell] = { credits: orb.credits, label: orb.label }
      newCells.push(cell)
      newCredits.push(orb.credits)
    }
  }

  const lockedCount = feature.locked.filter(c => c !== null).length
  let ended = false
  if (newCells.length > 0) {
    feature.respins = cfg.respins
    featureEvents.push({ type: 'orbs-locked', cells: newCells, credits: newCredits })
    featureEvents.push({ type: 'respins-reset', respins: cfg.respins })
    if (lockedCount === 15) ended = true
  } else {
    feature.respins -= 1
    featureEvents.push({ type: 'respin-missed', remaining: feature.respins })
    if (feature.respins === 0) ended = true
  }

  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []
  if (ended) {
    const totalCredits = feature.locked.reduce((s, c) => s + (c?.credits ?? 0), 0)
    const filled = lockedCount === 15
    wins.push({
      line: 'hold-and-spin', entryId: 'hold-and-spin', symbols: [],
      payCredits: totalCredits, wildCount: 0, progressive: false
    })
    if (filled && state.progressive?.kind === 'percent' && def.progressive !== null) {
      const grand = Math.floor(state.progressive.value)
      state.progressive.value = def.progressive.reset
      wins.push({
        line: 'grand', entryId: 'grand', symbols: [],
        payCredits: grand, wildCount: 0, progressive: true
      })
      progressiveEvents.push({ type: 'hit', meter: 'percent', amountCredits: grand })
    }
    featureEvents.push({ type: 'hold-and-spin-ended', totalCredits, filled })
    state.videoFeature = null
  }

  // respins have no strip stops; the grid renders the lock board
  const grid: SymbolId[][] = [0, 1, 2, 3, 4].map(r =>
    [0, 1, 2].map(row => feature.locked[r * 3 + row] !== null ? cfg.orbSymbol : cfg.emptySymbol))

  return {
    machineId: def.id,
    family: 'video',
    coins: feature.coins,
    gameKind: 'respin',
    coinsIn: 0,
    stops: [],
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents,
    featureEvents,
    trace: { draws }
  }
}
```

Route it in `spinVideo` (replacing the Task-6 throw):

```ts
    if (feature.kind === 'freeSpins') return freeSpinSpin(def, state, feature, rand)
    return holdAndSpinRespin(def, state, feature, rand)
```

One subtlety: `grid` reads `feature.locked` AFTER `state.videoFeature = null` — `feature` still references the same object, which is intended (the final board renders the full lock state).

In `app/engine/types.ts` extend the `stops` JSDoc's last line: `pachislo = the top-row cell index AFTER control/slip resolution; video hold-and-spin respins = empty array (no strip stops).`

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/video.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add hold-and-spin respin feature with orb locking and Grand progressive"
```

---

### Task 8: Exact video math — `videoExactRtp`

**Files:**
- Create: `app/engine/videoRtp.ts`
- Create: `tests/videoRtp.test.ts`
- Modify: `app/engine/exactRtp.ts` (wire `case 'video'`)

The module computes RTP from closed forms and hit-frequency/variance from the complete 24⁵ cycle, folding feature moments in analytically — the architecture (and every formula) is fixed by the calibration in "Numbers provenance". Both paths MUST agree on the base EV; a test asserts it to 1e-12.

- [ ] **Step 1: Write the failing tests**

`tests/videoRtp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hnsFinalDist, videoExactRtp } from '../app/engine/videoRtp'
import type { VideoMachineDef } from '../app/engine/types'

// Hand-checkable single-line machine: 4-cell strips, P(AA cell) = 1/4.
// rtp = 64*P(run=3) + 256*P(run=4) + 1024*P(run=5)
//     = 64*(3/256) + 256*(3/1024) + 1024*(1/1024) = 0.75 + 0.75 + 1 = 2.5
// HF = P(run >= 3) = (1/4)^3 = 1/64
// E[X^2] = 64^2*3/256 + 256^2*3/1024 + 1024^2/1024 = 48 + 192 + 1024 = 1264
// variance = 1264 - 2.5^2 = 1257.75
const HAND_DEF = {
  id: 'hand-lines',
  name: 'Hand Lines',
  family: 'video',
  denominationCents: 1,
  maxCoins: 1,
  symbols: { AA: { label: 'Ace' }, BB: { label: 'Blank' } },
  strips: [
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB']
  ],
  betMode: { kind: 'lines', lines: [[1, 1, 1, 1, 1]] },
  fixedBet: false,
  wildSymbol: null,
  scatter: null,
  freeSpins: null,
  holdAndSpin: null,
  paytable: [
    { id: 'aa3', symbol: 'AA', length: 3, pay: 64 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 256 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 1024 }
  ],
  progressive: null,
  history: 'test'
} as unknown as VideoMachineDef

describe('videoExactRtp — hand-checkable lines machine', () => {
  it('reproduces the closed-form RTP, HF, and variance exactly', () => {
    const r = videoExactRtp(HAND_DEF, {})
    expect(r.rtpPerCoin).toBeCloseTo(2.5, 12)
    expect(r.hitFrequency).toBeCloseTo(1 / 64, 12)
    expect(r.variancePerCoin).toBeCloseTo(1257.75, 8)
  })
  it('breakdown contributions sum to the RTP', () => {
    const r = videoExactRtp(HAND_DEF, {})
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 10)
  })
})

describe('videoExactRtp — free spins factor', () => {
  // Same machine + a scatter on reels 1,2,3 (one cell of 4 -> visible 3/4 of
  // stops) and 2 free spins at x2, no retrigger:
  // P_tr = (3/4)^3 = 27/64; factor = 1 + 2*2*P_tr = 1 + 4*27/64 = 2.6875.
  // Scatter pays nothing (pays table empty) so rtp = 2.5 * 2.6875 = 6.71875.
  const FS_DEF = {
    ...HAND_DEF,
    id: 'hand-fs',
    symbols: { ...HAND_DEF.symbols, SC: { label: 'Scatter' } },
    strips: [
      ['AA', 'SC', 'BB', 'BB'],
      ['AA', 'SC', 'BB', 'BB'],
      ['AA', 'SC', 'BB', 'BB'],
      ['AA', 'BB', 'BB', 'BB'],
      ['AA', 'BB', 'BB', 'BB']
    ],
    scatter: { symbol: 'SC', pays: {}, triggerCount: 3 },
    freeSpins: { count: 2, multiplier: 2, retrigger: false }
  } as unknown as VideoMachineDef
  it('applies 1 + count*mult*P_tr', () => {
    const r = videoExactRtp(FS_DEF, {})
    expect(r.rtpPerCoin).toBeCloseTo(2.5 * (1 + 4 * 27 / 64), 10)
    const fs = r.breakdown.find(b => b.entryId === 'free-spins')!
    expect(fs.probability).toBeCloseTo(27 / 64, 12)
  })
})

describe('hold-and-spin Markov chain', () => {
  it('FROZEN: P(fill | T=6) at p=2/24 is 2.35465409% and the distribution is proper', () => {
    const dist = hnsFinalDist(6, 2, 24, 3)
    let total = 0
    for (const p of dist.values()) total += p
    expect(total).toBeCloseTo(1, 12)
    expect(dist.get(15)!).toBeCloseTo(0.0235465409, 8)
  })
  it('with p=0 the feature never grows: K = T', () => {
    const dist = hnsFinalDist(7, 0, 24, 3)
    expect(dist.get(7)).toBeCloseTo(1, 12)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- videoRtp`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `app/engine/videoRtp.ts`**

```ts
import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { SymbolId, VideoMachineDef } from './types'

/**
 * Exact video math.
 *
 * RTP comes from closed forms over strip statistics; hit frequency and
 * variance need the joint distribution across reels, so the COMPLETE cycle is
 * enumerated — strips are 24 cells, 24^5 = 7,962,624 equally likely states —
 * accumulating integer sums (every accumulator stays far below 2^53: the
 * dominant sumB2 term is E[B^2]*24^5 ~ 6e10). Feature moments fold in
 * analytically:
 *  - free spins, no retrigger:  S = sum of `count` i.i.d. spins at x`mult`
 *  - free spins with retrigger: branching process, E[S] via Wald
 *      E[S]  = n*E[B] / (1 - n*q)
 *      E[S2] = (n*E[B2] + 2n*E[B*1tr]*E[S] + n(n-1)*E[C]^2) / (1 - n*q)
 *      where C = one batch member's subtree value, E[C] = E[B] + q*E[S]
 *  - hold-and-spin: absorbing Markov chain over (locked k, respins r);
 *      E[F|T=t] and E[F^2|T=t] from the final-count distribution and the
 *      orb-value moments; cross terms use E[B*1(T=t)] from the joint pass.
 * Results are memoized per (machine, coins, meter): the joint pass costs
 * seconds, and tests/PAR sheets call it repeatedly.
 */

export interface JointAccumulators {
  denom: number
  anyWinOrTrigger: number
  sumB: number
  sumB2: number
  sumBTrig: number
  nTrig: number
  tCounts: number[]
  sumBT: number[]
}

function jointCycle(def: VideoMachineDef, coins: number): JointAccumulators {
  const L = def.strips[0]!.length
  const reels = def.strips.length
  const symIds = new Map<SymbolId, number>()
  for (const s of Object.keys(def.symbols)) symIds.set(s, symIds.size)
  const wildId = def.wildSymbol === null ? -1 : symIds.get(def.wildSymbol)!
  const nSym = symIds.size

  const payLut = new Int32Array(nSym * 6)
  for (const e of def.paytable) payLut[symIds.get(e.symbol)! * 6 + e.length] = e.pay

  // per-reel per-cell window data
  const rowSym: Int32Array[][] = []
  const scFlag: Int32Array[] = []
  const orbCnt: Int32Array[] = []
  const waysCnt: Int32Array[][] = []
  for (let r = 0; r < reels; r++) {
    const strip = def.strips[r]!
    const rows = [new Int32Array(L), new Int32Array(L), new Int32Array(L)]
    const sc = new Int32Array(L)
    const orb = new Int32Array(L)
    const wc: Int32Array[] = []
    for (let s = 0; s < nSym; s++) wc.push(new Int32Array(L))
    for (let c = 0; c < L; c++) {
      for (let row = 0; row < 3; row++) {
        const sym = strip[(c + row) % L]!
        const id = symIds.get(sym)!
        rows[row]![c] = id
        if (def.scatter !== null && sym === def.scatter.symbol) sc[c] = 1
        if (def.holdAndSpin !== null && sym === def.holdAndSpin.orbSymbol) orb[c]!++
        for (let s = 0; s < nSym; s++) {
          if (id === s || id === wildId) wc[s]![c]!++
        }
      }
    }
    rowSym.push(rows)
    scFlag.push(sc)
    orbCnt.push(orb)
    waysCnt.push(wc)
  }

  const lines = def.betMode.kind === 'lines' ? def.betMode.lines.slice(0, coins) : []
  const lineRow: Int32Array[] = lines.map((pat) => {
    // resolve each line to its per-reel row LUT pointer index (0..2)
    return Int32Array.from(pat)
  })
  const payingSymIds = [...new Set(def.paytable.map(e => symIds.get(e.symbol)!))]
  const scPay = new Int32Array(reels + 1)
  if (def.scatter !== null) {
    for (const [k, p] of Object.entries(def.scatter.pays)) scPay[Number(k)] = p * coins
  }
  const scTrig = def.scatter?.triggerCount ?? 99
  const orbTrig = def.holdAndSpin?.triggerCount ?? 99

  const acc: JointAccumulators = {
    denom: L ** reels, anyWinOrTrigger: 0, sumB: 0, sumB2: 0,
    sumBTrig: 0, nTrig: 0, tCounts: new Array(16).fill(0), sumBT: new Array(16).fill(0)
  }
  const cs = [0, 0, 0, 0, 0]
  for (let c1 = 0; c1 < L; c1++) {
    cs[0] = c1
    for (let c2 = 0; c2 < L; c2++) {
      cs[1] = c2
      for (let c3 = 0; c3 < L; c3++) {
        cs[2] = c3
        for (let c4 = 0; c4 < L; c4++) {
          cs[3] = c4
          for (let c5 = 0; c5 < L; c5++) {
            cs[4] = c5
            let B = 0
            if (lines.length > 0) {
              for (let li = 0; li < lineRow.length; li++) {
                const pat = lineRow[li]!
                const a = rowSym[0]![pat[0]!]![c1]!
                let run = 1
                for (let r = 1; r < reels; r++) {
                  const id = rowSym[r]![pat[r]!]![cs[r]!]!
                  if (id === a || id === wildId) run++
                  else break
                }
                B += payLut[a * 6 + run]!
              }
            } else {
              for (const s of payingSymIds) {
                let run = 0
                let ways = 1
                for (let r = 0; r < reels; r++) {
                  const n = waysCnt[r]![s]![cs[r]!]!
                  if (n === 0) break
                  run++
                  ways *= n
                }
                if (run >= 3) B += payLut[s * 6 + run]! * ways
              }
            }
            let K = 0
            if (def.scatter !== null) {
              for (let r = 0; r < reels; r++) K += scFlag[r]![cs[r]!]!
            }
            B += scPay[K]!
            let T = 0
            if (def.holdAndSpin !== null) {
              for (let r = 0; r < reels; r++) T += orbCnt[r]![cs[r]!]!
            }
            const trig = K >= scTrig || T >= orbTrig
            if (B > 0 || trig) acc.anyWinOrTrigger++
            acc.sumB += B
            acc.sumB2 += B * B
            if (K >= scTrig) {
              acc.sumBTrig += B
              acc.nTrig++
            }
            if (def.holdAndSpin !== null) {
              acc.tCounts[T]!++
              acc.sumBT[T]! += B
            }
          }
        }
      }
    }
  }
  return acc
}

/** binomial pmf table for n trials at probability p */
function binomPmf(n: number, p: number): number[] {
  const out: number[] = []
  let c = 1
  for (let j = 0; j <= n; j++) {
    out.push(c * p ** j * (1 - p) ** (n - j))
    c = (c * (n - j)) / (j + 1)
  }
  return out
}

/**
 * Final locked-count distribution of the hold-and-spin chain from t locked
 * orbs with `respins` fresh respins; each respin every unlocked cell lands an
 * orb with probability numer/denom; any new orb resets the counter.
 */
export function hnsFinalDist(t: number, numer: number, denom: number, respins: number): Map<number, number> {
  const p = numer / denom
  const memo = new Map<string, Map<number, number>>()
  const dist = (k: number, r: number): Map<number, number> => {
    const key = `${k}:${r}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const out = new Map<number, number>()
    if (k === 15 || r === 0) {
      out.set(k, 1)
      memo.set(key, out)
      return out
    }
    const pmf = binomPmf(15 - k, p)
    for (let j = 0; j <= 15 - k; j++) {
      const pj = pmf[j]!
      if (pj === 0) continue
      const sub = j === 0 ? dist(k, r - 1) : dist(k + j, respins)
      for (const [kk, pk] of sub) out.set(kk, (out.get(kk) ?? 0) + pj * pk)
    }
    memo.set(key, out)
    return out
  }
  return dist(t, respins)
}

interface LineEntryStat {
  entryId: string
  pay: number
  probPerLine: number
}

/** Exact per-line entry probabilities by recursion over strip compositions. */
function lineEntryStats(def: VideoMachineDef): LineEntryStat[] {
  const L = def.strips[0]!.length
  const comps = def.strips.map((strip) => {
    const m = new Map<SymbolId, number>()
    for (const s of strip) m.set(s, (m.get(s) ?? 0) + 1)
    return [...m.entries()]
  })
  const denom = L ** def.strips.length
  const probs = new Map<string, number>()
  const rec = (reel: number, anchor: SymbolId | null, run: number, alive: boolean, w: number) => {
    if (reel === def.strips.length) {
      if (anchor === null) return
      const entry = def.paytable.find(e => e.symbol === anchor && e.length === run)
      if (entry !== undefined) probs.set(entry.id, (probs.get(entry.id) ?? 0) + w / denom)
      return
    }
    for (const [sym, cnt] of comps[reel]!) {
      if (reel === 0) {
        rec(1, sym, 1, true, w * cnt)
      } else if (alive && (sym === anchor || sym === def.wildSymbol)) {
        rec(reel + 1, anchor, run + 1, true, w * cnt)
      } else {
        rec(reel + 1, anchor, run, false, w * cnt)
      }
    }
  }
  rec(0, null, 0, false, 1)
  return def.paytable.map(e => ({ entryId: e.id, pay: e.pay, probPerLine: probs.get(e.id) ?? 0 }))
}

interface WaysEntryStat {
  entryId: string
  probability: number
  contributionCredits: number
}

/** Exact ways stats from window means (mu) and vacancies (z) per symbol/reel. */
function waysEntryStats(def: VideoMachineDef): WaysEntryStat[] {
  const L = def.strips[0]!.length
  const out: WaysEntryStat[] = []
  const seen = new Set<SymbolId>()
  for (const probe of def.paytable) {
    if (seen.has(probe.symbol)) continue
    seen.add(probe.symbol)
    const mu: number[] = []
    const z: number[] = []
    for (const strip of def.strips) {
      let total = 0
      let zero = 0
      for (let c = 0; c < L; c++) {
        let n = 0
        for (let row = 0; row < 3; row++) {
          const sym = strip[(c + row) % L]!
          if (sym === probe.symbol || sym === def.wildSymbol) n++
        }
        total += n
        if (n === 0) zero++
      }
      mu.push(total / L)
      z.push(zero / L)
    }
    for (const e of def.paytable) {
      if (e.symbol !== probe.symbol) continue
      let muProd = 1
      let pProd = 1
      for (let r = 0; r < e.length; r++) {
        muProd *= mu[r]!
        pProd *= 1 - z[r]!
      }
      const tail = e.length < def.strips.length ? z[e.length]! : 1
      out.push({
        entryId: e.id,
        probability: pProd * tail,
        contributionCredits: e.pay * muProd * tail
      })
    }
  }
  return out
}

/** Poisson-binomial over the reels that carry the scatter. */
function scatterDist(def: VideoMachineDef): number[] {
  const L = def.strips[0]!.length
  let d = [1]
  if (def.scatter === null) return d
  for (const strip of def.strips) {
    let visible = 0
    for (let c = 0; c < L; c++) {
      let any = false
      for (let row = 0; row < 3; row++) {
        if (strip[(c + row) % L] === def.scatter.symbol) any = true
      }
      if (any) visible++
    }
    const p = visible / L
    const nd = new Array<number>(d.length + 1).fill(0)
    for (let k = 0; k < d.length; k++) {
      nd[k]! += d[k]! * (1 - p)
      nd[k + 1]! += d[k]! * p
    }
    d = nd
  }
  return d
}

const cache = new Map<string, ExactRtpReport>()

export function videoExactRtp(def: VideoMachineDef, opts: ExactRtpOptions): ExactRtpReport {
  const coins = def.betMode.kind === 'lines' && !def.fixedBet
    ? (opts.coins ?? def.maxCoins)
    : def.maxCoins
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  if (def.fixedBet && opts.coins !== undefined && opts.coins !== def.maxCoins) {
    throw new Error(`${def.id}: fixed bet machine requires ${def.maxCoins} coins`)
  }
  const meter = opts.progressiveValues?.meter ?? def.progressive?.reset ?? 0
  const key = `${def.id}:${coins}:${meter}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const bet = coins
  const acc = jointCycle(def, coins)
  const EB = acc.sumB / acc.denom
  const EB2 = acc.sumB2 / acc.denom
  const EBtr = acc.sumBTrig / acc.denom
  const ptr = acc.nTrig / acc.denom
  const varB = EB2 - EB * EB

  let EX = EB
  let EX2 = EB2
  const breakdown: ExactRtpBreakdownEntry[] = []

  // base-game breakdown (closed forms — also a cross-check on the joint pass)
  let closedBaseCredits = 0
  if (def.betMode.kind === 'lines') {
    for (const s of lineEntryStats(def)) {
      if (s.probPerLine === 0) continue
      const probability = s.probPerLine * coins
      const contribution = probability * (s.pay / bet)
      closedBaseCredits += probability * s.pay
      breakdown.push({ entryId: s.entryId, probability, avgPayPerCoin: s.pay / bet, contribution })
    }
  } else {
    for (const s of waysEntryStats(def)) {
      if (s.probability === 0) continue
      closedBaseCredits += s.contributionCredits
      breakdown.push({
        entryId: s.entryId,
        probability: s.probability,
        avgPayPerCoin: s.contributionCredits / s.probability / bet,
        contribution: s.contributionCredits / bet
      })
    }
  }
  const scD = scatterDist(def)
  if (def.scatter !== null) {
    for (const [k, pay] of Object.entries(def.scatter.pays)) {
      const p = scD[Number(k)] ?? 0
      if (p === 0) continue
      closedBaseCredits += p * pay * bet
      breakdown.push({ entryId: `sc${k}`, probability: p, avgPayPerCoin: pay, contribution: p * pay })
    }
  }
  if (Math.abs(closedBaseCredits - EB) > 1e-9 * Math.max(1, EB)) {
    throw new Error(`${def.id}: joint pass disagrees with closed forms: ${EB} vs ${closedBaseCredits}`)
  }

  if (def.freeSpins !== null) {
    const n = def.freeSpins.count
    const m = def.freeSpins.multiplier
    let ES: number
    let ES2: number
    if (!def.freeSpins.retrigger) {
      ES = n * m * EB
      ES2 = n * m * m * varB + ES * ES
    } else {
      const q = ptr
      ES = (n * EB) / (1 - n * q)
      const EC = EB + q * ES
      ES2 = (n * EB2 + 2 * n * EBtr * ES + n * (n - 1) * EC * EC) / (1 - n * q)
    }
    EX = EB + ptr * ES
    EX2 = EB2 + 2 * EBtr * ES + ptr * ES2
    breakdown.push({
      entryId: 'free-spins',
      probability: ptr,
      avgPayPerCoin: ptr > 0 ? (ptr * ES) / ptr / bet : 0,
      contribution: (ptr * ES) / bet
    })
  }

  if (def.holdAndSpin !== null) {
    const cfg = def.holdAndSpin
    const wsum = cfg.orbValues.reduce((s, e) => s + e.weight, 0)
    const muV = cfg.orbValues.reduce((s, e) => s + e.credits * e.weight, 0) / wsum
    const m2V = cfg.orbValues.reduce((s, e) => s + e.credits * e.credits * e.weight, 0) / wsum
    const varV = m2V - muV * muV
    let featEV = 0
    let pTrigger = 0
    let pFill = 0
    for (let t = cfg.triggerCount; t <= 15; t++) {
      const pt = acc.tCounts[t]! / acc.denom
      if (pt === 0) continue
      const kd = hnsFinalDist(t, cfg.respinOrbNumer, cfg.respinOrbDenom, cfg.respins)
      let EFt = 0
      let EFt2 = 0
      for (const [k, pk] of kd) {
        const g = k === 15 ? meter : 0
        const mean = k * muV + g
        EFt += pk * mean
        EFt2 += pk * (k * varV + mean * mean)
      }
      EX += pt * EFt
      EX2 += 2 * (acc.sumBT[t]! / acc.denom) * EFt + pt * EFt2
      featEV += pt * EFt
      pTrigger += pt
      pFill += pt * (kd.get(15) ?? 0)
    }
    const grandSlice = pFill * meter
    breakdown.push({
      entryId: 'hold-and-spin',
      probability: pTrigger,
      avgPayPerCoin: pTrigger > 0 ? (featEV - grandSlice) / pTrigger / bet : 0,
      contribution: (featEV - grandSlice) / bet
    })
    breakdown.push({
      entryId: 'grand',
      probability: pFill,
      avgPayPerCoin: pFill > 0 ? meter / bet : 0,
      contribution: grandSlice / bet
    })
  }

  const report: ExactRtpReport = {
    rtpPerCoin: EX / bet,
    hitFrequency: acc.anyWinOrTrigger / acc.denom,
    variancePerCoin: (EX2 - EX * EX) / (bet * bet),
    breakdown: breakdown.sort((a, b) => b.contribution - a.contribution)
  }
  cache.set(key, report)
  return report
}
```

Wire the dispatch — in `app/engine/exactRtp.ts` replace the temporary `case 'video':` arm of the weights switch. The cleanest shape: move the family switch to the TOP of `exactRtp` and delegate:

```ts
import { videoExactRtp } from './videoRtp'
// ...
export function exactRtp(def: MachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  if (def.family === 'video') return videoExactRtp(def, opts)
  if (def.family === 'pachislo') throw new Error('pachislo exactRtp lands in Task 12')
  // ... existing enumeration body for stepper/bally-em unchanged,
  //     with the weights switch now only handling those two families ...
}
```

(Keep the existing coins guard, which now runs inside the enumeration path; `videoExactRtp` does its own validation because ways/fixed-bet machines resolve coins differently.)

- [ ] **Step 4: Run tests**

Run: `pnpm test -- videoRtp`
Expected: PASS — hand values exact to 12 decimals, frozen chain value to 8.

- [ ] **Step 5: Run the full suite (regression: stepper/bally exactRtp untouched)**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 6: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add exact video math: full-cycle joint enumeration with analytic feature moments"
```

---

### Task 9: The three video machines + video validation

**Files:**
- Create: `app/machines/canal-royale.ts`, `app/machines/dragons-hoard.ts`, `app/machines/thunder-vault.ts`
- Modify: `app/machines/index.ts`
- Modify: `app/engine/validate.ts` (video rules replace the temporary throw)
- Create: `tests/machines-video.test.ts`
- Modify: `tests/validate.test.ts`

Strips below are the EXACT calibrated layouts — symbol counts AND cell order both matter (cell order fixes the window statistics that hit frequency, scatter spacing, and orb clustering depend on). Do not "tidy" them.

- [ ] **Step 1: Write the failing frozen tests**

`tests/machines-video.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { validateMachineDef } from '../app/engine/validate'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { DRAGONS_HOARD } from '../app/machines/dragons-hoard'
import { THUNDER_VAULT } from '../app/machines/thunder-vault'

function counts(strip: string[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const s of strip) c[s] = (c[s] ?? 0) + 1
  return c
}

describe('canal-royale — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(CANAL_ROYALE)).not.toThrow()
  })

  it('strip compositions match the calibrated counts', () => {
    const want = [
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 4, TT: 4, SC: 1 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 3, TT: 3, SC: 1, WD: 2 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 4, TT: 3, WD: 2 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 3, TT: 3, SC: 1, WD: 2 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 4, TT: 4, SC: 1 }
    ]
    CANAL_ROYALE.strips.forEach((s, i) => expect(counts(s)).toEqual(want[i]))
  })

  it('FROZEN: RTP 92.455942% (628217093/679477248), HF@25 55.534306%, variance 8.792463', () => {
    const r = exactRtp(CANAL_ROYALE)
    expect(r.rtpPerCoin).toBeCloseTo(628217093 / 679477248, 10)
    expect(r.rtpPerCoin).toBeCloseTo(0.92455942, 6)
    expect(r.hitFrequency).toBeCloseTo(122833 / 221184, 10)
    expect(r.hitFrequency).toBeCloseTo(0.55534306, 6)
    expect(r.variancePerCoin).toBeCloseTo(8.792463, 4)
  })

  it('FROZEN: per-coin RTP is line-count invariant; trigger = 29/4096', () => {
    const r1 = exactRtp(CANAL_ROYALE, { coins: 1 })
    const r25 = exactRtp(CANAL_ROYALE, { coins: 25 })
    expect(r1.rtpPerCoin).toBeCloseTo(r25.rtpPerCoin, 12)
    const fs = r25.breakdown.find(b => b.entryId === 'free-spins')!
    expect(fs.probability).toBeCloseTo(29 / 4096, 12)
  })

  it('FROZEN: P(5xLI on a line) = 1/31104; breakdown sums to RTP', () => {
    const r = exactRtp(CANAL_ROYALE)
    const li5 = r.breakdown.find(b => b.entryId === 'li5')!
    expect(li5.probability).toBeCloseTo(25 / 31104, 12)
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 9)
  })
})

describe('dragons-hoard — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(DRAGONS_HOARD)).not.toThrow()
  })

  it('FROZEN: RTP 93.995040% (94747/100800), HF 53.553376%, variance 10.696426', () => {
    const r = exactRtp(DRAGONS_HOARD)
    expect(r.rtpPerCoin).toBeCloseTo(94747 / 100800, 10)
    expect(r.rtpPerCoin).toBeCloseTo(0.93995040, 6)
    expect(r.hitFrequency).toBeCloseTo(236903 / 442368, 10)
    expect(r.hitFrequency).toBeCloseTo(0.53553376, 6)
    expect(r.variancePerCoin).toBeCloseTo(10.696426, 4)
  })

  it('FROZEN: retrigger q = 29/4096 (E[T] = 4096/483 spins); breakdown sums to RTP', () => {
    const r = exactRtp(DRAGONS_HOARD)
    const fs = r.breakdown.find(b => b.entryId === 'free-spins')!
    expect(fs.probability).toBeCloseTo(29 / 4096, 12)
    // free-spin slice per coin = q * E[S] / 25 with E[S] = 8*E[B]/(1-8q)
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 9)
  })
})

describe('thunder-vault — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(THUNDER_VAULT)).not.toThrow()
  })

  it('FROZEN: RTP 90.294753% at grand reset, HF 41.289906%, variance 29.259962', () => {
    const r = exactRtp(THUNDER_VAULT)
    expect(r.rtpPerCoin).toBeCloseTo(0.90294753, 6)
    expect(r.hitFrequency).toBeCloseTo(68495 / 165888, 10)
    expect(r.hitFrequency).toBeCloseTo(0.41289906, 6)
    expect(r.variancePerCoin).toBeCloseTo(29.259962, 4)
  })

  it('FROZEN: P(trigger) = 449/55296; Grand 1/5,138 spins; feature slice 31.837642%', () => {
    const r = exactRtp(THUNDER_VAULT)
    const hns = r.breakdown.find(b => b.entryId === 'hold-and-spin')!
    expect(hns.probability).toBeCloseTo(449 / 55296, 12)
    const grand = r.breakdown.find(b => b.entryId === 'grand')!
    expect(grand.probability).toBeCloseTo(0.000194622926, 10)
    expect(hns.contribution + grand.contribution).toBeCloseTo(0.31837642, 6)
  })

  it('FROZEN: a higher meter raises RTP (the +EV teaching point)', () => {
    const atReset = exactRtp(THUNDER_VAULT)
    const grown = exactRtp(THUNDER_VAULT, { progressiveValues: { meter: 30000 } })
    // dRTP = P(fill) * dMeter / bet = 1.94622926e-4 * 25000 / 25
    expect(grown.rtpPerCoin - atReset.rtpPerCoin).toBeCloseTo(0.000194622926 * 25000 / 25, 8)
  })
})
```

Append to `tests/validate.test.ts`:

```ts
describe('video validation', () => {
  const base = () => JSON.parse(JSON.stringify(CANAL_ROYALE)) as typeof CANAL_ROYALE

  it('rejects a wild on reel 1', () => {
    const def = base()
    def.strips[0]![0] = 'WD'
    def.strips[0]![1] = 'JJ' // keep length; composition change is irrelevant to this rule
    expect(() => validateMachineDef(def)).toThrow(/wild .* reel 1/i)
  })

  it('rejects scatter spacing under 3', () => {
    const def = base()
    // duplicate the scatter right next to the existing one on reel 1 (cell 4)
    def.strips[0]![5] = 'SC'
    expect(() => validateMachineDef(def)).toThrow(/scatter spacing/i)
  })

  it('rejects incomplete pay-length triples', () => {
    const def = base()
    def.paytable = def.paytable.filter(e => e.id !== 'li4')
    expect(() => validateMachineDef(def)).toThrow(/lengths 3, 4 and 5/i)
  })

  it('rejects ways machines without fixed bet', () => {
    const def = JSON.parse(JSON.stringify(DRAGONS_HOARD)) as typeof DRAGONS_HOARD
    def.fixedBet = false
    expect(() => validateMachineDef(def)).toThrow(/fixed bet/i)
  })

  it('rejects hold-and-spin without a percent progressive', () => {
    const def = JSON.parse(JSON.stringify(THUNDER_VAULT)) as typeof THUNDER_VAULT
    def.progressive = null
    expect(() => validateMachineDef(def)).toThrow(/percent progressive/i)
  })
})
```

(Import `CANAL_ROYALE`, `DRAGONS_HOARD`, `THUNDER_VAULT` at the top of `tests/validate.test.ts`.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- machines-video`
Expected: FAIL — machine modules do not exist.

- [ ] **Step 3: Create the machine data files**

`app/machines/canal-royale.ts`:

```ts
import type { VideoMachineDef } from '../engine/types'
import { LINES25 } from '../engine/videoAwards'

/**
 * The bread-and-butter Venetian-floor archetype: 5x3 video, 25 selectable
 * lines, wilds on reels 2-4, gondola scatters on reels 1/2/4/5, 3+ scatters
 * = 10 free spins at x2.
 *
 * Frozen exact math (plan calibration over the full 24^5 cycle):
 * RTP 92.455942% per coin at ANY line count (= 628217093/679477248),
 * HF@25 55.534306%, variancePerCoin 8.792463 (medium volatility),
 * P(free spins) = 29/4096 = 1/141.2, P(5xLI on a line) = 1/31,104.
 */
export const CANAL_ROYALE: VideoMachineDef = {
  id: 'canal-royale',
  name: 'Canal Royale',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    LI: { label: 'Winged Lion' },
    MA: { label: 'Carnival Mask' },
    FA: { label: 'Golden Fan' },
    AA: { label: 'Ace' },
    KK: { label: 'King' },
    QQ: { label: 'Queen' },
    JJ: { label: 'Jack' },
    TT: { label: 'Ten' },
    WD: { label: 'Wild Doge' },
    SC: { label: 'Gondola Scatter' }
  },
  strips: [
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'FA', 'JJ', 'TT', 'LI', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'LI', 'MA'],
    ['WD', 'AA', 'JJ', 'KK', 'SC', 'QQ', 'TT', 'FA', 'LI', 'AA', 'JJ', 'KK', 'WD', 'QQ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'LI', 'MA'],
    ['WD', 'JJ', 'AA', 'KK', 'QQ', 'TT', 'FA', 'JJ', 'LI', 'AA', 'KK', 'QQ', 'WD', 'JJ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'LI', 'MA'],
    ['WD', 'AA', 'JJ', 'KK', 'SC', 'QQ', 'TT', 'FA', 'LI', 'AA', 'JJ', 'KK', 'WD', 'QQ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'LI', 'MA'],
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'FA', 'JJ', 'TT', 'LI', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'LI', 'MA']
  ],
  betMode: { kind: 'lines', lines: LINES25 },
  fixedBet: false,
  wildSymbol: 'WD',
  scatter: { symbol: 'SC', pays: { 3: 2, 4: 20 }, triggerCount: 3 },
  freeSpins: { count: 10, multiplier: 2, retrigger: false },
  holdAndSpin: null,
  paytable: [
    { id: 'li3', symbol: 'LI', length: 3, pay: 50 },
    { id: 'li4', symbol: 'LI', length: 4, pay: 250 },
    { id: 'li5', symbol: 'LI', length: 5, pay: 1000 },
    { id: 'ma3', symbol: 'MA', length: 3, pay: 30 },
    { id: 'ma4', symbol: 'MA', length: 4, pay: 120 },
    { id: 'ma5', symbol: 'MA', length: 5, pay: 400 },
    { id: 'fa3', symbol: 'FA', length: 3, pay: 20 },
    { id: 'fa4', symbol: 'FA', length: 4, pay: 75 },
    { id: 'fa5', symbol: 'FA', length: 5, pay: 250 },
    { id: 'aa3', symbol: 'AA', length: 3, pay: 12 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 40 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 150 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 10 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 30 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 100 },
    { id: 'qq3', symbol: 'QQ', length: 3, pay: 8 },
    { id: 'qq4', symbol: 'QQ', length: 4, pay: 24 },
    { id: 'qq5', symbol: 'QQ', length: 5, pay: 80 },
    { id: 'jj3', symbol: 'JJ', length: 3, pay: 5 },
    { id: 'jj4', symbol: 'JJ', length: 4, pay: 15 },
    { id: 'jj5', symbol: 'JJ', length: 5, pay: 50 },
    { id: 'tt3', symbol: 'TT', length: 3, pay: 4 },
    { id: 'tt4', symbol: 'TT', length: 4, pay: 12 },
    { id: 'tt5', symbol: 'TT', length: 5, pay: 38 }
  ],
  progressive: null,
  history: 'The 25-line video slot is the bread and butter of every modern floor — this one wears '
    + 'Venetian colors. Lines pay left to right anchored on reel 1, wilds substitute on reels 2-4, '
    + 'and three gondolas start ten free spins at double pay. Its strips are 24 cells so the FULL '
    + 'cycle — all 7,962,624 reel states — is enumerated exactly for the PAR sheet; nothing here is '
    + 'sampled or approximated.'
}
```

`app/machines/dragons-hoard.ts`:

```ts
import type { VideoMachineDef } from '../engine/types'

/**
 * 243-ways archetype (Reel Power lineage): any-adjacent left-to-right pays,
 * 2-cell stacked wilds on reels 2-4, scatters on reels 1/2/4/5, 8 free spins
 * with retriggers. Deliberately the loosest video machine on the floor.
 *
 * Frozen exact math (plan calibration): RTP 93.995040% per coin
 * (= 94747/100800), HF 53.553376%, variancePerCoin 10.696426,
 * retrigger q = 29/4096 -> E[total free spins] = 4096/483 = 8.4803.
 */
export const DRAGONS_HOARD: VideoMachineDef = {
  id: 'dragons-hoard',
  name: "Dragon's Hoard",
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    DR: { label: 'Dragon' },
    PH: { label: 'Phoenix' },
    KO: { label: 'Koi' },
    AA: { label: 'Ace' },
    KK: { label: 'King' },
    QQ: { label: 'Queen' },
    JJ: { label: 'Jack' },
    TT: { label: 'Ten' },
    WD: { label: 'Pearl Wild' },
    SC: { label: 'Gold Ingot Scatter' }
  },
  strips: [
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'DR', 'JJ', 'TT', 'KO', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'KO', 'PH'],
    ['WD', 'WD', 'AA', 'JJ', 'SC', 'KK', 'QQ', 'TT', 'DR', 'KO', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'KO', 'PH'],
    ['WD', 'WD', 'JJ', 'AA', 'KK', 'QQ', 'TT', 'DR', 'JJ', 'KO', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'KO', 'PH'],
    ['WD', 'WD', 'AA', 'JJ', 'SC', 'KK', 'QQ', 'TT', 'DR', 'KO', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'KO', 'PH'],
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'DR', 'JJ', 'TT', 'KO', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'KO', 'PH']
  ],
  betMode: { kind: 'ways' },
  fixedBet: true,
  wildSymbol: 'WD',
  scatter: { symbol: 'SC', pays: { 3: 2, 4: 10 }, triggerCount: 3 },
  freeSpins: { count: 8, multiplier: 1, retrigger: true },
  holdAndSpin: null,
  paytable: [
    { id: 'dr3', symbol: 'DR', length: 3, pay: 22 },
    { id: 'dr4', symbol: 'DR', length: 4, pay: 66 },
    { id: 'dr5', symbol: 'DR', length: 5, pay: 272 },
    { id: 'ph3', symbol: 'PH', length: 3, pay: 13 },
    { id: 'ph4', symbol: 'PH', length: 4, pay: 42 },
    { id: 'ph5', symbol: 'PH', length: 5, pay: 162 },
    { id: 'ko3', symbol: 'KO', length: 3, pay: 9 },
    { id: 'ko4', symbol: 'KO', length: 4, pay: 27 },
    { id: 'ko5', symbol: 'KO', length: 5, pay: 106 },
    { id: 'aa3', symbol: 'AA', length: 3, pay: 5 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 16 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 65 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 4 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 13 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 42 },
    { id: 'qq3', symbol: 'QQ', length: 3, pay: 3 },
    { id: 'qq4', symbol: 'QQ', length: 4, pay: 11 },
    { id: 'qq5', symbol: 'QQ', length: 5, pay: 32 },
    { id: 'jj3', symbol: 'JJ', length: 3, pay: 2 },
    { id: 'jj4', symbol: 'JJ', length: 4, pay: 9 },
    { id: 'jj5', symbol: 'JJ', length: 5, pay: 27 },
    { id: 'tt3', symbol: 'TT', length: 3, pay: 2 },
    { id: 'tt4', symbol: 'TT', length: 4, pay: 6 },
    { id: 'tt5', symbol: 'TT', length: 5, pay: 22 }
  ],
  progressive: null,
  history: 'A 243-ways game in the Reel Power lineage: no paylines — any symbol adjacent left to '
    + 'right pays, multiplied by how many of it land on each reel. Stacked pearl wilds on the middle '
    + 'reels and retriggerable free spins make it the loosest machine on this floor at 94.0% — '
    + 'machine-choosing literacy starts with reading numbers like that off the PAR sheet.'
}
```

`app/machines/thunder-vault.ts`:

```ts
import type { VideoMachineDef } from '../engine/types'
import { LINES25 } from '../engine/videoAwards'

/**
 * Hold-and-spin archetype (Lightning Link lineage, 2017): lean 25-line base
 * game plus orb symbols carrying credit values; 6+ orbs lock and start 3
 * respins over the 15-cell grid; every new orb resets the counter; filling
 * all 15 pays the percentage-fed Grand progressive.
 *
 * Frozen exact math (plan calibration): RTP 90.294753% per coin at grand
 * reset 5000, HF 41.289906%, variancePerCoin 29.259962 (high volatility),
 * P(trigger) = 449/55296 = 1/123.2, Grand ~ 1/5,138 spins.
 */
export const THUNDER_VAULT: VideoMachineDef = {
  id: 'thunder-vault',
  name: 'Thunder Vault',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    VA: { label: 'Vault' },
    LT: { label: 'Lightning' },
    GB: { label: 'Gold Bar' },
    AA: { label: 'Ace' },
    KK: { label: 'King' },
    QQ: { label: 'Queen' },
    JJ: { label: 'Jack' },
    OR: { label: 'Storm Orb' },
    EM: { label: 'Empty' }
  },
  strips: [
    ['OR', 'OR', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'JJ', 'AA', 'QQ', 'KK', 'LT', 'VA', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'AA', 'KK', 'JJ', 'LT', 'QQ', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'QQ', 'KK', 'GB', 'OR', 'AA', 'JJ', 'QQ', 'LT', 'KK', 'AA', 'JJ', 'QQ', 'VA', 'GB', 'KK', 'AA', 'JJ', 'QQ', 'LT', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'JJ', 'AA', 'QQ', 'KK', 'LT', 'VA', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'AA', 'KK', 'JJ', 'LT', 'QQ', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'QQ', 'KK', 'GB', 'OR', 'AA', 'JJ', 'QQ', 'LT', 'KK', 'AA', 'JJ', 'QQ', 'VA', 'GB', 'KK', 'AA', 'JJ', 'QQ', 'LT', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'JJ', 'AA', 'QQ', 'KK', 'LT', 'VA', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'AA', 'KK', 'JJ', 'LT', 'QQ', 'VA']
  ],
  betMode: { kind: 'lines', lines: LINES25 },
  fixedBet: true,
  wildSymbol: null,
  scatter: null,
  freeSpins: null,
  holdAndSpin: {
    orbSymbol: 'OR',
    triggerCount: 6,
    respins: 3,
    respinOrbNumer: 2,
    respinOrbDenom: 24,
    orbValues: [
      { credits: 25, weight: 72 },
      { credits: 50, weight: 48 },
      { credits: 75, weight: 28 },
      { credits: 125, weight: 14 },
      { credits: 250, weight: 7 },
      { credits: 300, weight: 4, label: 'mini' },
      { credits: 625, weight: 2, label: 'minor' },
      { credits: 2500, weight: 1, label: 'major' }
    ],
    emptySymbol: 'EM'
  },
  paytable: [
    { id: 'va3', symbol: 'VA', length: 3, pay: 100 },
    { id: 'va4', symbol: 'VA', length: 4, pay: 400 },
    { id: 'va5', symbol: 'VA', length: 5, pay: 1600 },
    { id: 'lt3', symbol: 'LT', length: 3, pay: 60 },
    { id: 'lt4', symbol: 'LT', length: 4, pay: 200 },
    { id: 'lt5', symbol: 'LT', length: 5, pay: 640 },
    { id: 'gb3', symbol: 'GB', length: 3, pay: 40 },
    { id: 'gb4', symbol: 'GB', length: 4, pay: 130 },
    { id: 'gb5', symbol: 'GB', length: 5, pay: 400 },
    { id: 'aa3', symbol: 'AA', length: 3, pay: 24 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 80 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 240 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 20 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 65 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 190 },
    { id: 'qq3', symbol: 'QQ', length: 3, pay: 13 },
    { id: 'qq4', symbol: 'QQ', length: 4, pay: 40 },
    { id: 'qq5', symbol: 'QQ', length: 5, pay: 130 },
    { id: 'jj3', symbol: 'JJ', length: 3, pay: 10 },
    { id: 'jj4', symbol: 'JJ', length: 4, pay: 30 },
    { id: 'jj5', symbol: 'JJ', length: 5, pay: 95 }
  ],
  progressive: {
    kind: 'percent',
    reset: 5000,
    max: 50_000,
    feedRate: 0.01
  },
  history: 'The hold-and-spin mechanic conquered casino floors after 2017: a deliberately lean base '
    + 'game funds orb features where credits stick where they land. Six storm orbs lock and grant '
    + 'three respins; every new orb resets the count; fill all fifteen cells and the Grand — fed by '
    + '1% of every bet — pays in full. High volatility by design, and the math shows exactly where '
    + 'the missing base-game percentage went.'
}
```

Update `app/machines/index.ts` (spec floor order — video, steppers, bally; pachislo appends in Task 12):

```ts
import type { MachineDef } from '../engine/types'
import { CANAL_ROYALE } from './canal-royale'
import { DRAGONS_HOARD } from './dragons-hoard'
import { THUNDER_VAULT } from './thunder-vault'
import { DIAMOND_DOUBLER } from './diamond-doubler'
import { SEVENS_ABLAZE } from './sevens-ablaze'
import { SERIES_E_3LINE } from './series-e-3line'
import { SERIES_E_MULTIPLIER } from './series-e-multiplier'

export const FLOOR: MachineDef[] = [
  CANAL_ROYALE,
  DRAGONS_HOARD,
  THUNDER_VAULT,
  DIAMOND_DOUBLER,
  SEVENS_ABLAZE,
  SERIES_E_3LINE,
  SERIES_E_MULTIPLIER
]
```

- [ ] **Step 4: Implement video validation**

In `app/engine/validate.ts` replace the temporary `case 'video':` throw with:

```ts
    case 'video': {
      if (def.strips.length !== 5) errors.push(`video needs 5 strips, got ${def.strips.length}`)
      const L = def.strips[0]?.length ?? 0
      if (L !== 24) errors.push(`video strips must be 24 cells (full-cycle enumeration), got ${L}`)
      def.strips.forEach((strip, r) => {
        if (strip.length !== L) errors.push(`strips[${r}] length ${strip.length} != ${L}`)
        strip.forEach(s => checkSymbol(s, `strips[${r}]`))
      })
      const special = new Set<SymbolId>()
      if (def.wildSymbol !== null) {
        checkSymbol(def.wildSymbol, 'wildSymbol')
        special.add(def.wildSymbol)
        if (def.strips[0]!.includes(def.wildSymbol)) {
          errors.push('wild must not appear on reel 1 (line/ways anchoring rule)')
        }
      }
      if (def.scatter !== null) {
        checkSymbol(def.scatter.symbol, 'scatter')
        special.add(def.scatter.symbol)
        def.strips.forEach((strip, r) => {
          const pos = strip.flatMap((s, i) => s === def.scatter!.symbol ? [i] : [])
          for (let a = 0; a < pos.length; a++) {
            for (let b = a + 1; b < pos.length; b++) {
              const d = Math.abs(pos[a]! - pos[b]!)
              if (Math.min(d, L - d) < 3) {
                errors.push(`strips[${r}]: scatter spacing under 3 breaks the one-per-window invariant`)
              }
            }
          }
        })
        for (const k of Object.keys(def.scatter.pays)) {
          const n = Number(k)
          if (!Number.isInteger(n) || n < 1 || n > 5) errors.push(`scatter pays key ${k} out of range 1..5`)
        }
      }
      if (def.holdAndSpin !== null) {
        const h = def.holdAndSpin
        checkSymbol(h.orbSymbol, 'holdAndSpin.orbSymbol')
        checkSymbol(h.emptySymbol, 'holdAndSpin.emptySymbol')
        special.add(h.orbSymbol)
        special.add(h.emptySymbol)
        if (h.triggerCount < 1 || h.triggerCount > 15) errors.push('holdAndSpin.triggerCount out of range 1..15')
        if (h.respins < 1) errors.push('holdAndSpin.respins must be >= 1')
        if (h.respinOrbDenom < 1 || h.respinOrbNumer < 0 || h.respinOrbNumer > h.respinOrbDenom) {
          errors.push('holdAndSpin respin probability must be a proper fraction')
        }
        if (h.orbValues.length === 0) errors.push('holdAndSpin.orbValues must not be empty')
        h.orbValues.forEach((v, i) => {
          if (v.credits <= 0 || v.weight <= 0) errors.push(`holdAndSpin.orbValues[${i}]: credits and weight must be > 0`)
        })
        if (def.strips.some(s => s.includes(h.emptySymbol))) {
          errors.push('holdAndSpin.emptySymbol must not appear on strips')
        }
        if (def.progressive?.kind !== 'percent') {
          errors.push('holdAndSpin requires a percent progressive (the Grand)')
        }
        if (def.freeSpins !== null) errors.push('freeSpins and holdAndSpin are mutually exclusive in v0.2')
        if (!def.fixedBet) errors.push('holdAndSpin machines must be fixed bet')
      } else if (def.progressive !== null) {
        errors.push('video percent progressives are only paid by hold-and-spin (the Grand) in v0.2')
      }
      if (def.freeSpins !== null) {
        if (def.scatter === null || def.scatter.triggerCount === null) {
          errors.push('freeSpins requires a scatter with a triggerCount')
        }
        if (def.freeSpins.count < 1 || def.freeSpins.multiplier < 1) {
          errors.push('freeSpins count and multiplier must be >= 1')
        }
      }
      if (def.betMode.kind === 'lines') {
        if (def.betMode.lines.length !== def.maxCoins) {
          errors.push(`lines count ${def.betMode.lines.length} != maxCoins ${def.maxCoins}`)
        }
        def.betMode.lines.forEach((pat, i) => {
          if (pat.length !== def.strips.length) errors.push(`lines[${i}] length ${pat.length} != 5`)
          pat.forEach((row) => {
            if (row < 0 || row > 2) errors.push(`lines[${i}] row ${row} out of range 0..2`)
          })
        })
      } else if (!def.fixedBet) {
        errors.push('ways machines must be fixed bet (the bet buys all ways)')
      }
      const bySymbol = new Map<SymbolId, Set<number>>()
      for (const e of def.paytable) {
        checkSymbol(e.symbol, `paytable ${e.id}`)
        if (e.pay <= 0) errors.push(`paytable ${e.id}: pay must be > 0`)
        if (special.has(e.symbol)) errors.push(`paytable ${e.id}: wild/scatter/orb symbols cannot pay as line symbols`)
        const set = bySymbol.get(e.symbol) ?? new Set<number>()
        set.add(e.length)
        bySymbol.set(e.symbol, set)
      }
      for (const [sym, lengths] of bySymbol) {
        if (lengths.size !== 3) {
          errors.push(`paytable for ${sym} must cover lengths 3, 4 and 5 (exact-run matching)`)
        }
      }
      break
    }
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- machines-video validate`
Expected: PASS, including all frozen values. (The Canal joint pass runs once per process thanks to the `videoRtp` cache; expect this suite to take a few seconds.)

- [ ] **Step 6: Full gate + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add Canal Royale, Dragon's Hoard, Thunder Vault with frozen calibration and video validation"
```

---

### Task 10: Stock Rush data + skill-stop control

**Files:**
- Create: `app/machines/stock-rush.ts`
- Create: `app/engine/pachislo.ts` (control + paying-hit detection; the spin flow lands in Task 11)
- Create: `tests/pachislo-control.test.ts`

The strips below were searched during planning under hard constraints and then **exhaustively verified**: every one of the 21³ press triples, at every token count, admits a no-win stop within the 4-slip window. The frozen service counts pin the control algorithm bit-for-bit — if any of them moves, the control's combo ordering or hit detection changed. Do not reorder DELTAS, lines, or combos.

- [ ] **Step 1: Create `app/machines/stock-rush.ts`**

```ts
import type { PachisloMachineDef } from '../engine/types'

/**
 * 4th-generation pachislo archetype with a stock system (Pachislo How-To
 * Manual, 2006). The lottery — not the reels — decides every game; drawn
 * flags queue ("stock") and are NEVER lost: control slips reels up to 4 stops
 * to land the front flag when the player's timing allows, and provably avoids
 * every win when no flag is pending. Player timing moves wins around in time;
 * the six operator odds levels move the RTP: L1 66.0012% .. L6 120.0028%,
 * every level inside the manual's published band (p.11).
 *
 * Bonuses (manual 3.1): REG = 15 tokens + 8 guaranteed 15-token JAC wins;
 * BIG = 15 + 3 rounds of 8 JAC wins with 2 increased-odds interludes between
 * rounds (each ends on a free game or 5 bells) — E[BIG] = 34595/81 = 427.1
 * tokens, ceiling 525 = the manual's "up to 35 payouts (500 tokens)".
 */
export const STOCK_RUSH: PachisloMachineDef = {
  id: 'stock-rush',
  name: 'Stock Rush',
  family: 'pachislo',
  denominationCents: 25,
  maxCoins: 3,
  symbols: {
    R7: { label: 'Red Seven' },
    BB: { label: 'Bonus Bar' },
    BE: { label: 'Bell' },
    RP: { label: 'Replay' },
    WM: { label: 'Watermelon' },
    CH: { label: 'Cherry' },
    BL: { label: 'Blank' }
  },
  strips: [
    ['CH', 'WM', 'RP', 'BE', 'WM', 'BL', 'BL', 'CH', 'RP', 'R7', 'BE', 'WM', 'BE', 'RP', 'CH', 'BL', 'RP', 'BE', 'BE', 'R7', 'RP'],
    ['BB', 'R7', 'RP', 'BB', 'RP', 'WM', 'BL', 'BE', 'RP', 'WM', 'BE', 'RP', 'BE', 'BL', 'WM', 'R7', 'R7', 'BE', 'BL', 'RP', 'BE'],
    ['RP', 'BB', 'BE', 'WM', 'BE', 'RP', 'RP', 'RP', 'BB', 'BB', 'WM', 'BE', 'BL', 'RP', 'WM', 'BB', 'BE', 'R7', 'BE', 'R7', 'R7']
  ],
  slip: 4,
  roles: {
    cherry: 'CH',
    watermelon: 'WM',
    bell: 'BE',
    replay: 'RP',
    seven: 'R7',
    bar: 'BB',
    blank: 'BL'
  },
  baseRates: { cherryPerRow: 167, watermelon: 256, replay: 2245 },
  oddsLevels: [
    { bell: 86, reg: 33, big: 46 },
    { bell: 212, reg: 36, big: 48 },
    { bell: 303, reg: 40, big: 51 },
    { bell: 371, reg: 47, big: 59 },
    { bell: 551, reg: 55, big: 66 },
    { bell: 670, reg: 66, big: 74 }
  ],
  defaultOddsLevel: 4,
  pays: { cherryPerLine: 2, watermelon: 8, bell: 15, bonusLined: 15 },
  jac: { perRound: 8, pay: 15, cost: 1 },
  bigRounds: 3,
  interlude: { bellWeight: 8, endWeight: 4, weightDenom: 16, bellPay: 15, maxBells: 5, cost: 1 },
  progressive: null,
  history: 'A Japanese parlor skill-stop machine of the stock era. You stop the reels yourself — '
    + 'but a lottery decided the game before they spun. Flagged wins slip onto the line when your '
    + 'timing allows; missed flags stock and come back; unflagged reels provably cannot pay. The '
    + 'operator key switches six odds levels straight from the service manual: 66% robbery up to a '
    + '120% loss-leader. Your fingers control WHEN — never HOW MUCH.'
}
```

- [ ] **Step 2: Write the failing control tests**

`tests/pachislo-control.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { controlStops, payingHits } from '../app/engine/pachislo'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import type { ControlTarget } from '../app/engine/pachislo'

const N = 21

describe('control avoidance — the no-win-without-a-flag guarantee', () => {
  for (const tokens of [1, 2, 3]) {
    it(`finds a win-free stop for every press triple at ${tokens} token(s)`, () => {
      for (let q1 = 0; q1 < N; q1++) {
        for (let q2 = 0; q2 < N; q2++) {
          for (let q3 = 0; q3 < N; q3++) {
            const r = controlStops(STOCK_RUSH, [q1, q2, q3], tokens, null)
            expect(r.realized).toBe(false)
            expect(payingHits(STOCK_RUSH, r.stops, tokens)).toHaveLength(0)
            for (let i = 0; i < 3; i++) {
              expect(r.slips[i]).toBeGreaterThanOrEqual(0)
              expect(r.slips[i]).toBeLessThanOrEqual(STOCK_RUSH.slip)
              expect(r.stops[i]).toBe((([q1, q2, q3][i]! + r.slips[i]!) % N))
            }
          }
        }
      }
    })
  }
})

describe('FROZEN: realization service over the full 21^3 press grid at 3 tokens', () => {
  const service = (target: ControlTarget) => {
    let ok = 0
    for (let q1 = 0; q1 < N; q1++) {
      for (let q2 = 0; q2 < N; q2++) {
        for (let q3 = 0; q3 < N; q3++) {
          const r = controlStops(STOCK_RUSH, [q1, q2, q3], 3, target)
          if (r.realized) ok++
        }
      }
    }
    return ok
  }
  // These exact counts came from the planning-time exhaustive verification.
  // A change in DELTAS ordering, hit detection, or strips moves them.
  it('bell lands from 6082/9261 press triples (65.67%)', () => {
    expect(service({ kind: 'combo', flag: 'bell' })).toBe(6082)
  })
  it('watermelon: 1780/9261 (19.22%)', () => {
    expect(service({ kind: 'combo', flag: 'watermelon' })).toBe(1780)
  })
  it('replay: 3060/9261 (33.04%)', () => {
    expect(service({ kind: 'combo', flag: 'replay' })).toBe(3060)
  })
  it('REG (7-7-bar): 1710/9261 (18.46%)', () => {
    expect(service({ kind: 'combo', flag: 'reg' })).toBe(1710)
  })
  it('BIG (7-7-7): 845/9261 (9.12%)', () => {
    expect(service({ kind: 'combo', flag: 'big' })).toBe(845)
  })
  it('cherry on each row: 6615/9261 (5/7)', () => {
    expect(service({ kind: 'cherry', row: 0 })).toBe(6615)
    expect(service({ kind: 'cherry', row: 1 })).toBe(6615)
    expect(service({ kind: 'cherry', row: 2 })).toBe(6615)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test -- pachislo-control`
Expected: FAIL — `app/engine/pachislo.ts` does not exist.

- [ ] **Step 4: Implement the control half of `app/engine/pachislo.ts`**

```ts
import type { PachisloMachineDef, SymbolId } from './types'

const N = 21

/** active line row-patterns by token count (manual 2.1) */
export const PACHISLO_LINES: number[][][] = [
  [[1, 1, 1]],
  [[1, 1, 1], [0, 0, 0], [2, 2, 2]],
  [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]]
]

/** lines crossing reel-1's cell at `row` for this token count (cherry pays) */
export function linesThroughRow(row: number, tokens: number): number {
  let n = 0
  for (const pat of PACHISLO_LINES[tokens - 1]!) {
    if (pat[0] === row) n++
  }
  return n
}

/**
 * Stop-combo search order: total slip ascending, then lexicographic. FROZEN —
 * the planning-time service counts assume exactly this order.
 */
const DELTAS: number[][] = (() => {
  const out: number[][] = []
  for (let a = 0; a <= 4; a++) {
    for (let b = 0; b <= 4; b++) {
      for (let c = 0; c <= 4; c++) out.push([a, b, c])
    }
  }
  return out.sort((x, y) =>
    (x[0]! + x[1]! + x[2]!) - (y[0]! + y[1]! + y[2]!)
    || x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!)
})()

export type ComboFlag = 'watermelon' | 'bell' | 'replay' | 'reg' | 'big'

export type ControlTarget
  = | { kind: 'combo', flag: ComboFlag }
    | { kind: 'cherry', row: number }
    | null

export type PachisloHit
  = | { kind: 'combo', flag: ComboFlag, rows: number[] }
    | { kind: 'cherry', row: number }

function comboTriple(def: PachisloMachineDef, flag: ComboFlag): [SymbolId, SymbolId, SymbolId] {
  const r = def.roles
  switch (flag) {
    case 'watermelon': return [r.watermelon, r.watermelon, r.watermelon]
    case 'bell': return [r.bell, r.bell, r.bell]
    case 'replay': return [r.replay, r.replay, r.replay]
    case 'reg': return [r.seven, r.seven, r.bar]
    case 'big': return [r.seven, r.seven, r.seven]
  }
}

const COMBO_ORDER: ComboFlag[] = ['watermelon', 'bell', 'replay', 'reg', 'big']

function cellAt(def: PachisloMachineDef, reel: number, stop: number, row: number): SymbolId {
  return def.strips[reel]![(stop + row) % N]!
}

/** Every paying combination visible on the active lines (plus paying cherries). */
export function payingHits(def: PachisloMachineDef, stops: number[], tokens: number): PachisloHit[] {
  const hits: PachisloHit[] = []
  const lines = PACHISLO_LINES[tokens - 1]!
  for (const flag of COMBO_ORDER) {
    const combo = comboTriple(def, flag)
    for (const pat of lines) {
      if (
        cellAt(def, 0, stops[0]!, pat[0]!) === combo[0]
        && cellAt(def, 1, stops[1]!, pat[1]!) === combo[1]
        && cellAt(def, 2, stops[2]!, pat[2]!) === combo[2]
      ) {
        hits.push({ kind: 'combo', flag, rows: [...pat] })
      }
    }
  }
  for (const row of [0, 1, 2]) {
    if (linesThroughRow(row, tokens) === 0) continue
    if (cellAt(def, 0, stops[0]!, row) === def.roles.cherry) {
      hits.push({ kind: 'cherry', row })
    }
  }
  return hits
}

export interface ControlResult {
  stops: number[]
  slips: number[]
  realized: boolean
}

/**
 * Deterministic skill-stop control. From the player's press positions it
 * searches stop combos in slip order (DELTAS) and picks the FIRST that
 * realizes the target with NO other paying combination; failing that, the
 * first with no paying combination at all (the flag stays stocked). The
 * planning-time exhaustive check proves a win-free combo always exists.
 */
export function controlStops(
  def: PachisloMachineDef,
  presses: number[],
  tokens: number,
  target: ControlTarget
): ControlResult {
  let fallback: ControlResult | null = null
  for (const d of DELTAS) {
    const stops = [
      (presses[0]! + d[0]!) % N,
      (presses[1]! + d[1]!) % N,
      (presses[2]! + d[2]!) % N
    ]
    const hits = payingHits(def, stops, tokens)
    if (target === null) {
      if (hits.length === 0) return { stops, slips: [...d], realized: false }
      continue
    }
    if (target.kind === 'cherry') {
      const visible = cellAt(def, 0, stops[0]!, target.row) === def.roles.cherry
      const others = hits.filter(h => !(h.kind === 'cherry' && h.row === target.row))
      if (visible && others.length === 0) return { stops, slips: [...d], realized: true }
    } else {
      const wanted = hits.some(h =>
        h.kind === 'combo' && h.flag === target.flag
        && h.rows[0] === 1 && h.rows[1] === 1 && h.rows[2] === 1)
      const others = hits.filter(h => !(
        h.kind === 'combo' && h.flag === target.flag
        && h.rows[0] === 1 && h.rows[1] === 1 && h.rows[2] === 1))
      if (wanted && others.length === 0) return { stops, slips: [...d], realized: true }
    }
    if (hits.length === 0 && fallback === null) {
      fallback = { stops, slips: [...d], realized: false }
    }
  }
  if (fallback !== null) return fallback
  throw new Error(
    `${def.id}: control found no win-free stop for presses ${presses.join(',')} — strip invariant broken`)
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- pachislo-control`
Expected: PASS — zero avoidance failures and ALL six frozen service counts exact. This suite sweeps 21³ × (3 + 8) control searches; expect roughly 5–15s.

- [ ] **Step 6: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add Stock Rush data and skill-stop control with frozen exhaustive invariants"
```

---

### Task 11: Pachislo spin flow — lottery, stock queues, bonus rounds

**Files:**
- Modify: `app/engine/pachislo.ts` (add `spinPachislo`)
- Modify: `app/engine/index.ts` (wire `case 'pachislo'`)
- Create: `tests/pachislo.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/pachislo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { spinPachislo } from '../app/engine/pachislo'
import { initMachineState, mulberry32, spin } from '../app/engine'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import type { MachineSessionState, PachisloFlag, SpinOutcome } from '../app/engine/types'
import type { RandomFn } from '../app/engine/rng'

const D = 16384

/** scripted raws first, then a seeded stream (presses etc.) */
function composite(script: number[], seed: number): RandomFn {
  const tail = mulberry32(seed)
  let i = 0
  return () => (i < script.length ? script[i++]! : tail())
}
const rawFor = (idx: number, range: number) => (idx + 0.5) / range

// level-4 lottery layout (cumulative /16384):
// cherry-top [0,167) cherry-mid [167,334) cherry-bot [334,501) wm [501,757)
// bell [757,1128) replay [1128,3373) reg [3373,3420) big [3420,3479) none [3479,...)
const LOT = {
  cherryTop: rawFor(0, D),
  wm: rawFor(600, D),
  bell: rawFor(800, D),
  replay: rawFor(2000, D),
  reg: rawFor(3400, D),
  big: rawFor(3450, D),
  none: rawFor(10000, D)
}

function freshState(): MachineSessionState {
  return initMachineState(STOCK_RUSH)
}

/** spin normal games (none-lottery after the first) until the wanted flag realizes */
function spinUntilRealized(state: MachineSessionState, firstLottery: number, flag: PachisloFlag, tokens = 3): SpinOutcome {
  let out = spinPachislo(STOCK_RUSH, state, tokens, composite([firstLottery], 1))
  let guard = 0
  for (;;) {
    const realized = out.featureEvents.find(e => e.type === 'flag-realized')
    if (realized !== undefined) {
      expect((realized as { flag: PachisloFlag }).flag).toBe(flag)
      return out
    }
    expect(out.featureEvents.some(e => e.type === 'flag-stocked')).toBe(true)
    guard++
    expect(guard).toBeLessThan(60) // P(60 misses) is astronomically small for every service rate
    out = spinPachislo(STOCK_RUSH, state, tokens, composite([LOT.none], 1000 + guard))
  }
}

describe('normal games', () => {
  it('a no-flag game never pays and consumes 3 tokens', () => {
    const state = freshState()
    const out = spinPachislo(STOCK_RUSH, state, 3, composite([LOT.none], 7))
    expect(out.gameKind).toBe('normal')
    expect(out.coinsIn).toBe(3)
    expect(out.totalPayout).toBe(0)
    expect(out.wins).toHaveLength(0)
    expect(out.featureEvents.some(e => e.type === 'flag-drawn')).toBe(false)
    expect(out.trace.presses).toHaveLength(3)
    for (const p of out.trace.presses!) {
      expect(p.slipUsed).toBeGreaterThanOrEqual(0)
      expect(p.slipUsed).toBeLessThanOrEqual(4)
      expect(p.stop).toBe((p.press + p.slipUsed) % 21)
    }
  })

  it('a bell flag pays 15 when it lands — and stocks until it does', () => {
    const state = freshState()
    const out = spinUntilRealized(state, LOT.bell, 'bell')
    expect(out.totalPayout).toBe(15)
    expect(out.wins[0]!.entryId).toBe('bell')
    expect(state.pachislo!.smallQueue).toHaveLength(0)
  })

  it('watermelon pays 8', () => {
    const state = freshState()
    const out = spinUntilRealized(state, LOT.wm, 'watermelon')
    expect(out.totalPayout).toBe(8)
  })

  it('replay grants the next game free', () => {
    const state = freshState()
    spinUntilRealized(state, LOT.replay, 'replay')
    expect(state.pachislo!.replayNext).toBe(true)
    const free = spinPachislo(STOCK_RUSH, state, 3, composite([LOT.none], 99))
    expect(free.coinsIn).toBe(0)
    expect(free.gameKind).toBe('normal')
    expect(state.pachislo!.replayNext).toBe(false)
  })

  it('cherry pays by lines through the flagged row: 4 at 3 tokens (corner), 0 at 1 token', () => {
    const corner = freshState()
    const out3 = spinUntilRealized(corner, LOT.cherryTop, 'cherry-top', 3)
    expect(out3.totalPayout).toBe(4)
    const wasted = freshState()
    const out1 = spinUntilRealized(wasted, LOT.cherryTop, 'cherry-top', 1)
    expect(out1.totalPayout).toBe(0) // flagged top-row cherry is WASTED at 1 token
  })

  it('rejects out-of-range tokens', () => {
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 0, composite([], 1))).toThrow(/out of range/)
    expect(() => spinPachislo(STOCK_RUSH, freshState(), 4, composite([], 1))).toThrow(/out of range/)
  })
})

describe('REG bonus', () => {
  it('plays 8 guaranteed JAC games at 1 token in / 15 out', () => {
    const state = freshState()
    spinUntilRealized(state, LOT.reg, 'reg')
    expect(state.pachislo!.bonus).toEqual({ type: 'reg', round: 1, jacLeft: 8, interlude: null })
    for (let i = 0; i < 8; i++) {
      const out = spinPachislo(STOCK_RUSH, state, 3, composite([], 200 + i))
      expect(out.gameKind).toBe('jac')
      expect(out.coinsIn).toBe(1)
      expect(out.totalPayout).toBe(15)
      expect(out.wins[0]!.entryId).toBe('jac')
    }
    expect(state.pachislo!.bonus).toBeNull()
  })
})

describe('BIG bonus', () => {
  it('runs 3 JAC rounds with interludes that end on a free game', () => {
    const state = freshState()
    const realization = spinUntilRealized(state, LOT.big, 'big')
    expect(realization.totalPayout).toBe(15)
    const playJacRound = (round: number) => {
      for (let i = 0; i < 8; i++) {
        const out = spinPachislo(STOCK_RUSH, state, 3, composite([], 300 + round * 10 + i))
        expect(out.gameKind).toBe('jac')
        expect(out.totalPayout).toBe(15)
      }
    }
    playJacRound(1)
    expect(state.pachislo!.bonus!.interlude).toEqual({ index: 1, bells: 0 })
    // interlude: scripted /16 draws — two bells then the ending free game
    const bellRaw = rawFor(0, 16)
    const endRaw = rawFor(10, 16)
    const noneRaw = rawFor(14, 16)
    let out = spinPachislo(STOCK_RUSH, state, 3, composite([bellRaw], 400))
    expect(out.gameKind).toBe('interlude')
    expect(out.coinsIn).toBe(1)
    expect(out.totalPayout).toBe(15)
    out = spinPachislo(STOCK_RUSH, state, 3, composite([noneRaw], 401))
    expect(out.totalPayout).toBe(0)
    out = spinPachislo(STOCK_RUSH, state, 3, composite([endRaw], 402))
    expect(out.featureEvents).toContainEqual({ type: 'interlude-ended', index: 1, bells: 1 })
    expect(state.pachislo!.bonus).toEqual({ type: 'big', round: 2, jacLeft: 8, interlude: null })
    playJacRound(2)
    // second interlude: cap at 5 bells forces the end without a free game
    for (let i = 0; i < 5; i++) {
      out = spinPachislo(STOCK_RUSH, state, 3, composite([bellRaw], 500 + i))
      expect(out.totalPayout).toBe(15)
    }
    expect(out.featureEvents).toContainEqual({ type: 'interlude-ended', index: 2, bells: 5 })
    playJacRound(3)
    expect(state.pachislo!.bonus).toBeNull()
  })
})

describe('stock conservation (seeded long run)', () => {
  it('every drawn flag is realized exactly once or still queued at the end', () => {
    const state = freshState()
    state.pachislo!.oddsLevel = 6
    const rand = mulberry32(424242)
    let drawn = 0
    let realized = 0
    for (let i = 0; i < 20_000; i++) {
      const out = spin(STOCK_RUSH, state, 3, rand)
      for (const e of out.featureEvents) {
        if (e.type === 'flag-drawn') drawn++
        if (e.type === 'flag-realized') realized++
      }
      if (out.gameKind === 'normal' && out.featureEvents.every(e => e.type !== 'flag-realized')) {
        expect(out.totalPayout).toBe(0) // no win without a realization — ever
      }
    }
    const queued = state.pachislo!.smallQueue.length + state.pachislo!.bonusQueue.length
    expect(drawn).toBe(realized + queued)
    expect(realized).toBeGreaterThan(3000) // sanity: flags actually flow at L6
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- tests/pachislo.test.ts`
Expected: FAIL — `spinPachislo` not exported.

- [ ] **Step 3: Implement `spinPachislo`** (append to `app/engine/pachislo.ts`)

```ts
import type {
  FeatureEvent, LineWin, MachineSessionState, PachisloFlag,
  PachisloSessionState, RngDraw, SpinOutcome
} from './types'
import type { RandomFn } from './rng'

const LOTTERY_DENOM = 16384

function drawLottery(
  def: PachisloMachineDef,
  level: number,
  rand: RandomFn,
  draws: RngDraw[]
): PachisloFlag | null {
  const rates = def.oddsLevels[level - 1]!
  const table: [PachisloFlag, number][] = [
    ['cherry-top', def.baseRates.cherryPerRow],
    ['cherry-mid', def.baseRates.cherryPerRow],
    ['cherry-bot', def.baseRates.cherryPerRow],
    ['watermelon', def.baseRates.watermelon],
    ['bell', rates.bell],
    ['replay', def.baseRates.replay],
    ['reg', rates.reg],
    ['big', rates.big]
  ]
  const raw = rand()
  const idx = Math.floor(raw * LOTTERY_DENOM)
  draws.push({ label: 'lottery', raw, value: idx, range: LOTTERY_DENOM })
  let acc = 0
  for (const [flag, n] of table) {
    acc += n
    if (idx < acc) return flag
  }
  return null
}

function targetFor(queue: PachisloSessionState): ControlTarget {
  const small = queue.smallQueue[0]
  if (small !== undefined) {
    if (small === 'cherry-top') return { kind: 'cherry', row: 0 }
    if (small === 'cherry-mid') return { kind: 'cherry', row: 1 }
    if (small === 'cherry-bot') return { kind: 'cherry', row: 2 }
    return { kind: 'combo', flag: small as ComboFlag }
  }
  const bonus = queue.bonusQueue[0]
  if (bonus !== undefined) return { kind: 'combo', flag: bonus }
  return null
}

function spinReels(
  def: PachisloMachineDef,
  tokens: number,
  target: ControlTarget,
  rand: RandomFn,
  draws: RngDraw[]
): { result: ControlResult, presses: NonNullable<SpinOutcome['trace']['presses']> } {
  const presses: number[] = []
  for (let r = 0; r < 3; r++) {
    const raw = rand()
    const press = Math.floor(raw * N)
    draws.push({ label: `reel${r + 1}-press`, raw, value: press, range: N })
    presses.push(press)
  }
  const result = controlStops(def, presses, tokens, target)
  const label = target === null ? null : target.kind === 'cherry' ? `cherry-row${target.row}` : target.flag
  return {
    result,
    presses: presses.map((press, reel) => ({
      reel, press, stop: result.stops[reel]!, slipUsed: result.slips[reel]!, target: label
    }))
  }
}

function gridFor(def: PachisloMachineDef, stops: number[]): SymbolId[][] {
  return def.strips.map((strip, r) =>
    [0, 1, 2].map(row => strip[(stops[r]! + row) % N]!))
}

function realizedWin(
  def: PachisloMachineDef,
  flag: PachisloFlag,
  tokens: number
): LineWin {
  if (flag === 'cherry-top' || flag === 'cherry-mid' || flag === 'cherry-bot') {
    const row = flag === 'cherry-top' ? 0 : flag === 'cherry-mid' ? 1 : 2
    return {
      line: `row-${row}`, entryId: 'cherry', symbols: [def.roles.cherry],
      payCredits: def.pays.cherryPerLine * linesThroughRow(row, tokens),
      wildCount: 0, progressive: false
    }
  }
  const pay = flag === 'watermelon'
    ? def.pays.watermelon
    : flag === 'bell'
      ? def.pays.bell
      : flag === 'replay' ? 0 : def.pays.bonusLined
  const symbols = flag === 'reg'
    ? [def.roles.seven, def.roles.seven, def.roles.bar]
    : flag === 'big'
      ? [def.roles.seven, def.roles.seven, def.roles.seven]
      : new Array<SymbolId>(3).fill(
        flag === 'watermelon' ? def.roles.watermelon : flag === 'bell' ? def.roles.bell : def.roles.replay)
  return { line: 'center', entryId: flag, symbols, payCredits: pay, wildCount: 0, progressive: false }
}

function jacGame(
  def: PachisloMachineDef,
  state: PachisloSessionState,
  rand: RandomFn
): SpinOutcome {
  const bonus = state.bonus!
  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  // reels are presentation during JAC: try to line bells, else stop clean
  const { result, presses } = spinReels(def, 1, { kind: 'combo', flag: 'bell' }, rand, draws)
  bonus.jacLeft -= 1
  const wins: LineWin[] = [{
    line: 'center', entryId: 'jac', symbols: new Array<SymbolId>(3).fill(def.roles.bell),
    payCredits: def.jac.pay, wildCount: 0, progressive: false
  }]
  if (bonus.jacLeft === 0) {
    featureEvents.push({ type: 'jac-round-complete', round: bonus.round })
    if (bonus.type === 'reg' || bonus.round === def.bigRounds) {
      featureEvents.push({ type: 'bonus-ended', bonus: bonus.type })
      state.bonus = null
    } else {
      bonus.interlude = { index: bonus.round as 1 | 2, bells: 0 }
      featureEvents.push({ type: 'interlude-started', index: bonus.round as 1 | 2 })
    }
  }
  return {
    machineId: def.id, family: 'pachislo', coins: 1, gameKind: 'jac', coinsIn: def.jac.cost,
    stops: result.stops, grid: gridFor(def, result.stops), wins,
    totalPayout: def.jac.pay, progressiveEvents: [], featureEvents,
    trace: { draws, presses }
  }
}

function interludeGame(
  def: PachisloMachineDef,
  state: PachisloSessionState,
  rand: RandomFn
): SpinOutcome {
  const bonus = state.bonus!
  const inter = bonus.interlude!
  const cfg = def.interlude
  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  const raw = rand()
  const idx = Math.floor(raw * cfg.weightDenom)
  draws.push({ label: 'interlude-lottery', raw, value: idx, range: cfg.weightDenom })
  const isBell = idx < cfg.bellWeight
  const isEnd = !isBell && idx < cfg.bellWeight + cfg.endWeight
  const wins: LineWin[] = []
  const { result, presses } = spinReels(
    def, 1, isBell ? { kind: 'combo', flag: 'bell' } : null, rand, draws)
  if (isBell) {
    inter.bells += 1
    wins.push({
      line: 'center', entryId: 'interlude-bell', symbols: new Array<SymbolId>(3).fill(def.roles.bell),
      payCredits: cfg.bellPay, wildCount: 0, progressive: false
    })
  }
  if (isEnd || inter.bells >= cfg.maxBells) {
    featureEvents.push({ type: 'interlude-ended', index: inter.index, bells: inter.bells })
    bonus.round += 1
    bonus.jacLeft = def.jac.perRound
    bonus.interlude = null
  }
  return {
    machineId: def.id, family: 'pachislo', coins: 1, gameKind: 'interlude', coinsIn: cfg.cost,
    stops: result.stops, grid: gridFor(def, result.stops), wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [], featureEvents,
    trace: { draws, presses }
  }
}

/**
 * One pachislo game. Routing: bonus interlude > JAC round > normal lottery
 * game. The lottery decides value; control decides placement; queues make
 * timing irrelevant to long-run RTP.
 */
export function spinPachislo(
  def: PachisloMachineDef,
  state: MachineSessionState,
  tokens: number,
  rand: RandomFn
): SpinOutcome {
  const ps = state.pachislo
  if (ps === null) throw new Error(`${def.id}: missing pachislo session state`)
  if (ps.bonus !== null) {
    return ps.bonus.interlude !== null ? interludeGame(def, ps, rand) : jacGame(def, ps, rand)
  }
  if (tokens < 1 || tokens > def.maxCoins) {
    throw new Error(`${def.id}: tokens ${tokens} out of range 1..${def.maxCoins}`)
  }

  const draws: RngDraw[] = []
  const featureEvents: FeatureEvent[] = []
  const coinsIn = ps.replayNext ? 0 : tokens
  ps.replayNext = false

  const flag = drawLottery(def, ps.oddsLevel, rand, draws)
  if (flag !== null) {
    featureEvents.push({ type: 'flag-drawn', flag })
    if (flag === 'reg' || flag === 'big') ps.bonusQueue.push(flag)
    else ps.smallQueue.push(flag)
  }

  const target = targetFor(ps)
  const { result, presses } = spinReels(def, tokens, target, rand, draws)
  const wins: LineWin[] = []

  if (result.realized && target !== null) {
    const realizedFlag: PachisloFlag = ps.smallQueue.length > 0
      ? ps.smallQueue.shift()!
      : ps.bonusQueue.shift()!
    featureEvents.push({ type: 'flag-realized', flag: realizedFlag })
    const win = realizedWin(def, realizedFlag, tokens)
    wins.push(win)
    if (realizedFlag === 'replay') {
      ps.replayNext = true
      featureEvents.push({ type: 'replay-granted' })
    }
    if (realizedFlag === 'reg' || realizedFlag === 'big') {
      ps.bonus = { type: realizedFlag, round: 1, jacLeft: def.jac.perRound, interlude: null }
      featureEvents.push({ type: 'bonus-started', bonus: realizedFlag })
    }
  } else if (flag !== null) {
    featureEvents.push({
      type: 'flag-stocked', flag,
      queueDepth: ps.smallQueue.length + ps.bonusQueue.length
    })
  }

  return {
    machineId: def.id, family: 'pachislo', coins: tokens, gameKind: 'normal', coinsIn,
    stops: result.stops, grid: gridFor(def, result.stops), wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [], featureEvents,
    trace: { draws, presses }
  }
}
```

Wire the facade — in `app/engine/index.ts` replace the temporary `case 'pachislo':` throw with:

```ts
    case 'pachislo':
      return spinPachislo(def, state, coins, rand)
```

(import `spinPachislo` from `./pachislo`).

Note on `flag-stocked`: it fires only when THIS game's drawn flag did not realize (either another flag was in front, or the target was unreachable). A flag drawn and realized in the same game emits `flag-drawn` + `flag-realized`. The conservation test counts exactly this.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/pachislo.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add pachislo spin flow: lottery, stock queues, replay, REG/BIG rounds with interludes"
```

---

### Task 12: Exact pachislo math + validation + floor completion

**Files:**
- Create: `app/engine/pachisloRtp.ts`
- Create: `tests/pachisloRtp.test.ts`
- Create: `tests/machines-pachislo.test.ts`
- Modify: `app/engine/exactRtp.ts` (oddsLevel option + `case 'pachislo'` dispatch)
- Modify: `app/engine/validate.ts` (pachislo rules replace the temporary throw)
- Modify: `app/machines/index.ts` (FLOOR gains STOCK_RUSH — 8 machines)
- Modify: `tests/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/pachisloRtp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { interludeMoments, pachisloBonusValues, pachisloExactRtp } from '../app/engine/pachisloRtp'
import { exactRtp } from '../app/engine/exactRtp'
import { STOCK_RUSH } from '../app/machines/stock-rush'

describe('interlude moments — frozen', () => {
  it('E[bells] = 422/243, E[bells^2] = 490/81, E[games] = 844/243', () => {
    const m = interludeMoments(STOCK_RUSH)
    expect(m.eBells).toBeCloseTo(422 / 243, 12)
    expect(m.eBells2).toBeCloseTo(490 / 81, 12)
    expect(m.eGames).toBeCloseTo(844 / 243, 12)
  })
})

describe('bonus values — frozen (manual: "up to 35 payouts (500 tokens)")', () => {
  it('REG = 135 out / 8 in; BIG = 34595/81 = 427.098765 out / 7520/243 = 30.946502 in', () => {
    const b = pachisloBonusValues(STOCK_RUSH)
    expect(b.regOut).toBe(135)
    expect(b.regIn).toBe(8)
    expect(b.bigOut).toBeCloseTo(34595 / 81, 10)
    expect(b.bigIn).toBeCloseTo(7520 / 243, 10)
    expect(b.bigMaxOut).toBe(525) // 35 payouts x 15
  })
})

describe('six operator levels at 3 tokens — frozen, all inside the manual bands', () => {
  const FROZEN = [
    { level: 1, rtp: 0.66001241, hf: 0.19329834, variance: 61.342095, band: [0.65, 0.67] },
    { level: 2, rtp: 0.72999378, hf: 0.20129395, variance: 64.317805, band: [0.72, 0.74] },
    { level: 3, rtp: 0.79983797, hf: 0.20727539, variance: 68.600733, band: [0.79, 0.81] },
    { level: 4, rtp: 0.91501312, hf: 0.21234131, variance: 79.370379, band: [0.88, 0.95] },
    { level: 5, rtp: 1.06006863, hf: 0.22424316, variance: 89.110325, band: [1.05, 1.07] },
    { level: 6, rtp: 1.20002784, hf: 0.23266602, variance: 100.340097, band: [1.15, 1.25] }
  ]
  for (const f of FROZEN) {
    it(`level ${f.level}: RTP ${(f.rtp * 100).toFixed(4)}%`, () => {
      const r = pachisloExactRtp(STOCK_RUSH, { oddsLevel: f.level })
      expect(r.rtpPerCoin).toBeCloseTo(f.rtp, 6)
      expect(r.hitFrequency).toBeCloseTo(f.hf, 6)
      expect(r.variancePerCoin).toBeCloseTo(f.variance, 4)
      expect(r.rtpPerCoin).toBeGreaterThan(f.band[0]!)
      expect(r.rtpPerCoin).toBeLessThan(f.band[1]!)
    })
  }
})

describe('token-count economics', () => {
  it('3 tokens beats 1 token (cherry rows + replay scaling) — the max-bet lesson', () => {
    const three = pachisloExactRtp(STOCK_RUSH, { oddsLevel: 4, coins: 3 })
    const one = pachisloExactRtp(STOCK_RUSH, { oddsLevel: 4, coins: 1 })
    expect(three.rtpPerCoin).toBeGreaterThan(one.rtpPerCoin)
  })
  it('breakdown sums to the RTP; replay contributes zero OUT', () => {
    const r = pachisloExactRtp(STOCK_RUSH, { oddsLevel: 4 })
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 10)
    expect(r.breakdown.find(b => b.entryId === 'replay')!.contribution).toBe(0)
  })
  it('dispatches through the exactRtp facade', () => {
    const r = exactRtp(STOCK_RUSH, { oddsLevel: 6 })
    expect(r.rtpPerCoin).toBeCloseTo(1.20002784, 6)
  })
})
```

`tests/machines-pachislo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { FLOOR } from '../app/machines'

describe('stock-rush — machine integrity', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(STOCK_RUSH)).not.toThrow()
  })
  it('strip compositions match the searched layout', () => {
    const counts = STOCK_RUSH.strips.map((strip) => {
      const c: Record<string, number> = {}
      strip.forEach((s) => {
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    expect(counts[0]).toEqual({ CH: 3, BE: 5, RP: 5, WM: 3, R7: 2, BL: 3 })
    expect(counts[1]).toEqual({ BE: 5, RP: 5, WM: 3, R7: 3, BB: 2, BL: 3 })
    expect(counts[2]).toEqual({ BE: 5, RP: 5, WM: 3, R7: 3, BB: 4, BL: 1 })
  })
  it('the floor is complete: 8 machines, all valid, ids unique', () => {
    expect(FLOOR).toHaveLength(8)
    expect(new Set(FLOOR.map(m => m.id)).size).toBe(8)
    for (const def of FLOOR) expect(() => validateMachineDef(def)).not.toThrow()
    expect(FLOOR.map(m => m.family)).toEqual([
      'video', 'video', 'video', 'stepper', 'stepper', 'bally-em', 'bally-em', 'pachislo'
    ])
  })
})
```

Append to `tests/validate.test.ts`:

```ts
describe('pachislo validation', () => {
  const base = () => JSON.parse(JSON.stringify(STOCK_RUSH)) as typeof STOCK_RUSH
  it('rejects cherries off reel 1', () => {
    const def = base()
    def.strips[1]![0] = 'CH'
    expect(() => validateMachineDef(def)).toThrow(/cherry .* reel 1/i)
  })
  it('rejects lottery rates that overflow 16384', () => {
    const def = base()
    def.oddsLevels[5]!.bell = 16000
    expect(() => validateMachineDef(def)).toThrow(/16384/)
  })
  it('rejects a missing combo symbol on a reel', () => {
    const def = base()
    def.strips[2] = def.strips[2]!.map(s => (s === 'BB' ? 'BL' : s))
    expect(() => validateMachineDef(def)).toThrow(/bar .* reel 3/i)
  })
  it('rejects wrong strip geometry', () => {
    const def = base()
    def.strips[0] = def.strips[0]!.slice(0, 20)
    expect(() => validateMachineDef(def)).toThrow(/21/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- pachisloRtp machines-pachislo`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `app/engine/pachisloRtp.ts`**

```ts
import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { PachisloMachineDef } from './types'
import { linesThroughRow } from './pachislo'

/**
 * Closed-form pachislo math (renewal-reward over lottery draws). Flags are
 * never lost, so every drawn flag contributes its full value exactly once and
 * player timing cancels out of the long-run quotient:
 *   RTP = OUT / IN
 *   OUT = sum of p_flag x flagValue        (replay's value sits in IN)
 *   IN  = tokens x (1 - p_replay) + p_reg x regIn + p_big x bigIn
 */

export interface InterludeMoments {
  eBells: number
  eBells2: number
  eGames: number
}

export function interludeMoments(def: PachisloMachineDef): InterludeMoments {
  const cfg = def.interlude
  const w = cfg.bellWeight / cfg.weightDenom
  const e = cfg.endWeight / cfg.weightDenom
  const rho = w / (w + e)
  const cap = cfg.maxBells
  let eBells = 0
  let eBells2 = 0
  let eEvents = 0
  for (let k = 0; k < cap; k++) {
    const p = rho ** k * (1 - rho)
    eBells += k * p
    eBells2 += k * k * p
    eEvents += (k + 1) * p
  }
  const pCap = rho ** cap
  eBells += cap * pCap
  eBells2 += cap * cap * pCap
  eEvents += cap * pCap
  return { eBells, eBells2, eGames: eEvents / (w + e) }
}

export interface PachisloBonusValues {
  regOut: number
  regIn: number
  bigOut: number
  bigIn: number
  /** hard ceiling: every payout at 15 tokens, both interludes capped */
  bigMaxOut: number
}

export function pachisloBonusValues(def: PachisloMachineDef): PachisloBonusValues {
  const m = interludeMoments(def)
  const jacOut = def.jac.perRound * def.jac.pay
  const jacIn = def.jac.perRound * def.jac.cost
  const interludes = def.bigRounds - 1
  return {
    regOut: def.pays.bonusLined + jacOut,
    regIn: jacIn,
    bigOut: def.pays.bonusLined + def.bigRounds * jacOut + interludes * m.eBells * def.interlude.bellPay,
    bigIn: def.bigRounds * jacIn + interludes * m.eGames * def.interlude.cost,
    bigMaxOut: def.pays.bonusLined + def.bigRounds * jacOut
      + interludes * def.interlude.maxBells * def.interlude.bellPay
  }
}

export function pachisloExactRtp(def: PachisloMachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  const tokens = opts.coins ?? def.maxCoins
  if (tokens < 1 || tokens > def.maxCoins) {
    throw new Error(`${def.id}: coins ${tokens} out of range 1..${def.maxCoins}`)
  }
  const level = opts.oddsLevel ?? def.defaultOddsLevel
  if (!Number.isInteger(level) || level < 1 || level > def.oddsLevels.length) {
    throw new Error(`${def.id}: oddsLevel ${level} out of range 1..${def.oddsLevels.length}`)
  }
  const rates = def.oddsLevels[level - 1]!
  const D = 16384
  const pChRow = def.baseRates.cherryPerRow / D
  const pCh = 3 * pChRow
  const pWm = def.baseRates.watermelon / D
  const pBell = rates.bell / D
  const pRp = def.baseRates.replay / D
  const pReg = rates.reg / D
  const pBig = rates.big / D

  // cherry value: the flag picks the row uniformly; pay = perLine x lines through it
  let eCh = 0
  let eCh2 = 0
  for (const row of [0, 1, 2]) {
    const pay = def.pays.cherryPerLine * linesThroughRow(row, tokens)
    eCh += pay / 3
    eCh2 += pay * pay / 3
  }

  const b = pachisloBonusValues(def)
  const m = interludeMoments(def)

  const OUT = pCh * eCh + pWm * def.pays.watermelon + pBell * def.pays.bell
    + pReg * b.regOut + pBig * b.bigOut
  const IN = tokens * (1 - pRp) + pReg * b.regIn + pBig * b.bigIn
  const rtpPerCoin = OUT / IN
  const hitFrequency = pCh + pWm + pBell + pRp + pReg + pBig

  // attribution variance (descriptive volatility; convergence uses block SE)
  const interludes = def.bigRounds - 1
  const sumBase = def.pays.bonusLined + def.bigRounds * def.jac.perRound * def.jac.pay
  const eS = interludes * m.eBells
  const eS2 = interludes * (m.eBells2 - m.eBells ** 2) + eS * eS
  const eBig2 = sumBase * sumBase + 2 * sumBase * def.interlude.bellPay * eS
    + def.interlude.bellPay ** 2 * eS2
  const EX2 = pCh * eCh2 + pWm * def.pays.watermelon ** 2 + pBell * def.pays.bell ** 2
    + pReg * b.regOut ** 2 + pBig * eBig2
  const variancePerCoin = (EX2 - OUT * OUT) / (tokens * tokens)

  const entry = (entryId: string, p: number, out: number): ExactRtpBreakdownEntry => ({
    entryId,
    probability: p,
    /** for pachislo: the flag's full value per renewal token (out/IN), so
     * probability x avgPayPerCoin = contribution and contributions sum to RTP */
    avgPayPerCoin: p > 0 ? out / IN : 0,
    contribution: p * out / IN
  })
  const breakdown = [
    entry('cherry', pCh, eCh),
    entry('watermelon', pWm, def.pays.watermelon),
    entry('bell', pBell, def.pays.bell),
    entry('replay', pRp, 0),
    entry('reg', pReg, b.regOut),
    entry('big', pBig, b.bigOut)
  ].sort((a, c) => c.contribution - a.contribution)

  return { rtpPerCoin, hitFrequency, variancePerCoin, breakdown }
}
```

- [ ] **Step 4: Wire dispatch + oddsLevel option**

In `app/engine/exactRtp.ts`: add to `ExactRtpOptions`:

```ts
  /** pachislo operator level 1..6 (default: def.defaultOddsLevel) */
  oddsLevel?: number
```

and replace the temporary pachislo arm with `if (def.family === 'pachislo') return pachisloExactRtp(def, opts)` (import from `./pachisloRtp`).

- [ ] **Step 5: Implement pachislo validation**

In `app/engine/validate.ts` replace the temporary `case 'pachislo':` throw with:

```ts
    case 'pachislo': {
      if (def.strips.length !== 3) errors.push(`pachislo needs 3 strips, got ${def.strips.length}`)
      def.strips.forEach((strip, r) => {
        if (strip.length !== 21) errors.push(`strips[${r}] length ${strip.length} != 21 stops`)
        strip.forEach(s => checkSymbol(s, `strips[${r}]`))
      })
      for (const [role, sym] of Object.entries(def.roles)) {
        checkSymbol(sym, `roles.${role}`)
      }
      if (def.strips[1]?.includes(def.roles.cherry) || def.strips[2]?.includes(def.roles.cherry)) {
        errors.push('cherry must only appear on reel 1 (control treats it as a left-reel win)')
      }
      const need: [number, SymbolId, string][] = [
        [0, def.roles.bell, 'bell'], [1, def.roles.bell, 'bell'], [2, def.roles.bell, 'bell'],
        [0, def.roles.watermelon, 'watermelon'], [1, def.roles.watermelon, 'watermelon'], [2, def.roles.watermelon, 'watermelon'],
        [0, def.roles.replay, 'replay'], [1, def.roles.replay, 'replay'], [2, def.roles.replay, 'replay'],
        [0, def.roles.seven, 'seven'], [1, def.roles.seven, 'seven'], [2, def.roles.seven, 'seven'],
        [2, def.roles.bar, 'bar']
      ]
      for (const [r, sym, name] of need) {
        if (!def.strips[r]?.includes(sym)) {
          errors.push(`combo symbol ${name} missing from reel ${r + 1} — its flag could never land`)
        }
      }
      if (def.slip < 0 || def.slip > 4) errors.push('slip must be 0..4 (real hardware caps at 4)')
      if (def.maxCoins !== 3) errors.push('pachislo takes 1-3 tokens (maxCoins must be 3)')
      if (def.oddsLevels.length !== 6) errors.push(`need 6 odds levels, got ${def.oddsLevels.length}`)
      if (def.defaultOddsLevel < 1 || def.defaultOddsLevel > def.oddsLevels.length) {
        errors.push('defaultOddsLevel out of range')
      }
      def.oddsLevels.forEach((lv, i) => {
        const total = 3 * def.baseRates.cherryPerRow + def.baseRates.watermelon
          + def.baseRates.replay + lv.bell + lv.reg + lv.big
        if (lv.bell < 0 || lv.reg < 0 || lv.big < 0) errors.push(`oddsLevels[${i}]: negative rate`)
        if (total > 16384) errors.push(`oddsLevels[${i}]: rates sum ${total} exceeds the 16384 lottery`)
      })
      if (def.jac.perRound < 1 || def.jac.pay < 1 || def.jac.cost < 0) errors.push('jac config must be positive')
      if (def.bigRounds < 1) errors.push('bigRounds must be >= 1')
      const il = def.interlude
      if (il.weightDenom < 1 || il.bellWeight < 0 || il.endWeight < 1
        || il.bellWeight + il.endWeight > il.weightDenom) {
        errors.push('interlude weights must satisfy 0 <= bell, 1 <= end, bell+end <= denom')
      }
      if (il.maxBells < 1) errors.push('interlude.maxBells must be >= 1')
      break
    }
```

- [ ] **Step 6: Complete the floor**

In `app/machines/index.ts` import `STOCK_RUSH` from `./stock-rush` and append it to `FLOOR` (8th entry).

- [ ] **Step 7: Run tests, full gate, commit**

Run: `pnpm test -- pachisloRtp machines-pachislo validate`
Expected: PASS — all six frozen levels exact.

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Add exact pachislo math, pachislo validation, and complete the 8-machine floor"
```

---

### Task 13: Simulator v2 — feature-aware cycles

**Files:**
- Modify: `app/engine/index.ts` (`SimOptions`, `simulateMachine`)
- Modify: `tests/simulate.test.ts`

`spins` now means **cycles**: base games (video) / normal games (pachislo); steppers and bally are unchanged because every spin is `gameKind: 'base'`. Feature spins are simulated but cost/count via `coinsIn`/`gameKind`. After the loop, in-flight features are drained so every counted cycle's payout is fully collected — for video this makes `totalIn === spins × coins` exact.

- [ ] **Step 1: Write the failing tests** (append to `tests/simulate.test.ts`; import the new machines)

```ts
describe('simulateMachine v2 — feature-aware cycles', () => {
  it('video: totalIn is exactly spins x coins (free spins cost 0; features drain)', () => {
    const sim = simulateMachine(CANAL_ROYALE, {
      spins: 50_000, coins: 25, seed: 11, progressiveMode: 'static'
    })
    expect(sim.totalIn).toBe(50_000 * 25)
    expect(sim.spins).toBe(50_000)
    expect(sim.rtp).toBeGreaterThan(0.80)
    expect(sim.rtp).toBeLessThan(1.05)
    expect(sim.byEntry['sc3'] ?? 0).toBeGreaterThan(0)
  })

  it('thunder-vault static: every Grand pays exactly the reset value', () => {
    const sim = simulateMachine(THUNDER_VAULT, {
      spins: 60_000, coins: 25, seed: 12, progressiveMode: 'static'
    })
    expect(sim.totalIn).toBe(60_000 * 25)
    // P(fill) = 1/5138 per base spin -> ~11.7 expected Grand hits; 3.5 sigma ~ 12
    expect(sim.jackpotHits).toBeGreaterThan(1)
    expect(sim.jackpotHits).toBeLessThan(25)
    expect(sim.byEntry['grand'] ?? 0).toBe(sim.jackpotHits)
  })

  it('pachislo: replays make totalIn less than 3 x games; oddsLevel moves RTP', () => {
    const l1 = simulateMachine(STOCK_RUSH, {
      spins: 50_000, coins: 3, seed: 13, progressiveMode: 'static', oddsLevel: 1
    })
    const l6 = simulateMachine(STOCK_RUSH, {
      spins: 50_000, coins: 3, seed: 13, progressiveMode: 'static', oddsLevel: 6
    })
    expect(l1.spins).toBe(50_000)
    // replay rate 2245/16384 -> totalIn ~ 3 x 50k x (1 - 0.137) plus ~1/game bonus tokens
    expect(l1.totalIn).toBeLessThan(3 * 50_000)
    expect(l1.totalIn).toBeGreaterThan(2.3 * 50_000)
    expect(l6.rtp).toBeGreaterThan(l1.rtp + 0.3) // 120.0% vs 66.0% exact gap, huge margin
  })

  it('pachislo bonus accounting: jac wins = 8 x REG + 24 x BIG, exactly (drain closes bonuses)', () => {
    const sim = simulateMachine(STOCK_RUSH, {
      spins: 200_000, coins: 3, seed: 14, progressiveMode: 'static', oddsLevel: 6
    })
    const reg = sim.byEntry['reg'] ?? 0
    const big = sim.byEntry['big'] ?? 0
    expect(reg).toBeGreaterThan(0)
    expect(big).toBeGreaterThan(0)
    expect(sim.byEntry['jac'] ?? 0).toBe(8 * reg + 24 * big)
    // interludes: at most 10 bells per BIG (2 x cap 5)
    expect(sim.byEntry['interlude-bell'] ?? 0).toBeLessThanOrEqual(10 * big)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- simulate`
Expected: FAIL — `oddsLevel` not a SimOption; video features never drain; cycle counting missing.

- [ ] **Step 3: Implement `simulateMachine` v2**

Replace `SimOptions` and `simulateMachine` in `app/engine/index.ts`:

```ts
export interface SimOptions {
  /**
   * Number of CYCLES: base games (video) / normal games (pachislo) / spins
   * (stepper, bally-em). Free spins, respins, JAC and interlude games are
   * simulated and accounted but do not count toward `spins`.
   */
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
  /** pachislo operator level 1..6 (default: def.defaultOddsLevel) */
  oddsLevel?: number
}

export function simulateMachine(def: MachineDef, opts: SimOptions): SimResult {
  const rand = mulberry32(opts.seed)
  const state = initMachineState(def)
  if (def.family === 'pachislo' && opts.oddsLevel !== undefined && state.pachislo !== null) {
    state.pachislo.oddsLevel = opts.oddsLevel
  }
  let totalIn = 0
  let totalOut = 0
  let hits = 0
  let jackpotHits = 0
  let cycles = 0
  let net = 0
  let peak = 0
  let maxDrawdown = 0
  const byEntry: Record<string, number> = {}

  const playOne = (): void => {
    // FO-5140 semantics: stepper/bally meters feed per intended coin BEFORE
    // the spin (Plan 1 behavior, preserved bit-for-bit). Video's Grand feeds
    // AFTER the spin by actual coinsIn — feature spins cost 0 and feed nothing.
    if (
      opts.progressiveMode === 'live' && def.progressive !== null && state.progressive !== null
      && (def.family === 'stepper' || def.family === 'bally-em')
    ) {
      for (let c = 0; c < opts.coins; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    const out = spin(def, state, opts.coins, rand)
    if (
      opts.progressiveMode === 'live' && def.family === 'video'
      && def.progressive !== null && state.progressive !== null
    ) {
      for (let c = 0; c < out.coinsIn; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    totalIn += out.coinsIn
    totalOut += out.totalPayout
    jackpotHits += out.progressiveEvents.length
    for (const w of out.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
    net += out.totalPayout - out.coinsIn
    if (net > peak) peak = net
    if (peak - net > maxDrawdown) maxDrawdown = peak - net
    if (out.gameKind === 'base' || out.gameKind === 'normal') {
      cycles++
      const eventHit = out.featureEvents.some(e =>
        e.type === 'flag-realized' || e.type === 'free-spins-triggered' || e.type === 'orbs-locked')
      if (out.totalPayout > 0 || eventHit) hits++
    }
  }

  while (cycles < opts.spins) playOne()
  // Drain in-flight features so every counted cycle's payout is collected.
  // (Queued pachislo small flags stay pending — a few tokens of tail value,
  // statistically invisible at convergence scales.)
  while (
    state.videoFeature !== null
    || (state.pachislo !== null && state.pachislo.bonus !== null)
  ) {
    playOne()
  }

  return {
    machineId: def.id,
    spins: opts.spins,
    coins: opts.coins,
    totalIn,
    totalOut,
    rtp: totalOut / totalIn,
    hitFrequency: hits / opts.spins,
    jackpotHits,
    maxDrawdown,
    byEntry
  }
}
```

(The drain loop can never count a cycle: while a video feature or pachislo bonus is active, `spin()` returns `free-spin`/`respin`/`jac`/`interlude` game kinds only.)

- [ ] **Step 4: Run tests**

Run: `pnpm test -- simulate`
Expected: PASS (existing stepper/bally expectations untouched: their spins are all cycles and `coinsIn === coins`).

- [ ] **Step 5: Lint + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Teach simulateMachine feature-aware cycles with drain and pachislo odds levels"
```

---

### Task 14: Convergence — the floor's statistical verdict

**Files:**
- Modify: `tests/convergence.test.ts`

- [ ] **Step 1: Add the video cases to the existing CASES array**

The Plan-1 SE machinery applies UNCHANGED to video machines: `variancePerCoin` is the full-cycle variance and `spins` counts base games, so SE = √(variancePerCoin/spins) — the whole cycle is one renewal sample. Append (imports at top):

```ts
  { def: CANAL_ROYALE, coins: 25, spins: 2_000_000, seed: 1006 },
  { def: DRAGONS_HOARD, coins: 25, spins: 2_000_000, seed: 1007 },
  { def: THUNDER_VAULT, coins: 25, spins: 2_000_000, seed: 1008 }
```

- [ ] **Step 2: Add the pachislo block-SE suite** (append to the file)

```ts
describe('pachislo convergence — block-empirical SE (attribution variance is not an i.i.d. SE)', () => {
  for (const level of [1, 4, 6]) {
    it(`stock-rush L${level}: 100 blocks x 10k games inside 3.5 sigma`, () => {
      const exact = exactRtp(STOCK_RUSH, { oddsLevel: level })
      const blocks = 100
      const per = 10_000
      const rtps: number[] = []
      const hfs: number[] = []
      let inSum = 0
      let outSum = 0
      for (let b = 0; b < blocks; b++) {
        const sim = simulateMachine(STOCK_RUSH, {
          spins: per, coins: 3, seed: 50_000 + level * 1000 + b,
          progressiveMode: 'static', oddsLevel: level
        })
        rtps.push(sim.rtp)
        hfs.push(sim.hitFrequency)
        inSum += sim.totalIn
        outSum += sim.totalOut
      }
      const overall = outSum / inSum
      const mean = rtps.reduce((a, x) => a + x, 0) / blocks
      const sd = Math.sqrt(rtps.reduce((a, x) => a + (x - mean) ** 2, 0) / (blocks - 1))
      const se = sd / Math.sqrt(blocks)
      expect(Math.abs(overall - exact.rtpPerCoin)).toBeLessThan(3.5 * se)
      const meanHf = hfs.reduce((a, x) => a + x, 0) / blocks
      const hfSe = Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / (blocks * per))
      expect(Math.abs(meanHf - exact.hitFrequency)).toBeLessThan(3.5 * hfSe)
    })
  }
})
```

- [ ] **Step 3: Run the convergence suite**

Run: `pnpm test -- convergence`
Expected: PASS, every machine inside its 3.5σ band. This is the moment the whole plan argues for: simulation and closed-form/joint math meeting across all eight machines' independent implementations. Expect ~1.5–3 minutes.

- [ ] **Step 4: Full gate + commit**

```bash
pnpm exec eslint . --fix && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "Extend convergence suite: video cycle SE cases and pachislo block-SE at three odds levels"
```

---

### Task 15: verify-floor v2, docs, version, tag

**Files:**
- Modify: `scripts/verify-floor.ts`
- Modify: `README.md`, `CHANGELOG.md`, `package.json`

- [ ] **Step 1: Rework `scripts/verify-floor.ts` for the 8-machine floor**

Replace the per-machine loop body with family-aware coin selection and a pachislo block-SE path (keep the Task-2 `arg` guard):

```ts
function coinsFor(def: MachineDef): number {
  switch (def.family) {
    case 'stepper': return def.maxCoins
    case 'bally-em': return def.payMode === 'lines' ? 1 : def.maxCoins
    case 'video': return def.maxCoins
    case 'pachislo': return def.maxCoins
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled family ${(exhaustive as MachineDef).family}`)
    }
  }
}

let allPass = true

FLOOR.forEach((def, i) => {
  validateMachineDef(def)
  const coins = coinsFor(def)
  const exact = exactRtp(def, { coins })
  let rtp: number
  let hf: number
  let jackpots: number
  let se: number
  if (def.family === 'pachislo') {
    // attribution variance is not an i.i.d. SE — use 10 independent sub-runs
    const blocks = 10
    const per = Math.max(1, Math.floor(spins / blocks))
    const rtps: number[] = []
    let inSum = 0
    let outSum = 0
    let hfSum = 0
    jackpots = 0
    for (let b = 0; b < blocks; b++) {
      const sim = simulateMachine(def, {
        spins: per, coins, seed: seed + i * 1000 + b, progressiveMode: 'static'
      })
      rtps.push(sim.rtp)
      inSum += sim.totalIn
      outSum += sim.totalOut
      hfSum += sim.hitFrequency
      jackpots += sim.jackpotHits
    }
    rtp = outSum / inSum
    hf = hfSum / blocks
    const mean = rtps.reduce((a, x) => a + x, 0) / blocks
    const sd = Math.sqrt(rtps.reduce((a, x) => a + (x - mean) ** 2, 0) / (blocks - 1))
    se = sd / Math.sqrt(blocks)
  } else {
    const sim = simulateMachine(def, { spins, coins, seed: seed + i, progressiveMode: 'static' })
    rtp = sim.rtp
    hf = sim.hitFrequency
    jackpots = sim.jackpotHits
    // SE divisor is cycles: within-spin coins are perfectly correlated on
    // coins-linear machines, and video variancePerCoin is full-cycle variance
    se = Math.sqrt(exact.variancePerCoin / spins)
  }
  const delta = Math.abs(rtp - exact.rtpPerCoin)
  const pass = delta < 3.5 * se
  allPass &&= pass
  console.log(
    `${def.id.padEnd(22)}${String(coins).padStart(3)}   ${pct(exact.rtpPerCoin)}  ${pct(rtp)}  ${pct(delta)}  ${pct(exact.hitFrequency)}  ${pct(hf)}  ${String(jackpots).padStart(8)}  ${pass ? 'PASS' : 'FAIL'}`
  )
})

console.log('\njackpots = progressive METER hits only (Bally dual/single, Thunder Vault Grand).')
console.log('Pachislo REG/BIG are bonus flags, not progressives; stock-rush reports at its default')
console.log(`odds level (4) with a block-empirical sigma. Spins are CYCLES: base/normal games.`)
console.log(allPass
  ? '\nPASS: every machine is inside its 3.5-sigma statistical band.'
  : '\nFAIL: at least one machine fell outside its band — engine bug or band misconfiguration.')
process.exit(allPass ? 0 : 1)
```

- [ ] **Step 2: Run the full floor verification**

Run: `pnpm verify -- --spins 1000000`
Expected: 8 rows, every row PASS, exit code 0. Then run the real thing once: `pnpm verify` (5M cycles/machine; expect several minutes) — paste its table into the README in the next step.

- [ ] **Step 3: Update README.md**

Update "The floor (so far)" to "The floor" listing all 8 machines with their **computed** exact RTPs (from the verify table you just ran): canal-royale 92.4559%, dragons-hoard 93.9950%, thunder-vault 90.2948% @ Grand reset, diamond-doubler 94.7442%, sevens-ablaze 94.4881% @ reset, series-e-3line 89.0351%/line, series-e-multiplier 89.1264% @ 3 coins, stock-rush 66.0012–120.0028% by operator level (L4 default 91.5013%). Add two short family sections mirroring the existing ones:

- **Video (lines / ways / hold-and-spin):** 24-cell strips so the full 24⁵ cycle is exactly enumerable; line and ways evaluation anchored on reel 1; free-spin EV via Wald/branching identities; hold-and-spin via an absorbing Markov chain; Thunder Vault's Grand is a percentage-fed progressive.
- **Pachislo (skill-stop):** the lottery decides, the reels obey: flags stock and are never lost, control slips ≤ 4 stops, and an exhaustive 21³ check proves no win can land without a flag — so your timing changes *when*, never *how much*. Six operator odds levels straight from the manual's bands (65–67% up to 115–125%).

Update the verification section: `pnpm verify` now covers 8 machines and prints the jackpot footnote; convergence tests include video cycle-SE cases and pachislo block-SE at levels 1/4/6.

- [ ] **Step 4: Update CHANGELOG.md and package.json**

`package.json`: `"version": "0.2.0"`.

CHANGELOG (prepend under `## [Unreleased]`, Keep-a-Changelog style):

```markdown
## [0.2.0] - 2026-06-12

### Added
- Video family: anchored line evaluation (25-line geometry), 243-ways evaluation,
  scatter pays, free spins (multipliers + retriggers), hold-and-spin with orb
  values and a percentage-fed Grand progressive.
- Pachislo family: /16384 flag lottery, stock queues that never lose a flag,
  deterministic skill-stop control (slip ≤ 4) exhaustively verified win-free
  without a flag, REG/BIG bonus rounds with increased-odds interludes, six
  operator odds levels.
- Machines: Canal Royale (92.4559%), Dragon's Hoard (93.9950%), Thunder Vault
  (90.2948% @ Grand reset), Stock Rush (66.0012%–120.0028% by level) — floor
  complete at 8.
- Exact math: full 24⁵ video cycle enumeration with analytic feature moments
  (Wald, branching second moments, absorbing Markov chain); pachislo renewal
  closed form; all frozen values reproduced from the plan calibration.
- `SpinOutcome.gameKind`/`coinsIn`/`featureEvents`; simulator v2 counts cycles,
  drains in-flight features, and takes a pachislo `oddsLevel`.

### Changed
- Family dispatch uses exhaustive switches with never-checks.
- `SimResult.hitRate` renamed to `hitFrequency`.
- Vitest engine suites run in the node environment.
- `verify-floor`: 8 machines, NaN-guarded args, pachislo block-empirical sigma,
  jackpot-column footnote.

### Fixed
- `exactRtp` rejects out-of-range coin levels.
```

- [ ] **Step 5: Close out the milestone**

Run the complete gate one last time:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm verify
```

Expected: every stage green, 8/8 PASS. Review `git log --oneline` — the narrative should read: backlog refactor → hardening → types → video awards → base game → free spins → hold-and-spin → video math → video machines → stock-rush control → pachislo flow → pachislo math/floor → simulator v2 → convergence → docs/release.

```bash
git add -A
git commit -m "Release 0.2.0: video + pachislo families complete the 8-machine floor"
git tag -a v0.2.0 -m "Video + pachislo families: 8-machine floor, exact math, full convergence"
```

Report completion including the `pnpm verify` table, and stop. Plan 3 (UI) is a separate plan document.

---

## Self-review checklist (run after writing, before execution)

- **Spec coverage for Plan-2 scope:** video lines/ways/free-spins/hold-and-spin ✓ (Tasks 4–9); pachislo flag/slip/stock with six odds levels in-band ✓ (Tasks 10–12); machines 1–3 and 8 of the spec floor ✓; computed-never-asserted RTP ✓ (every displayed figure traces to `exactRtp`); rngTrace extended with presses/control ✓; spec's "flag stays stocked, timing never changes RTP" is now a THEOREM of the implementation (queue conservation + exhaustively-verified avoidance), not an aspiration.
- **Frozen numbers internally consistent:** Canal 628217093/679477248 = 0.92455942 ✓; scatter trigger 29/4096 on both video scatter machines (c=1 on 4 reels at 3/24: C(4,3)(1/8)³(7/8)+(1/8)⁴ = 29/4096) ✓; DH 94747/100800 = 0.93995040 ✓ with E[T] = 8/(1−8·29/4096) = 4096/483 ✓; TV trigger 449/55296 ✓ from orb clusters (2,3,2,3,2); P(LI×5/line) = (2·4·4·4·2)/24⁵ = 1/31104 ✓; pachislo L1–L6 all inside manual bands ✓; E[BIG] = 375 + 30·422/243 = 34595/81 ✓; BIG ceiling 35 payouts = 525 tokens ✓ manual §3.1.
- **Type-name consistency across tasks:** `spinVideo`, `spinPachislo`, `videoExactRtp`, `pachisloExactRtp`, `controlStops`, `payingHits`, `linesThroughRow`, `interludeMoments`, `pachisloBonusValues`, `hnsFinalDist`, `evalLine`, `evalWays`, `scatterVisibleCount`, `orbCells`, `LINES25`, `GameKind`, `FeatureEvent`, `VideoFeatureState`, `PachisloSessionState`, `SimOptions.oddsLevel`, `SimResult.hitFrequency` — single spellings, used identically in Tasks 3–15.
- **Plan-1 backlog:** all nine items dispositioned (seven implemented in Tasks 1–2/15, breakage + worker params explicitly deferred with rationale).
- **Execution risk notes for the implementer:** (1) the frozen service counts in Task 10 are the most brittle-looking and most load-bearing tests — they pin DELTAS ordering and hit-detection semantics; if one fails, diff your control logic against the plan, do not touch the number. (2) `videoRtp`'s joint pass is the slowest unit in the suite; it is cached per (machine, coins, meter) — do not call it inside per-spin loops. (3) When a convergence case fails by a hair at a fixed seed, the bug is real somewhere upstream — Plan 1's experience was that every "statistical fluke" was a semantics divergence.

## Execution-time corrections (recorded at v0.2.0 close-out)

1. **Task 3:** `HoldAndSpinConfig.emptySymbol` pre-wired from Task 4's text; inline `MachineSessionState` literals in Plan-1 tests replaced with `initMachineState()`; `GameKind`/`HoldAndSpin` JSDoc wording fixes.
2. **Task 5:** hold-and-spin arming chained as `else-if` after free-spins arming (co-arming overwrite guard); a dead variable in one plan test dropped.
3. **Task 7:** the plan's `HNS_DEF` test fixture gained 5 line patterns (`lines.length === maxCoins` invariant); respin end condition hardened to `<= 0`; composite miss-out test + RNG draw-count assertions added pre-Task-8.
4. **Task 8:** the retrigger second-moment formulas were generalized to carry the free-spin multiplier (the plan's formulas silently dropped it; algebraically identical at multiplier 1, so all frozen values stand); supercriticality guard (`n·q >= 1` throws); integer guards on pays/coins.
5. **Task 9:** video validator additionally enforces `wild ≠ scatter` and the explicit `{3,4,5}` pay-length set.
6. **Task 11:** `flag-stocked` fires whenever a queued target fails to realize (the plan's code emitted it only for freshly-drawn flags, contradicting the plan's own tests; the tests' semantics won).
7. **Task 12:** validator pins `slip === 4` and `bigRounds === 3`; **pachislo v0.2 requires the full 3-token bet** — the plan's "3 tokens beats 1" economics test was wrong (fixed-value bonuses make 1-token per-coin RTP ≈ 247%); real stock-era machines gate bonuses by full bet, so v0.2 models that; the spec's 1-2-token line table is deferred to UI lamp behavior.
8. **Task 13:** `SimOptions.oddsLevel` bounds guard; family-caveat JSDoc on `ExactRtpReport` fields.
9. **Task 8 (recorded late):** the planned "dual-path agreement asserted to 1e-12 in a test" shipped instead as an always-on runtime cross-check inside `videoExactRtp` at 1e-9 relative — a stronger mechanism (every call self-checks, so every frozen test exercises it) with a looser epsilon appropriate to float sums over 7.96M cycle terms.
