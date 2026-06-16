# Lucky 21 — Blackjack Bonus + reel escalation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A true 2-card natural ends the Lucky 21 hand with a guaranteed payout and an optional double-or-nothing on a spinning chromed reel (STOP it for ×2 or BUST, CASH OUT to keep it; capped at 3 doubles); plus a reel rebalance — reel 3 friendlier, reels 4–5 escalating danger and bonuses, all BUSTs scattered — recalibrated to ~90% RTP.

**Architecture:** Reuse the `blackjack-reel` family in place. The bonus is a new `'gamble'` session phase entered from `stopReel` when reel 2 forms a natural; two new step fns (`gambleStop`, `gambleCashOut`) resolve it. The gamble is a fair 50/50, so it is **RTP-neutral** and stays out of the exact DP — the DP simply treats a natural as a terminal node valued at the guaranteed `naturalPay` (and the simulation collects it). Reel compositions + `naturalPay` are recalibrated to ~90% via the existing `blackjackReelExactRtp` DP.

**Tech Stack:** Nuxt 4 + Vue 3 `<script setup>` + Pinia (options store) + TypeScript + Vitest (happy-dom). Exact-RTP DP in `app/engine/blackjackReelRtp.ts`. `@stylistic` ESLint (one statement/line, no trailing commas in params/objects).

**Spec:** `docs/superpowers/specs/2026-06-16-lucky-21-blackjack-bonus.md`
**Locked visual mockup:** `.superpowers/brainstorm/7354-1781626731/content/bonus-reel-spin.html`

**Conventions for every commit in this plan:**
- No `Co-Authored-By` / AI-attribution trailer.
- Commit timestamps OUTSIDE Mon–Fri 7am–7pm (off-hours/weekends). Use
  `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE`, e.g.
  `GIT_AUTHOR_DATE="2026-06-16T06:30:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:30:00-0500" git commit ...`
