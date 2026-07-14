# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- **The jackpot sting was quieter than the bonus sting.** The two recorded stings
  shipped with hand-guessed volumes, and the guess inverted the mix: a progressive
  hit — the loudest thing that can happen on the floor — landed **1.2 dB below** a
  mere feature arming. The volumes are now *measured* rather than chosen. Rendering
  the exact synth fanfares each sample replaces and running EBU R128 loudness over
  both shows the ear-tuned synth mix puts a jackpot **+3.8 dB above** a bonus; the
  stock stings are mastered ~10 dB hotter than the synth and needed very different
  trims to sit in that same relationship. `BONUS_VOL` 0.4 → **0.28**, `JACKPOT_VOL`
  0.45 → **0.55**, which level-matches each sample to its own fanfare within 0.1 dB.
  The reasoning and the numbers are recorded in `soundBank.ts` so nobody re-guesses.

## [0.16.0] - 2026-07-14

### Fixed
- **The PAR sheet's close button was one deleted line from vanishing.** Nuxt UI
  renders a modal's × from `appConfig.ui.icons.close` (`i-lucide-x`) — a name that
  appears nowhere in our templates, so the icon scanner cannot see it, and under
  `connect-src 'self'` the runtime fetch from the Iconify API is blocked and the
  glyph renders as *nothing*. It shipped only because `index.vue` happens to name
  `i-lucide-x` for something unrelated. It is now pinned explicitly in
  `icon.clientBundle.icons`. This exact bug **was live** in the Flameout simulator,
  which had no such lucky line — its modals had no close button at all.

### Added
- **A way out — every page now exits to the floor at metaincognita.com.** Nine
  games hang off the hub and not one of them linked home: once you were inside a
  cabinet, the only way back to the floor with all the games was the browser's
  back button. `AppHubLink` is the suite's exit door — a gold **METAINCOGNITA**
  wordmark pinned to the far left of the status bar, on **every** route, never
  hidden and never confirmed. It destroys nothing (the session is persisted to
  `localStorage`), and the point of the feature is that you can *always* get out.
  It stays deliberately distinct from the **Floor** link beside it, which still
  means *this app's own machine index* — two different floors in one 36px bar is
  the collision the design turns on. The accessible name contains the visible
  wordmark verbatim (WCAG 2.5.3 Label in Name — "Meta Incognita" would have
  failed on the space), there is no `target="_blank"` (an exit, not a side trip),
  and "Session active" goes `sr-only` below 640px so the bar still fits at 390.
- **The first recorded sounds in the app — bonus and jackpot stings.** Three
  Floraphonic samples (Pixabay; `public/audio/CREDITS.md`) take over from the
  synth at the two moments the spectacle peaks, and nowhere else: a **feature
  arming** (pachislo bonus, video free spins, the Wonder Wheel topper) fires an
  alternating bonus sting, and a **jackpot** — a progressive hit, a filled
  hold-and-spin Grand, or the wheel's MEGA wedge — fires the jackpot sting. Every
  other sound in every cabinet is still synthesized.
  They are fetched and decoded lazily, never on boot, and warmed on the first
  user gesture, so a sting is in memory before it is asked for. Both respect the
  existing mute toggle and the AudioContext unlock. **A missing or undecodable
  file can never mean silence:** `playSampleNow()` returns false and the caller
  sings its synth fanfare instead — the samples are a sweetener on a cabinet that
  can always speak for itself.
- `media-src 'self'` added to the CSP. The stings are actually authorized by
  `connect-src` (they arrive via fetch + decodeAudioData, not an `<audio>`
  element), but the directive is declared anyway: it costs nothing and documents
  that this origin now serves audio.
- **Win/loss dots on the bankroll sparkline — in three colours, not two.** Every
  point on the result card's sparkline is now a dot coloured by what that spin did
  to the BANKROLL, not by what the machine called it: **green** it rose, **rose**
  no pay at all, and **amber** for the one in between — the machine flashed WIN and
  the bankroll fell anyway (a pay under the bet, or the bet handed straight back).
  That amber is the loss-disguised-as-a-win /learn/ldw-near-miss exists to expose,
  and it now shows up on the glass, spin by spin, with a legend under the line.
  `spinKind()` in bankrollSeries.ts is the single definition.
- **Dots on the X-ray's RTP sparkline too** — green while the session runs above
  the machine's exact RTP, rose while it runs below. The drift back to the dashed
  line is the house edge, drawn.

### Fixed
- **The Spin button no longer moves out from under your finger.** The result card
  was `v-if`'d out of the DOM whenever `spinning` was true and grew a chips row on
  a win, so the button beneath it jumped twice per pull — brutal when you're
  rattling Spin. The card now holds a FIXED slot in every state (idle, spinning,
  resolved, win, no-win): reserved chips row, one row deep, never wraps.
  It also now does what its own label always promised — it HOLDS the previous
  result while the reels turn. That is load-bearing, not cosmetic: `spinOnce()`
  resolves the engine and books the outcome the instant you press Spin (the reels
  are only animation, `revealDone()` flips `spinning` later), so `lastOutcome`,
  the bankroll and the history are ALREADY the new result mid-spin. Rendering them
  live would spoil the landing, so the card snapshots on each settled beat.

## [0.15.1] - 2026-07-13

### Changed
- **The whole floor is visible on arrival.** The first-run screen used to show
  the free-play Featured card and the bankroll form *only* — the other ten
  machines lived behind the session gate and appeared after "Start session," so
  a new visitor's floor looked like a one-machine floor. The Featured headliner
  and the family-grouped grid now render whether or not a session is open, and
  the curated `FEATURED_ID` (Wonder Wheel) fronts both — the headliner is no
  longer invisible to a first-time visitor.
