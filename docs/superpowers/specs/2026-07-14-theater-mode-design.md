# Theater mode — design

**Date:** 2026-07-14
**Status:** approved (design); spec under review
**Scope:** slots only, the `/game` cabinet. No engine, RTP, or game-logic change.

## The idea

A full-screen, deliberately gaudy display mode for a single cabinet. The owner's words:
*"it should look like a video slot machine in the Venetian — all you see is the machine, the big
icons, and lots of colors. It should pop."*

Default theater is **pure spectacle** — the giant machine, colossal symbols, saturated color, no
chrome. The pedagogical core (the X-ray) is not deleted; it is **one gesture away**: hold a key
and the truth layer washes over the glass, release and it's gone.

This is the app's thesis expressed as a physical gesture — the machine looks like a casino
machine, and the moment you want to know what it just did to you, you hold a key and it tells you.

## Decisions already made (in brainstorming)

| Question | Decision |
|---|---|
| How much machine do you see? | **Edge-to-edge glass** — the reel window fills the screen; the gaudy cabinet survives as a bezel at the viewport edge. |
| Narrow (3-reel) machines? | **Frame** — the window grows to full height keeping its aspect; leftover width fills with lit gold side-towers so it reads as a lavish cabinet, never three lonely symbols. |
| What does the truth layer show? | **Everything** — winning paylines lit, per-line pays, and the X-ray's RNG trace / near-miss / live RTP, combined into one translucent over-glass drawer. |
| How is the truth layer summoned? | **Hold `` ` `` to peek** (gone on release); **tap `` ` `` to pin** (until tapped again). Touch: press-and-hold the glass to peek, tap to pin. |
| Getting out / the hub-exit tension | **Ghost bar** — default shows nothing but the machine; pointer-move or tap wakes a slim translucent bar (the METAINCOGNITA hub exit + an ✕ Exit-theater button) for ~3s, then it fades. Esc exits theater instantly on desktop. |

## Why the hub-exit tension exists, and how the ghost bar resolves it

Earlier this same day the suite shipped an **always-visible hub exit** — a gold METAINCOGNITA
wordmark in the top nav, on every route, never hidden. Theater mode hides the nav. Left unhandled,
the app's best-looking mode would be the one place the exit vanishes — and on a phone in
fullscreen there is no Esc key to fall back on.

The ghost bar keeps the promise: the exit is never *truly* unreachable. It sleeps for immersion
and wakes on any interaction. Theater is a **mode of the `/game` route**, not a route of its own,
so the exit still lives on the route; it is merely dormant until you reach for it.

## The machines theater must handle

The floor is mixed. Theater must look right on all of it:

| Family | Count | Reels | Theater treatment |
|---|---|---|---|
| video | 4 | 5×3 | Fill edge-to-edge |
| cascade (Temple, Featured, free-play) | 1 | 5×4 | Fill edge-to-edge |
| stepper | 2 | 3×3 | **Frame** + gold side-towers |
| bally-em | 2 | 3×1/3×3 | **Frame** + gold side-towers |
| pachislo (Stock Rush) | 1 | 3×3 | Frame; manual **1/2/3 stop keys must still fire** |
| wheel (Wonder Wheel) | 1 | 5×3 + topper | Fill; the giant `WheelOverlay` topper scales with the cabinet |

*(blackjack-reel and lock-reel are parked, not on the floor — out of scope.)*

## Architecture

### The scaling principle: one block, one transform

The cabinet scales as a **single block** — a `transform: scale(k)` on the cabinet container, with
`k = min(maxCap, availWidth / naturalWidth, availHeight / naturalHeight)`. Everything inside — the
reels, the bespoke chrome frame, the marquee, the Wonder Wheel topper, the cascade celebration —
scales together, because nothing in the game components is `<Teleport>`ed or fixed-position.

This is deliberately **not** a per-reel change. `useFitScale` is consumed by the video, Bally,
stepper and wheel reels but **not** by cascade or pachislo; a per-reel approach would leave those
two machines (one of them the Featured machine) unscaled. Scaling the block sidesteps that
entirely and treats every family uniformly.

- **Normal mode is unchanged.** Per-reel `useFitScale` continues to handle narrow-viewport
  shrink exactly as today. The block transform is a theater-only addition; when theater is off,
  `k = 1` is never applied.
- **Fill vs Frame** falls out of the natural block size: a 5-reel window is wide, so width binds
  and it fills; a 3-reel window is narrow, so height binds and the leftover width is filled by
  the side-tower decoration.
- **Max cap** prevents a cabinet ballooning absurdly on a 4K display.

### Components (new, isolated)

- **`composables/useTheater.ts`** — the whole state machine: `active` (bool), `peek`
  (`'off' | 'held' | 'pinned'`), `enter()` / `exit()` / `togglePeek()`; owns the Fullscreen API
  calls, the `Backquote` hold/tap logic, `Escape`, and the `fullscreenchange` listener that keeps
  the CSS mode and the real fullscreen state in sync. One clear owner for all theater state.
