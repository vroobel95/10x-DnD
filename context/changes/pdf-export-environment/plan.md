# Battle Environment in PDF Export Implementation Plan

## Overview

The battle **environment** (terrain, lighting, hazards, ambiance, trivia) is generated and shown in
the app but is **missing from the exported PDF** — the PDF contains only per-enemy stat cards. This
change adds the environment as its **own first page** (a scene-setter before the enemy cards), with
**localized field labels** resolved by the route and passed into the pure PDF builder.

## Current State Analysis

- A battle carries `environment: BattleEnvironment | null` ([src/types.ts:28](../../../src/types.ts)),
  a five-field object — `terrain`, `lighting`, `hazards`, `ambiance`, `trivia`, each a non-empty
  string up to 2000 chars ([src/lib/schemas/environment.ts:3-9](../../../src/lib/schemas/environment.ts)).
- It is generated via `POST /api/battles/[id]/environment` and rendered in the UI by
  [EnvironmentSection.tsx](../../../src/components/battles/EnvironmentSection.tsx), which labels the
  fields with paraglide messages `m.env_terrain()`, `m.env_lighting()`, `m.env_hazards()`,
  `m.env_ambiance()`, `m.env_trivia()` and titles the section with `m.env_section_title()`
  ([EnvironmentSection.tsx:12-18,53](../../../src/components/battles/EnvironmentSection.tsx)).
- The PDF builder ignores it entirely: `buildBattlePdf(battle: Pick<Battle, "name">, enemies: Enemy[])`
  uses only `battle.name` and loops over enemies, one A4 page each
  ([src/lib/pdf/battle-pdf.ts:34,39-44](../../../src/lib/pdf/battle-pdf.ts)). The builder is pure and
  i18n-free — all its current labels (`HP`, `AC`, `Saving Throws`, …) are hardcoded English literals.
- The export route does **not fetch** the environment: it selects only `"id, name, campaign_id"`
  ([src/pages/api/battles/[id]/export.pdf.ts:23](../../../src/pages/api/battles/[id]/export.pdf.ts)),
  then calls `buildBattlePdf(battle, enemies)` ([export.pdf.ts:67](../../../src/pages/api/battles/[id]/export.pdf.ts)).
  It already imports `m` from paraglide ([export.pdf.ts:5](../../../src/pages/api/battles/[id]/export.pdf.ts)),
  so it can resolve localized labels in the active locale.
- The export **button and download UX already exist** in
  [EnemiesSection.tsx](../../../src/components/battles/EnemiesSection.tsx) — **no UI change is needed**.
- Tests: builder unit tests live at `tests/unit/lib/pdf/battle-pdf.test.ts`; route integration tests
  at `tests/integration/api/battles-export.test.ts` using `makeSupabaseMock`. Both are the templates
  to extend.

## Desired End State

Exporting a battle that **has** an environment produces a PDF whose **first page** shows the
environment — a heading plus the five fields with **localized labels** and their generated text —
followed by one page per confirmed enemy (unchanged). Exporting a battle with **no** environment
produces exactly today's output (enemy pages only, no blank environment page). Field text wraps
within the page and overflows gracefully onto a continuation page rather than being clipped or
throwing.

Verify by: exporting a battle with a generated environment and confirming the leading environment
page with localized labels; exporting a battle without one and confirming the PDF is unchanged
(enemy pages only); and `npm run test`, `npm run typecheck`, `npm run lint` all pass.

### Key Discoveries:

- Keep the builder **pure and i18n-free** by passing it the already-resolved label strings. The route
  resolves `m.env_*()` (active locale) and hands the builder a labels object; the builder just draws
  them. This matches the recently shipped i18n-polish work without making the builder locale-aware.
- The builder already has the wrapping primitives needed: `drawText` with `maxWidth` + `lineHeight`,
  `widthOfTextAtSize`, a descending `cursorY`, and the page-bottom guard pattern
  ([battle-pdf.ts:239-267](../../../src/lib/pdf/battle-pdf.ts)) — reuse them for the environment page.
