# Battle Environment in PDF Export — Plan Brief

> Full plan: `context/changes/pdf-export-environment/plan.md`

## What & Why

The battle **environment** (terrain, lighting, hazards, ambiance, trivia) is generated and shown in
the app but is **missing from the exported PDF**, which contains only enemy stat cards. This slice
adds the environment to the PDF so the GM has the scene at the table, not just the combatants.

## Starting Point

`Battle.environment` is a populated five-field object with its own schema, AI generation, API route,
and `EnvironmentSection` UI. The PDF builder takes only `Pick<Battle, "name">` and renders one page
per enemy; the export route selects `"id, name, campaign_id"` and never fetches `environment`. The
export button and download UX already exist.

## Desired End State

Exporting a battle that has an environment produces a PDF whose **first page** is the environment —
a heading and the five fields with **localized labels** and their generated text — followed by the
unchanged enemy pages. A battle with no environment exports exactly as before (enemy pages only).
Long fields wrap and overflow onto a continuation page rather than clipping.

## Key Decisions Made

| Decision            | Choice                                              | Why (1 sentence)                                                         | Source |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| Placement           | Its own first page, before enemy cards              | Battle-level scene-setter reads first; clean separation from cards.     | Plan   |
| Label localization  | Localized; route resolves `m.env_*`, passes strings | Matches i18n-polish + the UI; keeps the builder pure and i18n-free.     | Plan   |
| Null environment    | Skip the page entirely                              | Preserve today's output exactly when no environment exists.             | Plan   |
| Long-field overflow | Wrap + continuation page (no clip/throw)            | Environment is the point of the slice — content must not be lost.       | Plan   |
| UI                  | No change                                           | Export button + download already exist in EnemiesSection.               | Plan   |

## Scope

**In scope:** builder renders a leading environment page from caller-supplied localized labels +
unit tests; route fetches `environment` and resolves `m.env_*` labels to pass in + integration tests.

**Out of scope:** enemy-card/layout/font changes; export button/download UX; localizing the existing
English stat labels; any schema/migration/generation change; an environment page when none exists.

## Architecture / Approach

Two layers, built bottom-up. The pure builder gains a new `envLabels` parameter and draws an
environment first page when `battle.environment` is non-null, reusing its existing text-wrapping and
page-bottom patterns. The route adds `environment` to its SELECT and resolves the five `m.env_*`
labels + section title in the active locale, passing them and the battle into the builder. No UI work.

## Phases at a Glance

| Phase                              | What it delivers                                       | Key risk                                            |
| ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| 1. Builder environment page        | Leading environment page + null case + unit tests      | Wrapping/pagination of long fields (up to 2000 ch)  |
| 2. Route fetch + localized labels  | SELECT `environment`, resolve `m.env_*`, pass in + test| Keeping the builder pure; locale resolves correctly |

**Prerequisites:** built `pdf-export` feature (done); a battle with a generated environment for manual checks.
**Estimated effort:** ~1 session across the 2 phases.

## Open Risks & Assumptions

- The builder stays i18n-free by receiving resolved label strings; the route owns locale resolution
  (it already imports `m`).
- Existing English stat labels remain English — an accepted, scoped inconsistency this slice doesn't fix.
- Worker bundle/runtime fit already confirmed earlier in this change (gzip ≈ 746 KiB, ~27% under the
  1 MiB free limit), so adding a page raises no environment concern.

## Success Criteria (Summary)

- A battle with an environment exports a PDF whose first page is the localized environment, then the
  enemy pages; a battle without one exports unchanged.
- Switching locale changes the environment labels in the PDF.
- `npm run test` / `typecheck` / `lint` pass, including new builder and route tests.