- **`components/game/TheaterGhostBar.vue`** — the wake-on-interaction bar. Contains the hub exit
  (an `AppHubLink`, unchanged, keeping its exact WCAG-2.5.3 label) and an ✕ Exit-theater button.
  Wakes on `pointermove` / `pointerdown` / `keydown`, auto-hides on a timer.
- **`components/game/TheaterPeekLayer.vue`** — the translucent truth drawer. **Reuses** the
  existing `PaylineOverlay` (already pixel-driven off `WinLine[]`, so it scales with the block)
  and the X-ray's existing store-derived data (`store.lastOutcome`, `store.currentDef`,
  `useExactRtp`, `nearMisses`) rendered as an over-glass drawer instead of a side panel. It does
  not recompute anything the X-ray panel doesn't already compute.

### Existing files touched (small)

- **`components/game/CabinetToolbar.vue`** — one new button to enter theater, following the
  existing `UButton` + `aria-pressed` pattern used by the X-ray toggle.
- **`pages/game.vue`** — a `theater` class on the page root (hides nav + `cab-page-side`), a
  wrapper element as the fullscreen target, and mounting the two new components. The existing
  `Space`/`Enter` spin `keydown` handler must keep firing inside the fullscreen element.
- **`assets/css/main.css`** — `:fullscreen` / `.theater` rules, the block-scale wiring, and the
  gold side-tower decoration for narrow families.
- **`composables/useFitScale.ts`** — *possibly* a small height term so it and the block share one
  formula; not strictly required by the block-transform approach. Left as a plan-phase call.

## Accessibility & reduced motion

- All theater gaud (chasing bulbs, color washes, the ghost-bar fade) disarms under
  `prefers-reduced-motion`, following the existing `reducedMotion()` pattern. Reduced motion keeps
  the ghost bar **visible** rather than fading it, and the peek layer appears instantly.
- **Tap-to-pin is the keyboard/AT path** to the truth layer — a sustained hold is not required to
  reach the X-ray, which matters because the X-ray is the whole point of the app. (In normal mode
  the toolbar X-ray toggle still exists regardless.)
- The theater button carries `aria-pressed`. Focus moves into the theater container on enter and
  returns to the theater button on exit. Esc exits.
- The hub exit inside the ghost bar keeps its verbatim aria-label (WCAG 2.5.3 Label in Name).

## Testing

- **`useTheater`** — `enter()` sets `active` and requests fullscreen; `exit()` / `Escape` /
  `fullscreenchange` clear it; `Backquote` held → `peek='held'`, release → `'off'`; `Backquote`
  tapped → `'pinned'`, tapped again → `'off'`.
- **Block scale** — `k = min(maxCap, availW/natW, availH/natH)`; the cap is honored; a wide
  (5-reel) natural size fills on width, a narrow (3-reel) one binds on height.
- **`TheaterGhostBar`** — wakes on interaction, hides after the timer, stays visible under reduced
  motion; contains a hub exit with the exact aria-label **and** an exit-theater control; the two
  are distinct.
- **`TheaterPeekLayer`** — renders winning paylines + pays + X-ray data when `peek !== 'off'`,
  nothing when `'off'`; reuses the X-ray's data source (no divergent second computation).
- **Browser smoke** (this is a display feature; drive it live). The CSS `theater` class is
  drivable by viewcap even though the real Fullscreen API is not — which is exactly why the two
  are composed. Screenshot theater on a **video** machine and a **stepper** at desktop and mobile
  widths; confirm Fill vs Frame, the peek layer over the glass, and the ghost bar.
- **a11y** — axe on theater + peek; focus moves in on enter and returns on exit.

## Scope / non-goals

- **No engine, RTP, paytable, or outcome change.** Display only. The `spinOnce`-books-the-outcome
  invariant and the anti-spoiler result hold are untouched.
- **Slots only.** The other eight games are not touched.
- Theater applies to the **cabinet on `/game`**, not the floor, Sim Lab, or Learn.
- Pachislo's 1/2/3 manual stop keys and the Space/Enter spin must keep working inside fullscreen.
- No new machine, no new symbol art (theater reuses the existing SVG symbol registry at scale).

## Open questions for the plan phase

1. Exact mechanism for measuring the cabinet's natural (unscaled) size before applying the block
   transform — measure-then-scale on a `ResizeObserver`, vs a known per-family base size.
2. Whether `useFitScale` gains the height term (shared formula) or theater's block scale is fully
   independent of it.
3. The side-tower decoration: a shared `TheaterSideTowers` element vs each narrow family's own
   chrome growing to fill. (Leaning shared, since only 4 machines need it and they should match.)
