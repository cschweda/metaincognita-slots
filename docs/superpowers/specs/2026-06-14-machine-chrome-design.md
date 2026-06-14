# Per-Machine Cabinet Chrome — Design Spec

**Date:** 2026-06-14
**Status:** Approved (brainstorm) — pending spec review
**Author:** cschweda + Claude

## Summary

Make every machine feel visually its own by wrapping the **reel window** in bespoke, gaudy, "weird-Vegas" decorative **chrome** — a per-machine cabinet surround. The reels, controls, layout, store, and engine are **untouched**; the chrome is a purely decorative layer drawn *around* the existing reel window.

The motivation is a real product insight: in a play-money sim the thrill of the cash is gone, so the *spectacle* is the product. Leaning into flashy, kitschy slot-machine excess is the goal, not a compromise. A registry + default fallback means every future game gets chrome too.

## Goal & Non-Goals

**Goal:** A per-machine decorative chrome layer surrounding the reel window — nine bespoke, over-the-top frames (gothic, baroque-gold, fire-breathing dragon, neon pachinko, etc.), with ambient flair — plus a system that makes adding chrome to future machines a single drop-in module.

**Non-Goals (explicitly out of scope):**
- **No changes to the game itself** — reel surfaces (`ReelVideo/Stepper/Bally/Pachislo`), the reel grid, symbols, spin/bet controls, bet model, payouts, RNG, RTP, the store, or the engine.
- **No layout/composition changes** — controls stay exactly where they are; we are *not* moving the spin button, adding side control rails, or changing reel counts. (Those ideas were explored and set aside; "the game itself is fine — it's the chrome.")
- **No external image assets** — all chrome is hand-built CSS/SVG (keeps the strict CSP clean and the bundle light).
- No theming of the floor picker cards or history in v1 (possible later; noted under Future).

## Decisions Locked (from the visual brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | What changes | **Chrome only** — the decorative surround around the reel window; the game UI is untouched |
| 2 | Aesthetic | **Gaudy, flashy, kitschy, "weird Vegas"** — pushed deliberately over-the-top; visuals are the product |
| 3 | Coverage | **All nine machines** get bespoke chrome + a **registry & default fallback** so future games get chrome |
| 4 | Implementation medium | **Hand-built CSS/SVG only** (no external images) → CSP-clean, light bundle |
| 5 | Motion | **Ambient animation** (glow pulse, neon flicker, blinking bulbs, bobbing creatures), **gated by `prefers-reduced-motion`** |
| 6 | Accessibility | Chrome is **decorative** (`aria-hidden`, `pointer-events:none`) so the working controls and the 100/100 a11y score are unaffected |

## Architecture

A single new wrapper component surrounds the reel surface; everything else is data + presentational modules.

- **`<GameMachineChrome>` (wrapper).** Wraps the active machine's reel surface via a default `<slot/>`. It renders a positioned "stage": the bespoke chrome layers (backdrop behind + frame/ornaments around) plus the unchanged reel surface on top. The chrome layers are `aria-hidden="true"` and `pointer-events:none`, so the reel surface and controls keep their exact DOM, semantics, and clickability. The stage adds decorative padding so the frame has room around the window; the reel surface itself does not change size or behavior.
- **`ChromeFrame` (shared scaffold).** A presentational base giving every machine the same well-defined regions to fill — `backdrop`, `topper`, `left`/`right` rails, `bottom` lip, `corners`, and an `accent glow` — plus the reduced-motion handling and the responsive degradation rules in one place (DRY). Per-machine modules fill these slots with their motif.
- **Per-machine chrome modules** in `app/components/game/chrome/<machine>.vue` (e.g. `RubyOfGargoyleChrome.vue`). Each is pure SVG/CSS, self-contained, consuming its palette from the shared theme map. One responsibility: draw that machine's surround.
- **Registry** `app/components/game/chrome/registry.ts`: `chromeFor(machineId)` → the machine's chrome component via `defineAsyncComponent(() => import('./<machine>.vue'))`, falling back to **`DefaultChrome.vue`** for any machine without a bespoke module. Lazy import means only the active machine's chrome enters the bundle at runtime.
- **Theme map** `app/components/game/chrome/theme.ts`: a per-machine palette (`accent`, `secondary`, `glow`, `backdrop`) keyed by machine id. The existing `marquee/art.ts` accent is folded in / re-exported so the marquee and the chrome share one source of truth (and the two Bally machines, currently both amber, get distinct palettes — turquoise for the Multiplier).

**Integration point:** `app/pages/game.vue` wraps its four `<GameReelX>` components in one `<GameMachineChrome>`. That is the only change to existing app code. The marquee, credit panel, result bar, bet controls, and sidebar are unchanged.

## The Nine Chrome Identities