- **The bankroll is dialed on the way into a cabinet, not at the door.** A new
  `store.enterMachine` opens the session for a visitor who hasn't started one,
  at the bankroll dialed on the setup card (now `store.pendingBankrollCents`, so
  the slider and the grid share it) — so a cold click on a betting machine can't
  dead-end at the game page's session guard. Free play still walks up with no
  session at all: `isFreePlay` is now one shared predicate rather than
  `family === 'cascade'` spelled out at each call site.

### Fixed
- **Machine cards no longer trip WCAG 2.5.3 (label-in-name).** Each card carried
  an `aria-label="Play {name}"` while visibly showing the denomination, pay tag
  and jackpot, so its accessible name didn't contain its visible label — a
  *serious* axe finding on all ten cards, latent on the in-session floor and
  newly on the landing page now that the grid greets a cold visitor. The label
  is gone: the accessible name IS the visible content, the same stance
  `FeaturedMachine` already took. Floor is back to a11y 100/100, 0 issues.

## [0.15.0] - 2026-07-10

### Added
- **Wonder Wheel — the 11th machine, a new `wheel` engine family, and the new
  Featured headliner.** The Wheel-of-Fortune 1996 archetype: a 3-reel Telnaes
  stepper whose reel-3 WHEEL symbol at MAX COINS arms a giant 24-wedge topper
  overlay (chasing bulbs, decelerating ticker, payout-scaled fanfares, honest
  landing — the engine draws first and the animation obeys). Wedges are drawn
  equal-sized and weighted unequal: the X-ray prints the full weight table
  ("looks like 4.17% · really is …"), the PAR sheet carries every wedge as its
  own row, and betting under max fires a `wheel-wasted` event the result line
  announces (a real cabinet stays quiet). Frozen exact math: 92.4880%/coin at
  max (wheel term 21.9609%), 70.5271% under max — the authentic per-coin
  cliff; MEGA 2,500 credits at 1-in-55,872 spins; verify runs 11/11.
- **The Featured slot revolves.** `FEATURED_ID` + a per-machine copy record
  replace the hardcoded Temple card: Wonder Wheel headlines, Temple of Gold
  rejoins the grid under a Cascade group (and keeps anchoring the first-run
  screen as the free-play trainer). Rotating the spotlight is a one-line
  curation change; past headliners keep their copy.

### Fixed
- **The parked engines' X-ray sections no longer ride the /game route.** The
  backlog split missed one leak: `XrayPanel` statically imported both parked
  DP modules for its Flameout/Stop-&-Lock sections. Those sections moved to a
  lazily-loaded `XrayParkedPanel`, so the chunk only fetches inside a restored
  legacy parked session.

## [0.14.0] - 2026-07-10

### Added
- **The deploy gate now boots the site.** `pnpm smoke:csp` serves the generated
  `dist/` under the REAL production `_headers`, boots it in headless Chrome
  (system browser via puppeteer-core — nothing bundled), and fails on any CSP
  violation, page error, or never-rendering page — including proof the
  `rtp.worker` loads and answers under `worker-src`. GitHub CI runs it on every
  push with `CSP_SMOKE_REQUIRE=1`. This guards the silent white-screen class
  that has bitten twice — and its negative-control test immediately caught a
  real latent bug (below).
- **`/learn/volatility` — same edge, different ride.** The eleventh learn page:
  live sd/coin (√variance) and N₀ (variance ÷ edge²) for the whole floor,
  ranked by wildness, computed from the same exact reports the PAR sheets
  print. Sevens Ablaze vs Diamond Doubler is the nearly-equal-RTP pair (a
  quarter point apart on edge, 1.2× on the ride); the floor-wide spread runs
  5.4× (Series E Multiplier's sd 13.7 vs Temple of Gold's 2.6). Glossary
  volatility/sd entries now deep-link it.

### Fixed
- **`csp-hashes.mjs` is idempotent.** It blindly appended its generated block,
  so a re-run on an already-stamped `dist/` left a stale first-match CSP being
  served (Netlify and the smoke server both honor the FIRST `/*` rule) — the
  exact silent-white-screen failure the new smoke guards. Previous runs' blocks
  are now stripped by marker before the fresh one is written.
- **Steppers and the Bally cabinets no longer clip on phones.** Their
  fixed-pixel reel windows now fit-scale (the same `useFitScale` transform the
  video slots got) instead of overflowing on narrow viewports.

### Changed
- **The house-edge page's exact math moved off the main thread.** It was the
  last page computing the four 24⁵ video enumerations synchronously in render
  (it predates the worker tranche); it now shares `useFloorReports` (rtp.worker,
  cached, sync fallback in SSG/tests) with the volatility page.

### Performance
- **Parked engines are off the boot path.** Flameout 21's crash DP and Stop &
  Lock 777's collect DP (with `simulateMachine` and their solvers, a ~130KB
  chunk) no longer load on the floor — verified live against the built site.
  They fetch only behind a restored legacy parked session or a no-Worker PAR
  view, via the new `~/engine/parked` doorway + exactRtp solver registry. The
  machine defs stay resident (History still names retired machines instantly).
- Evaluated and deliberately skipped (recorded in the backlog-close spec):
  chrome gold-title/bulb primitives (the 11 frames are bespoke on purpose),
  machine-registry merge (would couple pure-data defs to component imports),
  `useStopReelCabinet` (only one stop-reel machine remains on the floor).

## [0.13.0] - 2026-07-10

### Fixed
- **The CASCADE! overlay no longer strobes.** The celebration's color wash was a
  hard `steps(1)` cycle at ~25 color switches/sec — far over WCAG 2.3.1's
  3-flashes/sec photosensitivity cap. It is now a smooth 1.2s hue-rotating wash
  on a `::before` layer (same tri-color spectacle, zero hard flashes, and the
  burst text/zaps are no longer hue-shifted with it); reduced-motion still shows
  the static beat.
