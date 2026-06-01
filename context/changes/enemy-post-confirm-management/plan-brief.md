# Edit and Remove Confirmed Enemies — Plan Brief

> Full plan: `context/changes/enemy-post-confirm-management/plan.md`

## What & Why

Add two post-confirmation actions to enemy cards: an inline edit mode (FR-007) and an inline remove toggle (FR-009). Together they make confirmation reversible and stat blocks adjustable — without them a GM who confirms an imperfect card has no recovery path.

## Starting Point

Confirmed enemy cards currently display a read-only stat block with no action buttons. `DELETE /api/enemies/[id]` already exists (used for deny). `PATCH /api/enemies/[id]` exists but only sets `status = 'confirmed'` with no request body. `EnemySchema` is already in the codebase and imported in `EnemyCard.tsx`.

## Desired End State

Every confirmed enemy card shows "Edit" and "Remove" buttons. Edit flips the card to an inline form pre-populated with all current stats; Save commits to the DB, Cancel discards. Remove shows an inline "Confirm remove?" toggle before deleting. Only one card can be in edit mode at a time.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Edit UX | Inline — card flips to edit state | Stays in context; matches existing Confirm/Deny pattern | Plan |
| Edit scope | All fields + ability text | GMs need to tweak descriptions as well as numbers | Plan |
| Remove confirmation | Inline toggle (no modal) | Prevents accidental delete; avoids blocking layer | Plan |
| PATCH route | Body discriminant (empty = confirm, `{stats}` = edit) | One endpoint, confirm flow unchanged, REST-conventional | Plan |
| Validation | Server-side EnemySchema only | Single source of truth; matches project conventions | Plan |
| Name sync | Update both `name` column and `stats.name` | Prevents divergence for queries that read `enemies.name` directly | Plan |
| Concurrent edits | One at a time via `editingId` in EnemiesSection | Simpler state; draft is lightweight enough that silent discard is acceptable | Plan |
| Pending edit scope | Confirmed-only | "Confirm first, then tweak" is the cleaner mental model | Plan |

## Scope

**In scope:** Edit all stat fields (hp, ac, speed, cr, ability scores, saving throw values, skill modifier values) and ability name/description text for existing abilities. Remove confirmed enemy with inline confirmation.

**Out of scope:** Editing pending enemies; adding/removing abilities; adding/removing saving throw or skill modifier keys; client-side validation; undo/history.

## Architecture / Approach

Single API change (PATCH body discriminant) + two component changes (EnemiesSection adds state/handlers, EnemyCard adds edit form and remove toggle). No schema migrations. RLS already covers ownership at the DB layer; the DELETE handler is hardened to return 404 instead of 500 on missing rows.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Extend PATCH Route | Body-discriminant PATCH; hardened DELETE | None — logic is straightforward; confirm path unchanged |
| 2. EnemiesSection State | editingId/removingId state; 6 new handlers wired to confirmed cards | Handler proliferation — keep naming consistent |
| 3. EnemyCard UI | Edit form (all fields) + remove toggle in confirmed card footer | Edit form layout — many inputs in one card; needs visual grouping |

**Prerequisites:** S-02 implemented (confirmed enemies must exist to test against)
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- The edit form for saving_throws and skill_modifiers renders existing keys as fixed labels — if the AI generated 0 entries for either, those sections simply don't appear in edit mode (consistent with read-only display)
- `useEffect` keyed on `isEditing` initialises the draft state from parsed stats — if `EnemySchema.parse` throws (corrupted JSONB), the card falls back to its existing parse-error render and edit mode is not entered
