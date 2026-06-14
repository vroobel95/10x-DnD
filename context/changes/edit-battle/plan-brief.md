# Edit Battle — Plan Brief

> Full plan: `context/changes/edit-battle/plan.md`

## What & Why

S-12 adds inline editing for a battle's name, party level, and location on the battle detail page. Once a GM creates a battle, there is currently no way to correct a typo or change the party level — they're stuck with whatever they entered at creation time.

## Starting Point

The battle detail page is pure Astro SSR: name renders as a static `<h1>`, party_level and location render as static badges. No PATCH endpoint exists for battles. Two other React islands (`EnvironmentSection`, `EnemiesSection`) already live on the page and establish the pattern to follow. The S-03 enemy edit pattern (`PATCH /api/enemies/[id].ts` + inline edit state in a React island) is the direct template.

## Desired End State

An Edit button (pencil icon) sits next to the battle name. Clicking it switches the header to an inline form pre-populated with the current name, party level, and location. The GM edits and saves; the updated values appear immediately in-place without a page reload. The campaign battle list shows the updated name on the next visit.

## Key Decisions Made

| Decision                    | Choice                                        | Why (1 sentence)                                                                 |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| "Description" field scope   | No new column — name + party_level + location | Roadmap used "description" loosely; Battle has no description column             |
| Editable fields             | Name + party_level + location                 | All three fields the GM set at creation; consistent with the create-battle form  |
| Edit UX                     | Inline on detail page (React island)          | Stays in context, no navigation; mirrors the enemy edit pattern in the codebase  |
| Post-save behavior          | Update heading in-place, exit edit mode       | Instant feedback without page flicker; matches enemy edit save behavior          |
| API pattern                 | PATCH /api/battles/[id] — JSON, not form-data | Matches the enemies endpoint pattern used by all React island→API calls          |
| Validation                  | Server-side only                              | Single source of truth; matches project conventions                              |

## Scope

**In scope:**
- `PATCH /api/battles/[id]` — new endpoint validating and persisting name, party_level, location
- `BattleHeader.tsx` — new React island managing header read/edit state
- `battles/[id].astro` — replace static h1 + badges with `<BattleHeader client:load />`

**Out of scope:**
- No new `description` column (no schema migration)
- No editing of battle `environment` JSONB
- No client-side form validation
- No `document.title` sync after inline save
- No real-time location sync to `EnvironmentSection` (stale until page reload)

## Architecture / Approach

Three thin phases: endpoint → island → page wiring. The PATCH endpoint follows `api/enemies/[id].ts` (JSON body, ownership cascade via campaign join, structured JSON error responses). The island follows `EnvironmentSection` / `EnemiesSection` (client:load, local state, fetch handler, error display). Astro's SSR handles the campaign page update automatically on the next navigation.

## Phases at a Glance

| Phase                             | What it delivers                          | Key risk                                                         |
| --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| 1. PATCH /api/battles/[id]        | Validated update endpoint                 | Ownership check cascade (battle → campaign → user_id)            |
| 2. BattleHeader React Island      | Inline view/edit toggle with save handler | Gradient h1 class parity with the static Astro version           |
| 3. Battle Detail Page Wiring      | Island in place; full flow verified       | EnvironmentSection `location` prop becomes stale after edit save |

**Prerequisites:** S-01 (create-battle) implemented — battles must exist to edit.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- If the GM edits `location` and then generates the environment without reloading, `EnvironmentSection` will pass the old location to the generation API (it received location as an SSR-baked prop). This is a known limitation; the GM can reload to pick up the new value for generation.
- The `<title>` tag reflects the SSR-rendered name and stays stale until the next page load — acceptable since the h1 updates immediately.

## Success Criteria (Summary)

- GM can edit battle name, party level, and location from the battle detail page without leaving the page
- Updated values persist across page reload (DB confirmed)
- Updated name appears in the campaign battle list on the next visit