- Do NOT push; the owner pushes when ready.
- Per-task gate before committing: `pnpm lint` (0 errors) + `pnpm typecheck` + the task's tests.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `app/engine/types.ts` | session-state + event types | add `'gamble'` phase, `gambleAmount`, `gambleCount`; two `FeatureEvent` members |
| `app/engine/blackjackReel.ts` | eval + step fns + payout | natural→`'gamble'` in `stopReel`; new `gambleStop`, `gambleCashOut`; `freshBlackjackState` defaults |
| `app/engine/blackjackReelRtp.ts` | exact optimal-stopping DP | a natural is terminal (no continue) |
| `app/engine/index.ts` | simulation driver | sim collects the guaranteed on a natural (`'gamble'` → cash) |
| `app/engine/validate.ts` | machine-def validation | allow reel-4 `MX5`; (no structural change to gamble — it's session state) |
| `app/machines/lucky-21.ts` | the machine def | recalibrated interleaved reels + `naturalPay` + header + frozen figures |
| `tests/machines-blackjack.test.ts` | frozen-figure + behaviour tests | new figures + bonus/gamble unit tests |
| `app/stores/slots.ts` | Pinia actions + restore | `gambleStop()`, `gambleCashOut()`; restore the `'gamble'` phase |
| `app/composables/useBlackjackReel.ts` | view-model | gamble state, actions, fair-EV for X-ray |
| `app/components/game/ReelBlackjackReel.vue` | cabinet UI | center-overlay spinning bonus reel + STOP/CASH OUT + ladder + BLACKJACK banner |
| `app/components/game/XrayPanel.vue` | learning surface | show the gamble's fair EV during `'gamble'` |
| `package.json`, `CHANGELOG.md`, `README.md` | docs/version | bump to 0.9.0, document the feature |

**Naming locked across tasks** (use exactly): phase `'gamble'`; fields `gambleAmount` (credits), `gambleCount` (0–3); constant `GAMBLE_CAP = 3`; step fns `gambleStop(def, state, rand)` and `gambleCashOut(def, state)`; store actions `gambleStop()` / `gambleCashOut()`; composable `gambleAmount`, `gambleCount`, `canGambleStop`, `gambleStop()`, `gambleCashOut()`, `gambleEv`; FeatureEvents `{ type: 'blackjack-bonus', amount }` and `{ type: 'gamble', outcome: 'double' | 'bust' | 'collect', amount, count }`.

---

## Task 1: Session state + event types

**Files:**
- Modify: `app/engine/types.ts`
- Modify: `app/engine/blackjackReel.ts` (`freshBlackjackState`)
- Test: `tests/machines-blackjack.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/machines-blackjack.test.ts`:

```ts
import { freshBlackjackState } from '../app/engine/blackjackReel'

describe('blackjack bonus — fresh state', () => {
  it('defaults the gamble fields', () => {
    const s = freshBlackjackState()
    expect(s.phase).toBe('idle')
    expect(s.gambleAmount).toBe(0)
    expect(s.gambleCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "fresh state"`
Expected: FAIL (`gambleAmount` is not a property / type error).

- [ ] **Step 3: Extend the types**

In `app/engine/types.ts`, in `BlackjackReelSessionState`:
- change `phase: 'idle' | 'spinning' | 'resolved'` to `phase: 'idle' | 'spinning' | 'resolved' | 'gamble'`
- add after `ante`:

```ts
  /** Blackjack-bonus double-or-nothing: credits currently on the line. */
  gambleAmount: number
  /** Doubles taken so far (0..GAMBLE_CAP). */
  gambleCount: number
```

In the `FeatureEvent` union, add:

```ts
  | { type: 'blackjack-bonus', amount: number }
  | { type: 'gamble', outcome: 'double' | 'bust' | 'collect', amount: number, count: number }
```

- [ ] **Step 4: Default the new fields**

In `app/engine/blackjackReel.ts`, in `freshBlackjackState()`, add `gambleAmount: 0` and `gambleCount: 0` to the returned object (keep `phase: 'idle'`).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "fresh state"`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add app/engine/types.ts app/engine/blackjackReel.ts tests/machines-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:30:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:30:00-0500" \
  git commit -m "feat(lucky-21): add 'gamble' phase + gamble state fields"
```

---

## Task 2: A natural triggers the bonus (`stopReel` → `'gamble'`)

**Files:**
- Modify: `app/engine/blackjackReel.ts` (`stopReel`, add `GAMBLE_CAP`)
- Test: `tests/machines-blackjack.test.ts`

Context: today `stopReel` sets `bj.natural = true` when reel index 1 lands a 21 and then lets the hand continue. New rule: a natural ends the spinning and enters `'gamble'` with the guaranteed payout on the line.

- [ ] **Step 1: Write the failing test**

```ts
import { dealReels, stopReel } from '../app/engine/blackjackReel'
import { LUCKY_21 } from '../app/machines/lucky-21'

// Deterministic RNG helper: returns the given sequence then 0s.
function seq(values: number[]) {
  let i = 0
  return () => (i < values.length ? values[i++]! : 0)
}

describe('blackjack bonus — natural enters gamble', () => {
  it('a 2-card 21 ends spinning and opens the gamble at naturalPay x ante', () => {
    const state: any = { blackjackReel: null }
    // Force reel strips so reel 1 -> Ace, reel 2 -> a ten-value card.
    dealReels(LUCKY_21, state, 1, seq([0]))
    const bj = state.blackjackReel
    bj.reelStrips[0] = ['AS']
    bj.reelStrips[1] = ['TH']
    stopReel(LUCKY_21, state, seq([0])) // lock reel 1 -> AS
    stopReel(LUCKY_21, state, seq([0])) // lock reel 2 -> TH => natural 21
    expect(bj.natural).toBe(true)
    expect(bj.phase).toBe('gamble')
    expect(bj.gambleAmount).toBe(LUCKY_21.naturalPay * 1) // ante = 1
    expect(bj.gambleCount).toBe(0)
    expect(bj.landed.slice(0, 2)).toEqual(['AS', 'TH'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "enters gamble"`
Expected: FAIL (`phase` is `'spinning'`, not `'gamble'`).

- [ ] **Step 3: Implement the natural→gamble branch**

In `app/engine/blackjackReel.ts`, add near the top (after imports): `const GAMBLE_CAP = 3`.
In `stopReel`, replace the existing natural line:

```ts
  // Natural: 2-card 21
  if (r === 1 && bt.total === 21) bj.natural = true // second reel = 2-card 21 → natural
```

with:

```ts
  // Natural: a 2-card 21 ENDS the hand and opens the double-or-nothing bonus.
  if (r === 1 && bt.total === 21) {
    bj.natural = true
    bj.phase = 'gamble'
    bj.gambleAmount = handPayout(def, bj) // base = naturalPay, multSum 0, charlie false → naturalPay × ante
    bj.gambleCount = 0
    return outcome(def, bj, bj.ante, 0, [{ type: 'blackjack-bonus', amount: bj.gambleAmount }])
  }
```

(The existing Charlie check below it stays — a natural returns before it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "enters gamble"`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add app/engine/blackjackReel.ts tests/machines-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:31:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:31:00-0500" \
  git commit -m "feat(lucky-21): a natural ends the hand and opens the bonus gamble"
```

---

## Task 3: `gambleStop` / `gambleCashOut` step functions

**Files:**
- Modify: `app/engine/blackjackReel.ts`
- Test: `tests/machines-blackjack.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { gambleStop, gambleCashOut } from '../app/engine/blackjackReel'

function naturalState() {
  const state: any = { blackjackReel: null }
  dealReels(LUCKY_21, state, 1, seq([0]))
  const bj = state.blackjackReel
  bj.reelStrips[0] = ['AS']; bj.reelStrips[1] = ['TH']
  stopReel(LUCKY_21, state, seq([0]))
  stopReel(LUCKY_21, state, seq([0])) // now phase 'gamble', gambleAmount = naturalPay
  return state
}

describe('blackjack bonus — gamble resolution', () => {
  it('cash out keeps the guaranteed amount and resolves', () => {
    const state = naturalState()
    const out = gambleCashOut(LUCKY_21, state)
    expect(state.blackjackReel.phase).toBe('resolved')
    expect(out.totalPayout).toBe(LUCKY_21.naturalPay)
  })

  it('STOP win doubles and keeps spinning until the cap', () => {
    const state = naturalState()
    const base = LUCKY_21.naturalPay
    gambleStop(LUCKY_21, state, seq([0.0])) // rand<0.5 => win (double)
    expect(state.blackjackReel.phase).toBe('gamble')
    expect(state.blackjackReel.gambleAmount).toBe(base * 2)
    expect(state.blackjackReel.gambleCount).toBe(1)
  })

  it('STOP win at the cap (3 doubles) auto-resolves paying base x 8', () => {
    const state = naturalState()
    const base = LUCKY_21.naturalPay
    gambleStop(LUCKY_21, state, seq([0.0]))
    gambleStop(LUCKY_21, state, seq([0.0]))
    const out = gambleStop(LUCKY_21, state, seq([0.0]))
    expect(state.blackjackReel.gambleCount).toBe(3)
    expect(state.blackjackReel.phase).toBe('resolved')
    expect(out.totalPayout).toBe(base * 8)
  })

  it('STOP loss zeroes the amount and resolves', () => {
    const state = naturalState()
    const out = gambleStop(LUCKY_21, state, seq([0.9])) // rand>=0.5 => bust
    expect(state.blackjackReel.phase).toBe('resolved')
    expect(state.blackjackReel.gambleAmount).toBe(0)
    expect(out.totalPayout).toBe(0)
  })

  it('payout stays a whole number of credits across antes and rungs', () => {
    for (const ante of [1, 3, 5]) {
      const state: any = { blackjackReel: null }
      dealReels(LUCKY_21, state, ante, seq([0]))
      const bj = state.blackjackReel
      bj.reelStrips[0] = ['AS']; bj.reelStrips[1] = ['TH']
      stopReel(LUCKY_21, state, seq([0])); stopReel(LUCKY_21, state, seq([0]))
      gambleStop(LUCKY_21, state, seq([0.0]))
      const out = gambleCashOut(LUCKY_21, state)
      expect(Number.isInteger(out.totalPayout)).toBe(true)
      expect(out.totalPayout).toBe(LUCKY_21.naturalPay * ante * 2)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "gamble resolution"`
Expected: FAIL (`gambleStop`/`gambleCashOut` not exported).

- [ ] **Step 3: Implement the step functions**

In `app/engine/blackjackReel.ts`, add after `cashOut`:

```ts
/**
 * Blackjack-bonus: STOP the spinning double-or-nothing reel — an honest 50/50.
 * Win (rand < 0.5) doubles the amount and increments the rung; at GAMBLE_CAP it
 * auto-resolves. Lose zeroes the amount and resolves. RTP-neutral by construction.
 */
export function gambleStop(
  def: BlackjackReelMachineDef,
  state: MachineSessionState,
  rand: RandomFn
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: gambleStop with no hand`)
  if (bj.phase !== 'gamble') throw new Error(`${def.id}: gambleStop in phase ${bj.phase}`)
  if (bj.gambleCount >= GAMBLE_CAP) throw new Error(`${def.id}: gambleStop past the cap`)
  const won = rand() < 0.5
  if (!won) {
    bj.gambleAmount = 0
    bj.phase = 'resolved'
    return outcome(def, bj, bj.ante, 0, [{ type: 'gamble', outcome: 'bust', amount: 0, count: bj.gambleCount }], 0)
  }
  bj.gambleAmount *= 2
  bj.gambleCount += 1
  const capped = bj.gambleCount >= GAMBLE_CAP
  if (capped) bj.phase = 'resolved'
  return outcome(
    def, bj, bj.ante, 0,
    [{ type: 'gamble', outcome: 'double', amount: bj.gambleAmount, count: bj.gambleCount }],
    capped ? bj.gambleAmount : 0
  )
}

