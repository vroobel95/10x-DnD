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

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                                   | Ready for `/10x-plan` | Notes                                              |
| ---------- | ----------------------------- | ------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| F-01       | data-schema                   | Design and migrate campaign/battle/enemy schema         | yes                   | Run `/10x-plan data-schema`                        |
| S-01       | create-battle                 | Create a battle within a campaign                       | no                    | Needs F-01 implemented                             |
| S-02       | first-gated-generation        | Generate, view, and confirm AI enemy cards for a battle | no                    | Needs S-01 implemented + AI provider resolved (Q1) |
| S-03       | enemy-post-confirm-management | Edit and remove confirmed enemies from a battle         | no                    | Needs S-02 implemented                             |

## Open Roadmap Questions

1. **Which AI provider and model will generate D&D 5e stat blocks?** Cloudflare Workers constraints (workerd runtime, 30s CPU budget) limit SDK choices — not all LLM provider SDKs are compatible. The selected provider's API key must be stored as a Wrangler secret. This choice also determines the prompt-engineering strategy (structured JSON output vs. free-text parsing with validation) and the feasibility of the latency NFR ("within a few seconds"). — Owner: developer. Block: S-02.

## Parked

- **FR-001: Campaign management UI** — Why parked: PRD demoted to nice-to-have; a default campaign is auto-created on signup so GMs reach the generator without manual setup (PRD §Campaigns & Battles, FR-001 Socrates note).
- **FR-006: Individual card regeneration** — Why parked: PRD nice-to-have; acknowledged edge case — if a GM dislikes one card they likely dislike the whole batch (PRD §Enemy Generation, FR-006 Socrates note).
- **FR-008: Enemy reuse across battles** — Why parked: PRD nice-to-have; confirmed low priority — GMs may prefer fresh generation to avoid player-facing repetition (PRD §Enemy Management, FR-008 Socrates note).
- **No player-facing features** — PRD §Non-Goals: app is GM-only; player access adds a separate access model out of scope for MVP.
- **VTT integrations (Roll20, Foundry VTT, D&D Beyond)** — PRD §Non-Goals: each integration is a separate scoped effort; core value is generation, not data portability.
- **Export / print (PDF, printable stat cards)** — PRD §Non-Goals: out of scope for v1; GMs can read from screen.
- **Offline mode** — PRD §Non-Goals: generation depends on a network call; offline caching is a future concern.
- **Multi-GM collaboration on shared campaigns** — PRD §Non-Goals: single-user model keeps auth and data model simple for MVP.

## Done

<!-- /10x-archive appends here when a change whose Change ID matches a roadmap item is archived.
     Format: - **<ID>: <Outcome>** — Archived <YYYY-MM-DD> → `context/archive/<YYYY-MM-DD-change-id>/`. Lesson: <pointer or —>.
     Do NOT pre-populate. -->
