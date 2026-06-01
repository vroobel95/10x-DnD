---
project: 'DnD 5enemy'
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: '2026-07-05'
  after_hours_only: true
---

## Vision & Problem Statement

D&D 5e Game Masters waste preparation time between sessions manually hunting online sourcebooks for enemy stat blocks, then hand-adjusting stats to match the party's current level and composition. No existing tool generates context-appropriate enemies on demand. The friction is threefold: too many manual steps (workflow friction), no purpose-built level-aware generation tool (missing capability), and an overwhelming volume of monster options with no way to filter by encounter context (decision paralysis).

Existing tools generate individual monsters in isolation — the GM still has to manually assemble a coherent encounter from separate lookups. This tool generates a _combat scenario_: a varied group of enemies (multiple types, balanced together) tailored to the party's level, the battle environment, and the GM's natural-language description. The differentiator is encounter-level generation, not monster-level generation.

## User & Persona

**Primary persona:** D&D 5e Game Master who runs regular tabletop sessions and prepares combat encounters between sessions.

- Role: Game Master (GM)
- Context: Hobby TTRPG player running D&D 5th Edition campaigns
- The moment they reach for this product: Between sessions, when planning upcoming combat encounters for their player group
- Pain trigger: Needing to find, adapt, and balance enemies without a unified, context-aware tool

## Success Criteria

### Primary

- GM logs in, creates a campaign, creates a battle, types a natural-language combat scenario request (e.g., "2 ice wolves and a frost troll on level 5 in a frozen cave"), receives enemy cards for each enemy in the scenario with level-appropriate stats and abilities, and confirms the enemies to the battle. The full flow working end-to-end = the product works.

### Secondary

- GM can regenerate individual enemy cards they don't like while keeping the others they approved.

### Guardrails

- Generated D&D 5e stat blocks must be mathematically valid — no impossible ability scores or broken combat math.
- A confirmed enemy list must persist reliably between sessions; data loss or corruption is a regression.

## User Stories

### US-01: GM generates and confirms enemies for a battle

- **Given** a GM has a battle open and types a natural-language enemy request (e.g., "3 ice wolves on level 5")
- **When** they submit the request
- **Then** they see a generated enemy card for each enemy requested, and can confirm or deny each card individually

#### Acceptance Criteria

- Each enemy card displays at minimum: name, level, stat block (ability scores, HP, AC), and abilities
- A denied card does not get saved to the battle
- A confirmed card is persisted to the battle and visible in subsequent sessions

## Functional Requirements

### Campaigns & Battles

- FR-001: GM can view a list of their campaigns, create a new campaign, and delete an existing campaign. After login, the app shows the campaign list rather than dropping directly into a single campaign. Priority: **must-have** (promoted from nice-to-have — 2026-06-01).
  > Socrates (original): Counter-argument considered: "A single GM rarely runs more than one active campaign — one default campaign is enough and could be auto-created." Resolution: revised. Default campaign auto-created on signup; explicit campaign management demoted to nice-to-have. GM lands directly on the generator.
  > Revised 2026-06-01: User feedback and implementation experience showed that campaign list visibility and the ability to manage multiple campaigns adds meaningful value and is feasible to implement now. FR-001 promoted to must-have and assigned to S-05.
- FR-002: GM can create a battle within a campaign. Priority: must-have
  > Socrates: Counter-argument considered: "Battles as a layer under campaigns double the setup steps before a GM sees any generated enemy." Resolution: kept as must-have; user confirmed battles are explicitly created by the GM. Campaign friction is resolved by auto-creation (FR-001 revision), so the remaining battle-creation step is acceptable.

### Enemy Generation

- FR-003: GM can submit a natural-language request describing a combat scenario for a battle (e.g., "2 ice wolves and a frost troll on level 5 in a frozen cave"). The request may specify multiple enemy types. Priority: must-have
  > Socrates: Counter-argument considered: "Ambiguous input requires fallback handling that adds scope before value is visible." Resolution: kept; natural-language input is the product's core differentiator. Ambiguity handling and input validation scope to be surfaced in business logic (Phase 5).
- FR-004: GM can view the generated enemy cards returned by the app (name, level, stats, abilities). Priority: must-have
  > Socrates: Counter-argument considered: "GMs may not know what a valid stat block looks like — they'll confirm bad cards and blame the app later." Resolution: kept; the guardrail (valid D&D 5e math) addresses this. Card display should include enough context for a GM to spot obvious errors.
