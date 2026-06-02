# S-02: First Gated Generation — Plan Brief

> Full plan: `context/changes/first-gated-generation/plan.md`
> Research: `context/changes/first-gated-generation/research.md`
> Provider decision: `context/changes/first-gated-generation/ai-provider-research.md`

## What & Why

Wire the complete generate → review → confirm flow for D&D 5e enemy cards — the product's north-star slice. A GM types a natural-language combat request, receives AI-generated enemy cards with full stat blocks, and confirms or denies each one individually. This is the smallest end-to-end slice that proves the core hypothesis: Claude can generate D&D 5e-valid stat blocks from natural language and the app can persist them reliably.

## Starting Point

All three database tables are deployed (`campaigns`, `battles`, `enemies` with `pending|confirmed` status enum and `stats JSONB` column). The battle detail page exists with an S-02 placeholder. No AI SDK or Zod is installed. The `nodejs_compat` flag and `astro:env/server` secret pattern are already in place.

## Desired End State

The GM opens a battle, types something like "2 ice wolves and a frost troll", clicks Generate, and sees one card per creature with full stat blocks (ability scores, HP, AC, speed, CR, saving throws, skill modifiers, and named abilities with descriptions). The battle's `party_level` and `location` are injected into the AI prompt automatically. Confirming a card persists it to the battle (status: confirmed); denying a card deletes it. Pending cards survive page reload.

## Key Decisions Made

| Decision                   | Choice                                                                       | Why (1 sentence)                                                                           | Source   |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| AI SDK                     | Vercel AI SDK v6 (`@ai-sdk/anthropic` + `generateText` + `Output.object()`)  | Structured output + Zod validation + provider-swappable interface; no streaming needed     | Research |
| Battle context injection   | Auto-inject `party_level` + `location` from battle record into system prompt | GM already set these when creating the battle — re-typing is friction                      | Plan     |
| Confirm/deny timing        | Immediate per-card API call (PATCH confirm, DELETE deny)                     | PRD: "confirm or deny each card individually"; no accidental bulk loss                     | Plan     |
| AI failure UX              | Sanitized error + Try Again button (no auto-retry)                           | Simple, predictable; avoids double-token burn on transient failures                        | Plan     |
| D&D stat validation        | Zod `.min()/.max()` range constraints; error to GM on violation              | Enforces PRD guardrail ("stat blocks must be mathematically valid") at the schema boundary | Plan     |
| Abilities format           | `{name, description}[]` — name + one-line mechanic description               | GM needs descriptions at the table; PRD says "named abilities and special attacks"         | Plan     |
| Multiple generation rounds | Additive — always available, new pending cards append to existing            | More flexible; nothing in PRD restricts multiple rounds                                    | Plan     |
| Pending persistence        | Pending enemies survive page reload                                          | Natural for after-hours use where sessions are interrupted                                 | Plan     |
| API routing                | Nested: `/api/battles/[id]/generate` + `/api/enemies/[id]`                   | REST-correct resource parenting; battle ownership visible in URL                           | Plan     |
| Denied card handling       | DELETE from DB immediately — no `'denied'` status                            | PRD: "denied card does not get saved"; simpler schema                                      | Plan     |
| React island scope         | Single `EnemiesSection` island manages all enemy state (pending + confirmed) | Avoids page reload on confirm; Astro pre-seeds initial data as props                       | Plan     |

## Scope

**In scope:**

- Vercel AI SDK install + `ANTHROPIC_API_KEY` env wiring
- Zod `EnemyGroupSchema` (the central data contract)
- `src/lib/ai.ts` — `generateEnemies()` function
- `POST /api/battles/[id]/generate` — AI call + insert pending enemies
- `PATCH /api/enemies/[id]` — confirm (status → confirmed)
- `DELETE /api/enemies/[id]` — deny (delete row)
- `EnemiesSection` React island + `EnemyCard` component
- Battle detail page updated to render generation UI
- Replace stale `anthropic-docs.md` with Vercel AI SDK reference

**Out of scope:**

- Streaming (workerd deadlock bug; S-02 flow is generate → wait → show)
- Auto-retry on AI failure
- Individual card regeneration (FR-006, nice-to-have)
- Enemy editing (FR-007, S-03)
- Enemy removal post-confirm (FR-009, S-03)
- `'denied'` status in DB enum
- Multi-campaign UI

## Architecture / Approach

The `EnemyGroupSchema` (Zod) is the central contract: it defines what Claude must produce, validates the AI response at the boundary, and is stored as-is in `enemies.stats` (JSONB). The generate route calls `generateEnemies(battle, prompt)` from `src/lib/ai.ts` — all AI SDK imports are isolated there. The battle detail page is an Astro SSR page with a single React island (`EnemiesSection`) that owns all enemy state, pre-seeded from the server.

## Phases at a Glance

| Phase                | What it delivers                                                               | Key risk                                                                                |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1. Foundation        | SDK installed, env wired, EnemyGroupSchema + generateEnemies() verified        | `astro:env/server` for API key (not `process.env`) — wrong import = silent auth failure |
| 2. Generate API      | POST endpoint calls Claude, saves pending enemies, returns DB records with IDs | AI may return schema-invalid stats; Zod catches and surfaces error to GM                |
| 3. Enemy Actions API | PATCH (confirm) + DELETE (deny) on individual enemies                          | RLS two-hop ownership check must work correctly via session cookies                     |
| 4. Battle Detail UI  | EnemiesSection island + EnemyCard; battle page renders full flow               | React island state must correctly handle optimistic updates + initial server data       |

**Prerequisites:** S-01 (create-battle) — shipped. F-01 (data-schema) — shipped. `ANTHROPIC_API_KEY` with credits — developer must obtain.  
**Estimated effort:** ~3-4 focused sessions across 4 phases.

## Open Risks & Assumptions

- Claude model quality: `claude-sonnet-4-6` should produce valid D&D 5e stat blocks for common creature types; unusual requests may produce edge cases the Zod schema rejects
- Latency: generation takes 2–8s under typical load; if consistently > 15s, the loading UX will feel broken before the Workers CPU budget is reached
- `Output.object()` error type: the exact Vercel AI SDK error thrown on schema validation failure should be verified during Phase 1 manual testing to ensure the error catch in the generate route handles it correctly

## Success Criteria (Summary)

- GM can type a natural-language prompt on a battle page, receive enemy cards with full stat blocks, and confirm them — confirmed enemies persist to the battle across page reloads
- Denying a card removes it from both the UI and Supabase
- AI failures show a human-readable, sanitized error; the form re-enables for retry
