# Unicode-safe PDF Export Implementation Plan

## Overview

Register `pdf-fontkit` and embed Noto Sans Regular + Bold TTF fonts into the `buildBattlePdf` builder, replacing the WinAnsi-limited `StandardFonts.Helvetica/HelveticaBold`. This makes all text in the exported PDF Unicode-safe, fixing the Polish locale export failure ("Nie udało się wygenerować PDF") that fires because every localized environment label contains Latin Extended-A glyphs.

## Current State Analysis

- `src/lib/pdf/battle-pdf.ts` embeds `StandardFonts.Helvetica` (line 52) and `StandardFonts.HelveticaBold` (line 53) — both use WinAnsi encoding and throw on any Latin Extended-A glyph
- All 15 `drawText()` calls and 8 `widthOfTextAtSize()` calls already reference the same two variables (`font`, `fontBold`) — no per-call edits needed once the two `embedFont` lines are replaced
- `pdf-fontkit` is not installed; no font assets exist in the repo
- `astro.config.mjs` has an existing `vite.ssr` block (line 27) with an `optimizeDeps` key — `noExternal` is added as a sibling key inside the same block
- `src/env.d.ts` has no `*.bin` module declaration — TypeScript will error on `.bin` imports without one
- Worker bundle: ~746 KB gzip, ~278 KB advisory headroom; hard limit is 3 MB (Free) / 10 MB (Paid) — Noto Sans Regular + Bold adds ~200–250 KB gzip combined, fits within the hard limit

## Desired End State

`buildBattlePdf` resolves for any text containing Polish diacritics (ą ć ę ł ń ó ś ż ź + uppercase variants). PDF export in the Polish locale no longer throws. The worker bundle builds cleanly, type-checks cleanly, and remains under 3 MB gzip. Two new test cases — one for Polish enemy content, one for Polish environment labels — pass alongside all existing tests.

### Key Discoveries