Each: frame material, corner/edge ornaments, backdrop, accent glow, a signature "weird" element, and gated ambient motion.

1. **Ruby of Gargoyle** — carved-stone gothic bezel, pointed cathedral arches, two gargoyles perched and glaring (eyes pulse red), the Gargoyle's Eye glowing above, crimson gem cabochons, embers drifting up; crimson breathing glow.
2. **Canal Royale** — baroque carnival-gold scrollwork, masquerade masks at the corners, fluted gold columns, Venetian-teal velvet; a gold shimmer sweep and twinkling sparkles.
3. **Dragon's Hoard** — a dragon coiled over the top breathing flickering fire down at the reels, scaled emerald border, a heaped pile of gold coins shimmering along the bottom lip.
4. **Thunder Vault** — riveted brushed-steel vault-door frame, violet/electric-blue lightning arcs across the top, a big dial/handle motif, neon Grand glow.
5. **Diamond Doubler** — frosted ice-and-chrome facets, prismatic sparkle, silver rails; clean and cold, with a slow gleam.
6. **Sevens Ablaze** — flames licking up from the base, ember glow, heat-shimmer over a charred frame; hot-rod red/orange.
7. **Series E · 3-Line** — 1960s Bally warm brass and cream bakelite, walnut cabinet, tungsten glow, a vintage bell finial; gentle, period-correct (least frenetic).
8. **Series E · Multiplier** — same Bally era but **cooler** — turquoise bakelite + chrome with red multiplier numerals, so the two Series E machines no longer look identical.
9. **Stock Rush** — blazing triple-neon pachinko tubes (orange/magenta/cyan), a kanji "big win" signboard, a chasing row of bulbs, a torii gate and a lucky cat bobbing at the base; maximum arcade.

The `DefaultChrome` fallback is a tasteful accent-framed surround using the machine's palette (so an unstyled future machine still looks intentional until it gets a bespoke module).

## Constraints

- **CSP / assets:** SVG + CSS only, no external fetches. Vue SFC `<style>` is bundled (not an inline `<script>`), so this adds **no new CSP hashes** and keeps the strict policy intact.
- **Reduced motion:** all ambient animation lives behind `@media (prefers-reduced-motion: reduce)` (or the existing `useReducedMotion` composable) and goes fully static when requested.
- **Accessibility:** chrome layers are `aria-hidden="true"` + `pointer-events:none`; the reel-window and control DOM/semantics/contrast are unchanged; the a11y audit must stay **100/100**.
- **Performance:** animate only `transform`/`opacity` (GPU-friendly, no layout thrash); lazy-load per-machine modules; cap the number of animated elements per frame.
- **Responsive:** the chrome scales with the reel window and **degrades gracefully on narrow viewports** (ornaments shrink/hide) so the playable area is never crowded or broken; the reel window keeps priority.

## Testing

- **Component tests** (`tests/components/machineChrome.test.ts`): `chromeFor()` resolves the right module per machine id and returns `DefaultChrome` for an unknown id; the chrome wrapper renders its slot (the reel surface) and marks the decorative layers `aria-hidden`; modules mount without any external-resource reference.
- **Browser smoke (mandatory):** visit all nine machines — confirm each chrome is visibly distinct and gaudy, the reels/controls still spin and pay, the console is clean **under the production CSP**, `prefers-reduced-motion` disables animation, and the layout holds at a narrow (mobile) width. viewcap screenshots of all nine.
- **a11y audit:** lightcap on the game screen for a sample of machines → hold 100/100.
- Gates per task: `pnpm lint` + `pnpm typecheck` + `pnpm test`.

## Rollout

Build the foundation + two exemplars first, review the aesthetic, then complete the set:

1. `ChromeFrame` scaffold + `theme.ts` + `registry.ts` + `DefaultChrome` + wire `<GameMachineChrome>` into `game.vue`.
2. Two exemplar modules at opposite ends of the vibe range — **Ruby of Gargoyle** (gothic) and **Stock Rush** (neon) — browser-smoke + review.
3. The remaining seven modules.
4. Docs/branding refresh + final full smoke + a11y + version bump.

## Risks & Mitigations

- **Aesthetic is subjective** → exemplar-first review before building all nine.
- **Chrome crowding the reels on small screens** → responsive degradation; reel window keeps priority.
- **Motion/perf** → transform/opacity only, lazy modules, reduced-motion gate.
- **Two Bally machines still looking alike** → distinct palettes (warm brass vs cool turquoise) baked into the theme map.

## Future (out of scope now)

- Mini-chrome hints on the floor picker cards so machines read as distinct while browsing.
- A themed treatment for feature moments (e.g. the hold-and-spin lock board adopting the machine's chrome) — would also address the earlier "hold-and-spin doesn't feel special" observation.
