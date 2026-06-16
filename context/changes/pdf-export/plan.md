# PDF Export Implementation Plan

## Overview

Let a GM export a battle's **confirmed** enemy stat-blocks as a printable PDF for use
at the table. A new GET route generates the PDF in the Cloudflare Workers runtime using
`pdf-lib` (one A4 page per enemy, battle name on each page), and an export button in the
Confirmed Enemies section downloads it via `fetch` + blob with a loading state and inline
error handling.

Implements roadmap S-07 / PRD FR-012.

## Current State Analysis

- The app is server-rendered on **Cloudflare Workers (workerd)** — `output: "server"` +
  `adapter: cloudflare()` ([astro.config.mjs:12,29](../../../astro.config.mjs)). PDF generation
  must be pure JS/WASM, in-memory, no filesystem, no Chromium. `pdf-lib` is the chosen library
  (see `research.md` and `pdf-lib-reference.md`).
- Confirmed enemy data already exists: `enemies` rows with a JSONB `stats` field validated by
  `EnemySchema` ([src/lib/schemas/enemy.ts:8-23](../../../src/lib/schemas/enemy.ts)). The exact fields
  to render are mirrored by the existing card UI ([src/components/battles/EnemyCard.tsx:269-323](../../../src/components/battles/EnemyCard.tsx)),
  including the ability-modifier formula ([EnemyCard.tsx:30-33](../../../src/components/battles/EnemyCard.tsx)).
- API routes follow a fixed shape: `createClient` (null → 500), `context.locals.user`
  (null → 401), campaign-ownership lookup, then the operation, with not-found (404) split from
  DB-error (500). The single-battle ownership chain in
  [generate.ts:37-64](../../../src/pages/api/battles/[id]/generate.ts) is the closest template.
- **No binary response exists yet** — every route returns `Response.json(...)`. This feature
  introduces the first `new Response(bytes, { headers })`.
- Confirmed-enemy client state lives in `EnemiesSection`
  ([src/components/battles/EnemiesSection.tsx:15](../../../src/components/battles/EnemiesSection.tsx)),
  not `BattleHeader` — so the export button belongs there, next to the "Confirmed Enemies" header.
  The component already has an established fetch-with-error-state pattern (`handleGenerate`,
  `actionError`).
- Test infra is in place: vitest with `tests/**/*.test.ts`, a `makeSupabaseMock` helper
  ([tests/helpers/supabase.ts](../../../tests/helpers/supabase.ts)) keyed by `battles`/`campaigns`/`enemies`,
  unit tests under `tests/unit/`, and integration route tests under `tests/integration/api/`. The
  generate-route test ([tests/integration/api/battles-generate.test.ts](../../../tests/integration/api/battles-generate.test.ts))
  is a direct template.

## Desired End State

On a battle detail page with at least one confirmed enemy, an "Export PDF" button appears in the
Confirmed Enemies section. Clicking it downloads `battle-<name>.pdf` — one A4 page per confirmed
enemy, each page showing the battle name plus that enemy's full stat-block (name, CR, HP/AC/Speed,
six ability scores with modifiers, saving throws, skill modifiers, abilities). On failure the user
sees an inline error and the page does not navigate away. Verify by: clicking the button on a battle
with confirmed enemies and opening the resulting PDF; confirming the button is absent/disabled when
there are no confirmed enemies; and `npm run test`, `npm run typecheck`, `npm run lint` all pass.

### Key Discoveries:

- pdf-lib API for our needs is captured in `pdf-lib-reference.md`: `PDFDocument.create()`,
  `embedFont(StandardFonts.Helvetica)`, `addPage([595.28, 841.89])` (A4), `drawText`,
  `widthOfTextAtSize`/`heightAtSize`, bottom-left origin (`y` grows upward), `save()` → `Uint8Array`.
- Stats are JSONB typed as `Record<string, unknown> | null` ([src/types.ts:36](../../../src/types.ts));
  the builder must re-validate each enemy's `stats` with `EnemySchema.safeParse` and skip/handle
  invalid ones rather than trusting the shape (the UI does the same at [EnemyCard.tsx:251](../../../src/components/battles/EnemyCard.tsx)).
