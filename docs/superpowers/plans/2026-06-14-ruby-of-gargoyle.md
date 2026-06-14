# Ruby of Gargoyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Ruby of Gargoyle — a gothic hold-and-spin jewel machine (video family) whose signature is an additive "Gargoyle's Eye" multiplier gem — as the ninth floor machine, with exact frozen math.

**Architecture:** The hold-and-spin loop already exists (`app/engine/video.ts`); we generalize the orb-value model so a locked cell can be a *credit* gem or a *multiplier* gem. At collect, multiplier faces add (×2+×3=×5) and scale the summed credit gems; the Grand pays clean. The exact-RTP closed form gains a conditioning step that provably reduces to the current formula when no multiplier orbs exist (so Thunder Vault's frozen numbers are unchanged). Then a new pure-data machine + theming + docs.

**Tech Stack:** Nuxt 4 SPA, TypeScript (strict), Vitest, Pinia, @nuxt/ui + Tailwind 4, pnpm. Engine is framework-free pure TS; machines are pure data.

**Branch:** `ruby-of-gargoyle` (already created; the design spec + roadmap are committed there).

---

## File Structure

**Engine (pure TS):**
- `app/engine/types.ts` — split `OrbValueEntry` into a credit/multiplier union; widen the hold-and-spin `locked` cell type; add a `mult-orbs-locked` feature event.
- `app/engine/validate.ts` — accept multiplier orb entries; require ≥1 credit entry.
- `app/engine/video.ts` — `drawOrbValue` returns credit or multiplier; collect applies the additive multiplier; emit `mult-orbs-locked`.
- `app/engine/videoRtp.ts` — feature EV/variance conditions on the number of multiplier cells (reduces to today's formula when none).

**Data:**
- `app/machines/ruby-of-gargoyle.ts` (new) — the machine definition.
- `app/machines/index.ts` — register in `FLOOR`.

**UI / presentation:**
- `app/components/game/symbols/registry.ts` — `gargoyle`, `ruby`, `chalice`, `crown`, `gargoyle-eye` icons.
- `app/components/game/marquee/art.ts` — marquee entry.
- `app/components/game/ReelVideo.vue` — render multiplier gems on the lock board.
- `app/stores/slots.ts` — announce multiplier locks (a11y).

**Docs / branding:**
- `public/og-image.svg` + `public/og-image.png` — "eight" → "nine" machines, regenerate PNG.
- `README.md` — count, machine table row, verify count + table, new **Future variants** section.
- `CHANGELOG.md` + `package.json` — 0.5.0 entry + version bump.
- `nuxt.config.ts` — social meta "eight" → "nine".

**Tests touched:** `tests/validate.test.ts`, `tests/video.test.ts`, `tests/videoRtp.test.ts`, `tests/machines-video.test.ts`, `tests/machines-pachislo.test.ts`, `tests/simulate.test.ts`, `tests/components/reelVideo.test.ts`.

Each task ends green: the suite (including Thunder Vault's frozen math) passes before you commit.

---

### Task 1: Orb-value types + validator support multiplier gems

**Files:**
- Modify: `app/engine/types.ts` (the `OrbValueEntry` block ~51-56; `VideoFeatureState` holdAndSpin `locked` ~264; `FeatureEvent` ~356)
- Modify: `app/engine/validate.ts:148-151`
- Test: `tests/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/validate.test.ts` inside the `describe('video validation', …)` block (after the existing hold-and-spin test, ~line 162):

```ts
  it('accepts hold-and-spin multiplier orb entries', () => {
    const def = JSON.parse(JSON.stringify(THUNDER_VAULT)) as typeof THUNDER_VAULT
    def.holdAndSpin!.orbValues.push({ mult: 3, weight: 2 })
    expect(() => validateMachineDef(def)).not.toThrow()
  })

  it('rejects a multiplier orb below x2', () => {
    const def = JSON.parse(JSON.stringify(THUNDER_VAULT)) as typeof THUNDER_VAULT
    def.holdAndSpin!.orbValues.push({ mult: 1, weight: 2 })
    expect(() => validateMachineDef(def)).toThrow(/multiplier/i)
  })

  it('rejects orbValues with no credit entry', () => {
    const def = JSON.parse(JSON.stringify(THUNDER_VAULT)) as typeof THUNDER_VAULT
    def.holdAndSpin!.orbValues = [{ mult: 2, weight: 1 }]
    expect(() => validateMachineDef(def)).toThrow(/at least one credit/i)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- tests/validate.test.ts`
Expected: the three new tests FAIL — currently a `{ mult }` entry is a TS error and/or the validator's `credits <= 0` rule rejects multiplier entries.

- [ ] **Step 3: Update the types**

In `app/engine/types.ts`, replace the `OrbValueEntry` interface (~51-56) with:

```ts
/** A credit gem: sticks a credit value to its cell. */
export interface OrbCreditEntry {
  /** credits at maxCoins bet */
  credits: number
  weight: number
  label?: 'mini' | 'minor' | 'major'
}

/** A Gargoyle's-Eye-style gem: carries an additive multiplier face, no credits. */
export interface OrbMultiplierEntry {
  /** additive multiplier face (>= 2); collected faces sum and scale the credit total */
  mult: number
  weight: number
}

export type OrbValueEntry = OrbCreditEntry | OrbMultiplierEntry
```

In the same file, widen the `holdAndSpin` `locked` cell type in `VideoFeatureState` (~262-267):

```ts
  | {
    kind: 'holdAndSpin'
    /** 15 cells (cell = reel*3 + row); null = unlocked. A cell is a credit gem or a multiplier gem. */
    locked: ({ credits: number, label?: 'mini' | 'minor' | 'major' } | { mult: number } | null)[]
    respins: number
    coins: number
  }
```

And add one variant to the `FeatureEvent` union (after the `orbs-locked` line ~356):

```ts
    | { type: 'mult-orbs-locked', cells: number[], mults: number[] }
```

- [ ] **Step 4: Update the validator**

In `app/engine/validate.ts`, replace the `orbValues` checks (lines 148-151):

```ts
        if (h.orbValues.length === 0) errors.push('holdAndSpin.orbValues must not be empty')
        let creditEntryCount = 0
        h.orbValues.forEach((v, i) => {
          if ('mult' in v) {
            if (v.mult < 2) errors.push(`holdAndSpin.orbValues[${i}]: multiplier mult must be >= 2`)
            if (v.weight <= 0) errors.push(`holdAndSpin.orbValues[${i}]: weight must be > 0`)
          } else {
            creditEntryCount++
            if (v.credits <= 0 || v.weight <= 0) errors.push(`holdAndSpin.orbValues[${i}]: credits and weight must be > 0`)
          }
        })
        if (creditEntryCount === 0) errors.push('holdAndSpin.orbValues must contain at least one credit entry')
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- tests/validate.test.ts`
Expected: PASS (new tests + all existing validator tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Thunder Vault's existing `{ credits, weight, label? }` entries remain valid `OrbCreditEntry`s.)

- [ ] **Step 7: Commit**

```bash
git add app/engine/types.ts app/engine/validate.ts tests/validate.test.ts
git commit -m "Orb-value types + validator support multiplier gems"
```

---

### Task 2: Engine — additive multiplier collect

**Files:**
- Modify: `app/engine/video.ts` (`DrawnOrb` ~8-12, `drawOrbValue` ~15-28, `videoBaseSpin` trigger ~124-132, `holdAndSpinRespin` ~189-268)
- Test: `tests/video.test.ts`

- [ ] **Step 1: Write the failing tests**

Append a new `describe` to `tests/video.test.ts` (after the existing `describe('hold-and-spin', …)`):

```ts
describe("hold-and-spin multiplier (Gargoyle's Eye)", () => {
  const MULT_DEF = {
    id: 'test-mult', name: 'Test Mult', family: 'video',
    denominationCents: 1, maxCoins: 5,
    symbols: { AA: { label: 'Ace' }, OR: { label: 'Orb' }, EM: { label: 'Empty' } },
    strips: [
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA']
    ],
    betMode: {
      kind: 'lines',
      lines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]]
    },
    fixedBet: true, wildSymbol: null, scatter: null, freeSpins: null,
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 6, respins: 3,
      respinOrbNumer: 2, respinOrbDenom: 24,
      // weight total 2: raw<0.5 -> credits(25), raw>=0.5 -> mult x2
      orbValues: [{ credits: 25, weight: 1 }, { mult: 2, weight: 1 }],
      emptySymbol: 'EM'
    },
    paytable: [],
    progressive: { kind: 'percent', reset: 5000, max: 50000, feedRate: 0.01 },
    history: 'test'
  } as unknown as VideoMachineDef

  const HIT = 0.01   // floor(0.01*24)=0 < 2 -> orb lands
  const MISS = 0.5   // floor(0.5*24)=12 -> no orb
  const CREDIT = 0.25 // floor(0.25*2)=0 -> credit entry
  const MULT = 0.75   // floor(0.75*2)=1 -> multiplier entry

  // reels 1-3 stop at 5 -> windows [AA,OR,OR] -> 6 orbs at cells 1,2,4,5,7,8.
  // values: cells 1,2,4,5,7 credit; cell 8 a x2 multiplier.
  const trigger5c1m = () => {
    const state = initMachineState(MULT_DEF)
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6),
      CREDIT, CREDIT, CREDIT, CREDIT, CREDIT, MULT]
    const out = spinVideo(MULT_DEF, state, 5, scripted(draws))
    expect(out.featureEvents).toContainEqual({ type: 'orbs-locked', cells: [1, 2, 4, 5, 7], credits: [25, 25, 25, 25, 25] })
    expect(out.featureEvents).toContainEqual({ type: 'mult-orbs-locked', cells: [8], mults: [2] })
    return state
  }

  it('additively multiplies the collected credits at collect (x2 of 5 gems)', () => {
    const state = trigger5c1m()
    let out
    for (let r = 0; r < 3; r++) out = spinVideo(MULT_DEF, state, 5, scripted(new Array(9).fill(MISS)))
    // creditSum = 5*25 = 125; multiplier = 2; collected = 250
    expect(out!.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 250, filled: false })
    expect(out!.totalPayout).toBe(250)
    expect(state.videoFeature).toBeNull()
  })

  it('leaves the total unmultiplied (x1) when no multiplier gem is present', () => {
    const state = initMachineState(MULT_DEF)
    // all six triggering orbs are credits
    const draws = [at(5, 6), at(5, 6), at(5, 6), at(2, 6), at(2, 6),
      CREDIT, CREDIT, CREDIT, CREDIT, CREDIT, CREDIT]
    spinVideo(MULT_DEF, state, 5, scripted(draws))
    let out
    for (let r = 0; r < 3; r++) out = spinVideo(MULT_DEF, state, 5, scripted(new Array(9).fill(MISS)))
    expect(out!.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 150, filled: false })
  })

  it('a multiplier gem landing on a respin resets the counter', () => {
    const state = trigger5c1m()
    // cell 0 lands a multiplier; others miss
    const out = spinVideo(MULT_DEF, state, 5, scripted([HIT, MULT, ...new Array(8).fill(MISS)]))
    expect(out.featureEvents).toContainEqual({ type: 'mult-orbs-locked', cells: [0], mults: [2] })
    expect(out.featureEvents).toContainEqual({ type: 'respins-reset', respins: 3 })
  })

  it('a filled board multiplies the credits and pays a clean Grand', () => {
    const state = trigger5c1m()
    state.progressive = { kind: 'percent', value: 5000 }
    // fill all 9 remaining cells with credit orbs
    const draws: number[] = []
    for (let i = 0; i < 9; i++) draws.push(HIT, CREDIT)
    const out = spinVideo(MULT_DEF, state, 5, scripted(draws))
    // credit cells = 5 + 9 = 14 -> creditSum 350; mult 2 -> collected 700; Grand 5000 clean
    expect(out.featureEvents).toContainEqual({ type: 'hold-and-spin-ended', totalCredits: 700, filled: true })
    expect(out.wins.find(w => w.entryId === 'hold-and-spin')!.payCredits).toBe(700)
    expect(out.wins.find(w => w.entryId === 'grand')!.payCredits).toBe(5000)
    expect(out.totalPayout).toBe(700 + 5000)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- tests/video.test.ts`
Expected: the new `Gargoyle's Eye` tests FAIL (no `mult-orbs-locked` event; collect is a plain sum). The existing hold-and-spin and free-spin tests still pass.

- [ ] **Step 3: Update `DrawnOrb`, `drawOrbValue`, and add a lock helper**

In `app/engine/video.ts`, replace the `DrawnOrb` interface (~8-12) and `drawOrbValue` (~14-28) with:

```ts
interface DrawnOrb {
  cell: number
  credits?: number
  label?: 'mini' | 'minor' | 'major'
  mult?: number
}

type LockedCell = { credits: number, label?: 'mini' | 'minor' | 'major' } | { mult: number }

function lockedCell(o: DrawnOrb): LockedCell {
  return o.mult !== undefined ? { mult: o.mult } : { credits: o.credits!, label: o.label }
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
    if (pick < acc) return 'mult' in e ? { cell, mult: e.mult } : { cell, credits: e.credits, label: e.label }
  }
  const last = table[table.length - 1]!
  return 'mult' in last ? { cell, mult: last.mult } : { cell, credits: last.credits, label: last.label }
}
```

- [ ] **Step 4: Update the trigger lock (`videoBaseSpin`)**

In `app/engine/video.ts`, replace the hold-and-spin trigger branch (~124-132):

```ts
  } else if (def.holdAndSpin !== null && ev.orbs.length >= def.holdAndSpin.triggerCount) {
    const locked: (LockedCell | null)[] = new Array(15).fill(null)
    for (const o of ev.orbs) locked[o.cell] = lockedCell(o)
    state.videoFeature = { kind: 'holdAndSpin', locked, respins: def.holdAndSpin.respins, coins }
    const creditOrbs = ev.orbs.filter(o => o.mult === undefined)
    const multOrbs = ev.orbs.filter(o => o.mult !== undefined)
    if (creditOrbs.length > 0) {
      featureEvents.push({ type: 'orbs-locked', cells: creditOrbs.map(o => o.cell), credits: creditOrbs.map(o => o.credits!) })
    }
    if (multOrbs.length > 0) {
      featureEvents.push({ type: 'mult-orbs-locked', cells: multOrbs.map(o => o.cell), mults: multOrbs.map(o => o.mult!) })
    }
  }
```

- [ ] **Step 5: Update the respin lock + collect (`holdAndSpinRespin`)**

In `app/engine/video.ts`, replace the body from the cell loop through the win push (~198-248) with:

```ts
  const newCreditCells: number[] = []
  const newCredits: number[] = []
  const newMultCells: number[] = []
  const newMults: number[] = []

  for (let cell = 0; cell < 15; cell++) {
    if (feature.locked[cell] !== null) continue
    const raw = rand()
    const value = Math.floor(raw * cfg.respinOrbDenom)
    draws.push({ label: `cell${cell}-respin`, raw, value, range: cfg.respinOrbDenom })
    if (value < cfg.respinOrbNumer) {
      const orb = drawOrbValue(def, rand, draws, cell)
      feature.locked[cell] = lockedCell(orb)
      if (orb.mult !== undefined) { newMultCells.push(cell); newMults.push(orb.mult) }
      else { newCreditCells.push(cell); newCredits.push(orb.credits!) }
    }
  }

  const lockedCount = feature.locked.filter(c => c !== null).length
  const landed = newCreditCells.length + newMultCells.length
  let ended = false
  if (landed > 0) {
    feature.respins = cfg.respins
    if (newCreditCells.length > 0) featureEvents.push({ type: 'orbs-locked', cells: newCreditCells, credits: newCredits })
    if (newMultCells.length > 0) featureEvents.push({ type: 'mult-orbs-locked', cells: newMultCells, mults: newMults })
    featureEvents.push({ type: 'respins-reset', respins: cfg.respins })
    if (lockedCount === 15) ended = true
  } else {
    feature.respins -= 1
    featureEvents.push({ type: 'respin-missed', remaining: feature.respins })
    if (feature.respins <= 0) ended = true
  }

  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []
  if (ended) {
    let creditSum = 0
    let multSum = 0
    for (const c of feature.locked) {
      if (c === null) continue
      if ('mult' in c) multSum += c.mult
      else creditSum += c.credits
    }
    const multiplier = multSum > 0 ? multSum : 1
    const totalCredits = creditSum * multiplier
    const filled = lockedCount === 15
    wins.push({
      line: 'hold-and-spin', entryId: 'hold-and-spin', symbols: [],
      payCredits: totalCredits, wildCount: 0, progressive: false
    })
    // validator invariant: holdAndSpin machines always carry a percent progressive
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
```

(Leave the grid render and the `return` block below unchanged — multiplier cells render as the orb symbol in the respin grid; the lock-board UI shows the ×N in Task 6.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test -- tests/video.test.ts`
Expected: PASS — new `Gargoyle's Eye` tests and all existing hold-and-spin/free-spin tests (Thunder Vault's collect is unchanged: no multiplier gems → multiplier 1).

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck` (expect no errors), then:

```bash
git add app/engine/video.ts tests/video.test.ts
git commit -m "Engine: additive Gargoyle's Eye multiplier at hold-and-spin collect"
```

---

### Task 3: Exact-RTP — feature math with multiplier orbs

**Files:**
- Modify: `app/engine/videoRtp.ts:415-455` (the `def.holdAndSpin !== null` block)
- Test: `tests/videoRtp.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/videoRtp.test.ts`. First extend the import on line 2 to pull in `LINES25`:

```ts
import { hnsFinalDist, videoExactRtp } from '../app/engine/videoRtp'
import { LINES25 } from '../app/engine/videoAwards'
```

Then append:

```ts
describe('videoExactRtp — hold-and-spin multiplier orbs', () => {
  // Base game pays nothing (anchor reel 1 is all orbs, never a paytable symbol).
  // Reels 1-3 are all-orb -> every window shows 9 orbs -> T = 9 with probability 1.
  // respinOrbNumer = 0 -> the feature never grows: final k = 9, no Grand.
  // orbValues: credit 100 (weight 3) + mult x2 (weight 1) -> pMult = 1/4.
  const MULT_RTP_DEF = {
    id: 'hand-hns-mult', name: 'Hand HNS Mult', family: 'video',
    denominationCents: 1, maxCoins: 25,
    symbols: { OR: { label: 'Orb' }, EM: { label: 'Empty' }, AA: { label: 'Ace' } },
    strips: [
      new Array(8).fill('OR'), new Array(8).fill('OR'), new Array(8).fill('OR'),
      new Array(8).fill('AA'), new Array(8).fill('AA')
    ],
    betMode: { kind: 'lines', lines: LINES25 },
    fixedBet: true, wildSymbol: null, scatter: null, freeSpins: null,
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 9, respins: 3,
      respinOrbNumer: 0, respinOrbDenom: 24,
      orbValues: [{ credits: 100, weight: 3 }, { mult: 2, weight: 1 }],
      emptySymbol: 'EM'
    },
    paytable: [],
    progressive: { kind: 'percent', reset: 0, max: 0, feedRate: 0.01 },
    history: 'test'
  } as unknown as VideoMachineDef

  const choose = (n: number, k: number) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c }

  it('matches an independent combinatorial reference (additive multiplier, k=9 fixed)', () => {
    const r = videoExactRtp(MULT_RTP_DEF, {})
    // E[F] = sum_{j=0..9} C(9,j) p^j (1-p)^(9-j) * (9-j)*100 * (j ? 2j : 1), p = 1/4
    const p = 1 / 4
    let EF = 0
    for (let j = 0; j <= 9; j++) {
      const pj = choose(9, j) * p ** j * (1 - p) ** (9 - j)
      const M = j === 0 ? 1 : 2 * j
      EF += pj * (9 - j) * 100 * M
    }
    expect(r.rtpPerCoin).toBeCloseTo(EF / 25, 10)
    const hns = r.breakdown.find(b => b.entryId === 'hold-and-spin')!
    expect(hns.probability).toBeCloseTo(1, 12) // always triggers
  })

  it('reduces to the plain credit sum when there are no multiplier orbs', () => {
    const def = JSON.parse(JSON.stringify(MULT_RTP_DEF)) as VideoMachineDef
    def.holdAndSpin!.orbValues = [{ credits: 100, weight: 1 }]
    const r = videoExactRtp(def, {})
    // no multipliers, k = 9 -> E[F] = 9 * 100 = 900
    expect(r.rtpPerCoin).toBeCloseTo(9 * 100 / 25, 10)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- tests/videoRtp.test.ts`
Expected: the first new test FAILS (current code treats every orb as a credit at mean `muV`, ignoring multiplier semantics). The reduction test may pass (no multipliers).

- [ ] **Step 3: Replace the hold-and-spin EV block**

In `app/engine/videoRtp.ts`, replace the entire `if (def.holdAndSpin !== null) { … }` block (lines 415-455) with:

```ts
  if (def.holdAndSpin !== null) {
    const cfg = def.holdAndSpin
    const wsum = cfg.orbValues.reduce((s, e) => s + e.weight, 0)
    const creditEntries = cfg.orbValues.filter(e => !('mult' in e)) as { credits: number, weight: number }[]
    const multEntries = cfg.orbValues.filter(e => 'mult' in e) as { mult: number, weight: number }[]
    const cw = creditEntries.reduce((s, e) => s + e.weight, 0)
    const mw = multEntries.reduce((s, e) => s + e.weight, 0)
    const pMult = mw / wsum
    // moments conditional on the orb's kind
    const muC = cw === 0 ? 0 : creditEntries.reduce((s, e) => s + e.credits * e.weight, 0) / cw
    const m2C = cw === 0 ? 0 : creditEntries.reduce((s, e) => s + e.credits * e.credits * e.weight, 0) / cw
    const varC = m2C - muC * muC
    const muF = mw === 0 ? 0 : multEntries.reduce((s, e) => s + e.mult * e.weight, 0) / mw
    const m2F = mw === 0 ? 0 : multEntries.reduce((s, e) => s + e.mult * e.mult * e.weight, 0) / mw
    const varF = m2F - muF * muF

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
        // condition on j = number of multiplier cells among k ~ Binomial(k, pMult).
        // credit sum C over (k-j) cells is independent of the multiplier M over j
        // cells given j; M = sum of faces (>= 1 when j >= 1, else 1).
        const jpmf = binomPmf(k, pMult)
        let EF = 0
        let EF2 = 0
        for (let j = 0; j <= k; j++) {
          const pj = jpmf[j]!
          if (pj === 0) continue
          const nc = k - j
          const EC = nc * muC
          const EC2 = nc * varC + EC * EC
          const EM = j === 0 ? 1 : j * muF
          const EM2 = j === 0 ? 1 : j * varF + EM * EM
          const EFj = EC * EM + g
          const EF2j = EC2 * EM2 + 2 * g * EC * EM + g * g
          EF += pj * EFj
          EF2 += pj * EF2j
        }
        EFt += pk * EF
        EFt2 += pk * EF2
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
```

(Reduction guarantee: with no multiplier entries `pMult = 0`, so `binomPmf(k, 0) = [1, 0, …]`, `j ≡ 0`, `EM = EM2 = 1`, giving `EFj = k·muC + g` and `EF2j = k·varC + (k·muC + g)²` — byte-identical to the previous closed form.)

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `pnpm test -- tests/videoRtp.test.ts`
Expected: PASS (combinatorial-reference + reduction tests).

- [ ] **Step 5: Run the Thunder Vault regression to verify its frozen math is unchanged**

Run: `pnpm test -- tests/machines-video.test.ts tests/videoRtp.test.ts tests/exactRtp.test.ts`
Expected: PASS — Thunder Vault still reports `RTP 90.294753%`, `HF 41.289906%`, `variance 29.259962`, `P(trigger) 449/55296`, feature slice `31.837642%`. (This is the regression proof.)

- [ ] **Step 6: Commit**

```bash
git add app/engine/videoRtp.ts tests/videoRtp.test.ts
git commit -m "Exact video RTP: multiplier-orb feature moments (reduces to credit-only form)"
```

---

### Task 4: Theming — gem icons + marquee

**Files:**
- Modify: `app/components/game/symbols/registry.ts` (add to `SYMBOL_ART`, before the closing `}` ~52)
- Modify: `app/components/game/marquee/art.ts:12` (add an entry)
- Test: `tests/components/iconCoverage.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/components/iconCoverage.test.ts` inside the `describe('icon coverage', …)` block:

```ts
  it('resolves the Ruby of Gargoyle gem icons', () => {
    for (const id of ['gargoyle', 'ruby', 'chalice', 'crown', 'gargoyle-eye']) {
      expect(symbolArt(id), id).not.toBeNull()
    }
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/components/iconCoverage.test.ts`
Expected: FAIL — those five icon ids are not in the registry.

- [ ] **Step 3: Add the icons**

In `app/components/game/symbols/registry.ts`, add these entries to `SYMBOL_ART` just before the closing brace (after the `'orb'` entry, ~line 52). House style: 24×24 viewBox, filled duotone, no `<svg>` wrapper. (Art is functional and on-style; a designer may refine later.)

```ts
  ,
  // ---- Ruby of Gargoyle ----
  'gargoyle': { kind: 'svg', body: '<path d="M4 13c-1-5 3-9 8-9s9 4 8 9c-1 4-4 7-8 7s-7-3-8-7z" fill="#64748b"/><path d="M5 5l3 3-3 1zM19 5l-3 3 3 1z" fill="#475569"/><circle cx="9" cy="12" r="1.4" fill="#1e293b"/><circle cx="15" cy="12" r="1.4" fill="#1e293b"/><path d="M8 16c2 2 6 2 8 0l-2-1.4-2 1-2-1z" fill="#334155"/>' },
  'ruby': { kind: 'svg', body: '<path d="M6 4h12l4 6-10 10L2 10z" fill="#f43f5e"/><path d="M6 4l-4 6h20l-4-6M12 20 8 10h8z" fill="#be123c"/><path d="M9 6l-1.5 4h3z" fill="#fecdd3"/>' },
  'chalice': { kind: 'svg', body: '<path d="M6.5 4h11c0 5.5-2.2 8.5-5.5 8.5S6.5 9.5 6.5 4z" fill="#fcd34d"/><path d="M8 4h8c0 4-1.6 6.5-4 6.5S8 8 8 4z" fill="#b45309"/><path d="M11 12.5h2V18h-2z" fill="#b45309"/><path d="M7 18h10v2.2H7z" fill="#fbbf24"/>' },
  'crown': { kind: 'svg', body: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="#fbbf24"/><path d="M5 19h14l.5-3H4.5z" fill="#b45309"/><circle cx="3" cy="8" r="1.4" fill="#fde68a"/><circle cx="21" cy="8" r="1.4" fill="#fde68a"/><circle cx="12" cy="4.5" r="1.4" fill="#fde68a"/>' },
  'gargoyle-eye': { kind: 'svg', body: '<circle cx="12" cy="12" r="8.5" fill="#7f1d1d"/><ellipse cx="12" cy="12" rx="7.5" ry="4.6" fill="#ef4444"/><circle cx="12" cy="12" r="2.6" fill="#1c0a0a"/><circle cx="10.3" cy="10.3" r="1" fill="#fecaca"/>' }
```

- [ ] **Step 4: Add the marquee entry**

In `app/components/game/marquee/art.ts`, add a line to `MACHINE_ART` (after the `'stock-rush'` entry, line 12 — add a comma to the prior line):

```ts
  'ruby-of-gargoyle': { accent: '#e11d48', heroIcon: 'gargoyle', tagline: "Hold & Spin · Gargoyle's Eye Multiplier" }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- tests/components/iconCoverage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/components/game/symbols/registry.ts app/components/game/marquee/art.ts tests/components/iconCoverage.test.ts
git commit -m "Theming: Ruby of Gargoyle gem icons + marquee art"
```

---

### Task 5: The machine — define, calibrate, freeze, register

**Files:**
- Create: `app/machines/ruby-of-gargoyle.ts`
- Modify: `app/machines/index.ts`
- Test: `tests/machines-video.test.ts`, `tests/machines-pachislo.test.ts:23-28`, `tests/simulate.test.ts:14-16`

- [ ] **Step 1: Create the machine definition (starting values)**

Create `app/machines/ruby-of-gargoyle.ts`. Strips relabel Thunder Vault's proven layout (VA→GA, LT→CH, GB→CR, OR→RU) so the trigger distribution starts identical; `orbValues` adds the multiplier gems on top of the credit tiers (these weights are the calibration starting point — Step 3 tunes them):

```ts
import type { VideoMachineDef } from '../engine/types'
import { LINES25 } from '../engine/videoAwards'

const R1 = ['RU', 'RU', 'AA', 'JJ', 'KK', 'QQ', 'CR', 'JJ', 'AA', 'QQ', 'KK', 'CH', 'GA', 'AA', 'JJ', 'KK', 'QQ', 'CR', 'AA', 'KK', 'JJ', 'CH', 'QQ', 'GA']
const R2 = ['RU', 'RU', 'AA', 'JJ', 'QQ', 'KK', 'CR', 'RU', 'AA', 'JJ', 'QQ', 'CH', 'KK', 'AA', 'JJ', 'QQ', 'GA', 'CR', 'KK', 'AA', 'JJ', 'QQ', 'CH', 'GA']

/**
 * Hold-and-spin jewel machine (Dragon Link lineage): a lean 25-line base game
 * funds a ruby lock-and-collect feature; 6+ rubies lock and start 3 respins,
 * every new gem resets the counter, filling all 15 perches pays the percent-fed
 * Grand. Signature twist: the Gargoyle's Eye multiplier gem — ×2/×3 faces ADD
 * and scale the collected ruby credits at collect; the Grand pays clean.
 *
 * Frozen exact math: see tests/machines-video.test.ts (calibrated to the
 * ~90% RTP / high-volatility band, verified by exactRtp + pnpm verify).
 */
export const RUBY_OF_GARGOYLE: VideoMachineDef = {
  id: 'ruby-of-gargoyle',
  name: 'Ruby of Gargoyle',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    GA: { label: 'Gargoyle', icon: 'gargoyle' },
    CH: { label: 'Chalice', icon: 'chalice' },
    CR: { label: 'Crown', icon: 'crown' },
    AA: { label: 'Ace', icon: 'ace' },
    KK: { label: 'King', icon: 'king' },
    QQ: { label: 'Queen', icon: 'queen' },
    JJ: { label: 'Jack', icon: 'jack' },
    RU: { label: 'Ruby', icon: 'ruby' },
    EM: { label: 'Empty', icon: 'blank' }
  },
  strips: [R1, R2, R1, R2, R1],
  betMode: { kind: 'lines', lines: LINES25 },
  fixedBet: true,
  wildSymbol: null,
  scatter: null,
  freeSpins: null,
  holdAndSpin: {
    orbSymbol: 'RU',
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
      { credits: 2500, weight: 1, label: 'major' },
      { mult: 2, weight: 5 },
      { mult: 3, weight: 2 }
    ],
    emptySymbol: 'EM'
  },
  paytable: [
    { id: 'ga3', symbol: 'GA', length: 3, pay: 100 },
    { id: 'ga4', symbol: 'GA', length: 4, pay: 400 },
    { id: 'ga5', symbol: 'GA', length: 5, pay: 1600 },
    { id: 'ch3', symbol: 'CH', length: 3, pay: 60 },
    { id: 'ch4', symbol: 'CH', length: 4, pay: 200 },
    { id: 'ch5', symbol: 'CH', length: 5, pay: 640 },
    { id: 'cr3', symbol: 'CR', length: 3, pay: 40 },
    { id: 'cr4', symbol: 'CR', length: 4, pay: 130 },
    { id: 'cr5', symbol: 'CR', length: 5, pay: 400 },
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
  progressive: { kind: 'percent', reset: 5000, max: 50_000, feedRate: 0.01 },
  history: 'A moonlit cathedral whose gargoyles guard a hoard of gems. The '
    + 'hold-and-spin lineage that conquered floors after 2017, here with a '
    + 'twist: the Gargoyle\'s Eye gem multiplies the rubies you collect. Six '
    + 'rubies lock and grant three respins; every gem resets the count; the '
    + 'Eye gems\' faces add and scale the haul; fill all fifteen perches and '
    + 'the Grand — fed by 1% of every bet — pays in full.'
}
```

- [ ] **Step 2: Register in `FLOOR`**

In `app/machines/index.ts`, import and insert `RUBY_OF_GARGOYLE` right after `THUNDER_VAULT` (keeps the video family grouped):

```ts
import { THUNDER_VAULT } from './thunder-vault'
import { RUBY_OF_GARGOYLE } from './ruby-of-gargoyle'
```

```ts
export const FLOOR: MachineDef[] = [
  CANAL_ROYALE,
  DRAGONS_HOARD,
  THUNDER_VAULT,
  RUBY_OF_GARGOYLE,
  DIAMOND_DOUBLER,
  SEVENS_ABLAZE,
  SERIES_E_3LINE,
  SERIES_E_MULTIPLIER,
  STOCK_RUSH
]
```

- [ ] **Step 3: Calibrate to the ~90% band (temporary probe)**

Add a temporary probe to `tests/machines-video.test.ts` (top-level, after the imports) to print the live numbers:

```ts
import { RUBY_OF_GARGOYLE } from '../app/machines/ruby-of-gargoyle'

describe.only('ruby probe', () => {
  it('prints exact figures', () => {
    const r = exactRtp(RUBY_OF_GARGOYLE)
    // eslint-disable-next-line no-console
    console.log('RUBY', JSON.stringify({ rtp: r.rtpPerCoin, hf: r.hitFrequency, varr: r.variancePerCoin,
      hns: r.breakdown.find(b => b.entryId === 'hold-and-spin'), grand: r.breakdown.find(b => b.entryId === 'grand') }, null, 2))
    expect(validateMachineDef(RUBY_OF_GARGOYLE)).toBeUndefined()
  })
})
```

Run: `pnpm test -- tests/machines-video.test.ts`
Read the printed `rtp`. **Acceptance:** `rtpPerCoin ∈ [0.895, 0.905]`. The multiplier adds feature EV, so the starting values likely print **above** 0.905 — if so, trim until in band by (in order of preference): lowering the `{ mult: 3, weight }` / `{ mult: 2, weight }` weights, then shaving the high credit tiers (`250`, `625`, `2500`) weights. Re-run after each change. Do **not** touch the strips (keep the trigger frequency near Thunder Vault's). Iterate until in band.

- [ ] **Step 4: Freeze the calibrated numbers**

Delete the `describe.only('ruby probe', …)` block. Add a real frozen block to `tests/machines-video.test.ts` (copy the exact printed decimals into the `toBeCloseTo` calls — these are measured constants, the repo's "compute, never assert" discipline):

```ts
describe('ruby-of-gargoyle — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(RUBY_OF_GARGOYLE)).not.toThrow()
  })

  it('RTP sits in the ~90% band with a clean Grand split', () => {
    const r = exactRtp(RUBY_OF_GARGOYLE)
    expect(r.rtpPerCoin).toBeGreaterThan(0.895)
    expect(r.rtpPerCoin).toBeLessThan(0.905)
    const hns = r.breakdown.find(b => b.entryId === 'hold-and-spin')!
    const grand = r.breakdown.find(b => b.entryId === 'grand')!
    expect(hns).toBeTruthy()
    expect(grand).toBeTruthy()
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 9)
  })

  it('FROZEN: exact figures (fill from the Step 3 probe output)', () => {
    const r = exactRtp(RUBY_OF_GARGOYLE)
    expect(r.rtpPerCoin).toBeCloseTo(/* PASTE printed rtp */ 0, 6)
    expect(r.hitFrequency).toBeCloseTo(/* PASTE printed hf */ 0, 6)
    expect(r.variancePerCoin).toBeCloseTo(/* PASTE printed varr */ 0, 4)
  })

  it('a higher Grand meter raises RTP by P(fill) * dMeter / bet', () => {
    const atReset = exactRtp(RUBY_OF_GARGOYLE)
    const grown = exactRtp(RUBY_OF_GARGOYLE, { progressiveValues: { meter: 30000 } })
    const pFill = atReset.breakdown.find(b => b.entryId === 'grand')!.probability
    expect(grown.rtpPerCoin - atReset.rtpPerCoin).toBeCloseTo(pFill * 25000 / 25, 8)
  })
})
```

Replace each `/* PASTE … */ 0` with the value printed in Step 3.

- [ ] **Step 5: Update the floor-count assertions**

In `tests/machines-pachislo.test.ts`, replace the body of the "floor is complete" test (lines 23-28):

```ts
    expect(FLOOR).toHaveLength(9)
    expect(new Set(FLOOR.map(m => m.id)).size).toBe(9)
    for (const def of FLOOR) expect(() => validateMachineDef(def)).not.toThrow()
    expect(FLOOR.map(m => m.family)).toEqual([
      'video', 'video', 'video', 'video', 'stepper', 'stepper', 'bally-em', 'bally-em', 'pachislo'
    ])
```

(Also update the test title text `8 machines` → `9 machines` on line 22.)

In `tests/simulate.test.ts`, replace the id list (lines 14-16) and the title (line 13 `eight` → `nine`):

```ts
    expect(FLOOR.map(m => m.id).sort()).toEqual([
      'canal-royale', 'diamond-doubler', 'dragons-hoard', 'ruby-of-gargoyle', 'series-e-3line', 'series-e-multiplier', 'sevens-ablaze', 'stock-rush', 'thunder-vault'
    ])
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm test`
Expected: PASS — Ruby frozen tests, floor-count tests, icon coverage (Ruby's icons exist from Task 4), and all unchanged suites including Thunder Vault's frozen math.

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`, then:

```bash
git add app/machines/ruby-of-gargoyle.ts app/machines/index.ts tests/machines-video.test.ts tests/machines-pachislo.test.ts tests/simulate.test.ts
git commit -m "Add Ruby of Gargoyle machine (frozen calibration) and register on the floor"
```

---

### Task 6: UI — render the multiplier gem on the lock board

**Files:**
- Modify: `app/components/game/ReelVideo.vue` (script ~1-42; lock-board template 71-101)
- Modify: `app/stores/slots.ts:502-507` (announcer)
- Test: `tests/components/reelVideo.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/components/reelVideo.test.ts` inside `describe('ReelVideo', …)`:

```ts
  it('renders a multiplier gem on the lock board', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('thunder-vault')
    store.currentState!.videoFeature = {
      kind: 'holdAndSpin',
      locked: [{ mult: 2 }, { credits: 25 }, ...new Array(13).fill(null)],
      respins: 3,
      coins: 25
    }
    const wrapper = mount(ReelVideo, {
      global: {
        components: { GameReelColumn },
        stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: IconStub, GamePaylineOverlay: OverlayStub }
      }
    })
    const board = wrapper.find('[data-test="lock-board"]')
    expect(board.exists()).toBe(true)
    expect(board.text()).toContain('×2')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/components/reelVideo.test.ts`
Expected: FAIL — the lock board reads `.credits` on every cell; a `{ mult }` cell renders nothing / throws.

- [ ] **Step 3: Add a cell-display helper in the script**

In `app/components/game/ReelVideo.vue`, add to the `<script setup>` block (after `const hns = …` ~line 13):

```ts
type LockCell = { credits: number, label?: string } | { mult: number } | null
function lockText(cell: LockCell): { mult: boolean, text: string, label?: string } | null {
  if (cell === null) return null
  if ('mult' in cell) return { mult: true, text: `×${cell.mult}` }
  return { mult: false, text: formatCredits(cell.credits), label: cell.label }
}
```

- [ ] **Step 4: Update the lock-board template**

Replace the lock-board cell `<template>` contents (lines 81-99) so each cell renders via `lockText`:

```vue
        <div
          v-for="row in 3"
          :key="`${r}:${row}`"
          class="h-16 rounded-lg flex items-center justify-center font-mono text-sm border"
          :class="hns.locked[(r - 1) * 3 + (row - 1)]
            ? (lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.mult
              ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
              : 'bg-sky-500/15 border-sky-500/50 text-sky-200')
            : 'bg-neutral-950 border-neutral-800 text-neutral-700'"
        >
          <template v-if="lockText(hns.locked[(r - 1) * 3 + (row - 1)])">
            <span :class="lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.mult ? 'font-bold' : ''">
              {{ lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.text }}
            </span>
            <span
              v-if="lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.label"
              class="ml-1 uppercase text-[9px] text-amber-300"
            >
              {{ lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.label }}
            </span>
          </template>
          <span v-else>·</span>
        </div>
```

- [ ] **Step 5: Announce multiplier locks (a11y)**

In `app/stores/slots.ts`, in the feature-event loop (~502-507), add after the `orbs-locked` line:

```ts
        if (e.type === 'mult-orbs-locked') parts.push(`${e.mults.map(m => `times ${m}`).join(' ')} multiplier locked.`)
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test -- tests/components/reelVideo.test.ts`
Expected: PASS (new multiplier-gem test + the two existing ReelVideo tests).

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`, then:

```bash
git add app/components/game/ReelVideo.vue app/stores/slots.ts tests/components/reelVideo.test.ts
git commit -m "UI: render Gargoyle's Eye multiplier gems on the lock board + announce them"
```

---

### Task 7: Docs & branding — count, OG image, README, CHANGELOG

**Files:**
- Modify: `public/og-image.svg:172`; regenerate `public/og-image.png`
- Modify: `nuxt.config.ts:23,30`
- Modify: `README.md` (lines 13, 41-50 table, 93, 102-114 verify table, + new section)
- Modify: `CHANGELOG.md`, `package.json:version`

- [ ] **Step 1: OG image — bump the machine count**

In `public/og-image.svg:172`, change `eight machines` to `nine machines`:

```
<text x="66" y="162" font-family="-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" font-size="21" fill="#64748b" letter-spacing="1">Telnaes virtual reels &#183; exact-enumeration RTP &#183; nine machines</text>
```

- [ ] **Step 2: Regenerate the PNG**

Run: `which rsvg-convert || brew install librsvg`
Then: `rsvg-convert -w 1200 -h 630 public/og-image.svg -o public/og-image.png`
Expected: `public/og-image.png` rewritten (1200×630). Verify: `file public/og-image.png` → `PNG image data, 1200 x 630`.

- [ ] **Step 3: Social meta**

In `nuxt.config.ts`, change `eight authentic machine archetypes` to `nine authentic machine archetypes` on **both** lines 23 (`og:description`) and 30 (`twitter:description`).

- [ ] **Step 4: README — count, table row, verify count**

In `README.md`:

Line 13: `eight machines` → `nine machines`.

Add a row to the floor table after the Thunder Vault row (line 49):

```
| Ruby of Gargoyle | Video (lines) | 5 reels x 24 stops, 25-line, hold & spin, Gargoyle's Eye ×N multiplier, Grand progressive | ~90% @ Grand reset (see frozen test) |
```

Line 93: `pnpm verify` now covers `8 machines` → `9 machines`.

- [ ] **Step 5: README — add the verify table row**

Run `pnpm verify` (it now includes Ruby). From its output, copy the `ruby-of-gargoyle` line into the fenced table in `README.md` (after the `thunder-vault` row, line 108), matching the column alignment. (If `pnpm verify` is slow, `pnpm verify -- --spins 1000000` is fine for the README snapshot; note the spin count stays 5M in the caption.)

- [ ] **Step 6: README — add the Future variants section**

Insert a new section after "## The floor" (before "## Stepper", ~line 55):

```markdown
## Future variants

Planned machines (see `docs/superpowers/specs/2026-06-14-future-games-roadmap.md`):

- **Five Card Charlie** *(working title; also "Hit Me")* — a press-your-luck
  blackjack on five reels. Spin a card per reel; stand or hit again; bust over
  21 and lose the hand. Multiplier/bonus cards tempt you to hit even on a strong
  total, and surviving all five reels is the five-card Charlie bonus. A new
  family: sequential reveal + player stop-decisions + hand evaluation, with RTP
  computed under optimal stopping strategy (video-poker-style).
- **Crash / cash-out** — a stop-or-bust machine (the flameout-family mechanic):
  each stop banks credits, a bad stop forfeits the lot. Distinct from pachislo
  skill-stop, where wins are protected.
- **Authentic 4-tier progressives** — Mini/Minor/Major/Grand as scaling pools,
  generalizing the single-meter progressive system.
```

- [ ] **Step 7: CHANGELOG + version bump**

In `CHANGELOG.md`, replace the `## [Unreleased]` heading with a new release block (keep any genuinely-unreleased items, then the new version):

```markdown
## [0.5.0] - 2026-06-14

### Added
- Ruby of Gargoyle: a gothic hold-and-spin jewel machine (video family, ninth on
  the floor) with the Gargoyle's Eye multiplier gem — ×2/×3 faces that ADD and
  scale the collected ruby credits at collect; the Grand pays clean.
- Engine: orb values may be credit gems or multiplier gems; the exact-RTP feature
  moments condition on the multiplier-cell count and provably reduce to the
  credit-only closed form (Thunder Vault's frozen math is unchanged).
- Docs: future-games roadmap (blackjack-reel "Five Card Charlie", crash/cash-out,
  4-tier progressives) and a README "Future variants" section.

### Changed
- og-image, README, and social meta now read "nine machines"; `pnpm verify`
  covers 9 machines.
```

In `package.json`, bump `"version": "0.4.0"` → `"version": "0.5.0"`.

- [ ] **Step 8: Reread the whole README for order & structure**

Read `README.md` start to finish. Confirm the new "Future variants" section sits sensibly after "## The floor", the floor-table row and the verify-table row are aligned and consistent, the machine count reads "nine" everywhere, and the section order still flows (overview → playing → floor → future variants → per-family → verification → tech → sources). Fix any heading/order/wording that no longer coheres after the edits. (Standing rule: after any major doc change, reread the README end-to-end so its structure still holds.)

- [ ] **Step 9: Verify the docs are consistent**

Run: `grep -rn -i "eight machines\|8 machines" README.md public/og-image.svg nuxt.config.ts`
Expected: no matches (all updated to nine/9).

- [ ] **Step 10: Commit**

```bash
git add public/og-image.svg public/og-image.png nuxt.config.ts README.md CHANGELOG.md package.json
git commit -m "Docs & branding: nine machines, Ruby on the floor, Future variants, 0.5.0"
```

---

### Task 8: Full verification + browser smoke

**Files:** none (verification only), then finish the branch.

- [ ] **Step 1: Lint, typecheck, unit tests**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all green. If `pnpm lint` flags the temporary probe leftovers, ensure the `describe.only` from Task 5 Step 3 is gone.

- [ ] **Step 2: Floor verification (the Monte-Carlo cross-check for the multiplier math)**

Run: `pnpm verify`
Expected: exit 0; every machine (now 9, including `ruby-of-gargoyle`) lands inside its 3.5-σ band — the simulated RTP agrees with the new exact closed form. If Ruby is outside the band, the closed form and the engine disagree: re-check Task 2/Task 3 before proceeding.

- [ ] **Step 3: Browser smoke (REQUIRED — green unit tests have missed render/data-shape bugs on this project)**

Run `pnpm dev`, then in the browser:
1. Open `http://localhost:3000/?m=ruby-of-gargoyle` (or pick it from the floor — confirm its marquee/tagline and gem icons render).
2. Spin until a hold-and-spin triggers (6+ rubies). Confirm the lock board appears with locked ruby credit values.
3. Confirm a **Gargoyle's Eye** gem renders as `×2`/`×3` in rose styling, distinct from credit cells.
4. Let the feature resolve; confirm the ResultBar shows the **multiplied** collect total (credits × summed multiplier), and a filled board pays the Grand on top.
5. Open **X-ray**; confirm the RNG trace shows `orb-value-cellN` draws and no console errors.
6. Capture screenshots of the lock board (with a multiplier gem) and the collect result via the `viewcap` MCP server.

- [ ] **Step 4: Final commit (if smoke surfaced fixes)**

Commit any fixes from Step 3 with a clear message. If none, skip.

- [ ] **Step 5: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill to choose how to integrate `ruby-of-gargoyle` (merge to `main` / open a PR / keep). Per project rules: commit timestamps stay outside Mon–Fri 7am–7pm before any push, and commit messages carry no AI-attribution trailer.

---

## Self-Review (completed during planning)

- **Spec coverage:** theme/symbols (Task 5), additive multiplier semantics (Tasks 2, 3), ~90% / high-vol math mirroring Thunder Vault (Task 5), the eight-file engine/UI change list from the spec (Tasks 1, 2, 3, 4, 6), validator (Task 1), exact-RTP with Thunder Vault regression (Task 3), testing incl. browser smoke (Task 8), and the user's added requirements — OG SVG+PNG, README currency + Future variants, CHANGELOG (Task 7). All covered.
- **Placeholder scan:** the only deferred constants are the calibrated RTP/HF/variance decimals (Task 5 Step 4), which are measured outputs by design — captured via an explicit probe-then-paste step, the same way the other eight machines were frozen. The band assertions (`> 0.895`, `< 0.905`) are complete and enforce correctness even before the exact freeze.
- **Type consistency:** `OrbValueEntry = OrbCreditEntry | OrbMultiplierEntry`; locked cell `{ credits, label? } | { mult } | null`; `lockedCell()`/`lockText()` helpers and the `mult-orbs-locked` event use these same shapes across engine, RTP, store, and UI.