- **Video reels no longer clip on phones.** The 556px reel window of the four
  video machines scales to fit (new `useFitScale`: ResizeObserver → transform
  with compensated height) instead of silently hiding reels 4–5 inside the
  overflow-hidden chrome on narrow viewports.
- **Ruby of Gargoyle's floor card shows its "Top award 1 in X" row again.** The
  hand-maintained per-machine map in `floorIntel` had drifted (Ruby was missing);
  the id now lives on each machine def (`topAwardEntryId`), the map is gone, and
  a floor-wide test asserts every machine resolves real odds. `LockReelMachineDef`
  now extends `MachineDefBase` so future base fields can't skip it.
- **Live-progressive parity.** `simulateSession` fed only video Grands, missing
  cascade (latent — the Sim Lab currently pins static mode). The
  feed-before/after-by-family rule now lives in one `feedProgressive()` engine
  helper used by live play, `simulateMachine`, `simulateSession`, and the
  free-play driver; every floor RTP verified bit-identical after the refactor.
- **The Temple sound toggle is honest and remembered.** Mute state is reactive
  (label + `aria-pressed` update the instant you click) and persists across
  visits.
- **Leaving Temple mid-spin goes quiet.** The tumble's awaited timer chain
  cancels on unmount — no more SFX or ledger updates bleeding onto the floor
  page after navigation.

### Added
- **`/learn/psychology` — the floor's persuasion toolkit, receipts on.** LDW
  celebrations (headlined by the live 63.34% share of celebrated "wins" that
  lost money — and the note that THIS floor's payout-scaled jingles do it too,
  deliberately, beside an honest result bar), variable-ratio reinforcement
  (live pay-rate vs beat-the-bet-rate pair), engineered near misses,
  credits-as-distance, the illusion of control (pachislo as the demonstration),
  and time on device — with the floor's built-in exits (History takeaway, Sim
  Lab N₀, End session). Tenth learn card.
- **Glossary completion — 39 terms.** Seven additions the app itself now
  surfaces: RNG, pachislo, REG/BIG/JAC (History prints them), N₀ (the Sim Lab
  panel computes it), variable-ratio reinforcement, illusion of control, and
  time on device.
- **`/learn/myths` — due, hot & cold, refuted live.** Gambler's fallacy, "due"
  jackpots, and hot/cold machines, each stated in its own voice and answered by
  a seeded 250,000-spin experiment through the real Sevens Ablaze engine (in the
  rtp.worker): hit rates conditioned on the preceding streak are identical, and
  the 1-in-13,824 jackpot's gaps (549 to 42,247 spins around an expected
  ~13,824) show no schedule. Ninth learn card; the glossary gains
  gambler's-fallacy and independence entries.
- **The Sim Lab shows the math before you spin.** A live model panel (per-spin
  EV, no-bust expected end, ±1σ of luck, spins-for-the-edge-to-outgrow-luck)
  updates as the form moves, every figure labeled model vs measured — and after
  a run the ending-bankroll histogram overlays the model expected end against
  the measured mean (guidelines §2.5).
- **History speaks English and draws the lesson.** Machine names instead of ids,
  awards as "5× Winged Lion" instead of `li5`, game kinds humanized (the export
  log keeps raw ids) — and a takeaway line comparing the expected net at the
  machines' exact edges against the actual net, with luck quantified
  (guidelines §2.3).
- **The floor has a voice — all ten machines now make sound.** Four
  period-authentic synthesized voices (no audio files, CSP-clean): steppers
  thunk mechanically and rattle coins into the tray, the 1979 Bally EMs hum
  and ring a true striking bell, the video slots chime in digital arpeggios,
  and Stock Rush beeps like a Japanese parlor (with the fever jingle on a
  bonus). Reveals scale with the payout — a loss disguised as a win throws
  the same party a real machine would, while the ResultBar's net line keeps
  telling the truth; clean losses stay silent; a stocked pachislo flag stays
  deliberately silent (real machines hide it — the X-ray shows it). Global
  mute lives in the top nav and shares Temple of Gold's persisted state.
- **The game→learn loop is closed.** Every betting cabinet's sidebar now links
  to the /learn explainer for its machine (Ruby → Gargoyle's Eye, the
  hold-and-spin videos → the fill math, steppers → Telnaes, Stock Rush → the
  flag lottery), and Temple of Gold's teaching panel points at the tumble-math
  page. One `learnLink()` map, tested against every machine.
- **Glossary grew from 19 to 30 headwords** — the 11 terms the UI already used
  but never defined (bankroll, drawdown, EV, flag/stock/slip, jackpot tiers,
  multiplier, risk of ruin, sd/coin, wild). Every entry now carries an anchor
  id (`/learn/glossary#rtp`), the bottom nav gained a Glossary link, and the
  sidebar's RTP / hit-frequency / volatility labels deep-link to their
  definitions.
- **Plain-English glosses at point of use.** Bet-control fixed-bet reasons say
  *why* in lay terms, the floor cards' RTP / hit-freq / volatility / top-award
  labels carry tooltip definitions, and every Sim Lab stat card explains
  itself on hover (plus a glossary footer link).
- **An incompatible saved session now explains itself.** A storage-version
  mismatch used to silently discard bankroll/history; the floor now shows a
  dismissible notice saying the old save couldn't be carried over.