- Ability modifier: `Math.floor((score - 10) / 2)`, formatted with a leading `+` when ≥ 0
  ([EnemyCard.tsx:30-33](../../../src/components/battles/EnemyCard.tsx)). Saves/skills are formatted
  `KEY ±N` ([EnemyCard.tsx:299-301](../../../src/components/battles/EnemyCard.tsx)).
- Astro maps `src/pages/api/battles/[id]/export.pdf.ts` to the route `/api/battles/[id]/export.pdf`.
- pdf-lib standard fonts (Helvetica) are built-in — no font-file embedding, which is exactly what the
  no-filesystem Workers runtime needs.

## What We're NOT Doing

- No pending/unconfirmed enemies in the PDF — confirmed only.
- No multi-card-per-page packing, cover page, custom fonts, images/portraits, or theming — one A4
  page per enemy, Helvetica only.
- No PDF content-parsing tests (no asserting specific text inside the bytes).
- No new dependency beyond `pdf-lib` (no `@pdf-lib/fontkit`, no `boxpdf`).
- No data-model/schema/migration changes.
- No export entry point anywhere other than the battle detail page's Confirmed Enemies section.

## Implementation Approach

Separate the pure, testable PDF generation (`buildBattlePdf`) from the HTTP/auth concerns (the
route) from the client trigger (the button). Build bottom-up: the pure function first (unit-tested in
isolation, the riskiest logic), then the route that wires auth/ownership/data-fetch to it
(integration-tested against the established mock), then the UI button (manually verified). Mirror the
existing generate-route ownership chain and the existing EnemiesSection fetch-error pattern so the new
code reads like its neighbors.

## Critical Implementation Details

- **Coordinate system**: pdf-lib's origin is the bottom-left corner and `y` increases upward. The
  stat-block reads top-down, so track a descending `cursorY` from near the page top
  (`height - margin`) and decrement it as each line/section is drawn.
- **Bytes type at the route boundary**: `pdfDoc.save()` returns a `Uint8Array`; pass it straight to
  `new Response(...)`. Do not stringify or JSON-wrap it.

## Phase 1: PDF builder (pure function) + unit tests

### Overview

Add the `pdf-lib` dependency and a pure, Workers-safe function that turns a battle + its confirmed
enemies into PDF bytes. No HTTP, no Supabase — just data in, `Uint8Array` out. Unit-test it.

### Changes Required:

#### 1. Add dependency

**File**: `package.json`

**Intent**: Add `pdf-lib` as a runtime dependency so the builder can import it. No other deps
(fontkit/boxpdf explicitly out of scope).

**Contract**: `pdf-lib` appears under `dependencies`; `package-lock.json` updated via `npm install pdf-lib`.

#### 2. PDF builder module

**File**: `src/lib/pdf/battle-pdf.ts` (new)

**Intent**: Export an async `buildBattlePdf(battle, enemies)` that produces one A4 page per confirmed
enemy, each page drawing the battle name as a small header followed by that enemy's stat-block
(name + CR, HP/AC/Speed, the six ability scores with modifiers, saving throws, skill modifiers, and
abilities). Re-validate each enemy's `stats` with `EnemySchema` and skip entries that fail to parse so
one bad row can't abort the whole document. Use the built-in Helvetica/Helvetica-Bold standard fonts.

