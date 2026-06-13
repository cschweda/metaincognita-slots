# Reel Visual Upgrade — Design

**Date:** 2026-06-13
**Status:** Approved (brainstormed via the visual companion)
**Builds on:** Plan 3 UI (v0.3.0). Engine, RTP math, PAR, and the money model are unchanged.

## Goal

Make the playing surface look and feel like a real slot machine — pictorial symbols, reels that actually spin, paylines drawn across the face — and make the outcome **persist until the next spin** instead of flashing away. The simulator stays a teaching tool: every visual is honest to the engine's result, and the result card reinforces the money story.

## Scope

**In scope (presentation only):**
- Pictorial symbol icons (filled-duotone SVG) replacing text labels on all four reel families.
- Real vertical-scroll spin animation with staggered ease-out stops (shared composable).
- Drawn winning paylines + glowing winning cells, color-coded, with left-gutter line numbers.
- A held result card (replaces the auto-hiding win banner): gross win, current bankroll, literal per-line chips, and a bankroll sparkline.
- A denomination tag by the credit meter.
- A machine marquee (game name + theme emblem) above the credit panel.

**Out of scope (do not touch):**
- Engine math, `exactRtp`, validators, simulate functions, PAR-sheet numbers.
- The cents/credits money model (we only *add* a display tag and *reuse* the existing history series).
- Pachislo skill-stop logic (`usePachisloPress`) — it keeps its press-driven motion; it only gains the new icons.
- X-ray internals (the RTP-convergence sparkline there is separate and stays).

## Locked decisions (from the visual session)

| Topic | Decision |
|---|---|
| Symbol art | Custom **filled-duotone** SVG icons, large, from a shared registry. Royals (A/K/Q/J/10), BAR, and 7 render as styled type, not SVG. |
| Spin motion | Vertical reel scroll, **smooth ease-out**, staggered stop reel-1-first, motion-blur while travelling. Reduced-motion → instant snap. |
| Sizing | Big reels — desktop tiles ~110–140px, responsive scale-down on narrow screens. |
| Paylines | Draw **winning** lines as thin (≈4px @ ~100px tile, scales with tile) color-coded polylines + glow the winning cells. Left-gutter **line numbers** at each line's entry row; stack if two share a row. Diagonals are ordinary polylines. Winning lines only on the reel; all 25 stay in the PAR sheet. |
| 243-ways machines | No single line — glow the winning symbol cluster; chip reads "<n> <Symbol> — pays any position". |
| Single-payline (stepper / Bally center) | Draw the one center line. |
| Win chips | **Words-only**, uniform width (sized to the widest), columns aligned: `[L#] [count] [Name]`. Names pluralized from the def `label`. Laid out **horizontally**, wrapping into a grid. |
| Result card | Held until the next spin. `WIN +<gross>` (credits) or `No win`; `Bankroll now <credits> · $<dollars>` (no "net" delta); chips as legend; **bankroll sparkline** on the right. Spin-start clears the prior result, lines, and glows. |
| Denomination tag | Small pill by the credit meter derived from `denominationCents`: `🪙 Penny machine · 1 credit = 1¢` / `Quarter machine · 1 credit = 25¢` / `Dollar machine · 1 credit = $1`. |
| Machine marquee | A lit topper above the credit panel: game name (gold display type) + a theme hero emblem in a glowing ring + a tagline + a gradient underline. Per-machine accent colour, hero icon, and tagline. |
| Sparkline rationale | The bankroll sparkline is the poker-style bankroll graph players read at a glance — up/down trend with no math. Net-negative drift makes the house edge visible. |

## Architecture

Each unit has one job and a clear interface. New files are small and focused; the four reel surfaces shrink as their duplicated timer/label logic moves into shared units.

### 1. Symbol icon system

**Engine type (`app/engine/types.ts`).** Extend the symbol metadata — the existing comment already anticipates this:

```ts
// before:  symbols: Record<SymbolId, { label: string }>
symbols: Record<SymbolId, { label: string, icon?: string }>
```

`icon` is a display-only semantic id (e.g. `'lion'`, `'seven'`, `'bar3'`). It is a plain string — the engine stays Vue/Nuxt-free and the CI purity grep still passes.

**Machine defs.** Tag each symbol with its `icon` id. Mapping (33 distinct ids; variants share a base with a colour/badge prop):

