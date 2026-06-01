---
project: "DnD 5enemy"
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-25
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

| ID   | Change ID                     | Outcome (user can …)                                                                            | Prerequisites | PRD refs                       | Status   |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------- | ------------------------------ | -------- |
| F-01 | data-schema                   | (foundation) campaigns, battles, and enemy tables deployed via migrations with RLS              | —             | FR-002, FR-005, FR-007, FR-009 | ready    |
| S-01 | create-battle                 | create a battle within their auto-created campaign and see it listed in the app                 | F-01          | FR-002                         | proposed |
| S-02 | first-gated-generation        | type a natural-language combat scenario request, see AI-generated enemy cards, and confirm them | S-01, F-01    | US-01, FR-003, FR-004, FR-005  | blocked  |
| S-03 | enemy-post-confirm-management | edit a confirmed enemy's stats and remove a confirmed enemy from a battle                       | S-02          | FR-007, FR-009                 | proposed |
| S-04 | password-reset                | reset a forgotten password via email link and regain access to the app                          | —             | FR-010                         | proposed |
| S-05 | campaign-management           | see a list of campaigns after login, choose one, create a new one, or delete an existing one    | F-01, S-01    | FR-001                         | proposed |
| S-06 | delete-battle                 | delete a battle and all its confirmed enemies from the campaign battle list                     | S-05          | FR-011                         | proposed |
| S-07 | pdf-export                    | export a battle's confirmed enemy cards as a printable PDF                                      | S-02, S-03    | FR-012                         | proposed |

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
- **Status:** ready

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
- **Status:** proposed

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
- **Status:** blocked

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
- **Parallel with:** any other slice
- **Blockers:** —
- **Unknowns:** —
- **Risk:** low — Supabase's built-in reset flow (`resetPasswordForEmail` + PKCE redirect) handles the token lifecycle; implementation is two pages and a link on the sign-in form.
- **Status:** proposed

### S-05: Create and manage campaigns

- **Outcome:** after logging in, GM sees a list of their campaigns and can choose one, create a new campaign, or delete an existing campaign; selecting a campaign navigates to its battle list.
- **Change ID:** campaign-management
- **PRD refs:** FR-001
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** this slice changes the post-login navigation path established in S-01 (root `/` was the battle list; it now becomes `/campaigns`); the existing auto-created campaign is preserved and visible in the list so existing data is not orphaned. Sequenced after S-01 so there is a working baseline to route from.
- **Status:** proposed

### S-06: Delete battle

- **Outcome:** GM can delete a battle and all its confirmed enemies from the campaign's battle list, with a confirmation step to prevent accidental deletion.
- **Change ID:** delete-battle
- **PRD refs:** FR-011
- **Prerequisites:** S-05
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** low — delete cascades to enemies via FK already defined in data-schema; the main UX concern is preventing accidental deletion, addressed by an inline confirmation. Sequenced after S-05 because the battle list lives in the campaign page introduced there.
- **Status:** proposed

### S-07: Export battle as PDF

- **Outcome:** GM can export a battle's confirmed enemy cards as a printable PDF, one card per enemy, suitable for use at the table.
- **Change ID:** pdf-export
- **PRD refs:** FR-012
- **Prerequisites:** S-02, S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which PDF generation approach is compatible with Cloudflare Workers (workerd runtime)? Puppeteer/Chromium is unavailable; candidates are `pdf-lib` (pure JS), an external HTML-to-PDF API, or Cloudflare Browser Rendering (beta/paid). Requires a spike to confirm bundle size and runtime compatibility. — Owner: developer. Block: soft (implementation can't start until approach is picked).
- **Risk:** PDF generation on Cloudflare Workers is non-trivial — the workerd runtime prohibits most node-native and browser-headless approaches. The unknown above is the primary risk; a spike should resolve it before `/10x-plan pdf-export`. Sequenced last because it depends on the full enemy data model being stable (S-03).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                                   | Ready for `/10x-plan` | Notes                                              |
| ---------- | ----------------------------- | ------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| F-01       | data-schema                   | Design and migrate campaign/battle/enemy schema         | yes                   | Run `/10x-plan data-schema`                        |
| S-01       | create-battle                 | Create a battle within a campaign                       | no                    | Needs F-01 implemented                             |
| S-02       | first-gated-generation        | Generate, view, and confirm AI enemy cards for a battle | no                    | Needs S-01 implemented + AI provider resolved (Q1) |
| S-03       | enemy-post-confirm-management | Edit and remove confirmed enemies from a battle         | no                    | Needs S-02 implemented                             |
| S-04       | password-reset                | Reset forgotten password via email link                 | yes                   | No schema changes; Supabase Auth handles token flow |
| S-05       | campaign-management           | Campaign list, create, and delete                       | yes                   | Needs F-01 + S-01 implemented; revamps dashboard route |
| S-06       | delete-battle                 | Delete a battle from the campaign battle list           | no                    | Needs S-05 implemented (battle list lives there)   |
| S-07       | pdf-export                    | Export battle enemy cards as PDF                        | no                    | Needs S-02 + S-03 implemented; requires Workers PDF spike |

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
