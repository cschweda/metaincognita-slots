# Learn Finish — Design Spec (2026-07-10)

Owner directive: "finish out the learning items — the glossary and psychology
pages" before the push. Two pieces, both riding patterns already on main:

## 1. Glossary completion pass

The glossary's contract is "every term on this floor in plain English" — and
the floor has grown terms since the 30-term pass. Audit target: everything the
APP ITSELF now displays or the new psychology page introduces. Additions (7 →
39 entries), each with an anchor id and the house one-breath-definition voice:

- **RNG (random number generator)** — the X-ray shows raw draws; the myths page
  says the phrase. Link → `/learn/myths`.
- **Pachislo** — flag/stock/slip are defined but the machine family itself
  never was; the floor groups a whole section under the word. Link →
  `/learn/pachislo`.
- **REG / BIG / JAC (pachislo bonuses)** — History's humanized awards now print
  "REG bonus", "BIG bonus", "JAC win". Link → `/learn/pachislo`.
- **N₀ — spins to outrun luck** — the Sim Lab model panel ships the concept
  ("edge outgrows luck after ~N spins"); name it. Link → `/sim-lab`.
- **Variable-ratio reinforcement** — psychology page's core term. Link →
  `/learn/psychology`.
- **Illusion of control** — psychology page. Link → `/learn/psychology`.
- **Time on device** — psychology page. Link → `/learn/psychology`.

Alphabetical placement by term; glossary tests extend the term-presence lists
and anchor assertions.

## 2. `/learn/psychology` — "The psychology of the floor"

The backlog's synergy note, cashed in: a floor-psychology page that points at
THIS app's own machinery as the specimen (guidelines §1.4 honest fun, §2.2).
Structure mirrors myths.vue (LearnSection pattern, breadcrumb, cross-links).
Live numbers come from the CACHED `ldwExperimentAsync()` (rtp.worker; sync
fallback in tests/SSG) — no new experiment code.

Sections:

1. **"The party is for you, not the win"** — LDW celebrations. Headline:
   live `ldwShareOfWins` (63.34%) — the share of celebrated "wins" that lost
   money. The twist: THIS floor's sound does it too, deliberately — reveals
   scale with the payout, exactly like a real cabinet — while the ResultBar
   and History speak net truth beside it. Links: `/learn/ldw-near-miss`, the
   nav mute.
2. **"The hook is the schedule"** — variable-ratio reinforcement: rewards on
   an unpredictable count are the most persistence-inducing schedule known
   (Skinner's boxes), and a slot is the purest commercial form. Live pair from
   the same experiment: `hitPct` (something pays most spins) vs `trueWinPct`
   (spins that actually beat the bet).
3. **"Almost is engineered"** — the near-miss jolt, briefly, pointing at
   `/learn/ldw-near-miss` and `/learn/myths` for the full treatment.
4. **"Credits keep dollars abstract"** — denomination distancing: on the
   penny video slots a $10 bill becomes 1,000 credits and a 25¢ max bet
   reads as "25". Glossary links (credits, denomination).
5. **"Buttons that don't steer"** — illusion of control: pachislo's stop
   buttons (the flag already decided; the slip corrects ≤4), and every
   machine's X-ray showing the draw happen. Links: `/learn/pachislo`,
   `/learn/myths`.
6. **"Time on device"** — the industry's actual success metric; no natural
   stopping points by design. This floor builds the exits in: History's
   expected-vs-actual line, the Sim Lab's N₀, End session. Links: `/history`,
   `/sim-lab`.

Hub gains its 10th card (icon `i-lucide-brain`). Tests in learnPages.test.ts
mirror the myths describe (mount, two ticks, live percentage rendered,
key phrases, links).

## Gates & sequencing (owner's push protocol)

lint + targeted vitest per task; then the README/branding pass (README is 4
tranches stale; CHANGELOG Unreleased → `[0.13.0] - 2026-07-10`; package.json
bump; og-image check), full `pnpm check`, production-CSP smoke of the new
page + glossary anchors, THEN the [[commit-timestamp-rule]] rewrite (the 28
Thu-16:44–18:37 commits), then push.

## Out of scope

The volatility deep-dive page (still backlog; the glossary term exists),
any engine change, any new experiment util.