- **Four new /learn pages — the mission's biggest gaps closed.**
  *Cascades (tumble math)*: scatter pays, the shatter-fall-refill chain, the
  multiplier ladder, closed-form first-drop and Grand-trigger odds computed at
  render, and an honest account of why exact tumble RTP needs an
  absorbing-Markov DP (with a pointer to the cabinet's PAR sheet for the full
  enumeration). *Pachislo: the flag lottery*: the lottery decides / the reels
  obey — flags, stock, the ≤4-stop slip, and a live exact-RTP table for all
  six operator-key settings (~66% to over 100%). *LDWs & near misses*: the
  floor's two best tricks defined and then MEASURED — a seeded 10,000-spin
  Canal Royale experiment runs in the reader's browser and reports how many
  "wins" were net losses and how many losing spins flashed an engineered near
  miss. *Glossary*: every floor term in plain English (guidelines §2.2),
  cross-linked to the deep-dive pages. The Learn hub now lists eight topics;
  all four new routes prerender.
- **`pnpm smoke`** — serves `dist/` with the generated `_headers` (real CSP,
  real 404s, first-match-wins like Netlify), closing the documented dev/preview
  gap that once hid two production CSP bugs.
- **CSP hash guard** — the build now *fails* if a pinned runtime-injected inline
  script no longer exists verbatim in the installed `@nuxt/ui`, instead of
  shipping a CSP that would block it after an upgrade.
- **Typecheck now covers tests + scripts** (`tsconfig.tests.json`): `pnpm
  typecheck` sees all suites and `verify-floor.ts` (it surfaced 8 latent fixture
  type errors on arrival — fixed).
- **`pnpm check`** — lint + typecheck + test + verify as one gate.
- **MIT LICENSE** (a public educational repo was all-rights-reserved by default).

### Changed
- **The heavy exact math moved off the main thread.** A long-lived `rtp.worker`
  now computes `exactRtp` for the floor's X-ray cards, the sidebar/X-ray intel,
  and the PAR sheet's Math tab (each video machine is a 24⁵-state enumeration
  ≈1s — the floor used to freeze ~4s with X-ray on), and runs the LDW lab's
  10,000 seeded spins (the learn page no longer blocks first paint). Identical
  numbers everywhere — same engine code, same seeds; environments without
  workers (SSG, tests) fall back to the same math computed synchronously.
- **Netlify's deploy gate now runs the full battery** — lint + typecheck +
  tests + a 250k-spin `verify` before `generate` (was lint+test only; Netlify
  deploys independently of GitHub CI, so the expensive gates must run there
  too). Both CI and Netlify install with `--frozen-lockfile`.
- **CI enforces coverage thresholds** (statements 86 / branches 77 /
  functions 88 / lines 89 — ~2 points under the 2026-07-09 baseline, a
  ratchet against silent regression).
- **One money-formatter family.** `formatCentsExact` ("$4.00") and
  `formatCentsCompact` ("25¢"/"$1"/"$1.25") replace seven hand-rolled dollar
  renderers across the cabinets, narration, and X-ray (rendered output
  unchanged, byte-for-byte).