- Royals/type: `ace king queen jack ten` ; `seven` (+`seven-flame`, `seven-red` variants) ; `bar1 bar2 bar3` (+`bar-bonus`) ; `blank`
- Pictorial shared: `cherry plum orange watermelon bell diamond replay`
- Themed: `lion mask fan doge gondola` (Canal Royale) · `dragon phoenix koi pearl ingot` (Dragon's Hoard) · `vault lightning goldbar orb` (Thunder Vault)

**`app/components/game/symbols/registry.ts`.** The single source for icon art: a map from icon id → renderer. Pictorial ids return inline-SVG duotone markup; typographic ids (`ace`…`ten`, `seven*`, `bar*`) are flagged so `SymbolIcon` renders styled text. Includes a short **style guide** comment: 24×24 viewBox, solid fill + one darker shade, rounded forms, palette tied to Tailwind tokens. `blank`/empty renders as a faint dot.

**`app/components/game/SymbolIcon.vue`** (`<GameSymbolIcon>`). Props: `icon?`, `label`, `size`, `glow?`. Renders the registry entry; falls back to the `label` text if `icon` is missing or unknown (so nothing ever renders empty). `role="img"`, `aria-label="{label}"`. This is the only place that knows how a symbol looks.

### 2. Spin animation — `app/composables/useReelSpin.ts`

Replaces the per-surface `watch(store.spinning)` + `setTimeout` reveal in ReelVideo/Stepper/Bally (retires the long-deferred "shared reveal composable" debt).

- **Input:** reel count, and an accessor for the resolved grid (`store.lastOutcome.grid`) plus a pool of filler symbols for the spinning blur.
- **Output (reactive):** per-reel `offsetY` (px), per-reel `blur` (px), `revealed` (count of stopped reels), `spinning`.
- **Behaviour:** on `store.spinning` rising, each reel renders a tall strip = `[filler buffer…] + [the 3 resolved cells]` and animates `translateY` from 0 to the buffer height with `cubic-bezier(.16,.74,.18,1)`; durations stagger (`base + reelIndex·step`) so reels stop 1→N; blur fades out near the end. When the last reel lands, call `store.revealDone()`.
- **Reduced motion:** skip animation, set `revealed = reelCount`, call `store.revealDone()` immediately (parity with today).
- Surfaces gate cell-glow and the payline overlay on `revealed === reelCount`.

### 3. Paylines — overlay + summariser

**`app/utils/winLines.ts`.** Pure helpers:
- `pluralize(label)` — `King→Kings`, `Cherry→Cherries`, `Winged Lion→Winged Lions`, `Seven→Sevens` (handle `…y`→`…ies`, `…s/x/ch/sh`→`…es`, else `+s`).
- `summariseWins(def, outcome)` → ordered `WinLine[]` `{ lineNumber|null, count, symbolId, symbolName, pluralName, payout, pattern|null, kind: 'line'|'ways'|'single' }`, each assigned a colour by index from a fixed palette (amber, sky, fuchsia, emerald, violet, rose, …). Maps `line-N` → `def.betMode.lines[N-1]` pattern; `ways-*` → `kind:'ways'`; single payline → `kind:'single'`.

**`app/components/game/PaylineOverlay.vue`** (`<GamePaylineOverlay>`). Props: grid geometry (gutter, tile, gap, rows, cols) + `WinLine[]`. Draws an absolutely-positioned SVG: one thin, glow-filtered polyline per line through cell centres, and a colour-matched number badge in the left gutter at each line's entry row (stacking when rows collide). `ways`/`single` skip the polyline (cells still glow). `aria-hidden` (the chips carry the same info accessibly).

### 4. Result card — `app/components/game/ResultBar.vue`

Replaces `WinBanner.vue`. Visible when `!store.spinning && store.lastOutcome`; **no timeout** — it persists until `store.spinning` goes true (next spin), which also clears the reel glows/lines. Content:
- Headline: `WIN +<totalPayout>` (gross credits) on a win, else `No win`.
- `Bankroll now <creditBalance> credits · <formatCents(bankrollCents)>`.
- Chips: horizontal, uniform-width, aligned `[L#][count][Name]` legend from `summariseWins` (words-only). Losses show no chips.
- **Bankroll sparkline** (right): a small SVG polyline of the running bankroll derived from the store `history` (last ~30 records), ending at the current balance. No new store state.

### 5. Denomination tag — `app/components/game/CreditPanel.vue`

Add a pill derived from `denominationCents` via a small `denominationLabel(cents)` helper (`1→Penny…1¢`, `5→Nickel…5¢`, `25→Quarter…25¢`, `100→Dollar…$1`). Display-only.

### 6. Machine marquee — `app/components/game/MachineMarquee.vue`

A lit cabinet topper above the credit panel. `<GameMachineMarquee>` reads `store.currentDef` for the name and a small UI-side art map for the theme:

**`app/components/game/marquee/art.ts`** — `MACHINE_ART: Record<machineId, { accent: string, heroIcon: string, tagline: string }>`. `accent` is a Tailwind/hex colour token; `heroIcon` is a registry icon id (reuses `SymbolIcon`); `tagline` is a short hand-written line (e.g. "25-Line Venetian Video Slot"). Pure presentation — engine untouched. A neutral fallback (family + denomination) covers any machine missing an entry.

The component renders: a circular emblem badge (accent ring + glow) holding the hero icon, the game name in accent-gradient display type, the tagline, and a faint gradient underline. Responsive: collapses the flourish on narrow screens. `denominationCents` is *not* shown here (the credit-panel tag owns that).

### 7. Per-family wiring

- **ReelVideo / ReelStepper / ReelBally:** swap text cells for `<GameSymbolIcon>`; drive motion from `useReelSpin`; mount `<GamePaylineOverlay>` (video = lines, stepper/Bally = single/center; ways video glows clusters).
- **ReelPachislo:** swap text cells for `<GameSymbolIcon>` only. Keeps `usePachisloPress` motion and its slip annotations.
- **game.vue:** mount `<GameMachineMarquee>` at the top of the page (above `<GameCreditPanel>`); `<GameWinBanner>` → `<GameResultBar>`. Family dispatch unchanged (literal per-family tags from Plan 3).

## Data flow

`spinOnce` (unchanged) resolves `lastOutcome` and sets `spinning=true`. `useReelSpin` animates and calls `revealDone()` (sets `spinning=false`) when reels land → cell glows + `PaylineOverlay` (gated on `revealed`) + `ResultBar` appear, computed from `lastOutcome`/`bankrollCents`/`history`. They persist until the next `spinOnce` flips `spinning` true, which clears them. Reduced-motion collapses the animation but the data flow is identical.

## Accessibility & reduced motion

- Every symbol exposes `aria-label={label}`; the result and chips are real text. The drawn overlay is decorative (`aria-hidden`).
- Reduced-motion: no scroll/blur, instant reveal — already the project norm.
- Maintain AA contrast on chips, numbers, and the tag (the Plan 3 contrast bar).
- The held result re-announces via the existing live-region nonce so screen-reader users hear each outcome even on repeats.

## Testing

Component tests (happy-dom), engine suites stay node:
- `SymbolIcon`: pictorial render, royal/bar/seven as type, blank dim, **fallback to label** when `icon` missing, `aria-label`.
- `useReelSpin`: reduced-motion → instant + `revealDone` called once; stagger stops in order; `revealed` reaches reel count.
- `winLines`: `pluralize` cases; `summariseWins` for a known line win, a ways win, a single-payline win; stable colour assignment.
- `PaylineOverlay`: polyline points for `[1,1,1,1,1]` and the diagonal `[0,1,2,1,0]`; gutter number at the entry row.
- `ResultBar`: shows on resolve, **no auto-hide**, clears on spin-start; win vs `No win`; `Bankroll now` text; sparkline present; chips uniform/aligned structure.
- `denominationLabel` mapping.
- `MachineMarquee`: renders the def name + tagline; falls back gracefully when a machine has no art entry; hero icon present.

**Mandatory before "done": a live browser smoke** (chrome-devtools + viewcap) across all four families — spin each, confirm icons render, reels animate, lines draw, the result holds and clears. This is the hard lesson from Plan 3: SFC-import unit tests do not prove Nuxt render.

No engine/RTP test changes; `pnpm verify` must stay 8/8.

## Risks & mitigations

- **Spin-scroll is the most novel piece.** Keep `useReelSpin` self-contained and tested; the reduced-motion path is the safety net and matches today's behaviour exactly.
- **Icon authoring volume (~33 SVGs).** Mitigated by one shared registry, typographic royals/bars/sevens (no art), and colour/badge variants over duplicated drawings. Author subagent-driven against the style-guide comment.
- **Engine purity.** `icon` is a string on display metadata only; the CI grep stays green.
- **No silent truncation.** Sparkline window and "winning lines only on reel" are intentional; the PAR sheet remains the full reference.

## Provenance

Brainstormed 2026-06-13 with the visual companion. User choices, in order: icons = custom vector (filled duotone, sized large); spin = smooth ease-out; reels bigger; paylines drawn + glow, thinner stroke, left-gutter numbers, diagonals confirmed; chips literal/words-only/uniform-aligned then horizontal; result held with `Bankroll now` (not net); result card gains the **bankroll sparkline** (poker-style trend); machine **marquee** added (name + theme emblem); denomination tag added.

A throwaway in-browser demo (filler symbols, 9→20 demo paylines, tuned to ~48% hit / ~90% RTP) validated the feel. That demo math is **illustrative only** — the real reel surfaces render the engine's actual outcomes and the existing exact-calibrated RTP per machine; none of the demo's payout numbers ship.