- All 15 `drawText()` calls are variable swaps only; the two `embedFont` replacements at [battle-pdf.ts:52-53](../../../src/lib/pdf/battle-pdf.ts#L52-L53) propagate to the entire builder automatically
- Noto Sans from `notofonts/latin-greek-cyrillic` v2.015 covers 100% of Latin Extended-A (all Polish glyphs); OFL 1.1 license (no attribution required in the PDF)
- `.bin` extension → `ArrayBuffer` is handled automatically by `@cloudflare/vite-plugin`; no `wrangler.jsonc` changes needed
- `pdf-fontkit` (community fork of `@pdf-lib/fontkit`) fixes CFF/TTF subsetting bugs; same `registerFontkit` API; `{ subset: true }` keeps PDF output small regardless of font file size
- `ssr.noExternal: ['pdf-fontkit']` prevents a known Vite ESM interop issue that manifests as `registerFontkit is not a function` at runtime

## What We're NOT Doing

- Pre-subsetting fonts offline with HarfBuzz — full TTF + runtime `{ subset: true }` chosen for zero tooling friction
- Catching/swallowing font embedding errors — failures propagate to the export route's existing error handler (fail-fast principle from `context/foundation/lessons.md`)
- Changing font selection for S-18 ui-redesign (separate change)
- Modifying any API route, schema, component, or Supabase query
- Adding Bold Italic or Italic variants — only Regular and Bold are needed

## Implementation Approach

Three sequential phases: install the npm dependency and prepare binary font assets (Phase 1), create a shared font module and refactor the builder (Phase 2), then add Polish test cases and verify manually (Phase 3). Phase 2 depends on the assets from Phase 1; Phase 3 validates the completed implementation.

## Critical Implementation Details

**`ssr.noExternal` is required preemptively.** The `@cloudflare/vite-plugin` + fontkit interop issue causes `PDFDocument.registerFontkit is not a function` at runtime in some Vite SSR builds because the package is resolved as an external and its CJS/ESM shim is not bundled. Adding `pdf-fontkit` to `vite.ssr.noExternal` forces Vite to bundle it into the SSR output, eliminating the interop gap before it can surface.

**`*.bin` TypeScript declaration is required.** TypeScript has no built-in module type for `.bin` files. Without `declare module "*.bin" { const content: ArrayBuffer; export default content; }` in `src/env.d.ts`, every `.bin` import in `fonts.ts` produces a TypeScript error at build time — the type declaration must land in Phase 1 alongside the font files.

---

## Phase 1: Dependency, Font Assets, and Type Declaration

### Overview

Install `pdf-fontkit`, download Noto Sans Regular and Bold TTF files from the canonical release, rename them to `.bin`, place them in `src/lib/pdf/assets/`, add the TypeScript module declaration for `.bin` imports, and wire `pdf-fontkit` into `vite.ssr.noExternal`. Verify the build succeeds and measure the bundle size delta before any builder code changes.

### Changes Required

#### 1. Install `pdf-fontkit`

**File**: `package.json` (via `npm install pdf-fontkit`)

**Intent**: Add `pdf-fontkit` as a runtime dependency. This is the community fork of `@pdf-lib/fontkit` that fixes TTF subsetting bugs while exposing the identical `registerFontkit` API.

**Contract**: `pdf-fontkit` entry appears under `"dependencies"` in `package.json`. The `node_modules/pdf-fontkit` directory is created.

#### 2. Download and place Noto Sans font files

**Files**:
- `src/lib/pdf/assets/NotoSans-Regular.bin`
- `src/lib/pdf/assets/NotoSans-Bold.bin`

**Intent**: Provide the Unicode-safe font bytes that the builder will embed. The `.bin` extension is required for the Cloudflare Vite plugin to bundle them as `ArrayBuffer` with no additional config.

**Contract**: Download `NotoSans-v2.015.zip` (or equivalent release) from https://github.com/notofonts/latin-greek-cyrillic/releases. Extract `NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` from the `hinted/ttf/` directory inside the zip. Rename each to `.bin` and place at the paths above. The files are binary; they must not be touched by any text-encoding transform at commit or build time (`.gitattributes` binary mark is not required in practice but acceptable if the team prefers it).

#### 3. Add `*.bin` TypeScript module declaration

**File**: `src/env.d.ts`

**Intent**: Tell TypeScript that importing a `.bin` file returns an `ArrayBuffer` default export, eliminating the "Cannot find module" type error on the font imports in `fonts.ts`.

**Contract**: Add `declare module "*.bin" { const content: ArrayBuffer; export default content; }` to the existing `src/env.d.ts` file. Place it after the existing `App.Locals` namespace block.

#### 4. Add `pdf-fontkit` to `vite.ssr.noExternal`

**File**: `astro.config.mjs`

**Intent**: Prevent the Vite SSR bundler from treating `pdf-fontkit` as an external module, which causes a `registerFontkit is not a function` runtime error in the workerd isolate.

**Contract**: Inside the existing `vite.ssr` object (currently contains only `optimizeDeps`), add `noExternal: ['pdf-fontkit']` as a sibling key. The existing `optimizeDeps` key is unchanged.

### Success Criteria

#### Automated Verification

- Font assets present: `ls src/lib/pdf/assets/` shows `NotoSans-Regular.bin` and `NotoSans-Bold.bin`
- Build succeeds: `npm run build` exits 0 with no TypeScript or bundling errors
- Type check passes: `npx tsc --noEmit` exits 0

#### Manual Verification

- After `npm run build`, inspect the dist output size. Confirm the bundle grew by ~200–350 KB compared to the pre-change baseline — this is the expected cost of the two Noto Sans files. Confirm the total remains under 3 MB gzip (the Cloudflare Workers hard limit).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the bundle size delta is acceptable before proceeding to Phase 2.

---

## Phase 2: Font Module and Builder Refactor

### Overview

Create `src/lib/pdf/fonts.ts` to export the font bytes as module-scope `Uint8Array` values (cached per isolate), then update `battle-pdf.ts` to register fontkit, embed both faces with `{ subset: true }`, and drop the now-unused `StandardFonts` import. No layout logic changes are required.

### Changes Required

#### 1. Create `src/lib/pdf/fonts.ts`

**File**: `src/lib/pdf/fonts.ts` (new file)

**Intent**: Centralize font byte imports at module scope so the `ArrayBuffer → Uint8Array` conversion runs once per isolate (not once per PDF request), and so a future second PDF builder can reuse the same font assets without re-importing.

**Contract**: The module imports `NotoSans-Regular.bin` and `NotoSans-Bold.bin` as default imports, converts each `ArrayBuffer` to `Uint8Array` at module scope, and exports them as `REGULAR_FONT: Uint8Array` and `BOLD_FONT: Uint8Array`.

#### 2. Refactor `src/lib/pdf/battle-pdf.ts`

**File**: `src/lib/pdf/battle-pdf.ts`

**Intent**: Replace the two WinAnsi-encoded `StandardFonts` embeds with the Unicode-capable Noto Sans faces, register `fontkit` so pdf-lib can process custom TTF files, and clean up the now-unused `StandardFonts` import.

**Contract**: Four edits, in order:

- **Import line (line 1)**: Remove `StandardFonts` from the `pdf-lib` named import. Keep `PDFDocument` and `rgb`.
- **New imports (after line 1)**: Add `import fontkit from 'pdf-fontkit'` and `import { REGULAR_FONT, BOLD_FONT } from './fonts'`.
- **Fontkit registration (after line 51, `PDFDocument.create()`)**: Add `pdfDoc.registerFontkit(fontkit)` synchronously before the two `embedFont` calls.
- **Lines 52–53**: Replace `pdfDoc.embedFont(StandardFonts.Helvetica)` with `pdfDoc.embedFont(REGULAR_FONT, { subset: true })` and `pdfDoc.embedFont(StandardFonts.HelveticaBold)` with `pdfDoc.embedFont(BOLD_FONT, { subset: true })`. The variable names `font` and `fontBold` are unchanged — all 15 `drawText()` calls and 8 `widthOfTextAtSize()` calls propagate automatically.

### Success Criteria

#### Automated Verification

- Unit tests pass: `npx vitest run tests/unit/lib/pdf/battle-pdf.test.ts` — all 8 existing `buildBattlePdf` tests and 4 `pdfFilename` tests pass
- Type check passes: `npx tsc --noEmit` exits 0
- Build passes: `npm run build` exits 0

#### Manual Verification

- Run `npx vitest run tests/unit/lib/pdf/battle-pdf.test.ts` and confirm all existing tests pass with the embedded fonts (no regressions in page count, PDF signature, or pagination behavior).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Test Extension and Manual Verification

### Overview

Add two new test cases to the existing unit test file that assert `buildBattlePdf` resolves cleanly when given Polish-language input — covering both enemy card text and environment labels. Then verify the fix end-to-end in the running app with Polish locale.

### Changes Required

#### 1. Add Polish test cases to `tests/unit/lib/pdf/battle-pdf.test.ts`

**File**: `tests/unit/lib/pdf/battle-pdf.test.ts`

**Intent**: Confirm that the builder no longer throws on Latin Extended-A glyphs — both in enemy content (AI-generated names/abilities) and in environment labels (which are always Polish in the `pl` locale).

**Contract**: Add two `it` blocks inside the existing `describe("buildBattlePdf", ...)` suite:

1. A test with a Polish battle name and a Polish-named enemy whose `abilities` array contains ability names and descriptions with diacritics (ą ć ę ł ń ó ś ż ź Ś Ż). Assert the returned `Uint8Array` begins with `%PDF-` (same assertion as the first existing test). The enemy `stats` object follows the `BASE_STATS` shape already defined in the test file.

2. A test that passes a `BattleEnvironment` with Polish field values alongside an `EnvLabels` object whose `sectionTitle`, `terrain`, `lighting`, `hazards`, `ambiance`, and `trivia` keys contain Polish strings (e.g., `"Środowisko"`, `"Oświetlenie"`, `"Zagrożenia"`). Assert `%PDF-` prefix and a page count ≥ 2 (one env page + one enemy page).

### Success Criteria

#### Automated Verification

- New tests pass: `npx vitest run tests/unit/lib/pdf/battle-pdf.test.ts` — 10 `buildBattlePdf` tests pass (8 existing + 2 new Polish tests)
- Full suite passes: `npm test` exits 0 — no regressions in integration or other unit tests

#### Manual Verification

- In the running app with the locale set to Polish (`pl`): open a battle that has a generated environment and at least one confirmed enemy. Click the Export PDF button. Confirm the file downloads without error. Open the PDF and verify all Polish diacritics in the environment labels (`Środowisko`, `Oświetlenie`, `Zagrożenia`, etc.) and any Polish AI-generated enemy names/abilities render correctly (not as `?` or replacement characters, and not as a thrown error).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before marking this change complete.

---

## Testing Strategy

### Unit Tests

- 2 new tests in `tests/unit/lib/pdf/battle-pdf.test.ts` covering Polish enemy content and Polish environment labels
- All 12 existing tests in that file must continue to pass (no regression in page counts, PDF signature, pagination, or validation-skip behavior)

### Integration Tests

- `tests/integration/api/battles-export.test.ts` mocks `buildBattlePdf` — no changes expected; run as part of `npm test` to confirm no regression

### Manual Testing Steps

1. Set locale to Polish in the app (language toggle in navbar)
2. Navigate to a battle that has an environment block and at least one confirmed enemy
3. Click Export PDF
4. Confirm the download completes without a toast error or 500 response
5. Open the downloaded PDF — verify all Polish characters in environment labels and enemy text are readable
6. Switch locale back to English, export the same battle — confirm the English PDF is unaffected

## Performance Considerations

- Font bytes are converted to `Uint8Array` once at module scope in `fonts.ts` (cached per isolate). No per-request I/O or conversion.
- `{ subset: true }` in `embedFont` causes pdf-lib to include only the glyphs actually drawn in each PDF, keeping individual PDF file sizes small regardless of the ~348 KB font file.

## References

- Research: `context/changes/pdf-unicode-fonts/research.md`
- Builder under change: `src/lib/pdf/battle-pdf.ts` (lines 1, 51–53)
- Unit test file: `tests/unit/lib/pdf/battle-pdf.test.ts`
- Astro config: `astro.config.mjs` (line 27, `vite.ssr` block)
- TypeScript declarations: `src/env.d.ts`
- Prior PDF export plan: `context/changes/pdf-export/plan.md`
- Prior environment export plan: `context/changes/pdf-export-environment/plan.md`
- Font source: https://github.com/notofonts/latin-greek-cyrillic/releases (v2.015, `hinted/ttf/`)
- `pdf-fontkit` on npm: https://www.npmjs.com/package/pdf-fontkit

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dependency, Font Assets, and Type Declaration

#### Automated

- [x] 1.1 Font assets present: `ls src/lib/pdf/assets/` shows both `.bin` files — 80cf56c
- [x] 1.2 Build succeeds: `npm run build` exits 0 — 80cf56c
- [x] 1.3 Type check passes: `npx tsc --noEmit` exits 0 — 80cf56c

#### Manual

- [x] 1.4 Bundle size delta acceptable (grew by ~200–350 KB; total under 3 MB gzip) — 80cf56c

### Phase 2: Font Module and Builder Refactor

#### Automated

- [x] 2.1 Unit tests pass: `npx vitest run tests/unit/lib/pdf/battle-pdf.test.ts` (all 12 tests)
- [x] 2.2 Type check passes: `npx tsc --noEmit` exits 0
- [x] 2.3 Build passes: `npm run build` exits 0

#### Manual

- [x] 2.4 All existing unit tests confirmed passing with embedded fonts (no page count or PDF signature regressions)

### Phase 3: Test Extension and Manual Verification

#### Automated

- [ ] 3.1 New Polish tests pass: `npx vitest run tests/unit/lib/pdf/battle-pdf.test.ts` — 10 of 10 `buildBattlePdf` tests pass
- [ ] 3.2 Full suite passes: `npm test` exits 0

#### Manual

- [ ] 3.3 Polish locale PDF export completes without error and diacritics render correctly in the downloaded PDF
