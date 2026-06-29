# README Update (DnD 5enemy) Implementation Plan

## Overview

Replace the stale "10x Astro Starter" boilerplate `README.md` with an accurate
contributor-facing README for **DnD 5enemy** — the AI D&D 5e encounter
generator this repo actually is. The goal (roadmap S-14) is that a new
contributor can clone, configure, and run the app without having to ask: correct
product identity and feature list, the real tech stack, **all** required
environment variables (including the currently-undocumented `ANTHROPIC_API_KEY`),
real Supabase migration steps, the complete npm script set, and correct
CI/deployment instructions.

This is a documentation-only change. No application code is modified.

## Current State Analysis

The README at [README.md](README.md) still describes the upstream starter
template, and several sections are not merely incomplete but **factually wrong**:

- **Identity** — titled "10x Astro Starter" with a generic template tagline
  ([README.md:1-5](README.md#L1-L5)). Clone URL points at
  `przeprogramowani/10x-astro-starter` ([README.md:26](README.md#L26)). A
  template banner image is referenced ([README.md:3](README.md#L3)).
- **Missing core dependency** — the product's entire value is AI generation via
  `@ai-sdk/anthropic` + `ai` (Claude Sonnet 4.6, [src/lib/ai.ts:59](src/lib/ai.ts#L59)).
  `ANTHROPIC_API_KEY` is a **required** server secret
  ([astro.config.mjs:43](astro.config.mjs#L43), present in `.env.example`) but is
  never mentioned in the README.
- **False migration claim** — [README.md:114](README.md#L114) states "No database
  tables or migrations are required." Reality: 7 migrations exist in
  [supabase/migrations/](supabase/migrations/) (campaigns, battles, enemies, FK
  indexes, campaign description, battle environment, battle main enemy), all with
  RLS per AGENTS.md conventions.
- **Stale scripts** — [README.md:50-57](README.md#L50-L57) omits `test`,
  `test:watch`, `test:coverage`, `typecheck`, `test:e2e`, `test:e2e:ui`, and
  `e2e-test` (all in [package.json:11-19](package.json#L11-L19)).
- **Stale CI section** — [README.md:169-171](README.md#L169-L171) says "lint +
  build on `master`." The real workflow runs on `main` and does lint → typecheck
  → test → build, plus a **deploy** job to Cloudflare on push to `main`
  ([.github/workflows/](.github/workflows/)).
- **Outdated structure / unmentioned features** — Paraglide i18n (EN/PL,
  `messages/en.json` + `pl.json`, configured in
  [astro.config.mjs](astro.config.mjs#L18-L24)), shadcn/ui, PDF export
  (`pdf-lib` / `pdf-fontkit`), `src/lib/`, `src/paraglide/`, `src/middleware.ts`,
  `src/types.ts`, and `tests/` are all absent from the structure block
  ([README.md:59-71](README.md#L59-L71)). Cloudflare config now carries a KV
  `SESSION` binding and app name `dnd-5enemy` ([wrangler.jsonc](wrangler.jsonc)).
- **Hook ambiguity** — `.husky/pre-commit` runs `lint-staged` (active);
  `lefthook.yml` is also present but is the unmodified example file with one
  appended block. AGENTS.md documents only husky + lint-staged. The README will
  document husky + lint-staged (the wired hook) and ignore `lefthook.yml`.

The accurate stack, gathered from [package.json](package.json) and config:
Astro 6 SSR + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui (new-york) +
Supabase (SSR Auth + Postgres) + Anthropic via Vercel AI SDK + Paraglide JS i18n
+ pdf-lib/pdf-fontkit, deployed on Cloudflare Workers, tested with Vitest +
Playwright.

## Desired End State

`README.md` describes DnD 5enemy accurately. A contributor who has never seen the
project can read it top to bottom and: understand what the app does, install
prerequisites, set all three env vars, stand up Supabase locally (or point at a
cloud project) **with migrations applied**, run the dev server, run the test
suites, and deploy to Cloudflare — with every documented command verified to work
against the actual repo. No section contradicts the real codebase.

### Key Discoveries:

- `ANTHROPIC_API_KEY` is required and currently undocumented
  ([astro.config.mjs:43](astro.config.mjs#L43), [src/lib/ai.ts:47](src/lib/ai.ts#L47)).
- The "no migrations needed" claim is false — 7 SQL migrations exist
  ([supabase/migrations/](supabase/migrations/)).
- CI runs on `main` (not `master`) with typecheck + test added, plus a deploy job
  ([.github/workflows/](.github/workflows/)).
- Local secrets live in **both** `.env` and `.dev.vars`; `.env.example` is the
  template for the three secrets; e2e uses a separate `.env.e2e`
  (`E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BASE_URL`).
- Active pre-commit hook is `.husky/pre-commit` → `lint-staged`
  ([package.json:81-88](package.json#L81-L88)).

## What We're NOT Doing

- Not modifying any application code, config, migrations, or AGENTS.md.
- Not resolving the husky-vs-lefthook duplication (a separate cleanup) — the
  README documents only the active husky hook.
- Not adding screenshots/GIFs or a marketing-style hero (chose brief
  intro + feature list).
- Not changing `.env.example`, `wrangler.jsonc`, or CI workflow files.
- Not documenting unreleased/parked roadmap features (player access, VTT
  integrations, offline mode).

## Implementation Approach

Rewrite `README.md` in a single pass, section by section, preserving the parts of
the existing structure that are already correct (the overall section ordering,
the local-Supabase Docker walkthrough, the auth-routes table) and correcting or
adding the rest. Use the existing repo as the source of truth for every command
and path — do not invent steps. Then verify by actually running the documented
commands and a clean Supabase migration apply, so the "accuracy" promise is real
rather than asserted.

## Phase 1: Rewrite README.md

### Overview

Produce the full, accurate README in one edit covering identity, features, stack,
prerequisites, getting started, environment variables, Supabase (local + cloud +
migrations + RLS), scripts, project structure, i18n, pre-commit hook, deployment,
and CI.

### Changes Required:

#### 1. Header & product intro

**File**: `README.md`

**Intent**: Replace the "10x Astro Starter" title and template tagline with the
DnD 5enemy identity — a short paragraph framing the product (a GM types a
natural-language combat scenario and receives a set of balanced, 5e-valid enemy
cards) followed by a concise feature bullet list. Remove the stale template
banner image reference.

**Contract**: New `# DnD 5enemy` H1; 2–3 sentence intro lifted/condensed from the
roadmap Vision recap; a `## Features` bullet list covering campaigns, battles,
AI encounter generation (Claude Sonnet 4.6), battle environment, main-enemy
profile, PDF export, EN/PL i18n, and Supabase auth. No `![](./public/template.png)`.

#### 2. Tech Stack

**File**: `README.md`

**Intent**: Update the stack list to match `package.json` — add the AI SDK,
Paraglide i18n, shadcn/ui, and PDF tooling; keep the existing accurate entries.

**Contract**: Bullet list: Astro 6, React 19, TypeScript 5, Tailwind 4,
shadcn/ui (new-york), Supabase (Auth + Postgres), Anthropic via Vercel AI SDK
(`ai` + `@ai-sdk/anthropic`), Paraglide JS (EN/PL), pdf-lib/pdf-fontkit, Vitest +
Playwright, Cloudflare Workers.

#### 3. Prerequisites & Getting Started

**File**: `README.md`

**Intent**: Keep the Node 22 / npm prerequisites and the clone → install → run
flow, but replace the upstream clone URL with a generic placeholder and make the
env-setup step point at all three secrets and the migration step.

**Contract**: `git clone <your-fork-url>` placeholder; `npm install`; copy
`.env.example` → `.env` and `.dev.vars`; cross-reference the Supabase section for
migrations; `npm run dev`.

#### 4. Environment Variables

**File**: `README.md`

**Intent**: Add an explicit env-vars table/section documenting all three secrets,
making clear `ANTHROPIC_API_KEY` is required for generation and that secrets live
in both `.env` and `.dev.vars`. Note the separate `.env.e2e` for e2e tests.

**Contract**: Table with `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`
(source + purpose each); note these are server-only secrets via `astro:env`; note
`.env.e2e` keys (`E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BASE_URL`) for Playwright.

#### 5. Supabase Configuration (local + cloud + migrations)

**File**: `README.md`

**Intent**: Correct the false "no migrations required" statement. Keep both the
local Docker stack walkthrough and the cloud-project path, and add the
migration-apply step plus an RLS note to each. Preserve the email-confirmation and
auth-routes subsections (still accurate).

**Contract**: Local path keeps `supabase init` / `start` / `stop`; **replace** the
"No database tables or migrations are required" line with a migration-apply step
(`npx supabase db push` for local, or `npx supabase migration up`) referencing
[supabase/migrations/](supabase/migrations/); add a one-line "all tables have RLS
enabled" note. Cloud path gains the same migration step. Keep the auth-routes
table and `PROTECTED_ROUTES`/`src/middleware.ts` note.

#### 6. Available Scripts

**File**: `README.md`

**Intent**: List every script from `package.json`, grouped (dev/build, quality,
test).

**Contract**: Add `typecheck` (`astro check`), `test`, `test:watch`,
`test:coverage`, `test:e2e`, `test:e2e:ui`, `e2e-test`; keep `dev`, `build`,
`preview`, `lint`, `lint:fix`, `format`.

#### 7. Project Structure

**File**: `README.md`

**Intent**: Replace the outdated tree with one reflecting the real `src/` layout
and key root files.

**Contract**: Tree includes `src/{components,layouts,pages,pages/api,lib,
paraglide,styles}`, `src/middleware.ts`, `src/types.ts`, `supabase/migrations/`,
`messages/{en,pl}.json`, `tests/`, `wrangler.jsonc`. Drop nonexistent
`src/assets/` if not present (verify against repo before writing).

#### 8. Internationalization note

**File**: `README.md`

**Intent**: Add a short section noting the app ships EN + PL via Paraglide JS,
cookie-based locale, with translation strings in `messages/en.json` + `pl.json`.

**Contract**: 2–4 lines; point at `messages/` and the navbar language toggle;
mention AI-generated content follows the active locale.

#### 9. Pre-commit hook

**File**: `README.md`

**Intent**: Document the active husky + lint-staged pre-commit behavior so
contributors know what runs on commit.

**Contract**: One short subsection: `.husky/pre-commit` runs `lint-staged`
(ESLint fix on `*.{ts,tsx,astro}`, Prettier on `*.{json,css,md}`). Do not mention
`lefthook.yml`.

#### 10. Deployment & CI

**File**: `README.md`

**Intent**: Correct the deploy/CI sections to match the real Cloudflare config and
GitHub Actions workflow.

**Contract**: Deploy: `npm run build` → `npx wrangler deploy`; app name
`dnd-5enemy`; set `SUPABASE_URL`, `SUPABASE_KEY`, **`ANTHROPIC_API_KEY`** as
Wrangler secrets; mention the KV `SESSION` binding requirement. CI: runs on `main`
(lint → typecheck → test → build) with an auto-deploy job on push to `main`;
repo secrets `SUPABASE_URL` / `SUPABASE_KEY` required.

### Success Criteria:

#### Automated Verification:

- Prettier accepts the file: `npx prettier --check README.md`
- No broken relative links to repo paths the README references (manual grep of
  referenced paths exists): all of `supabase/migrations/`, `.env.example`,
  `src/middleware.ts`, `messages/en.json`, `messages/pl.json`, `wrangler.jsonc`
  resolve.

#### Manual Verification:

- README opens with DnD 5enemy identity + feature list; no "10x Astro Starter"
  or template-banner references remain.
- All three env vars (incl. `ANTHROPIC_API_KEY`) are documented with source and
  purpose.
- The false "no migrations required" line is gone; a migration-apply step is
  present in both local and cloud Supabase paths with an RLS note.
- Scripts section lists every script in `package.json`.
- Deployment lists `ANTHROPIC_API_KEY` as a required Wrangler secret; CI section
  references `main` (not `master`) and the deploy job.

**Implementation Note**: After this phase and the automated checks pass, pause for
human confirmation before Phase 2's verification run.

---

## Phase 2: Verify documented commands

### Overview

Prove the README's instructions are true by running the documented commands and a
clean migration apply against the actual repo. The point of S-14 is accuracy, so
verification is a first-class phase, not an afterthought.

### Changes Required:

#### 1. Command + setup verification (no file changes)

**File**: _(verification only — no source edits unless a discrepancy is found)_

**Intent**: Execute the documented quality/test/build commands and confirm the
Supabase migration step applies cleanly, correcting any README step that turns out
to be inaccurate.

**Contract**: Run `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run build`; confirm `npx supabase` migration command name is correct for this
repo's CLI version; spot-check that `.env.example` keys match the documented env
table. Any mismatch → fix the README text (loops back into Phase 1 content), not
the code.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npm run typecheck`
- Unit tests pass: `npm run test`
- Production build succeeds: `npm run build`
- Prettier check passes: `npx prettier --check README.md`

#### Manual Verification:

- The documented Supabase migration command applies the 7 migrations cleanly
  against a fresh local stack (or is confirmed correct for the installed CLI).
- A reader following only the README (no tribal knowledge) could reach a running
  dev server — sanity-checked by walking the steps top to bottom.
- No documented command in the README is missing or misnamed relative to
  `package.json`.

**Implementation Note**: This phase changes no source code; if verification
surfaces an inaccurate instruction, the fix is an edit to `README.md`.

---

## Testing Strategy

### Manual Testing Steps:

1. Read the README top to bottom as a newcomer; confirm the narrative flows from
   "what is this" → setup → run → test → deploy with no gaps.
2. Run each documented command and confirm it behaves as described.
3. Verify every repo path referenced in the README actually exists.
4. Confirm no stale starter references (`10x Astro Starter`, `master`,
   `przeprogramowani/10x-astro-starter`, template banner, "no migrations
   required") remain.

## References

- Roadmap slice S-14: `context/foundation/roadmap.md` (readme-update)
- Source of truth: `package.json`, `astro.config.mjs`, `wrangler.jsonc`,
  `supabase/migrations/`, `.github/workflows/`, `src/lib/ai.ts`
- Conventions: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Rewrite README.md

#### Automated

- [ ] 1.1 Prettier accepts the file: `npx prettier --check README.md`
- [ ] 1.2 All repo paths referenced in the README resolve (migrations, .env.example, middleware, messages, wrangler)

#### Manual

- [ ] 1.3 README opens with DnD 5enemy identity + feature list; no starter/template references remain
- [ ] 1.4 All three env vars (incl. ANTHROPIC_API_KEY) documented with source and purpose
- [ ] 1.5 False "no migrations" line gone; migration-apply step + RLS note in both Supabase paths
- [ ] 1.6 Scripts section lists every script in package.json
- [ ] 1.7 Deployment lists ANTHROPIC_API_KEY as a Wrangler secret; CI references main + deploy job

### Phase 2: Verify documented commands

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Type check passes: `npm run typecheck`
- [ ] 2.3 Unit tests pass: `npm run test`
- [ ] 2.4 Production build succeeds: `npm run build`
- [ ] 2.5 Prettier check passes: `npx prettier --check README.md`

#### Manual

- [ ] 2.6 Documented Supabase migration command applies the 7 migrations cleanly (or confirmed correct for installed CLI)
- [ ] 2.7 A reader following only the README reaches a running dev server
- [ ] 2.8 No documented command is missing or misnamed relative to package.json
