# The hub exit — design

**Date:** 2026-07-14
**Status:** approved
**Scope:** 8 of the 9 hub games. Blackjack's *code* is explicitly out of scope.

## The problem

`metaincognita.com` (the `metaincognita-default` repo) is the suite's landing page — itself
built as a casino floor, with a cabinet per game, neon zone signs and floor audio. It links
**out** to nine games, each on its own subdomain.

Not one of those nine links **home**. Once you are inside a simulator you cannot get back to
the floor except with the browser's back button or by retyping the URL. A player who lands
deep in a cabinet has no way out of the simulation.

## The suite topology

| Zone | Game | Subdomain | Stack |
|---|---|---|---|
| The Pit | Blackjack Trainer | `blackjack.` | Nuxt 4 |
| The Pit | No-Limit Hold'em | `holdem.` | Nuxt 4 |
| The Pit | Craps Simulator | `craps.` | Nuxt 4 |
| The Pit | Roulette Trainer | `roulette.` | Nuxt 4 |
| Machines | Slots Simulator | `slots.` | Nuxt 4 |
| Machines | Video Poker Trainer | `videopoker.` | Nuxt 4 |
| Machines | Pachinko Parlor | `pachinko.` | **Vite** |
| Machines | Flameout | `flameout.` | Nuxt 4 |
| The Mind | PAO Speed Trainer | `pao.` | **Astro** |

`metaincognita-convoy` and `metaincognita-hand-analyzer` are not git repositories and are not
in the hub catalog. They are out of scope.

## The decision

A branded **hub exit**: a gold `METAINCOGNITA` wordmark pill, pinned to the far left of the
existing top status bar, on **every page of every app**, linking to `https://metaincognita.com`.

The wordmark-as-home is the universal web convention, and it drops into all eight apps
unchanged — which is what the guidelines' "chrome identical everywhere" mandate requires.

### The naming collision it avoids

Slots already uses **"Floor"** for its *own* machine index (`/`), and its top bar already has
a `← Floor` link. The hub is *also* a floor. Naming the hub exit "Floor" would give slots two
different "floors" in one 36-pixel bar.

Rejected alternatives:

- **The hub takes the word "Floor"** (slots' index renamed to "Machines"). Literal, but it
  costs a rename through the slots UI, tests, README and docs — and the other seven apps have
  no floor of their own, so the word would be doing two jobs suite-wide.
- **A full-width exit banner.** Maximum prominence, but ~40px on every page of eight apps
  whose layouts are `h-screen` and must stay playable at 390px. A persistent banner also
  reads as an ad.

## The contract

Every app renders this, and nothing about it varies between apps except the framework
idioms needed to express it.

```
┌──────────────────────────────────────────────────────┐
│ ⏻ METAINCOGNITA │ ← Floor  🔊   ● Session active     │
└──────────────────────────────────────────────────────┘
  └─ hub exit          └─ the app's own back/leave,
     ALWAYS visible       unchanged
```

**Destination.** `https://metaincognita.com` — an absolute URL, so it resolves identically
from `<game>.metaincognita.com` and from local dev.

**A real anchor.** `<a href>`, never a router push. It leaves the SPA.

**Same tab.** No `target="_blank"`. This is an *exit*, not a side trip.

**Never hidden.** It renders on every route, including the app's own index. (Slots' existing
`← Floor` link hides itself on the floor; the hub exit must not copy that.)

**Never confirms.** A deliberate, narrow deviation from guidelines §5's *"leave" always
confirms before destroying a session*. That rule governs the in-app "leave table" affordance
that genuinely destroys a hand, and it keeps its confirm. The hub exit destroys nothing —
slots persists its session to `localStorage` — and the requirement is that you can *always*
get out. Friction here would defeat the feature.

**Accessible name — the WCAG 2.5.3 trap.** The accessible name must *contain* the visible
label verbatim. The visible label is `METAINCOGNITA`, so:

```
aria-label="METAINCOGNITA — exit the simulator, back to all the games"
```

An aria-label of "Meta Incognita floor" would fail 2.5.3 (Label in Name) on the space —
this is the same rule that forced the `FeaturedMachine` aria-label removal. The icon is
`aria-hidden`.

**Mobile (390px).** The bar is tight. The wordmark stays; the *"Session active" text* drops
below `sm` (the pulsing dot stays). The exit never degrades to icon-only — prominence is the
point of the feature.

### Reference implementation (Nuxt 4 + Nuxt UI 4 + Tailwind 4)

`app/components/AppHubLink.vue`:

```vue
<a
  href="https://metaincognita.com"
  aria-label="METAINCOGNITA — exit the simulator, back to all the games"
  data-test="hub-link"
  class="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5
         text-amber-400 transition-colors hover:border-amber-400/60 hover:bg-amber-500/10
         hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-amber-400/70"
>
  <UIcon name="i-lucide-log-out" class="w-3.5 h-3.5" aria-hidden="true" />
  <span class="text-[10px] font-semibold tracking-[0.12em]">METAINCOGNITA</span>
</a>
```

Mounted far-left in the top `<nav>` of `app/layouts/default.vue`, followed by a
`border-l border-neutral-800` divider, then whatever that app already had in the left slot.

### Per-stack adaptation

- **Nuxt 4** (holdem, craps, roulette, video-poker, flameout, slots) — as above. Auto-imported.
- **Pachinko (Vite/Vue)** — no Nuxt auto-import and no `UIcon`. Import the SFC explicitly;
  replace `UIcon` with an inline `<svg>` of the lucide `log-out` glyph. Same markup otherwise.
- **PAO (Astro)** — an `.astro` component with an inline `<svg>`. Same markup, same classes if
  Tailwind is present; otherwise scoped CSS producing the same result.

Each repo uses its own accent token where it has one, but **the hub exit stays gold**
(`#d4a847` / `amber-400`) in every app. It is suite chrome, not game chrome — it should look
the same everywhere so players learn it once.

## Tests

Per repo, in that repo's own idiom:

1. The link renders on the app's index **and** on a deep in-game route (it is not gated).
2. `href` is exactly `https://metaincognita.com`.
3. It is an `<a>`, not a router link.
4. It has no `target` attribute (must exit in the same tab).
5. The accessible name contains the visible wordmark (WCAG 2.5.3).

Then that repo's own gates: lint, typecheck, unit tests, build.

## Guidelines amendment — v1.2

`METAINCOGNITA-GUIDELINES` §5 (UI standard) gains the hub exit as a chrome non-negotiable,
and clarifies that the confirm rule applies to the session-destroying in-app leave, not to
the hub exit.

The doc lives in three repos — **blackjack (canonical)**, roulette, slots — and is kept
byte-identical across them.

**Known gap, recorded deliberately:** blackjack's *code* is out of scope by the owner's
standing rule, so on the day v1.2 lands blackjack is the one game whose chrome does not match
the document it hosts. v1.2 names it as the single pending adopter so the inconsistency is
tracked rather than silent.

## Out of scope

- Blackjack's code (standing rule: never touch it). The guidelines doc in that repo is the
  one sanctioned exception and *is* updated.
- `convoy`, `hand-analyzer` — not repos, not on the hub.
- Any change to the hub itself (`metaincognita-default`). It already links out correctly.
- Pushing. All commits stay local until asked. (Note: commits authored during M–F 7am–7pm
  need their timestamps moved off business hours before any push.)