- The environment is **battle-level**, so it is its own page, not part of any enemy card — this also
  sidesteps the per-enemy `battle.name` header already drawn on each enemy page.
- The route's `battle` SELECT must add `environment`; `EnvironmentSection`'s field order
  (terrain → lighting → hazards → ambiance → trivia) is the order to mirror in the PDF.

## What We're NOT Doing

- No change to enemy-card rendering, page size, fonts, or the export button / download UX.
- No change to auth/ownership, response headers, or the workerd-hardened binary response.
- No new environment generation, schema, or migration — environment is consumed as-is.
- Not localizing the existing English stat-block labels (HP/AC/Saving Throws/…); out of scope, only
  the new environment labels are localized.
- No environment page when `battle.environment` is null (preserve current output exactly).

## Implementation Approach

Bottom-up, mirroring the original `pdf-export` structure: extend the pure builder first (render an
environment page from passed-in label strings + the environment object, unit-tested in isolation,
including the null case), then wire the route to fetch `environment` and resolve the localized labels
it passes in (integration-tested). No UI work.

## Phase 1: Builder renders the environment page

### Overview

Teach `buildBattlePdf` to draw a leading environment page when an environment is present, using
caller-supplied localized labels, then unit-test it.

### Changes Required:

#### 1. Environment page in the PDF builder

**File**: `src/lib/pdf/battle-pdf.ts`

