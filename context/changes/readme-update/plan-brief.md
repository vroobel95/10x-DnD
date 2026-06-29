# README Update (DnD 5enemy) — Plan Brief

> Full plan: `context/changes/readme-update/plan.md`

## What & Why

The repo's `README.md` is still the upstream "10x Astro Starter" boilerplate — it
never mentions DnD 5enemy, omits the required `ANTHROPIC_API_KEY`, and even
claims "no database tables or migrations are required" (false: 7 migrations
exist). We're rewriting it so a new contributor can clone, configure, and run the
AI D&D 5e encounter generator without having to ask (roadmap S-14).

## Starting Point

`README.md` describes a generic starter: wrong title and clone URL, missing the AI
SDK / i18n / PDF stack, stale scripts, a false migrations claim, and a CI section
pointing at `master` (real CI runs on `main` with typecheck + test + a deploy
job). The rest of the structure (section ordering, local-Supabase walkthrough,
auth-routes table) is sound and will be preserved.

## Desired End State

A contributor reads the README top to bottom and understands what the app does,
sets all three env vars, stands up Supabase **with migrations applied** (local or
cloud), runs the dev server and test suites, and deploys to Cloudflare — every
documented command verified against the real repo.

## Key Decisions Made

| Decision           | Choice                                          | Why (1 sentence)                                              | Source  |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------ | ------- |
| Scope              | Full product README rewrite                     | Accuracy patch would leave the README reading as a template. | Plan    |
| Framing            | Brief intro + feature list                      | Orients a newcomer fast without screenshot upkeep.           | Plan    |
| Supabase docs      | Keep local + cloud, both with a migration step  | Covers both setups and fixes the false "no migrations" line. | Plan    |
| Stale visuals/repo | Drop template banner + przeprogramowani URL     | README should state only what's true today.                  | Plan    |
| Git hook docs      | Document husky + lint-staged (active hook)       | `.husky/pre-commit` is wired; `lefthook.yml` is unused.      | Plan    |

## Scope

**In scope:** full `README.md` rewrite — identity + features, tech stack,
prerequisites, getting started, env vars (incl. `ANTHROPIC_API_KEY`), Supabase
(local + cloud + migrations + RLS), scripts, project structure, i18n note,
pre-commit hook, deployment, CI; verify documented commands run.

**Out of scope:** any code/config/migration/AGENTS.md change; resolving the
husky-vs-lefthook duplication; screenshots/marketing hero; parked roadmap
features.

## Architecture / Approach

Single-pass rewrite of one file, section by section, using the repo
(`package.json`, `astro.config.mjs`, `wrangler.jsonc`, `supabase/migrations/`,
`.github/workflows/`, `src/lib/ai.ts`) as the source of truth — then a
verification pass that actually runs the documented commands so the accuracy
promise is real.

## Phases at a Glance

| Phase                        | What it delivers                              | Key risk                                          |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------- |
| 1. Rewrite README.md         | Accurate, complete contributor README         | Missing a stale claim or an undocumented env var. |
| 2. Verify documented commands| Proof every documented step actually works    | A documented command/migration step is wrong.     |

**Prerequisites:** none (fully independent doc change).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes the correct Supabase migration command for the installed CLI is
  `supabase db push` / `migration up` — verified in Phase 2.
- `lefthook.yml`'s presence is left unresolved by design; documenting only husky
  could surprise someone who later notices lefthook.

## Success Criteria (Summary)

- README describes DnD 5enemy accurately with no starter/template leftovers.
- All three env vars and the real migration steps are documented.
- Every documented command runs successfully (lint, typecheck, test, build).
