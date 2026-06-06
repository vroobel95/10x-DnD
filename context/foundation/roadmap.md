---
project: "DnD 5enemy"
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-06
prd_version: 1
main_goal: speed
top_blocker: external
---

# Roadmap: DnD 5enemy

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

D&D 5e Game Masters lose preparation time hunting stat blocks and manually adjusting them to party level — no tool generates a balanced, context-aware _combat scenario_ on demand. DnD 5enemy is that tool: the GM types a natural-language description of the encounter (e.g., "2 ice wolves and a frost troll on level 5 in a frozen cave") and receives a complete set of enemy cards — multiple enemy types, balanced together, with full D&D 5e-valid stat blocks. The differentiator is encounter-level generation (a group of enemies, balanced as a unit), not monster-level generation (one monster at a time).

## North star

**S-02: first-gated-generation** — the smallest complete user flow, from typing a combat request to having confirmed enemies saved to a battle, that proves the core product hypothesis: the AI can generate valid D&D 5e stat blocks from natural language and the app can persist them reliably.

> The north star is the smallest end-to-end slice whose successful delivery proves the core hypothesis — placed as early as Prerequisites allow because everything else only matters if this works. It maps directly to the primary Success Criterion: "The full flow working end-to-end = the product works."

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                                                   | Prerequisites    | PRD refs                       | Status           |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------ | ---------------- |
| F-01 | data-schema                   | (foundation) campaigns, battles, and enemy tables deployed via migrations with RLS                     | —                | FR-002, FR-005, FR-007, FR-009 | impl_reviewed    |
| S-01 | create-battle                 | create a battle within their auto-created campaign and see it listed in the app                        | F-01             | FR-002                         | impl_reviewed    |
| S-02 | first-gated-generation        | type a natural-language combat scenario request, see AI-generated enemy cards, and confirm them        | S-01, F-01       | US-01, FR-003, FR-004, FR-005  | impl_reviewed    |
| S-03 | enemy-post-confirm-management | edit a confirmed enemy's stats and remove a confirmed enemy from a battle                              | S-02             | FR-007, FR-009                 | proposed         |
| S-04 | password-reset                | reset a forgotten password via email link and regain access to the app                                 | —                | FR-010                         | proposed         |
| S-05 | campaign-management           | see a list of campaigns, choose one, create or delete; battle delete folded in (FR-011)                | F-01, S-01       | FR-001, FR-011                 | proposed         |
| S-06 | delete-battle                 | _(folded into S-05)_                                                                                   | S-05             | FR-011                         | folded into S-05 |
| S-07 | pdf-export                    | export a battle's confirmed enemy cards as a printable PDF                                             | S-02, S-03, S-05 | FR-012                         | proposed         |
| S-08 | ux-improvements               | see DnD 5enemy branding on the landing page and get visual feedback during page loads and form submits | —                | —                              | proposed         |
| S-09 | battle-environment            | see AI-generated atmospheric and environmental details for a battle (terrain, hazards, ambiance)        | S-01             | —                              | proposed         |
| S-10 | main-enemy-profile            | if a battle has a main enemy, see its generated narrative description, unique characteristics, and 3 roleplay dialogue lines | S-02 | —               | proposed         |
| S-11 | sentry-setup                  | server errors, unhandled exceptions, and AI generation failures surface in Sentry with environment context                  | —    | —               | proposed         |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 + Tailwind 4 + shadcn/ui; pages at `src/pages/`, components at `src/components/`
- **Backend / API:** partial — three auth-only API routes (`src/pages/api/auth/`); no application endpoints yet
- **Data:** partial — Supabase client integrated (`src/lib/supabase.ts`); no schema or migration files present
- **Auth:** present — Supabase SSR Auth, route-guard middleware (`src/middleware.ts`), sign-in/sign-up/sign-out flows complete
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`) + GitHub Actions CI/CD (`.github/workflows/ci.yml`)
- **Observability:** partial — `observability.enabled: true` in `wrangler.jsonc`; no application-level logging or error tracking

## Foundations

### F-01: Data schema

- **Outcome:** (foundation) campaigns, battles, and enemy tables are deployed via Supabase migrations with RLS enabled; the app can read and write all entities required by the must-have flows.
- **Change ID:** data-schema
- **PRD refs:** FR-002, FR-005, FR-007, FR-009
- **Unlocks:** S-01 (battle creation requires a battles table), S-02 (generation + confirmation requires battles and enemies tables), S-03 (edit/remove require the enemies table)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** sequenced first because every must-have slice depends on the data layer; schema decisions made here are load-bearing — correcting a wrong data model is cheap before any slice ships and expensive after S-02 is live.
- **Status:** impl_reviewed

## Slices

### S-01: Create and list battles

- **Outcome:** user can create a battle within their auto-created campaign and see it listed in the app.
- **Change ID:** create-battle
- **PRD refs:** FR-002
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** sequenced immediately after F-01 because the generation flow (S-02) requires a battle context; this slice is intentionally thin — a clean battle-creation step that unblocks the north star with minimal scope.
- **Status:** impl_reviewed

### S-02: Generate → view → confirm enemies

- **Outcome:** user can type a natural-language combat scenario request, see AI-generated D&D 5e enemy cards (name, level, stat block, abilities), and confirm or deny each card individually; confirmed cards are persisted to the battle and visible in subsequent sessions.
- **Change ID:** first-gated-generation
- **PRD refs:** US-01, FR-003, FR-004, FR-005
- **Prerequisites:** S-01, F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which AI provider and model will generate D&D 5e stat blocks from Cloudflare Workers? (API key, SDK compatibility with workerd runtime, latency profile under the NFR "within a few seconds", structured JSON output strategy to guarantee D&D 5e-legal stat values.) — Owner: developer. Block: yes.
- **Risk:** the AI generation is the product's riskiest assumption — the model may produce stat blocks that fail D&D 5e validity checks (impossible ability scores, illegal HP/AC ranges), requiring retry logic or prompt-engineering iteration; prompt design is not specified in the PRD and will surface as its own unknowns during `/10x-plan`. Sequenced directly after S-01 to validate the core hypothesis as early as the deadline allows.
- **Status:** impl_reviewed

### S-03: Edit and remove confirmed enemies

- **Outcome:** user can edit a confirmed enemy's ability scores or stats (edit existing fields only; no adding or removing abilities), and remove a confirmed enemy from a battle entirely.
- **Change ID:** enemy-post-confirm-management
- **PRD refs:** FR-007, FR-009
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** sequenced last among must-haves because both FRs are post-confirmation operations that only make sense once an enemy has been generated and saved; FR-009 (remove) is what makes FR-005 (confirm) reversible and safe to use at the table — it completes the MVP contract.
- **Status:** proposed

### S-04: Reset password

- **Outcome:** GM who has forgotten their password can request a reset email, follow the link, set a new password, and regain access to the app.
- **Change ID:** password-reset
- **PRD refs:** FR-010
- **Prerequisites:** — (Supabase Auth already in place)
- **Parallel with:** S-03, S-05 — touches only auth pages; zero file overlap with any other slice
- **Blockers:** —
- **Unknowns:** —
- **Risk:** low — Supabase's built-in reset flow (`resetPasswordForEmail` + PKCE redirect) handles the token lifecycle; implementation is two pages and a link on the sign-in form. The `/api/auth/callback` route required for email confirmation (added as a bug fix 2026-06-01) handles the PKCE code exchange for password reset too.
- **Status:** proposed

### S-05: Create and manage campaigns

- **Outcome:** after logging in, GM sees a list of their campaigns and can choose one, create a new campaign, or delete an existing campaign (FR-011 folded in); selecting a campaign navigates to its battle list.
- **Change ID:** campaign-management
- **PRD refs:** FR-001, FR-011
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03, S-04 — no file overlap with either (S-03 is component-only; S-04 is auth-only)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** this slice is the widest in the roadmap — it rewrites the navigation architecture (root `/` → `/campaigns`, battle list moves to `/campaigns/[id]`, back-links in `battles/[id].astro` and `battles/new.astro` update). The `getUserCampaign` helper in `lib/campaigns.ts` changes contract (single → selectable); all callers (`battles/index.astro`, `battles/[id].astro`, `battles/new.astro`, `api/battles.ts`) must be migrated in the same PR. FR-011 (delete battle) is folded in: it adds one button and one API endpoint (`DELETE /api/battles/[id]`) to the campaign page this slice creates — keeping S-06 separate would produce a PR that modifies a file that doesn't exist in main yet. S-07 (PDF) also writes `battles/[id].astro`; that slice must be based on this slice's version, not the original.
- **Status:** proposed

### S-06: Delete battle (folded into S-05)

- **Outcome:** folded into S-05 — see S-05 notes. Keeping as a roadmap entry for traceability.
- **Change ID:** delete-battle
- **PRD refs:** FR-011
- **Prerequisites:** S-05
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** none as a standalone — the scope is one button and one `DELETE /api/battles/[id]` endpoint. Folded into S-05 because the target page (`campaigns/[id].astro`) is created by S-05 and does not exist in `main` beforehand.
- **Status:** folded into S-05

### S-07: Export battle as PDF

- **Outcome:** GM can export a battle's confirmed enemy cards as a printable PDF, one card per enemy, suitable for use at the table.
- **Change ID:** pdf-export
- **PRD refs:** FR-012
- **Prerequisites:** S-02, S-03, S-05
- **Parallel with:** — (must be sequenced after both S-03 and S-05)
- **Blockers:** —
- **Unknowns:**
  - Which PDF generation approach is compatible with Cloudflare Workers (workerd runtime)? Puppeteer/Chromium is unavailable; candidates are `pdf-lib` (pure JS), an external HTML-to-PDF API, or Cloudflare Browser Rendering (beta/paid). Requires a spike to confirm bundle size and runtime compatibility. — Owner: developer. Block: soft (implementation can't start until approach is picked).
- **Risk:** two sources of risk. (1) PDF generation on Cloudflare Workers — the workerd runtime prohibits most node-native and browser-headless approaches; spike required before planning. (2) `battles/[id].astro` write conflict with S-05 — both slices modify this file; S-07 must be based on S-05's version. Adding S-05 as an explicit prerequisite closes this risk: by the time S-07 starts, `battles/[id].astro` is settled. Sequenced last because the enemy data model must be stable (S-03) and the navigation architecture must be in place (S-05).
- **Status:** proposed

### S-09: Battle environment

- **Outcome:** GM can view AI-generated atmospheric and environmental details for a battle — terrain features, environmental hazards, lighting conditions, ambient ambiance, and battleground trivia — displayed on the battle page and persisted to the battle.
- **Change ID:** battle-environment
- **PRD refs:** —
- **Prerequisites:** S-01 (battle must exist before environment can be attached)
- **Parallel with:** S-08 — no file overlap expected
- **Blockers:** —
- **Unknowns:** scope of "environment" (pure flavor text vs. D&D mechanical effects vs. both), generation trigger (auto on battle creation vs. on-demand button), whether to allow regeneration, where it lives in the battle UI — to be resolved during `/10x-plan`.
- **Risk:** low–medium. Core risk is prompt design: the AI must produce concise, GM-usable content rather than walls of text. UI placement and DB storage shape need a plan decision before implementation.
- **Status:** proposed

### S-10: Main enemy profile

- **Outcome:** if a battle has a designated main enemy (boss), GM sees a generated profile card containing a narrative description, unique characteristics and tactics, and 3 example roleplay dialogue lines — helping the GM portray the villain convincingly at the table.
- **Change ID:** main-enemy-profile
- **PRD refs:** —
- **Prerequisites:** S-02 (enemies must exist to designate one as the main enemy)
- **Parallel with:** S-09 — no file overlap expected
- **Blockers:** —
- **Unknowns:** how the GM designates a main enemy (toggle on enemy card? field on battle creation? auto-inferred from CR?), where the profile is stored (new `main_enemy_profile` JSONB column on `battles`, or extended `stats` on the enemy?), whether the profile is generated on designation or on demand.
- **Risk:** low. Scope is well-defined: one AI call → one structured output → one UI card. Main decision is the designation UX and the data model placement.
- **Status:** proposed

### S-08: UX improvements

- **Outcome:** the landing page shows DnD 5enemy's product identity; users see visual loading feedback when navigating to a battle or submitting the create-battle form.
- **Change ID:** ux-improvements
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** S-03, S-04, S-05 — writes only `Welcome.astro`, `BattleCard.astro`, and `CreateBattleForm.tsx`; none of these files are touched by any Wave 1 slice
- **Blockers:** —
- **Unknowns:** —
- **Risk:** low. Two distinct sub-tasks: (1) text replacement in `Welcome.astro`; (2) loading feedback in `BattleCard.astro` (inline script on link click) and `CreateBattleForm.tsx` (set `isSubmitting` flag before native form submit proceeds — `SubmitButton` already accepts `pendingText`, the flag is just never set on a valid submit today).
- **Status:** proposed

### S-11: Sentry error tracking

- **Outcome:** server errors, unhandled exceptions, and AI generation failures (including silent swallows) are captured by Sentry with environment tag, release, and request context — giving the developer observability over production issues without needing to dig through Cloudflare logs.
- **Change ID:** sentry-setup
- **PRD refs:** —
- **Prerequisites:** — (fully independent; the baseline already notes observability as a gap)
- **Parallel with:** any slice — purely additive; no shared files with any other slice
- **Blockers:** —
- **Unknowns:**
  - `@sentry/node` does not run on the Cloudflare Workers (workerd) runtime. The correct package is `@sentry/cloudflare` (or `@sentry/astro` with the Cloudflare adapter). SDK compatibility and instrumentation approach need a quick spike before planning. — Owner: developer. Block: soft.
- **Risk:** low–medium. Core risk is workerd runtime compatibility: Sentry's standard SDK uses Node APIs unavailable in workerd; using the wrong package silently no-ops at runtime. Additional consideration: Sentry's DSN and environment config must be stored as Wrangler secrets, not committed. Once the right SDK is confirmed the implementation is straightforward — wrap the server entrypoint, instrument catch blocks that currently swallow errors silently, and add a source-map upload step to CI.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                                   | Ready for `/10x-plan` | Notes                                                              |
| ---------- | ----------------------------- | ------------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| F-01       | data-schema                   | Design and migrate campaign/battle/enemy schema         | yes                   | Run `/10x-plan data-schema`                                        |
| S-01       | create-battle                 | Create a battle within a campaign                       | no                    | Needs F-01 implemented                                             |
| S-02       | first-gated-generation        | Generate, view, and confirm AI enemy cards for a battle | no                    | Needs S-01 implemented + AI provider resolved (Q1)                 |
| S-03       | enemy-post-confirm-management | Edit and remove confirmed enemies from a battle         | no                    | Needs S-02 implemented                                             |
| S-04       | password-reset                | Reset forgotten password via email link                 | yes                   | Fully independent; parallel with S-03 + S-05                       |
| S-05       | campaign-management           | Campaign list, create, delete (FR-011 folded in)        | yes                   | Revamps nav architecture; fold S-06 in; widest PR in roadmap       |
| S-06       | delete-battle                 | _(folded into S-05)_                                    | —                     | One button + DELETE endpoint; not worth a separate PR              |
| S-07       | pdf-export                    | Export battle enemy cards as PDF                        | no                    | Needs S-03 + S-05 done; Workers PDF spike required before planning |
| S-08       | ux-improvements               | Landing page rebrand + loading spinners                 | yes                   | No deps; parallel with S-03, S-04, S-05                            |
| S-11       | sentry-setup                  | Configure Sentry error tracking on Cloudflare Workers   | no                    | No deps; parallel with any slice; requires `@sentry/cloudflare` spike before planning |

## Open Roadmap Questions

1. **Which AI provider and model will generate D&D 5e stat blocks?** Cloudflare Workers constraints (workerd runtime, 30s CPU budget) limit SDK choices — not all LLM provider SDKs are compatible. The selected provider's API key must be stored as a Wrangler secret. This choice also determines the prompt-engineering strategy (structured JSON output vs. free-text parsing with validation) and the feasibility of the latency NFR ("within a few seconds"). — Owner: developer. Block: S-02.

## Parked

- **FR-006: Individual card regeneration** — Why parked: PRD nice-to-have; acknowledged edge case — if a GM dislikes one card they likely dislike the whole batch (PRD §Enemy Generation, FR-006 Socrates note).
- **FR-008: Enemy reuse across battles** — Why parked: PRD nice-to-have; confirmed low priority — GMs may prefer fresh generation to avoid player-facing repetition (PRD §Enemy Management, FR-008 Socrates note).
- **No player-facing features** — PRD §Non-Goals: app is GM-only; player access adds a separate access model out of scope for MVP.
- **VTT integrations (Roll20, Foundry VTT, D&D Beyond)** — PRD §Non-Goals: each integration is a separate scoped effort; core value is generation, not data portability.
- **Offline mode** — PRD §Non-Goals: generation depends on a network call; offline caching is a future concern.
- **Multi-GM collaboration on shared campaigns** — PRD §Non-Goals: single-user model keeps auth and data model simple for MVP.

> Previously parked, now promoted to active slices: **FR-001 Campaign management** → S-05; **Export/print (PDF)** → S-07.

## Done

<!-- /10x-archive appends here when a change whose Change ID matches a roadmap item is archived.
     Format: - **<ID>: <Outcome>** — Archived <YYYY-MM-DD> → `context/archive/<YYYY-MM-DD-change-id>/`. Lesson: <pointer or —>.
     Do NOT pre-populate. -->