- **Displayed-RTP test assertions are derived, not transcribed.** The PAR
  sheet and X-ray tests compute their expected strings from `exactRtp` the
  same way the components do; the engine-side exact values are frozen in the
  machine suites (stock-rush's 0.9150131… freeze is new).
- **game.vue deduplicated.** The X-ray/PAR toolbar (copy-pasted 4×) is one
  `CabinetToolbar` component; the three bespoke page shells (byte-identical
  CSS except backdrop + sidebar width) are one `.cab-page` family.
- **First run shows the free machine first.** The floor page used to hide
  everything — including the walk-up, free-play Temple of Gold — behind the
  bankroll form. The Featured card and a /learn pointer now render above the
  gate; only the nine betting machines wait for a session.
- **The Temple grid reads honestly to screen readers.** The non-interactive
  symbol display no longer claims `role="grid"` (which implied keyboard cells
  and read the columns as transposed rows); it is an image with a summary
  label, with results announced via the live region and the X-ray trace.
- Zero-value readouts (last-win, history payouts, the inactive Bally meter
  label) brightened from near-invisible `neutral-600` to readable `neutral-400`
  — they are data, not disabled controls.
- **Internals, no behavior change** (every RTP re-verified bit-identical):
  the localStorage restore sanitizers moved out of the 965-line store into
  `app/engine/restore.ts` and the outcome narration into
  `app/utils/outcomeText.ts` (store now ~630 lines); the interactive
  Monte-Carlo hand/round drivers are shared engine helpers instead of
  duplicated between `simulateMachine` and `simulateSession`; the two PARKED
  machines' cabinets lazy-load so floor visitors stop downloading them; the
  cost-prediction property test now fails loudly on an unhandled family; stale
  "wired in a later task" comments on parked-machine code now say PARKED.
- `netlify.toml`: Node pinned to 22 (matches CI), HSTS header, a lint + test
  gate before deploy so a red push cannot ship, and the dead SPA catch-all
  rewrite removed (the preset's `/* /404.html 404` already wins).
- README: v0.12.1 status, plain-English glosses at first use (RTP, PAR sheet,
  hit frequency, lines vs ways, progressive feed), a corrected `docs/` note
  (scanned manuals are local-only, never redistributed), and a License section.

## [0.12.1] - 2026-06-19

### Added
- **Temple of Gold — the CASCADE! celebration.** A chain ≥ 2 re-win now forces a
  flashy, can't-miss beat: a strobing rainbow overlay with a giant flashing
  **CASCADE!**, the live **×N** multiplier, a screen-shake, and a dozen lightning
  bolts, plus an escalating riser + double-bell + sub-boom sound — so it's no
  longer easy to mindlessly hit spin through a tumble (reduced-motion shows it
  static, no strobe/shake).
- **A real X-ray for the cabinet.** The X-ray toggle now reveals the **last spin
  link by link** in the cabinet — every cascade chain, its symbol + count, the
  multiplier, and the cents it paid (and the Grand when it hits). Immediate, per
  spin, and the heart of the trainer.
- **PAR sheet on the cascade page**, beside the X-ray toggle — the full pay-anywhere
  paytable + the exact, computed RTP (the empty "Strips" tab is hidden for cascade;
  it opens on the Paytable tab).

### Changed
- The CascadeXray sidebar is now all-instant (explainers, ladder, per-cell odds);
  the heavy exact-RTP enumeration moved to the PAR sheet (where a brief spinner is
  expected), so the page never janks and the X-ray toggle has an obvious effect.
  Version → 0.12.1.

## [0.12.0] - 2026-06-19

### Added
- **Temple of Gold — the Featured machine; the floor is back to ten.** A new
  `cascade` engine family: a gaudy 5×4 Aztec **tumble** (the Gonzo's Quest /
  Sweet Bonanza lineage). A symbol landing **8+ times anywhere** on the grid
  pays (scatter / pay-anywhere), shatters, and the survivors fall while fresh
  symbols drop in — chaining up a **×1/×2/×3/×5/×8** ladder, all inside one bet.
  Six **golden idols** light a percent-fed **Grand** (~1 in 51,000; \$100 →
  \$1,000).
- **The floor's first FREE-PLAY machine.** A bespoke gold cabinet runs the real
  engine but never debits a balance. Instead an **honest House Ledger** shows,
  in *real dollars* (never "credits"), what a \$1/spin player **would** have fed,
  won, and lost — settling toward the true RTP — and a per-spin **trick-exposer**
  X-rays the result: **loss-disguised-as-a-win** (the #1 trick), engineered
  **near-miss**, **clean loss**, **genuine win**, and the **Grand** as the carrot
  funded by everyone's losses. The house edge is shown as a fact, inflicted on no
  one. Temple is a **walk-up** machine — playable without starting a session.
- **Exact RTP for a cascade — no Monte-Carlo in the exact path.** A memoized
  **absorbing-Markov DP** over symbol-count states computes the per-spin mean and
  variance exactly (the percent Grand folded at the meter, like the video Grand),
  with admissible probability-bound pruning and a `maxTumbles` cap for
  tractability. **RTP 90.896%**, hit frequency 35.5%; `pnpm verify` confirms it
  against a 5M-spin simulation within 3.5σ (Δrtp 0.012%).
- **Greenfield synth SFX** (`app/utils/audio.ts`): zero-file, CSP-clean Web Audio
  — whirr, win-chimes (a pentatonic climb per cascade link), shatters, drops, and
  a Grand fanfare. A visible sound toggle (default on, unlocked on first gesture),
  reduced-motion-aware.
- A **CascadeXray** teaching panel: plain-English "what's a cascade / a
  progressive / why free play", the symbol odds, the multiplier ladder, and — on
  X-ray — the exact RTP / hit-frequency / volatility / Grand odds, computed live
  (a real enumeration), deferred so the page never janks.

### Changed
- `FLOOR` is ten again (`TEMPLE_OF_GOLD` added; Flameout 21 + Stop & Lock 777 stay
  parked). og-image (svg + regenerated png), social/OG meta, README, and `verify`
  read **ten**. Version → 0.12.0. 526 tests; verify 10/10; a11y 100/100 (desktop +
  mobile); production-CSP console verified clean (the synth audio and the exact
  enumeration both run under the hardened CSP).

## [0.11.1] - 2026-06-19

### Changed
- **Stop & Lock 777 parked — the floor is back to nine.** The shipped hold-and-spin
  cash-collect machine, plus a follow-up spins-economy redesign (3-reel, $1/spin,
  free-spin snowball, a stop-the-777 luck multiplier — explored on the
  `lock-reel-kitsch` branch), both came out technically sound and exact-RTP-verified
  but never felt *fun* enough as a slot. The honest, recurring lesson — the same one
  that parked Flameout 21 — is that inventing a genuinely fun *new* slot is hard when
  the math has to favor the house. Moved `STOP_AND_LOCK_777` from `FLOOR` to `PARKED`
  (now `[FLAMEOUT_21, STOP_AND_LOCK_777]`) — kept resolvable + tested, off the floor.
  Removed the Featured card + the `lock-reel` family group; og-image (svg + regenerated
  png), social/OG meta, README, and `verify` read **nine** again. The code and design
  specs are preserved (the redesign on `lock-reel-kitsch`) for a possible future revisit.

## [0.11.0] - 2026-06-18

### Added
- **Stop & Lock 777 — the Featured machine; the floor is back to ten.** A new
  `lock-reel` engine family: a player-stopped **hold-and-spin cash-collect**
  cabinet (the genre of Lightning Link / Dragon Link / Buffalo Gold), the floor's
  brushed-steel "big daddy" corner machine. Five reels spin nonstop over a 5×4
  grid; you press **STOP** to lock each reel left to right, and every locked cash
  symbol + fixed prize **banks** — nothing is ever wiped out (no bust, no crash).
  When all five are stopped you collect the bet-scaled sum.
- **The 777 bonus is a *real* hold-and-spin, not a re-roll.** Lock three vault-7s
  in one pass and the bonus fires: everything held stays put and every still-empty
  cell respins off **dedicated, ~25× denser bonus reels**, so cash genuinely keeps
  locking. Any new lock resets the respins; the trigger's 7s are sticky and
  upgrade. Filling the whole 20-cell grid awards the **GRAND** — a rare-but-
  reachable dream (~1 in 10,600 rounds), not a showcase you can never hit.
- **Exact RTP 94.5073%/coin** ($0.25 denom, 1–20 coins), computed by the
  `lockReelExactRtp` derivation (base collect + a full bonus-fill DP) and frozen
  in tests; the seeded multi-million-round sim converges inside `verify`'s 3.5σ
  band. Value sits in real bonus locking and the GRAND, not flat sticky-7 upgrades.
- **Bespoke big-daddy cabinet** (its own full-page `GameReelLockReel`): gold bezel
  over brushed steel, three giant vault-7s as the bonus meter, a beveled-chrome
  5×4 grid, and five 3-D metal STOP keys. An **X-ray** surfaces per-reel cash EV,
  the 3-seven trigger odds, and the bonus EV; the **PAR sheet** shows the full
  cash-collect paytable and derivation. The skill-stop interaction is real even
  though every stop is an honest uniform draw (the pachislo stance).
- Floor screen restores the **Featured** card (now Stop & Lock 777), adds the
  `lock-reel` family group, and reads "Ten authentic machines"; floor-card label
  "Stop & Lock", marquee art, and chrome theme entries added.

### Changed
- og-image (svg + regenerated png), social/OG meta, the README, and `verify` now
  read **ten** machines; `verify` iterates all ten and passes. Flameout 21 stays
  `PARKED` (resolvable + tested, off the floor); `PARKED` is now just Flameout 21.

## [0.10.1] - 2026-06-18

### Changed
- **Flameout 21 parked — the floor is back to nine machines.** The
  blackjack-meets-crash game was a good exercise but isn't fun as a slot: a
  risk-free cashable launch at a real (sub-100%) RTP forces low payoff for high
  risk (surviving the whole gauntlet on a weak hand nets a few cents), which
  doesn't read as Vegas-y. It's removed from the selection screen, the Sim Lab
  list, and `verify`.
- **The code is kept, not deleted.** Flameout 21 stays in the repo and is still
  resolvable + covered by its tests (the store resolves a new `ALL_MACHINES` =
  `FLOOR` + `PARKED`); it's simply off the floor. A fuller rework (every launch
  ≥ ×1.0, cash-out gated to reel 3, reworked DP, rocket chrome, sidebar result
  card) is preserved on the `flameout-21-parked` branch for a possible revisit.
- og-image, social meta, and the README updated to nine machines.

### Lesson
- The stop-the-reels dynamic (constantly spinning reels you stop yourself) is
  fine and reusable — see pachislo (Stock Rush). What failed was pairing it with
  a crash economy: at a real RTP, "climb then lose it all" can't pay off the risk.
  A future stop-the-reels game should pair the dynamic with a *collecting* payoff
  (hold-and-spin lock, line wins, a real bonus), not a lose-it-all gamble.

## [0.10.0] - 2026-06-17

### Changed
- **Flameout 21 — a blackjack-meets-crash game — replaces Lucky 21** in the
  `blackjack-reel` family (the floor's tenth machine; the floor is still ten
  machines). The stop-the-reels chassis is reborn as an Aviator-style crash
  game:
  - The two-card deal (reels 1–2, which never crash) sets a **launch
    multiplier** and a climb **velocity** by hand value — closer to 21 launches
    higher and climbs steeper; a 2-card natural launches highest.
  - Reels 3–5 each **climb** (multiplier ×= velocity) or **crash** (lose it
    all), with the crash share escalating ~20% → 33% → 43%.
  - **Cash out any reel** to bank `bet × multiplier`, or ride a hot hand and
    top out by surviving all five.
- **Recalibration to ~97% RTP** (the Aviator standard) under optimal cash/climb
  play — exact `rtpPerCoin` 96.9591%. Because reels 1–2 never crash a player can
  always cash the launch risk-free, so RTP ≥ E[launch]; the launch table
  therefore averages below ×1.0 and the profit comes from the climb. The
  `blackjackReelExactRtp` DP enumerates the two-card deal distribution into a
  closed-form climb/crash policy; the seeded sim cross-check converges within the
  3.5σ band.
- **Dynamic rocket side-chrome + altitude marks** flank the cabinet, rising with
  the climb, and an **in-page result card** replaces the centered result modal
  (the side rockets stay visible at the payoff). The PAR sheet and X-ray now read
  in crash terms (launch/velocity, per-reel crash odds, live EV cash vs climb).
- **Flashy 3-across kitsch floor**: the slot picker is now a three-column neon
  grid with chase-light bulb trim, per-family accents, big glyphs, hover
  lift+glow, and paylines/ways badges; Flameout 21 is the featured machine.

### Fixed
- **Sim Lab now runs Flameout 21.** `simulateSession` implements the
  `blackjack-reel` (crash) family instead of throwing — one paid spin per hand,
  the ante charged once, and the closed-form optimal cash/climb policy driving
  the run (mirroring the convergence sim). Picking Flameout 21 in the Sim Lab
  produces full risk-of-ruin / survival / drawdown / sample-trajectory output;
  its empirical RTP tracks the exact 96.9591% DP behind the house-edge figure.

## [0.9.0] - 2026-06-16

### Added
- **Lucky 21 — Blackjack Bonus**: a true 2-card natural (A + ten-value) ends the
  hand into an optional double-or-nothing gamble on a spinning chromed reel:
  - **STOP** spins the reel for a fair 50/50 outcome: ×2 doubles the amount on
    the line, BUST forfeits it all.
  - **CASH OUT** locks the guaranteed natural payout without risking the gamble.
  - Capped at 3 consecutive doubles (×1 → ×2 → ×4 → ×8); a ladder rung lights
    at each successful double so the player always sees their position.
  - The bonus is RTP-neutral: the fair coin-flip EV equals the forfeited amount,
    so it neither raises nor lowers the machine's RTP.
  - A result-modal gamble chip confirms the final outcome (BUST or the doubled
    amount); X-ray labels the natural correctly throughout the sequence.

### Changed
- **Lucky 21 reel escalation rebalance**: danger and bonuses now scale correctly
  3→4→5, with BUST symbols scattered for drama rather than front-loaded:
  - Reel 3 (lock-in bonus, no cards): 6 BUST + ×2/×3 multipliers + −3 safe room.
  - Reel 4 (mix): 13 BUST + ×3/×5 multipliers + −3 safe room + cards.
  - Reel 5 (big): 20 BUST + ×5/×10 multipliers + cards; surviving reel 5 qualifies
    for Five-Card Charlie.
- **Recalibration**: RTP 90.0255% (was 89.9977%), `naturalPay` 5, Five-Card
  Charlie ≈ 0.77%, house edge ≈ 9.97%. The `blackjackReelExactRtp` DP covers the
  gamble branch; seeded sim cross-check converges within the 3.5σ band.

## [0.8.0] - 2026-06-15

### Added
- **Hit or Bust** — a new machine and a new engine family, `blackjack-reel`
  (the floor's tenth machine). Press-your-luck blackjack reimagined as a
  five-card reel game:
  - Ante a bet; the machine deals two cards, then you **Hit** (reveal the next
    card) or **Stand** (lock the payout) across up to five reels. No dealer —
    you play a scaling paytable by final hand value (21 best, then 20/19/18;
    bust pays nothing).
  - **Additive multiplier cards** (×2 + ×3 = ×5) that contribute nothing to the
    total but scale the payout — tempting you to hit even a strong hand.
  - **Five-Card Charlie** bonus for surviving all five cards, and a rare
    **Bust-Save** that voids one busting card in place so the run continues.
  - **Exact RTP under optimal stopping**: a backward-induction DP over the
    state `(cards drawn, hard total, aces, multiplier sum, save held)`
    enumerates the whole decision tree. Calibrated to 89.9977%; a
    simulate-under-optimal cross-check converges (89.9858% sim, Δ 0.0120%).
  - **PAR sheet** renders the DP-derived hit/stand strategy table and the exact
    bust / Five-Card-Charlie odds; **X-ray** shows the live EV(hit) vs
    EV(stand) at each decision.
  - Bespoke **green-felt card-room chrome** (gold table trim, ♠♥♦♣ corner
    ornaments, chip stacks, neon "HIT OR BUST · 21" sign) — the tenth chrome
    module, via the v0.7.0 chrome system.

### Fixed
- PAR strategy table is now card-count-aware and derived entirely from the DP,
  so it can never contradict the live X-ray (it previously queried the DP with
  card arrays that didn't sum to the stated total). The Bust-Save note now
  correctly reads a null stand-threshold as "HIT on all hard totals" instead of
  "no change".
- Hit or Bust multiplier badge overstated the multiplier by one (showed ×3 while
  the hand paid ×2); it now matches the payout's `max(1, multSum)`.
- Accessibility on the Hit or Bust game screen → 100/100: empty card slots
  carried `aria-label` with no role (now `role="img"` in a `role="group"`
  row), and the X-ray EV footnote met contrast (neutral-400).
- Bet + Deal/Hit/Stand controls wrap on narrow viewports instead of clipping
  the Hit/Stand buttons off-screen.
- `pnpm verify` (and `simulateMachine`/`exactRtp` plumbing) now covers the
  `blackjack-reel` family — the floor verification reports all ten machines.

### Changed
- og-image alt, README, social meta, and the floor intro now read "ten
  machines"; `pnpm verify` covers 10.

## [0.7.0] - 2026-06-14

### Added
- Per-machine decorative cabinet chrome: every machine's reel window is now
  wrapped in a bespoke, gaudy, themed frame. Nine hand-crafted chrome modules:
  - **Ruby of Gargoyle** — gothic stone ring, cathedral arches, bobbing
    gargoyles, Gargoyle's Eye, crimson breathing glow.
  - **Stock Rush** — triple-neon tube frame, kanji big-win sign, chasing
    bulbs, torii ⛩️ and lucky cat 🐱.
  - **Canal Royale** — baroque carnival gold scrollwork, masquerade masks 🎭,
    fluted gold rails, shimmer sweep.
  - **Dragon's Hoard** — fire-breathing dragon 🐉 with soft flame flicker,
    emerald scale-arc border, coin row 🪙.
  - **Thunder Vault** — riveted brushed-steel frame, SVG lightning bolts,
    vault-dial motif, violet/electric-blue glow.
  - **Diamond Doubler** — frosted ice facets, silver rails, prismatic gleam
    sweep, cool restrained sparkle.
  - **Sevens Ablaze** — layered flame shapes licking up from the base, ember
    dots, charred dark frame, hot red/orange glow.
  - **Series E 3-Line** — warm brass gradient, bell finial 🔔, cream bakelite
    corner inlays, tungsten glow; the least animated (period-correct calm).
  - **Series E Multiplier** — same Bally era, cool turquoise + chrome,
    red ×2/×3 multiplier numerals as side ornaments; deliberately distinct
    from the 3-Line so the two Ballys no longer look identical.
- `<GameMachineChrome>` wrapper component: injects per-machine palette as CSS
  variables (`--chrome-accent/secondary/glow/backdrop`) + a radial stage
  backdrop; resolves the active machine's chrome module via a registry.
- `chromeFor()` registry + `DefaultChrome` fallback: future games get per-
  machine chrome by dropping in one `.vue` module and one registry line;
  unknown machines fall back automatically to the accent-framed default.
- Global `prefers-reduced-motion` guard in `main.css`: all chrome ambient
  animation is suppressed with a single `@media` rule so the guard applies to
  every present and future module automatically.

### Notes
- Reels, controls, bet logic, and the engine are **completely unchanged**.
- All chrome is `aria-hidden` + `pointer-events:none` — no accessibility
  regressions; a11y audit remains 100/100.
- CSS/SVG-only hand-built art: no external images, no CSP violations.
- Ambient keyframe motion is subtle throughout (brightness ≈1↔1.1,
  translateY ≤2–3px, opacity glows, durations 3–6s ease-in-out); no
  strobing or rapid blinking anywhere.

### Changed
- Test suite: 363 tests (was 357 at v0.6.0).

## [0.6.0] - 2026-06-14

### Added
- Sim Lab (`/sim-lab`, top-level nav): risk/bankroll Monte-Carlo lab. Runs
  thousands of sessions against any of the nine machines in a Web Worker (UI
  stays responsive; live progress bar + cancel returning partial results). Each
  session plays from a starting bankroll at a fixed bet until bust or a spin
  cap. Headline stats: risk of ruin, median/mean ending bankroll, % ended
  ahead, avg session length, avg max drawdown, empirical RTP, house edge. Four
  inline-SVG charts: survival curve, ending-bankroll histogram, sample session
  trajectories, max-drawdown histogram.
- Learn section (`/learn` index + four topic pages, top-level nav): layered
  "intuition + one live number, then a collapsible rigorous derivation with
  live tables" explainers, all driven by live machine data.
  - **House edge** — floor-wide RTP/house-edge table via `exactRtp()`.
  - **Telnaes virtual reels** — virtual vs physical reel weight mechanics; the
    combined 3-reel jackpot squeeze (~1 in 31,104 virtual vs 1 in 10,648
    physical on Diamond Doubler).
  - **Hold-and-spin** — Ruby of Gargoyle respin-reset as an absorbing Markov
    chain (P(fill)=2.35%, E[final]=10.19 cells).
  - **Gargoyle's Eye** — the additive ×N multiplier gem: ×2.5 expected added
    multiplier; additive ×5 vs multiplicative ×6.
- Engine: `app/engine/sessions.ts` — `simulateSession`, `aggregateSessions`,
  `createSimLabRun` reuse the existing per-spin primitives (`spin`,
  `nextSpinCost`, `initMachineState`); `simulateMachine` is untouched.
- Deploy: CSP extended with `worker-src 'self'`; `/sim-lab` and all `/learn/*`
  routes added to `nitro.prerender.routes`; worker verified loading under the
  production CSP (no blob URL, no CSP violation).

### Changed
- Nav is now **Sim Lab / Learn / History** (was History only).
- Test suite: 357 tests (was 325 at v0.5.0).
- Social meta descriptions updated to reflect Sim Lab and /learn capabilities.

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
- Content-security policy hardened: inline scripts hash-pinned, no
  `unsafe-inline`, `object-src 'none'`.
- Restore is explicitly prototype-pollution-guarded; stepper virtual maps must
  cover every physical stop; reel count is tracked reactively.
- Reel surfaces share a `GameReelColumn` component + `useReelSymbols`
  composable (deduplication, no behaviour change).

### Fixed
- Win display: stepper "count" wins (e.g. cherries) no longer count a wild on
  the line as the paying symbol — a wild neither inflates the chip count nor
  lights a non-winning cell (the engine pays the literal symbol only).
- Bally multi-line hit frequency is computed over the joint reel-stop
  distribution; treating paylines as independent had under-reported it.
- Held result, payline drawing, and winning-cell glow reflect the actual
  matched run rather than the full payline; feature wins no longer emit a
  stray "0" chip and scatter wins glow their real grid cells.
- Dual progressive payouts are floored, preserving the integer-cents wallet
  invariant even for a corrupt restored meter.

## [0.4.0] - 2026-06-13

### Added
- Slot-machine reel presentation: filled-duotone symbol icons, vertically
  spinning reels with staggered ease-out (reduced-motion snap), drawn paylines
  with winning-cell glow and gutter line numbers, a held result bar (gross win,
  bankroll, literal per-line chips, bankroll sparkline), a per-machine marquee,
  and a denomination tag. Presentation only — the engine, RTP, and money model
  are unchanged (a display `icon?` field was added to symbol metadata).

## [0.3.0] - 2026-06-12

### Added
- Playable UI: casino floor with family-grouped machine cards and X-ray intel,
  per-family game surfaces (video lines/ways/hold-and-spin board, stepper
  payline glass, Bally dual alternating progressive meters, pachislo with
  HUMAN stop presses and visible slip), PAR-sheet modal with the exact-math
  derivation, X-ray side panel (labeled RNG trace, near-miss callouts,
  session-vs-exact convergence sparkline, machine internals), history page
  with text export.
- Session store: single-wallet cents model, atomic spins, versioned
  localStorage persistence with sanitize-on-load, EXACT mid-feature restore,
  per-machine progressive meters that persist across sessions, pachislo
  operator key (six computed odds levels).
- Engine seams: optional player presses on spinPachislo, nextSpinCost,
  pure nearMisses module (provably non-payout-affecting).

### Changed
- verify-floor: pachislo sub-runs 10 → 20; hit frequency now banded too.
- CI enforces engine purity (no UI imports under app/engine).

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

## [0.1.0] - 2026-06-12

### Added
- Project scaffold: Nuxt 4 SPA with family conventions (pnpm, @nuxt/ui,
  Tailwind 4, Pinia, Vitest, Netlify static preset, strict CSP).
- Headless engine (`app/engine/`): seeded mulberry32 RNG, award matching,
  uniform-stop Bally-EM evaluator, Telnaes virtual-reel stepper evaluator,
  FO-5140 progressive controllers (dual toggle / single / percent feed),
  exact-RTP enumeration with variance and per-entry breakdown, machine
  validation, seeded batch simulation.
- Four calibrated machines with frozen exact math: Diamond Doubler
  (94.7442%), Sevens Ablaze (94.4881% @ reset), Series E 3-Line (89.0351%),
  Series E Multiplier (89.1264% @ 3 coins).
- Verification: frozen-calibration tests, chi-squared RNG/distribution
  tests, 3.5-sigma convergence suite, `pnpm verify` floor report CLI.
