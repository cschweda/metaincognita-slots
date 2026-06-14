# Ruby of Gargoyle — Design Spec

**Date:** 2026-06-14
**Status:** Approved (brainstorm) — ready for implementation plan
**Author:** cschweda + Claude

## Summary

Add a ninth machine, **Ruby of Gargoyle**, to the floor: a hold-and-spin ("lock
and collect") jewel game in the existing `video` family, themed as a moonlit
gothic cathedral whose gargoyles guard a hoard of gems. It reuses the proven
Thunder Vault hold-and-spin loop (6+ orbs lock, 3 respins, every new orb resets
the counter, fill all 15 cells pays the Grand) and distinguishes itself with one
new, reusable mechanic: the **Gargoyle's Eye** multiplier gem.

This is deliberately the *smallest* of three game ideas on the roadmap (see
**Out of Scope**). It ships the casino feature players most associate with
"jewel/dragon" slots while adding a self-contained engine feature every future
hold-and-spin game can reuse.

## Goal & Non-Goals

**Goal:** A distinct, shippable hold-and-spin machine with exact, frozen math in
the ~90% RTP / high-volatility band, plus a multiplier-gem feature generalized
into the engine (not hardcoded to this machine).

**Non-goals:** No new bet modes, no free spins, no new machine *family*, no
changes to stepper/bally-em/pachislo code paths, no multi-tier progressive
jackpots (that is the future "authentic 4-tier" build).

## Key Decision & Rationale

The hold-and-spin mechanic already exists (`video` family, `holdAndSpin` config;
Thunder Vault uses it), including the two details that make these games beloved:
respins reset on every new lock (`video.ts:217`) and a filled board pays the
percent-fed Grand (`video.ts:237`). So Ruby of Gargoyle is *mostly data*. To
avoid shipping a Thunder Vault reskin, it adds **one contained signature twist**
— a multiplier gem — chosen over a pure reskin (too similar) and over real
4-tier progressives (a much larger engine generalization, deferred).

## Theme & Symbols

Moonlit gothic cathedral; stone gargoyles perched over a gem hoard. Rubies
surface on the reels; six or more wake the gargoyles, who lock the gems for the
collect feature. The Grand is the cathedral's legendary heart-ruby, won by
filling all fifteen perches.

Nine symbols, mirroring Thunder Vault's shape so the def drops cleanly into the
`video` family and satisfies the validator (3/4/5 paytable coverage, orb +
empty specials):

| ID | Symbol | Role |
|----|--------|------|
| `GA` | Gargoyle | Premium 1 (top payer) |
| `CH` | Chalice | Premium 2 |
| `CR` | Crown | Premium 3 |
| `AA` | Ace | Royal |
| `KK` | King | Royal |
| `QQ` | Queen | Royal |
| `JJ` | Jack | Royal |
| `RU` | Ruby | Orb — triggers & locks in the hold-and-spin (Thunder Vault's `OR` role) |
| `EM` | Empty | Respin blank (`emptySymbol`) |

Premiums are intentionally *non-gem* icons (gargoyle, chalice, crown) so the
Ruby reads unambiguously as "the collectible." The **Gargoyle's Eye** multiplier
is **not** a reel symbol — it is a value a locked gem can take, rendered as a
glowing ×N gem on the lock board (see Feature).

**New art (implementation):** ~5 SVG icons in
`app/components/game/symbols/registry.ts` (`gargoyle`, `ruby`, `chalice`,
`crown`, `gargoyle-eye`) and one entry in `app/components/game/marquee/art.ts`.
No new components.

## Game Configuration

New file `app/machines/ruby-of-gargoyle.ts`, exported into `FLOOR` in
`app/machines/index.ts`. Profile mirrors Thunder Vault:

- `family: 'video'`, `denominationCents: 1`, `maxCoins: 25`, `fixedBet: true`
- `betMode: { kind: 'lines', lines: LINES25 }` (25 lines = `maxCoins`, validator rule)
- `wildSymbol: null`, `scatter: null`, `freeSpins: null` (lean base game funds the feature)
- `strips`: 5 × 24 cells (validator: video strips must be exactly 5 reels × 24 cells)
- `paytable`: `GA`,`CH`,`CR`,`AA`,`KK`,`QQ`,`JJ` each at lengths 3/4/5 (21 entries)
- `progressive: { kind: 'percent', reset: 5000, max: 50000, feedRate: 0.01 }` (the Grand)
- `holdAndSpin`:
  - `orbSymbol: 'RU'`, `emptySymbol: 'EM'`, `triggerCount: 6`, `respins: 3`
  - `respinOrbNumer / respinOrbDenom`: calibrated (Thunder Vault uses 2/24)
  - `orbValues`: credit gems **plus** two multiplier gems (see Feature)
- Ruby (`RU`) placement on the strips calibrated so P(trigger) sits near Thunder
  Vault's ~1/123 spins.

All concrete numbers (strip layouts, orb weights, respin fraction) are
calibration outputs, finalized during implementation against the exact-RTP tool
and frozen in the def's header comment exactly like the other eight machines.

## Signature Feature — Gargoyle's Eye Multiplier Gem

During the hold-and-spin, a locked gem can be either a **credit gem** (a credit
value, as today) or a **Gargoyle's Eye** (a multiplier face, ×2 or ×3). A
multiplier gem:

- Lands and locks like any orb — it **occupies a cell** and therefore **counts
  toward filling the board** (and toward the Grand) and **resets the respins**
  just like a credit gem. The respin/landing probability and the fill mechanic
  are unchanged.
- Carries **no credits of its own**.
- At **collect**, all multiplier faces **add**: total multiplier
  `M = max(1, Σ faces)` (no Eye gems → ×1; one ×2 → ×2; ×2 and ×3 → ×5).
- `M` multiplies the **summed credit value of the credit gems only**. The
  **Grand pays clean** (un-multiplied).

Final collected payout for a feature that ends with the board in some state:

```
payout = (Σ credit-gem credits) × max(1, Σ Eye faces)  +  (Grand if board filled)
```

**Multiplier faces:** ×2 and ×3, additive (user-selected). Rare enough that a
strong board reaches ≈ ×5.

## Engine Changes (precise)

All within the `video` family; no other family touched.

1. **`app/engine/types.ts`** — generalize a `holdAndSpin.orbValues` entry from
   `{ credits, weight, label? }` to a discriminated union:
   - credit gem: `{ kind: 'credits', credits, weight, label? }`
   - multiplier gem: `{ kind: 'multiplier', mult, weight }`
   Locked-cell state and the internal `DrawnOrb` gain an optional multiplier so a
   locked cell can represent an Eye. (To keep Thunder Vault's def untouched, the
   credit kind may be the default when `kind` is omitted; final shape is a plan
   decision, but the credit-only path must remain byte-identical.)

2. **`app/engine/video.ts`**
   - `drawOrbValue` (`:15`) returns either credits or a multiplier face from the
     weighted table.
   - `holdAndSpinRespin` collect branch (`:230`) computes
     `Σcredits × max(1, Σmult)` instead of a plain sum; the Grand is added
     after, un-multiplied. Emit the multiplier in the feature events for the UI.
   - Lock-board grid render (`:251`) marks multiplier cells distinctly.

3. **`app/engine/videoRtp.ts`** (the one real math change, `:415–455`) — the
   feature EV/variance currently assume every locked cell is a credit orb
   (`mean = k·muV + grand`). Replace with a closed form that conditions on
   `j` = number of multiplier cells among the `k` locked (Binomial(k, p_mult),
   where `p_mult` = multiplier weight / total weight):
   - credit sum `C` over `k−j` cells ⟂ multiplier `M` over `j` cells given `j`
   - `E[F|j] = E[C|j]·E[M|j] + G`, with `M = 1` when `j = 0`
   - sum over `j`, then over the existing `hnsFinalDist` over `k`, then over
     trigger counts `t` — same nesting as today; `hnsFinalDist`, the joint cycle,
     and the base-game closed forms are **unchanged**.
   - **Regression guarantee:** with no multiplier entries, `p_mult = 0`, so
     `j ≡ 0`, `M ≡ 1`, and the form collapses to `k·muV` — Thunder Vault's RTP,
     hit frequency, and variance are provably identical. This is an explicit
     test assertion.

4. **`app/engine/validate.ts`** (`:149–151`) — `orbValues` validation currently
   requires `credits > 0` and `weight > 0` on every entry. Update: credit
   entries keep `credits > 0`; multiplier entries require `mult ≥ 2` and
   `weight > 0`; `orbValues` must contain at least one credit entry (a feature of
   pure multipliers has nothing to multiply).

5. **`app/components/game/ReelVideo.vue`** — render a locked multiplier cell with
   the `gargoyle-eye` icon and a `×N` badge. Small, additive; exact scope depends
   on how the lock board currently surfaces per-cell values (verify in plan).

6. **`app/components/game/symbols/registry.ts`** — add the new SVG icons.

7. **`app/components/game/marquee/art.ts`** — add the marquee entry (icon,
   tagline, accent color).

8. **`app/machines/ruby-of-gargoyle.ts`** (new) + **`app/machines/index.ts`**
   (add to `FLOOR`).

## Data Flow

1. **Base spin** (`spinVideo` → `videoBaseSpin`): 25 lines evaluated; Ruby orbs
   counted. 6+ Rubies → enter `holdAndSpin` feature state with those cells locked.
2. **Respin** (`holdAndSpinRespin`): each empty cell lands an orb at
   `respinOrbNumer/Denom`; each landed orb's *kind* (credit or Eye) is a weighted
   `orbValues` draw. Any new orb resets respins to 3. Board full → end.
3. **Collect** (feature ends — respins exhausted or board full): pay
   `Σcredits × max(1, ΣEye)`; if board full, also pay the Grand (clean) and reset
   the meter.

## Math & Calibration

- **Targets:** RTP ≈ 90% per coin, high volatility, P(trigger) ≈ 1/123,
  Grand fed by 1% of bet — Thunder Vault's band. The multiplier *adds* feature
  EV, so credit weights/values and/or trigger frequency are trimmed relative to
  Thunder Vault to land the target; exact numbers come from the calibration loop.
- **Method:** `videoExactRtp` (closed-form, full 24⁵ cycle enumeration) is the
  source of truth; numbers are frozen in the def header and guarded by
  `scripts/verify-floor.ts`.
- **Cross-check:** a Monte-Carlo simulation of the feature (including multiplier
  collect) must agree with the new closed form within tolerance.

## Invariants & Error Handling

- Validator additions above run via `validateMachineDef` at machine select.
- Existing video invariants still hold: percent progressive required for
  hold-and-spin; fixed bet; orb/empty are special and cannot pay as line symbols;
  paytable covers 3/4/5 for every paying symbol.

## Testing

1. **Validator:** Ruby of Gargoyle passes `validateMachineDef`; targeted negative
   tests for the new multiplier-entry rules.
2. **Exact RTP:** `videoExactRtp` lands in the target band; **Thunder Vault's
   report is unchanged** (regression — the reduction guarantee).
3. **Feature unit tests:** collect math for 0, 1, and many Eye gems; a filled
   board (credits × multiplier + clean Grand); a board that ends on respin
   exhaustion; Eye gems correctly reset respins and count toward fill.
4. **Closed-form vs Monte-Carlo** agreement for the feature EV/variance.
5. **Browser-smoke (required):** play the machine in a browser through a real
   trigger → respins → multiplier collect → Grand, watching render and data
   shape. (Project lesson: green unit tests with hand-made inputs have missed
   render/data-shape bugs; the UI phase must be exercised.)

## Out of Scope / Future Roadmap

Captured so they are not lost; each gets its own brainstorm → spec → plan cycle:

- **Crash / cash-out machine** ("stop or bust", a new family) — the player-control
  + risk idea. Note: distinct from the existing pachislo skill-stop, whose wins
  are protected and never lost.
- **Reels + cards hybrid** (poker-hand evaluation, finite depleting deck, or a
  card-draw bonus) — a new family; the interesting version is a new evaluation
  model, not a card-themed reskin.
- **Authentic 4-tier progressives** (Mini/Minor/Major/Grand as scaling pools) —
  generalizes the single-progressive system to multiple meters.

## Open Questions (resolved during implementation)

- Final `orbValues` table (credit tiers + Eye weights) and `respinOrb` fraction —
  calibration outputs.
- Strip layouts hitting the target trigger frequency.
- Exact `orbValues` entry shape (explicit `kind` discriminant vs. optional
  `mult`), chosen to keep Thunder Vault's def and math untouched.
- Whether the lock board already surfaces per-cell values, which sets the
  `ReelVideo.vue` scope.