**Intent**: Before the enemy loop, if an environment is present, add a first page drawing a heading
and the five fields (terrain, lighting, hazards, ambiance, trivia) in that order — each as a bold
localized label followed by its wrapped text. Keep the function pure: receive the label strings from
the caller rather than importing paraglide. Wrap long field text within the content width and
continue onto a new page if it overflows the page bottom (don't clip or throw).

**Contract**: Updated signature
`buildBattlePdf(battle: Pick<Battle, "name" | "environment">, enemies: Enemy[], envLabels: { sectionTitle: string; terrain: string; lighting: string; hazards: string; ambiance: string; trivia: string }): Promise<Uint8Array>`.
When `battle.environment` is non-null, the first page is the environment page; when null, output is
unchanged (enemy pages only). Reuses the existing wrapping/`cursorY`/page-bottom patterns; adds a
continuation page when the environment content exceeds one page. Still returns bytes beginning with
`%PDF-`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`
- New unit test: a battle with an environment yields a PDF whose page count is `enemies + 1` (one leading environment page)
- New unit test: a battle with `environment: null` yields exactly `enemies` pages (no environment page)
- New unit test: very long field values (near the 2000-char max) wrap and paginate without throwing
- Existing builder tests still pass (enemy pages, invalid-stats skip, `%PDF-` signature)

#### Manual Verification:

- The generated environment page is readable: heading plus the five labelled fields in EnvironmentSection order, text wrapped within the margins

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: Route fetches environment + passes localized labels

### Overview

Make the export route fetch the battle's `environment` and pass it, with route-resolved localized
labels, into `buildBattlePdf`. Extend the integration test.

### Changes Required:

#### 1. Fetch environment and pass localized labels

**File**: `src/pages/api/battles/[id]/export.pdf.ts`

**Intent**: Add `environment` to the battle SELECT, resolve the five field labels plus the section
title via `m.env_*()` in the active locale, and pass `battle` (now including `environment`) and the
resolved `envLabels` object to `buildBattlePdf`. No change to auth, ownership, enemy fetch, status
codes, or response headers.

**Contract**: Battle SELECT becomes `"id, name, campaign_id, environment"`
([export.pdf.ts:23](../../../src/pages/api/battles/[id]/export.pdf.ts)); the `buildBattlePdf` call
([export.pdf.ts:67](../../../src/pages/api/battles/[id]/export.pdf.ts)) passes the new `envLabels`
object built from `m.env_section_title()`, `m.env_terrain()`, `m.env_lighting()`, `m.env_hazards()`,
`m.env_ambiance()`, `m.env_trivia()`. Everything else unchanged.

#### 2. Integration test for environment in the export

**File**: `tests/integration/api/battles-export.test.ts`

**Intent**: Cover that the route fetches and includes the environment: a battle whose mock row has an
environment exports a valid PDF (still `200`, `application/pdf`, `%PDF-` body), and a battle with
`environment: null` still exports successfully.

**Contract**: New/extended cases via `makeSupabaseMock` keyed by `battles`/`campaigns`/`enemies`
where the `battles` row carries an `environment` object (and a null variant); assert success + headers
+ `%PDF-` body. Existing cases (401/404/500/no-enemies/headers) still pass.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Integration test: a battle with an environment exports `200` + `application/pdf` + `%PDF-` body
- Integration test: a battle with `environment: null` still exports successfully
- Existing export route tests still pass: `npm run test`

#### Manual Verification:

- Exporting (via the existing button) a battle with a generated environment downloads a PDF whose first page is the localized environment, followed by the enemy pages
- Exporting a battle without an environment downloads the same output as before (enemy pages only)
- Switching the app locale changes the environment labels in the exported PDF

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation.

---

## Testing Strategy

### Unit Tests (`tests/unit/lib/pdf/battle-pdf.test.ts`):

- environment present → page count is `enemies + 1`
- `environment: null` → page count is `enemies`
- near-max-length field values wrap and paginate without throwing
- existing enemy-page / invalid-stats / `%PDF-` cases unchanged

### Integration Tests (`tests/integration/api/battles-export.test.ts`):

- battle with environment → `200` + `application/pdf` + `%PDF-`
- battle with `environment: null` → still `200`
- existing guard/header cases unchanged

### Manual Testing Steps:

1. Generate an environment on a battle with confirmed enemies, click Export PDF — confirm the leading
   environment page with localized labels, then enemy pages.
2. Export a battle that has confirmed enemies but no environment — confirm output matches the previous
   behaviour (enemy pages only, no blank page).
3. Switch locale, re-export — confirm the environment labels change language.

## Performance Considerations

One extra page with five wrapped text fields adds negligible cost (pdf-lib ≈ 10 ms/page); the worker
bundle and runtime fit was confirmed in this change's earlier bundle check (gzip ≈ 746 KiB, ~27%
under the 1 MiB free limit). No new dependency.

## Migration Notes

None — no schema or data changes. Additive: one builder edit, one route edit, test additions.

## References

- Built PDF export this extends: `context/changes/pdf-export/plan.md`
- Environment schema/fields: `src/lib/schemas/environment.ts:3-9`
- Environment UI + label messages: `src/components/battles/EnvironmentSection.tsx:12-18,53-64`
- PDF builder: `src/lib/pdf/battle-pdf.ts:34` (signature), `:239-267` (wrapping pattern)
- Export route: `src/pages/api/battles/[id]/export.pdf.ts:23` (SELECT), `:67` (builder call)
- Integration-test template: `tests/integration/api/battles-export.test.ts`
- Bundle-fit check (this change, earlier): gzip ≈ 746 KiB vs 1 MiB free limit

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Builder renders the environment page

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm run test`
- [x] 1.4 Unit test: environment present → page count is `enemies + 1`
- [x] 1.5 Unit test: `environment: null` → page count is `enemies`
- [x] 1.6 Unit test: near-max-length field values wrap and paginate without throwing
- [x] 1.7 Existing builder tests still pass (enemy pages, invalid-stats skip, `%PDF-`)

#### Manual

- [x] 1.8 Environment page is readable: heading + five labelled fields in order, wrapped within margins

### Phase 2: Route fetches environment + passes localized labels

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Integration test: battle with environment exports `200` + `application/pdf` + `%PDF-` body
- [ ] 2.4 Integration test: battle with `environment: null` still exports successfully
- [ ] 2.5 Existing export route tests still pass: `npm run test`

#### Manual

- [ ] 2.6 Exporting a battle with an environment shows the localized environment page first, then enemy pages
- [ ] 2.7 Exporting a battle without an environment matches the previous output (enemy pages only)
- [ ] 2.8 Switching locale changes the environment labels in the exported PDF