/** Blackjack-bonus: keep the guaranteed amount without spinning. Resolves. */
export function gambleCashOut(
  def: BlackjackReelMachineDef,
  state: MachineSessionState
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: gambleCashOut with no hand`)
  if (bj.phase !== 'gamble') throw new Error(`${def.id}: gambleCashOut in phase ${bj.phase}`)
  bj.phase = 'resolved'
  return outcome(def, bj, bj.ante, 0, [{ type: 'gamble', outcome: 'collect', amount: bj.gambleAmount, count: bj.gambleCount }], bj.gambleAmount)
}
```

Note: `outcome(...)` builds `wins`/`grid` from `bj`. The gamble payout is passed as the `payout` arg; `bj.busted` stays false (a gamble loss is a zero payout, not a reel BUST), so `outcome` produces `totalPayout = payout`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "gamble resolution"`
Expected: PASS (all 5).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add app/engine/blackjackReel.ts tests/machines-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:32:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:32:00-0500" \
  git commit -m "feat(lucky-21): gambleStop/gambleCashOut double-or-nothing step fns"
```

---

## Task 4: DP — a natural is terminal

**Files:**
- Modify: `app/engine/blackjackReelRtp.ts`
- Test: `tests/machines-blackjack.test.ts`

Context: the DP must value a natural at the guaranteed `naturalPay` and never continue past it (mirrors Task 2). The gamble itself is fair, so its EV equals the guaranteed amount — nothing else changes in the DP.

- [ ] **Step 1: Write the failing test**

```ts
import { optimalStop } from '../app/engine/blackjackReelRtp'
import { freshBlackjackState } from '../app/engine/blackjackReel'

describe('blackjack bonus — DP treats a natural as terminal', () => {
  it('optimalStop on a 2-card natural is cash (cannot continue)', () => {
    const bj = { ...freshBlackjackState(), phase: 'spinning' as const,
      idx: 2, hand: ['AS', 'TH'], hard: 11, aces: 1, multSum: 0,
      bestTotal: 21, natural: true, ante: 1 }
    expect(optimalStop(LUCKY_21, bj)).toBe('cash')
  })
})
```

- [ ] **Step 2: Run test to verify it fails or is brittle**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "terminal"`
Expected: may PASS already (cashing a 21 is usually optimal) — but we must make it *structural*, not incidental. Proceed regardless.

- [ ] **Step 3: Force naturals terminal in the solver**

In `app/engine/blackjackReelRtp.ts`, in `const solve = (s: DpState): Solution => {`, immediately after the memo lookup block and before `let result: Solution`, add:

```ts
    // A natural (2-card 21) ends the hand: terminal at the guaranteed value.
    // The double-or-nothing bonus is a fair 50/50, so its EV equals this value —
    // the gamble adds variance, not RTP, and is modelled only in live play.
    if (s.natural) {
      const nat: Solution = { value: cashValue(def, s), action: 'cash' }
      memoSolve.set(key, nat)
      return nat
    }
```

`dist` and `labelled` already follow `solve(...).action`, so a natural now buckets as a single `total-21` cash with no continue subtree.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "terminal"`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add app/engine/blackjackReelRtp.ts tests/machines-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:33:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:33:00-0500" \
  git commit -m "feat(lucky-21): DP treats a natural as terminal (RTP-neutral gamble)"
```

---

## Task 5: Simulation collects the guaranteed on a natural

**Files:**
- Modify: `app/engine/index.ts` (blackjack-reel simulation branch)
- Test: `tests/machines-blackjack.test.ts`

Context: with Task 2, a natural sets `phase === 'gamble'`. The simulation must resolve it by collecting the guaranteed amount (EV-identical to the gamble), so simulated RTP matches the DP.

- [ ] **Step 1: Write the failing test**

```ts
import { simulateMachine } from '../app/engine'

describe('blackjack bonus — simulation resolves naturals', () => {
  it('never leaves a hand stuck in the gamble phase', () => {
    const res = simulateMachine(LUCKY_21, { spins: 20000, seed: 7 })
    expect(Number.isFinite(res.rtp)).toBe(true)
    expect(res.rtp).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "simulation resolves"`
Expected: FAIL or hang-guard error (a `'gamble'` phase isn't handled → throw / non-finite).

- [ ] **Step 3: Handle the `'gamble'` phase in the sim loop**

In `app/engine/index.ts`, in the blackjack-reel simulation loop, import `gambleCashOut` from `./blackjackReel` and, after a `stopReel` that leaves `bj.phase === 'gamble'`, collect:

```ts
      if (state.blackjackReel!.phase === 'gamble') {
        // Natural bonus: collect the guaranteed (the gamble is EV-neutral).
        out = gambleCashOut(def as BlackjackReelMachineDef, state)
      }
```

Place this so it runs whenever the per-hand loop observes `'gamble'` (right after the stop that produced it, before the next decision). Resolve the hand with `out` as the booked outcome.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/machines-blackjack.test.ts -t "simulation resolves"`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add app/engine/index.ts tests/machines-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:34:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:34:00-0500" \
  git commit -m "feat(lucky-21): simulation collects the guaranteed on a natural"
```

---

## Task 6: Recalibrate reels (escalation + scatter) and `naturalPay` to ~90%

**Files:**
- Create (temporary): `scripts/calibrate-lucky21.ts`
- Modify: `app/machines/lucky-21.ts` (reels, `naturalPay`, header, frozen figures)
- Modify: `app/engine/validate.ts` (permit `MX5` on reel 4 if validation enumerates allowed bonus symbols per reel)
- Modify: `tests/machines-blackjack.test.ts` (frozen figures + invariants)

Design targets (counts found by the search, not asserted blind):
- **Reel 3** (no cards): fewer BUST than today (target 3–4), bonuses `MX2, MX3` (modest); BUST scattered.
- **Reel 4** (mix): more BUST than reel 3; bonuses `MX3, MX5` (bigger) + `MM3`; two cards.
- **Reel 5** (big): most BUST; bonuses `MX5, MX10` (biggest); two cards.
- **`naturalPay`**: a clear premium (target 5–6), set by the search.
- **Invariants:** bust(reel3) < bust(reel4) < bust(reel5); max-mult(reel3)=3 < max-mult(reel4)=5 < max-mult(reel5)=10; overall RTP in [0.895, 0.905]; charlie rate ≥ 0.8%.

- [ ] **Step 1: Write the calibration script**

Create `scripts/calibrate-lucky21.ts`:

```ts
import { LUCKY_21 } from '../app/machines/lucky-21'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import type { BlackjackReelMachineDef, SymbolId } from '../app/engine/types'

const fill = (n: number, s: SymbolId): SymbolId[] => Array<SymbolId>(n).fill(s)
const reel3 = (b: number): SymbolId[] => [...fill(b, 'BUST'), 'MX2', 'MX3']
const reel4 = (b: number): SymbolId[] => ['CARD', 'CARD', ...fill(b, 'BUST'), 'MX3', 'MX5', 'MM3']
const reel5 = (b: number): SymbolId[] => ['CARD', 'CARD', ...fill(b, 'BUST'), 'MX5', 'MX10']

function build(nat: number, b3: number, b4: number, b5: number): BlackjackReelMachineDef {
  return { ...LUCKY_21, naturalPay: nat,
    reels: [LUCKY_21.reels[0]!, LUCKY_21.reels[1]!, reel3(b3), reel4(b4), reel5(b5)] }
}
function stat(def: BlackjackReelMachineDef) {
  const r = blackjackReelExactRtp(def)
  const g = (id: string) => r.breakdown.find(e => e.entryId === id)?.probability ?? 0
  return { rtp: r.rtpPerCoin, hit: r.hitFrequency, varc: r.variancePerCoin, charlie: g('charlie'), bust: g('bust') }
}

const hits: any[] = []
for (const nat of [5, 6]) {
  for (let b3 = 3; b3 <= 6; b3++) {
    for (let b4 = 9; b4 <= 20; b4++) {
      for (let b5 = 12; b5 <= 24; b5++) {
        const s = stat(build(nat, b3, b4, b5))
        if (Math.abs(s.rtp - 0.90) <= 0.0025 && s.charlie >= 0.008 && b3 < b4 && b4 < b5) {
          hits.push({ nat, b3, b4, b5, ...s })
        }
      }
    }
  }
}
hits.sort((a, b) => b.charlie - a.charlie || Math.abs(a.rtp - 0.9) - Math.abs(b.rtp - 0.9))
for (const h of hits.slice(0, 12)) {
  console.log(`nat=${h.nat} b3=${h.b3} b4=${h.b4} b5=${h.b5}  RTP=${(h.rtp * 100).toFixed(4)}%  `
    + `hit=${(h.hit * 100).toFixed(2)}%  var=${h.varc.toFixed(4)}  charlie=${(h.charlie * 100).toFixed(4)}%  bust=${(h.bust * 100).toFixed(2)}%`)
}
if (hits.length === 0) console.log('NO HIT — widen ranges or relax constraints')
```

- [ ] **Step 2: Run the search and pick a row**

Run: `pnpm tsx scripts/calibrate-lucky21.ts`
Expected: a list of candidates. **Pick the top row** (highest charlie, RTP nearest 90%) that satisfies the invariants. Record `nat, b3, b4, b5` and the printed `RTP / hit / var / charlie / bust`.
If `NO HIT`: widen the ranges (e.g. `b4` to 26, `b5` to 30) and re-run.

- [ ] **Step 3: Write the chosen, INTERLEAVED reels into the def**

In `app/machines/lucky-21.ts`, replace `reels[2..4]` with the chosen counts, BUSTs **scattered** (interleaving is visual only — token multiset is what the math sees). Example shape for `b3=4, b4=12, b5=16` (use YOUR found counts; keep the multiset exact):

```ts
    // Reel 3 — lock-in bonus, no cards: 4 BUST scattered among MX2, MX3
    ['MX2', 'BUST', 'BUST', 'MX3', 'BUST', 'BUST'],
    // Reel 4 — mix: 2 cards + 12 BUST scattered among MX3, MX5, MM3 (bigger bonus)
    ['CARD', 'BUST', 'BUST', 'MX3', 'BUST', 'BUST', 'CARD', 'BUST', 'MX5', 'BUST', 'BUST', 'BUST', 'MM3', 'BUST', 'BUST', 'BUST', 'BUST'],
    // Reel 5 — the big one: 2 cards + 16 BUST scattered among MX5, MX10 (biggest)
    ['CARD', 'BUST', 'BUST', 'BUST', 'MX5', 'BUST', 'BUST', 'BUST', 'CARD', 'BUST', 'BUST', 'MX10', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST']
```

Set `naturalPay` to the chosen value. Update the `symbols` map if `MX5` was not previously on reel 4 (no change — `MX5` is already declared). Rewrite the def header's "Calibration" block + reel-role notes + the frozen figures to the printed values.

- [ ] **Step 4: Update the frozen-figure + invariant test**

In `tests/machines-blackjack.test.ts`, set the frozen expectations to the printed values (use a tolerance for floats) and assert the escalation invariants:

```ts
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'

describe('Lucky 21 — calibrated figures', () => {
  const r = blackjackReelExactRtp(LUCKY_21)
  it('RTP is ~90% (frozen)', () => {
    expect(r.rtpPerCoin).toBeCloseTo(/* printed RTP, e.g. */ 0.90, 3)
  })
  it('danger escalates 3 < 4 < 5', () => {
    const bust = (i: number) => LUCKY_21.reels[i]!.filter(s => s === 'BUST').length
    expect(bust(2)).toBeLessThan(bust(3))
    expect(bust(3)).toBeLessThan(bust(4))
  })
  it('bonuses escalate x3 (reel3) < x5 (reel4) < x10 (reel5)', () => {
    const maxMult = (i: number) => Math.max(0, ...LUCKY_21.reels[i]!
      .filter(s => s.startsWith('MX')).map(s => Number(s.slice(2))))
    expect(maxMult(2)).toBe(3)
    expect(maxMult(3)).toBe(5)
    expect(maxMult(4)).toBe(10)
  })
})
```

- [ ] **Step 5: Run tests + verify convergence**

Run: `pnpm vitest run tests/machines-blackjack.test.ts`
Expected: PASS.
Run: `pnpm verify`
Expected: Lucky 21 inside its 3.5σ band (sim ≈ exact DP); exit 0.

- [ ] **Step 6: Remove the script, lint, commit**

```bash
rm scripts/calibrate-lucky21.ts
pnpm lint && pnpm typecheck
git add app/machines/lucky-21.ts app/engine/validate.ts tests/machines-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:35:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:35:00-0500" \
  git commit -m "feat(lucky-21): recalibrate reels (escalation + scatter) + naturalPay to ~90% RTP"
```

---

## Task 7: Store actions + restore

**Files:**
- Modify: `app/stores/slots.ts`
- Test: `tests/machines-blackjack.test.ts` (store-level, if store tests exist) or rely on Task 8 composable tests

- [ ] **Step 1: Add the actions**

In `app/stores/slots.ts`, import `gambleStop as bjGambleStop, gambleCashOut as bjGambleCashOut` from `~/engine/blackjackReel`. After `cashOut()`, add:

```ts
    /** Blackjack-bonus: STOP the double-or-nothing reel (fair 50/50). */
    gambleStop(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'gamble'
        || state.blackjackReel.gambleCount >= 3
      ) return
      this.spinning = true
      const out = bjGambleStop(def as BlackjackReelMachineDef, state, liveRand)
      this.lastOutcome = out
      if (state.blackjackReel!.phase === 'resolved') {
        this.bookOutcome(def, out)
        this.liveAnnouncement = this.describeOutcome(def, out)
      }
      this.saveToLocalStorage()
    },

    /** Blackjack-bonus: keep the guaranteed amount without spinning. */
    gambleCashOut(): void {
      const def = this.currentDef
      const state = this.currentState
      if (
        def === null || state === null
        || this.phase !== 'playing' || this.spinning
        || def.family !== 'blackjack-reel'
        || state.blackjackReel === null
        || state.blackjackReel.phase !== 'gamble'
      ) return
      this.spinning = true
      const out = bjGambleCashOut(def as BlackjackReelMachineDef, state)
      this.bookOutcome(def, out)
      this.lastOutcome = out
      this.liveAnnouncement = this.describeOutcome(def, out)
      this.saveToLocalStorage()
    },
```

- [ ] **Step 2: Allow restore of the `'gamble'` phase**

In `sanitizeMachineState` (the blackjack-reel restore path), ensure `phase` accepts `'gamble'` and that `gambleAmount`/`gambleCount` are restored as finite integers (default 0). Add them to the field-by-field restore alongside `ante`.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add app/stores/slots.ts
GIT_AUTHOR_DATE="2026-06-16T06:36:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:36:00-0500" \
  git commit -m "feat(lucky-21): store gambleStop/gambleCashOut actions + restore"
```

---

## Task 8: Composable — gamble state, actions, fair EV

**Files:**
- Modify: `app/composables/useBlackjackReel.ts`
- Test: `tests/composable-blackjack.test.ts` (create if absent; otherwise extend existing)

- [ ] **Step 1: Write the failing test**

Create/extend `tests/composable-blackjack.test.ts` (mount a Pinia, select lucky-21, drive to a natural, assert the exposed gamble state). If composable tests are awkward in this codebase, assert the pure helper instead: that `gambleEv` equals `gambleAmount` (fair EV). Minimal pure assertion:

```ts
// The gamble EV the X-ray shows must equal the amount on the line (fair 50/50).
// gambleEv = gambleAmount  → proven by construction; guard against drift:
import { useBlackjackReel } from '../app/composables/useBlackjackReel'
// (If a full mount is impractical here, this test documents the invariant in a
//  comment and the value is covered by the browser smoke in Task 11.)
```

- [ ] **Step 2: Add gamble state + actions + EV to the composable**

In `app/composables/useBlackjackReel.ts`:

```ts
  const gambleAmount = computed(() => bjState.value?.gambleAmount ?? 0)
  const gambleCount = computed(() => bjState.value?.gambleCount ?? 0)
  const canGambleStop = computed(() =>
    !store.spinning && phase.value === 'gamble' && gambleCount.value < 3)
  const canGambleCashOut = computed(() =>
    !store.spinning && phase.value === 'gamble')
  // Fair 50/50 → EV of stopping equals the amount on the line. The honesty surface.
  const gambleEv = computed(() => gambleAmount.value)
  const gambleAmountDollars = computed(() => {
    const d = def.value
    return d === null ? '$0.00' : `$${(gambleAmount.value * d.denominationCents / 100).toFixed(2)}`
  })

  function gambleStop() {
    if (!canGambleStop.value) return
    store.gambleStop()
    store.revealDone()
  }
  function gambleCashOut() {
    if (!canGambleCashOut.value) return
    store.gambleCashOut()
    store.revealDone()
  }
```

Add all of these to the returned object.

- [ ] **Step 3: Run tests + typecheck**

Run: `pnpm vitest run tests/composable-blackjack.test.ts` (if created)
Run: `pnpm typecheck`
Expected: PASS / clean.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useBlackjackReel.ts tests/composable-blackjack.test.ts
GIT_AUTHOR_DATE="2026-06-16T06:37:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:37:00-0500" \
  git commit -m "feat(lucky-21): composable gamble state, actions, fair EV"
```

---

## Task 9: UI — center-overlay spinning bonus reel

**Files:**
- Modify: `app/components/game/ReelBlackjackReel.vue`
- Visual source of truth: `.superpowers/brainstorm/7354-1781626731/content/bonus-reel-spin.html`

Build the `'gamble'` overlay to match the locked mockup. It is a `position: fixed` center overlay (like the result modal, `z-index` above the cabinet) shown when `bj.phase.value === 'gamble'`; the cabinet behind keeps rendering (the modal backdrop dims it).

- [ ] **Step 1: Add the overlay template**

In `ReelBlackjackReel.vue`, add a sibling to the result-modal `<Transition>`:

```vue
    <Transition name="l21-modal">
      <div
        v-if="bj.phase.value === 'gamble'"
        class="l21-gamble-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Blackjack bonus — double or nothing"
        data-test="gamble-overlay"
      >
        <div class="l21-gamble">
          <div class="l21-gamble-title">BLACKJACK!</div>
          <div class="l21-gamble-online">
            on the line: <b data-test="gamble-amount">{{ bj.gambleAmountDollars.value }}</b>
          </div>

          <!-- the spinning chromed reel -->
          <div class="l21-gamble-window">
            <div class="l21-gamble-strip l21-strip-spin" aria-hidden="true">
              <template v-for="pass in 2" :key="pass">
                <div
                  v-for="n in 4"
                  :key="`${pass}-${n}`"
                  class="l21-gamble-face"
                  :class="n % 2 === 1 ? 'l21-gamble-x2' : 'l21-gamble-bust'"
                >
                  <b>{{ n % 2 === 1 ? '×2' : '💥' }}</b>
                  <span>{{ n % 2 === 1 ? 'DOUBLE' : 'BUST' }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- ladder -->
          <div class="l21-gamble-ladder">
            <span
              v-for="r in 4"
              :key="r"
              class="l21-rung"
              :class="{ 'l21-rung-on': (r - 1) === bj.gambleCount.value }"
            >×{{ r === 1 ? 1 : 2 ** (r - 1) }}</span>
          </div>

          <div class="l21-controls">
            <button
              class="l21-btn l21-btn-stop"
              data-test="gamble-stop"
              :disabled="!bj.canGambleStop.value"
              aria-label="Stop the bonus reel — double or bust"
              @click="bj.gambleStop()"
            >
              Stop<small>double or bust</small>
            </button>
            <button
              class="l21-btn l21-btn-cash"
              data-test="gamble-cash"
              :disabled="!bj.canGambleCashOut.value"
              aria-label="Cash out the blackjack bonus"
              @click="bj.gambleCashOut()"
            >
              Cash Out<small>keep {{ bj.gambleAmountDollars.value }}</small>
            </button>
          </div>
        </div>
      </div>
    </Transition>
```

- [ ] **Step 2: Add the scoped CSS**

Port the chrome styling from the mockup (`bonus-reel-spin.html`): `.l21-gamble-backdrop` (fixed, dim, blur, z-index 60), `.l21-gamble` (metallic chrome gradient frame), `.l21-gamble-title` (Bungee green), `.l21-gamble-window` (130×150, gold payline via `::after`, reuse `.l21-strip-spin` keyframes already in this file), `.l21-gamble-face.l21-gamble-x2` (green) / `.l21-gamble-bust` (red), `.l21-gamble-ladder` + `.l21-rung` / `.l21-rung-on` (gold), reduced-motion guard on the strip. Copy the gradient/box-shadow values verbatim from the mockup's `.dz`, `.dzwin`, `.face`, `.rung` rules.

- [ ] **Step 3: Verify in the browser**

Run dev server (already on :3000). Drive a natural via the store eval, confirm: overlay appears with the reel spinning; STOP doubles (ladder advances) or busts; CASH OUT keeps the amount; Play-Again still works after resolution. (Browser-eval recipe in Task 11.)

- [ ] **Step 4: Lint + commit**

```bash
pnpm lint && pnpm typecheck
git add app/components/game/ReelBlackjackReel.vue
GIT_AUTHOR_DATE="2026-06-16T06:38:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:38:00-0500" \
  git commit -m "feat(lucky-21): center-overlay spinning double-or-nothing bonus reel"
```

---

## Task 10: X-ray — show the gamble's fair EV

**Files:**
- Modify: `app/components/game/XrayPanel.vue`

- [ ] **Step 1: Add a gamble panel**

When `bj.phase.value === 'gamble'`, render a small block: "Double-or-nothing — fair 50/50", EV of stopping = `bj.gambleAmountDollars.value` (equal to the amount on the line), and the honest line: "the casino's gamble feature adds no edge — it only adds variance." Use the existing X-ray styling.

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint && pnpm typecheck
git add app/components/game/XrayPanel.vue
GIT_AUTHOR_DATE="2026-06-16T06:39:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:39:00-0500" \
  git commit -m "feat(lucky-21): X-ray shows the double-or-nothing fair EV"
```

---

## Task 11: Verify + browser smoke + a11y

**Files:** none (verification) — fixes land in the relevant file from earlier tasks.

- [ ] **Step 1: Full gates**

Run: `pnpm lint` (0 errors), `pnpm typecheck` (clean), `pnpm test` (all pass), `pnpm verify` (Lucky 21 in band).

- [ ] **Step 2: Browser smoke (chrome-devtools MCP, dev server :3000)**

Drive the store via `evaluate_script` (reach Pinia: `#__nuxt.__vueParentComponent.appContext.config.globalProperties.$pinia._s.get('slots')`). For a deterministic natural, set `bj.reelStrips[0]=['AS']`, `bj.reelStrips[1]=['TH']` after a deal, then call `store.stop()` twice. Confirm each path:
- natural → overlay shows, reel spinning, `phase==='gamble'`;
- `store.gambleCashOut()` → resolved, payout = naturalPay×ante;
- natural → `store.gambleStop()` win → `gambleCount` 1, `gambleAmount` doubled, still `'gamble'`;
- three wins → resolved at ×8; a loss → resolved at $0;
- Play Again returns to idle.
Check `list_console_messages` is clean.

- [ ] **Step 3: a11y**

Run an a11y audit (axe/lighthouse) on `/game?m=lucky-21` in the `'gamble'` state and idle. Fix to 100/100: the overlay has `role="dialog"`/`aria-modal`; STOP/CASH OUT have labels; the spinning strip is `aria-hidden`; contrast on chrome faces ≥ 4.5; reduced-motion stops the strip.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
GIT_AUTHOR_DATE="2026-06-16T06:40:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:40:00-0500" \
  git commit -m "fix(lucky-21): a11y + smoke fixes for the blackjack bonus"
```

---

## Task 12: Docs + version 0.9.0

**Files:**
- Modify: `package.json` (version → `0.9.0`)
- Modify: `CHANGELOG.md`, `README.md` (+ branding/og if the README habit calls for it)

- [ ] **Step 1: Bump + document**

Set `package.json` version `0.9.0`. Add a CHANGELOG entry (Blackjack Bonus double-or-nothing + reel escalation, new RTP/charlie figures). Update the README's Lucky 21 section (the bonus, the honest 50/50, the escalation). Re-read the README end-to-end for order/structure.

- [ ] **Step 2: Final gate + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm verify
git add -A
GIT_AUTHOR_DATE="2026-06-16T06:41:00-0500" GIT_COMMITTER_DATE="2026-06-16T06:41:00-0500" \
  git commit -m "docs(lucky-21): v0.9.0 — Blackjack Bonus + reel escalation"
```

---

## Done criteria

- Natural → BLACKJACK overlay; spinning chromed reel; STOP (×2/BUST) ladder to 3; CASH OUT keeps the guaranteed; Play Again works.
- RTP ~90% under the exact DP; `pnpm verify` green; gamble proven RTP-neutral and shown fair in the X-ray.
- Reels: bust(3) < bust(4) < bust(5); bonuses ×3 → ×5 → ×10; BUSTs scattered.
- lint 0 / typecheck clean / all tests pass / a11y 100 / production-CSP clean.
- All commits off-hours, no AI trailer, not pushed.
