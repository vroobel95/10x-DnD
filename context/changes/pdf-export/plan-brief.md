# PDF Export — Plan Brief

> Full plan: `context/changes/pdf-export/plan.md`
> Research: `context/changes/pdf-export/research.md`
> pdf-lib API notes: `context/changes/pdf-export/pdf-lib-reference.md`

## What & Why

GMs need their generated enemy stat-blocks at the table on paper, not just on screen
(PRD FR-012 / roadmap S-07). This adds a one-click "Export PDF" that turns a battle's
confirmed enemies into a printable PDF.

## Starting Point

The app SSRs on Cloudflare Workers (workerd) — pure JS only, no Chromium/filesystem.
Confirmed enemies already persist as JSONB `stats` validated by `EnemySchema` and render
in `EnemyCard`. Every existing API route returns `Response.json`; there is no binary
response, no PDF code, and no export button yet.

## Desired End State

On a battle with ≥1 confirmed enemy, an "Export PDF" button in the Confirmed Enemies
section downloads `battle-<name>.pdf` — one A4 page per enemy showing the battle name and
the full stat-block (name, CR, HP/AC/Speed, six abilities with modifiers, saves, skills,
abilities). Failures show an inline error without navigating away.

## Key Decisions Made

| Decision            | Choice                                   | Why (1 sentence)                                                        | Source   |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------- | -------- |
| PDF library         | `pdf-lib`                                | Only mature pure-JS option that runs on workerd; ~330 KB, no fontkit.  | Research |
| Page layout         | One card per page                        | No flow/pagination math (pdf-lib has no layout engine); cut-out cards. | Plan     |
| Page size           | A4                                       | Matches the likely EU printer.                                         | Plan     |
| Download trigger    | `fetch` + blob + inline error            | Matches EnemiesSection's error pattern; honors lessons.md.             | Plan     |
| Identifying content | Battle name on each page                 | Loose printed cards stay identifiable; cheap to draw.                  | Plan     |
| Button placement    | EnemiesSection (not BattleHeader)        | Confirmed-enemy state lives there, so it can react to count.           | Plan     |
| Testing depth       | Unit (builder) + integration (route)     | Covers the risky logic without brittle PDF-content parsing.            | Plan     |
| Fonts               | Built-in Helvetica                       | No font-file embedding — required on the no-filesystem runtime.        | Research |

## Scope

**In scope:** `pdf-lib` dependency; pure `buildBattlePdf` builder + unit tests; GET
`/api/battles/[id]/export.pdf` route (auth, ownership, confirmed-enemy fetch, binary
response) + integration tests; export button in EnemiesSection.

**Out of scope:** pending enemies; multi-card-per-page/cover page/custom fonts/images;
PDF content-parsing tests; any schema/migration change; export from anywhere else.

## Architecture / Approach

Three layers, built bottom-up: a pure `buildBattlePdf(battle, enemies) → Uint8Array`
(unit-tested in isolation) → a GET route mirroring the generate-route auth/ownership chain
that fetches confirmed enemies and streams `application/pdf` (integration-tested) → an
EnemiesSection button that downloads via fetch+blob with loading/error state.

## Phases at a Glance

| Phase                          | What it delivers                            | Key risk                                            |
| ------------------------------ | ------------------------------------------- | --------------------------------------------------- |
| 1. PDF builder + unit tests    | Pure `buildBattlePdf` returning PDF bytes   | pdf-lib layout (bottom-left origin, text wrapping)  |
| 2. Export route + integration  | GET route streaming the PDF download        | First binary response; correct ownership guards     |
| 3. UI export button            | Button + fetch/blob download with errors    | Download UX + error handling without navigation     |

**Prerequisites:** Confirmed enemies exist (S-02/S-03 done) — already true.
**Estimated effort:** ~1–2 sessions across the 3 phases.

## Open Risks & Assumptions

- pdf-lib bundle/CPU fit on Workers is expected fine (~330 KB, handful of pages) but is
  first verified for real when the route runs; the spike from `change.md` is effectively
  folded into Phase 1/2 verification.
- `stats` is JSONB (`Record<string, unknown> | null`), so the builder re-validates with
  `EnemySchema` and skips bad rows rather than trusting shape.

## Success Criteria (Summary)

- A GM can export and open a correct one-page-per-enemy PDF for an owned battle.
- No confirmed enemies → no export; another user's battle → 404 (no data leak).
- Failures surface inline; `npm run test` / `typecheck` / `lint` pass.