**Contract**: Signature `buildBattlePdf(battle: Pick<Battle, "name">, enemies: Enemy[]): Promise<Uint8Array>`.
A4 page size `[595.28, 841.89]`. Reuses the modifier formula `Math.floor((score - 10) / 2)` and the
`KEY ±N` formatting from the card UI (extract small local helpers). Long ability descriptions wrap
within the page width using `font.widthOfTextAtSize` (or `drawText`'s `maxWidth`). If a parsed-enemy
list is empty the function returns a single-page PDF or the route guards against it (see Phase 2) —
the builder must still return valid bytes for a non-empty list. Returns bytes beginning with the
`%PDF-` signature.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Unit tests pass: `npm run test`
- [ ] New unit test asserts `buildBattlePdf` output starts with the `%PDF-` byte signature
- [ ] New unit test asserts one page is produced per confirmed enemy (e.g. via `PDFDocument.load(bytes)` then `getPageCount()`)
- [ ] New unit test covers an enemy with optional `saving_throws`/`skill_modifiers` present and one with many/long abilities without throwing
- [ ] New unit test confirms an enemy whose `stats` fails `EnemySchema` is skipped (not thrown on)

#### Manual Verification:

- [ ] Generated bytes open as a valid PDF in a viewer with the expected per-enemy pages and readable stat-block layout

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: Export API route + integration tests

### Overview

Add the GET route that authenticates, verifies battle ownership, loads confirmed enemies, calls
`buildBattlePdf`, and returns the bytes as a PDF download. Integration-test the guards and headers.

### Changes Required:

#### 1. Export route

**File**: `src/pages/api/battles/[id]/export.pdf.ts` (new)

**Intent**: Implement `GET` that mirrors the generate-route auth + single-battle ownership chain,
then fetches the battle's confirmed enemies, builds the PDF, and streams it as an attachment. Return
404 when the battle is missing or not owned and when there are no confirmed enemies; sanitize all
Supabase errors (generic messages only, per lessons.md); split DB-error (500) from not-found (404).

**Contract**: `export const prerender = false;` and `export const GET: APIRoute`. Flow:
`createClient` null → 500 `{error:"Service unavailable"}`; no `locals.user` → 401; battle
`select("id, name, campaign_id").eq("id", id).single()` with `PGRST116` → 404 else error → 500;
campaign `select("id").eq("id", battle.campaign_id).eq("user_id", user.id).single()` with
`PGRST116` → 404; enemies `select("*").eq("battle_id", id).eq("status","confirmed").order("created_at")`;
empty list → 404 `{error:"No confirmed enemies to export"}`. On success:
`new Response(bytes, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="battle-<safeName>.pdf"' } })`
where `<safeName>` is the battle name slugified to a filename-safe ASCII string with a fallback (e.g.
`battle`). Wrap `buildBattlePdf` in try/catch → 500 generic message.

#### 2. Filename helper

**File**: `src/lib/pdf/battle-pdf.ts` (or a small local util)

**Intent**: Provide a helper that turns a battle name into a safe download filename so the route does
not inline ad-hoc sanitization.

**Contract**: `pdfFilename(name: string): string` returning a lowercased, hyphenated, ASCII-only stem
ending in `.pdf`, with a non-empty fallback.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Integration test: 500 when `createClient` returns null
- [ ] Integration test: 401 when unauthenticated
- [ ] Integration test: 404 when battle not found (`PGRST116`) and 500 on a non-not-found battle SELECT error
- [ ] Integration test: 404 when the battle is not owned by the user (campaign lookup `PGRST116`)
- [ ] Integration test: 404 when there are no confirmed enemies
- [ ] Integration test: 200 on success with `Content-Type: application/pdf`, a `Content-Disposition` attachment header, and a body beginning with `%PDF-`

#### Manual Verification:

- [ ] Hitting `/api/battles/<id>/export.pdf` while logged in for an owned battle downloads a valid PDF
- [ ] Requesting another user's battle id returns 404 (no data leak)

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 3: UI export button

### Overview

Add an "Export PDF" control to the Confirmed Enemies section that downloads the PDF via `fetch` +
blob, with a loading state and inline error — never navigating away or surfacing a raw error.

### Changes Required:

#### 1. Export button + handler in EnemiesSection

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Render an "Export PDF" button beside the "Confirmed Enemies" heading, shown only when
`confirmed.length > 0`. On click, `fetch` the export route, check `res.ok` (surface an inline error on
failure, matching the existing `actionError`/`generateError` pattern), read the response as a blob,
and trigger a download via a temporary object URL that is revoked afterward. Show a spinner/disabled
state while in flight.

**Contract**: New local state (e.g. `isExporting`, `exportError`) and an async `handleExport` using
`fetch(\`/api/battles/${battleId}/export.pdf\`)` → `res.blob()` →
`URL.createObjectURL` → anchor `click()` → `URL.revokeObjectURL`. Read the download filename from the
response `Content-Disposition` header when present, else fall back to `battle.pdf`. Button styling
follows the existing purple-button classes in this file; error styling follows the existing red error
banner classes.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Existing tests still pass: `npm run test`

#### Manual Verification:

- [ ] Button is hidden (or disabled) when there are no confirmed enemies and appears once at least one exists
- [ ] Clicking downloads the PDF without leaving the page; a loading state shows during generation
- [ ] Simulating a failed request shows an inline error and does not navigate away or expose a raw error message
- [ ] Downloaded file name reflects the battle name

---

## Testing Strategy

### Unit Tests (`tests/unit/lib/pdf/battle-pdf.test.ts`):

- `%PDF-` signature on output
- page count equals number of confirmed enemies
- enemies with/without optional saves & skills, and with long/many abilities, render without throwing
- enemy with `stats` that fails `EnemySchema` is skipped
- `pdfFilename` slugification + fallback

### Integration Tests (`tests/integration/api/battles-export.test.ts`):

- Mirror `battles-generate.test.ts` using `makeSupabaseMock` keyed by `battles`/`campaigns`/`enemies`
- Cover 500 (null client), 401, 404 (battle not found, IDOR via campaign), 500 (battle SELECT error),
  404 (no confirmed enemies), and 200 with correct headers + `%PDF-` body

### Manual Testing Steps:

1. Log in, open a battle with ≥1 confirmed enemy, click Export PDF, open the file — verify one page per
   enemy, battle name header, and all stat fields.
2. Open a battle with no confirmed enemies — verify the button is absent/disabled.
3. Temporarily point the fetch at a bad URL (or stop the dev server mid-request) — verify an inline
   error and no navigation.
4. Attempt to fetch another user's battle export URL directly — verify 404.

## Performance Considerations

pdf-lib runs in-isolate with ~10 ms/page overhead; a battle has at most a handful of confirmed
enemies, so generation is well within the Workers CPU budget. The whole document is built in memory
and returned in a single response — no streaming needed at this scale. `pdf-lib` (~330 KB gzipped)
fits comfortably within the Workers script-size limit.

## Migration Notes

None — no schema or data changes. Purely additive (one dependency, two new files, one edited component).

## References

- Research: `context/changes/pdf-export/research.md`
- pdf-lib API notes: `context/changes/pdf-export/pdf-lib-reference.md`
- Change identity: `context/changes/pdf-export/change.md`
- Route/ownership template: `src/pages/api/battles/[id]/generate.ts:37-64`
- Integration-test template: `tests/integration/api/battles-generate.test.ts`
- Supabase mock helper: `tests/helpers/supabase.ts`
- Card fields & modifier formula: `src/components/battles/EnemyCard.tsx:30-33,269-323`
- Lessons applied: `context/foundation/lessons.md` (sanitize errors; split 500 vs 404; never swallow fetch errors)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: PDF builder (pure function) + unit tests

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm run test`
- [x] 1.4 Unit test asserts `%PDF-` byte signature on output
- [x] 1.5 Unit test asserts one page per confirmed enemy
- [x] 1.6 Unit test covers optional saves/skills and many/long abilities without throwing
- [x] 1.7 Unit test confirms an enemy with invalid `stats` is skipped

#### Manual

- [ ] 1.8 Generated bytes open as a valid PDF with expected per-enemy pages and readable layout

### Phase 2: Export API route + integration tests

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Integration test: 500 when `createClient` returns null
- [ ] 2.4 Integration test: 401 when unauthenticated
- [ ] 2.5 Integration test: 404 on battle not found and 500 on non-not-found battle SELECT error
- [ ] 2.6 Integration test: 404 when battle not owned (campaign IDOR)
- [ ] 2.7 Integration test: 404 when no confirmed enemies
- [ ] 2.8 Integration test: 200 with `application/pdf` + `Content-Disposition` + `%PDF-` body

#### Manual

- [ ] 2.9 Logged-in request for an owned battle downloads a valid PDF
- [ ] 2.10 Requesting another user's battle id returns 404 (no data leak)

### Phase 3: UI export button

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Existing tests still pass: `npm run test`

#### Manual

- [ ] 3.4 Button hidden/disabled with no confirmed enemies, appears when ≥1 exists
- [ ] 3.5 Clicking downloads the PDF without leaving the page; loading state shows
- [ ] 3.6 Failed request shows inline error, no navigation, no raw error exposed
- [ ] 3.7 Downloaded file name reflects the battle name