- FR-005: GM can confirm generated enemies to save them to a battle. Priority: must-have
  > Socrates: Counter-argument considered: "Confirm is ambiguous — if there's no clear undo or edit path, GMs will be afraid to commit." Resolution: FR-009 added (GM can remove a confirmed enemy from battle), making confirmation reversible.
- FR-006: GM can regenerate individual enemy cards while keeping others they approved. Priority: nice-to-have
  > Socrates: Counter-argument considered: "If the GM dislikes a card, they'll likely dislike all cards from the same request — individual regeneration solves a rare case." Resolution: kept as nice-to-have; acknowledged edge case, not MVP-blocking.

### Enemy Management

- FR-007: GM can edit a confirmed enemy's stats or abilities after confirmation. Priority: must-have
  > Socrates: Counter-argument considered: "The more editable the tool, the more it becomes a spreadsheet substitute rather than a time-saving generator — scope risk." Resolution: kept; light editing (tweaking a value) is meaningfully different from full authoring. Scope boundary: edit existing fields only, not add/remove abilities.
- FR-008: GM can reuse a previously generated enemy in a different battle. Priority: nice-to-have
  > Socrates: Counter-argument considered: "GMs may prefer to regenerate rather than reuse — the same enemy in two battles can feel repetitive for players." Resolution: kept as nice-to-have; valid concern about player experience, confirmed this is low priority.
- FR-009: GM can remove a confirmed enemy from a battle. Priority: must-have
  > Socrates: Added in response to FR-005 challenge. Makes confirmation reversible so GMs are not afraid to commit.

### Auth & Account

- FR-010: GM who has forgotten their password can request a password-reset email, follow the link, and set a new password. Priority: must-have (added 2026-06-01 — reported as a real blocker for account recovery).

### Battle Management

- FR-011: GM can delete a battle and all its associated enemies. Deletion requires a confirmation step to prevent accidental data loss. Priority: must-have (added 2026-06-01 — GMs need a way to remove unwanted or test battles).

### Export

- FR-012: GM can export a battle's confirmed enemy cards as a PDF, with one card per enemy, formatted for table use. Priority: nice-to-have (added 2026-06-01 — validated by user research; out of scope for v1 Non-Goals updated).

## Non-Functional Requirements

- Enemy cards are visible to the GM within a few seconds of submitting a request — no long waits between input and output.
- The app is usable on the latest two major versions of mainstream desktop browsers without degradation.
- All generated stat values fall within D&D 5e legal ranges — no impossible ability scores, HP values, or AC values that would make a stat block unrunnable at the table.

## Business Logic

Given the party's level, battle location, and any additional GM-provided context, the app generates D&D 5e-valid enemy stat blocks appropriate for the encounter.

**Inputs the rule consumes (user-facing):**

- Party level — required; drives stat scaling
- Creature type / name — required (e.g., "ice wolf", "goblin shaman")
- Number of enemies — required (e.g., "3")
- Battle location / environment — optional context (e.g., "frozen tundra")

**Output:** Each generated enemy card contains — ability scores (STR, DEX, CON, INT, WIS, CHA), HP, AC, named abilities and special attacks, Challenge Rating (CR), speed, saving throws, and skill modifiers.

**How the GM encounters it:** The GM types a natural-language request combining the above inputs into a battle's text box. The app returns one enemy card per requested creature. The GM reviews each card and confirms or denies individually.

## Access Control

Login required (email + password or OAuth). No unauthenticated access to the generator.

Role model: Flat — all authenticated Game Masters have equal capabilities. No admin / player / guest role separation in MVP.

## Non-Goals

- No player-facing features: the app is GM-only. Players do not have accounts, cannot view battles, and have no interaction surface in MVP. Rationale: the pain is the GM's; player access adds an entirely different access model.
- No integration with virtual tabletop platforms (Roll20, Foundry VTT, D&D Beyond, etc.) in MVP. Rationale: each integration is a separate scoped effort; the core value is enemy generation, not data portability.
- No text-file export or VTT-import formats: the only export target is PDF (FR-012, nice-to-have). Rationale: text/VTT formats add per-platform maintenance; PDF covers the "print for the table" use case GMs actually asked for.
- No offline mode: the app requires an active internet connection. Rationale: generation depends on a network call; offline caching is a future concern.
- No multi-GM collaboration on shared campaigns: each campaign belongs to one GM. Rationale: single-user model keeps auth and data model simple for MVP.

## Open Questions

_(No open questions. All signals resolved during shaping — quality check accepted at phase 7.)_
