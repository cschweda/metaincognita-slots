# Learn Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the glossary completion pass (7 app-surfaced terms) and `/learn/psychology` per `docs/superpowers/specs/2026-07-10-learn-finish-design.md`, then run the owner's push protocol (README pass, v0.13.0, timestamp rewrite, push).

**Architecture:** Pure presentation on existing rails — glossary entries into the existing `entries` array; psychology page mirrors `myths.vue` and reuses the cached `ldwExperimentAsync()` (no new experiment/worker code).

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup lang="ts">` (versions per package.json: nuxt ^4.4.2, vue ^3.5.38), vitest 4 + happy-dom, pnpm.

## Global Constraints

Same as the content-trio plan: no semicolons / single quotes / explicit return types; per-task gate `pnpm lint` + targeted `pnpm vitest run` (real exit codes, no pipes); no `pnpm dev`/`pnpm generate` during `pnpm check`; conventional commits, **no AI trailers**; money/percent via `~/utils/format`.

---

### Task 1: Glossary completion (7 terms) + tests

**Files:** Modify `app/pages/learn/glossary.vue`, `tests/components/learnPages.test.ts`.

- [ ] Extend the glossary tests: term list gains `'rng', 'pachislo', 'variable-ratio', 'illusion of control', 'time on device'`; anchor list gains `'rng', 'n0', 'variable-ratio'`. Run → FAIL.
- [ ] Insert the 7 entries alphabetically by term (ids: `illusion-of-control`, `n0`, `pachislo`, `reg-big-jac`, `rng`, `time-on-device`, `variable-ratio`), links per spec.
- [ ] `pnpm vitest run tests/components/learnPages.test.ts && pnpm lint` → PASS.
- [ ] Commit `feat(learn): glossary completion — 7 app-surfaced terms (RNG, pachislo bonuses, N₀, psychology trio)`.

### Task 2: `/learn/psychology` + hub card + tests

**Files:** Create `app/pages/learn/psychology.vue`; modify `app/pages/learn/index.vue`, `tests/components/learnPages.test.ts`.

**Interfaces consumed:** `ldwExperimentAsync()` from `~/utils/rtpClient`; `LDW_PAID_SPINS`, `LdwExperimentResult` from `~/utils/ldwExperiment`; `formatPercent` from `~/utils/format`; `LearnSection`.

- [ ] Tests first (myths-style describe): mount + 2 ticks → text contains `reinforcement`, `illusion of control`, `time on device`, `loss disguised as a win`; matches `/63\.3\d%/`; links to `/learn/ldw-near-miss` and `/learn/pachislo` exist. Run → FAIL (import dies).
- [ ] Page per spec §2 (six LearnSections, `onMounted` fill from `ldwExperimentAsync`, SSG-safe 'measuring…' fallbacks).
- [ ] Hub card #10: `{ to: '/learn/psychology', icon: 'i-lucide-brain', title: 'The psychology of the floor', blurb: '...' }` after myths, before glossary.
- [ ] `pnpm vitest run tests/components/learnPages.test.ts tests/utils/learnLink.test.ts && pnpm lint` → PASS.
- [ ] Commit `feat(learn): psychology page — the floor's persuasion toolkit, demonstrated on this floor's own machinery`.

### Task 3: README/branding pass + v0.13.0

**Files:** Modify `README.md`, `CHANGELOG.md`, `package.json`.

- [ ] Read README end-to-end; fold in everything unshipped since v0.12.1: floor sound, worker offload (zero long tasks), glossary (39 terms), game→learn links, myths lab, Sim Lab live math panel + overlay, History plain-English + takeaway, psychology page; learn hub = 10 pages. Reread for structure/order per the house habit.
- [ ] CHANGELOG: add psychology/glossary bullets under Unreleased, then retitle `## [Unreleased]` → `## [0.13.0] - 2026-07-10`.
- [ ] `package.json` version `0.12.1` → `0.13.0`. Check og-image/social copy still true (ten machines — unchanged).
- [ ] `pnpm vitest run tests/components/learnPages.test.ts && pnpm lint` → PASS. Commit `docs: README + CHANGELOG for v0.13.0 (sound, worker, content trio, learn finish)` + `chore: v0.13.0`.

### Task 4: Full gate + production-CSP smoke

- [ ] `pnpm check` (foreground exit code) → PASS.
- [ ] `pnpm generate && pnpm smoke`; verify served CSP == dist/_headers; drive `/learn/psychology` (numbers fill, zero console errors), glossary anchor `#rng` resolves, hub shows 10 cards.

### Task 5: Timestamp rewrite + push

- [ ] Enumerate `origin/main..HEAD`; the 28 commits stamped Thu 2026-07-09 16:44–18:37 (Mon–Fri 7am–7pm) get new dates 19:02–21:09 same evening (~4.6-min spacing, order preserved); later commits keep their (already off-hours) dates. `git filter-branch --env-filter` over the range; assert `HEAD^{tree}` unchanged.
- [ ] Any commit made today after 07:00 also gets moved (to Fri 05:0x–06:5x or ≥19:02 — must stay in the past).
- [ ] `git push origin main`; update memory (handoff + state files) with final hashes.
