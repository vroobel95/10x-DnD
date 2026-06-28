# Unicode-safe PDF Export — Plan Brief

> Full plan: `context/changes/pdf-unicode-fonts/plan.md`
> Research: `context/changes/pdf-unicode-fonts/research.md`

## What & Why

PDF export fails entirely in Polish locale because pdf-lib's built-in `StandardFonts.Helvetica` uses WinAnsi encoding and throws on any Latin Extended-A glyph. In Polish, the environment section labels alone (`Środowisko`, `Oświetlenie`, `Zagrożenia`) are sufficient to trigger the failure — making every export unconditionally broken when the app locale is `pl`. The fix is to register a Unicode-capable fontkit and embed Noto Sans (Regular + Bold) TTFs.

## Starting Point

`buildBattlePdf` in `src/lib/pdf/battle-pdf.ts` embeds `StandardFonts.Helvetica` and `StandardFonts.HelveticaBold` (lines 52–53). All 15 `drawText()` calls reference the same two variables (`font`, `fontBold`). No fontkit is installed and no font assets exist in the repo. The worker bundle is ~746 KB gzip with ~278 KB advisory headroom (hard limit: 3 MB Free / 10 MB Paid).

## Desired End State

`buildBattlePdf` resolves for any text containing Polish diacritics. PDF export in the Polish locale completes without error, all characters render correctly in the downloaded file, and the worker bundle remains under the 3 MB hard limit. Two new unit tests covering Polish enemy content and Polish environment labels pass alongside the existing suite.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Fontkit package | `pdf-fontkit` (community fork) | Fixes TTF subsetting bugs in `@pdf-lib/fontkit` that affect dash and some OTF fonts | Research |
| Font | Noto Sans Regular + Bold (notofonts/latin-greek-cyrillic v2.015) | ~348 KB each, ~200–250 KB gzip combined; 100% Latin Extended-A coverage; OFL 1.1 | Research |
| Font bundling | Rename `.ttf` → `.bin`, import as `ArrayBuffer` | `@cloudflare/vite-plugin` handles `.bin` → `ArrayBuffer` natively; no wrangler.jsonc changes | Research |
| Font preparation | Full TTF + runtime `{ subset: true }` | No tooling required; pdf-fontkit subsets glyphs per document at embed time | Plan |
| Font module | `src/lib/pdf/fonts.ts` exports `REGULAR_FONT` + `BOLD_FONT` | Module-scope `Uint8Array` is cached per isolate; clean separation for future builders | Plan |
| Error handling | Hard error — propagate to export route | Follows the fail-fast rule in `lessons.md`; a corrupt font should not produce a silently broken PDF | Plan |
| TS declaration | Add `declare module "*.bin"` to `src/env.d.ts` | TypeScript has no built-in type for `.bin` imports; required for `tsc --noEmit` to pass | Plan |
| `ssr.noExternal` | Add `pdf-fontkit` preemptively | Prevents known Vite ESM interop issue (`registerFontkit is not a function` in workerd) | Research |
| Test scope | Extend existing unit test file with 2 Polish cases | Minimal new test code; directly covers the failure mode; reuses existing fixture helpers | Plan |

## Scope

**In scope:**
- Install `pdf-fontkit`
- Download and commit `NotoSans-Regular.bin` + `NotoSans-Bold.bin` to `src/lib/pdf/assets/`
- Add `*.bin` TypeScript declaration to `src/env.d.ts`
- Add `pdf-fontkit` to `vite.ssr.noExternal` in `astro.config.mjs`
- Create `src/lib/pdf/fonts.ts`
- Refactor `src/lib/pdf/battle-pdf.ts` lines 1 and 51–53
- Add 2 new Polish test cases to `tests/unit/lib/pdf/battle-pdf.test.ts`

**Out of scope:**
- Offline font pre-subsetting with HarfBuzz
- Changing the font for S-18 ui-redesign
- API routes, schemas, UI components
- Bold Italic / Italic font variants

## Architecture / Approach

The change is entirely contained to the PDF layer. The route (`src/pages/api/battles/[id]/export.pdf.ts`) is untouched — it calls `buildBattlePdf`, which owns all font logic. A new `fonts.ts` module holds the module-scope `Uint8Array` exports, keeping the builder file focused on drawing. Fontkit is registered once per `PDFDocument.create()` call, and both font faces are embedded with `{ subset: true }` so each output PDF only carries the glyphs actually drawn. The 15 `drawText()` calls and 8 `widthOfTextAtSize()` calls all reference the existing `font`/`fontBold` variables — they need no individual changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Dependency + Assets | `pdf-fontkit` installed; font `.bin` files committed; TS declaration added; Vite config updated; build green | Bundle size delta pushes past advisory 1 MB threshold (stays under 3 MB hard limit regardless) |
| 2. Font Module + Builder | `fonts.ts` created; builder uses embedded Unicode fonts; all existing unit tests pass | `registerFontkit is not a function` (mitigated by `ssr.noExternal` in Phase 1) |
| 3. Tests + Verification | 2 Polish unit tests pass; full suite clean; manual Polish export confirmed | Visual glyph rendering — can only be verified by opening the actual PDF |

**Prerequisites:** S-07 (pdf-export) and S-16 (i18n-polish) must be `impl_reviewed` — both are.  
**Estimated effort:** ~1 session across 3 phases (Phase 1 is mostly file download + config; Phase 2 is the core ~15-line edit; Phase 3 is test + QA).

## Open Risks & Assumptions

- Noto Sans Bold TTF is available in the `notofonts/latin-greek-cyrillic` v2.015 release zip — assumed yes (the repo ships Regular, Bold, Italic, BoldItalic); confirm when downloading.
- The actual post-Phase-1 bundle gzip is assumed to be ~200–250 KB larger — measure after `npm run build` in Phase 1 before committing to the font choice.
- `pdf-fontkit` with `{ subset: true }` on a Latin-script Noto Sans TTF is assumed to work without the CJK-specific bugs — test confirmed in Phase 2's unit run.

## Success Criteria (Summary)

- `buildBattlePdf` resolves (does not throw) for Polish text in both enemy content and environment labels
- `npm test` passes with 2 new Polish unit tests and no regressions
- A PDF exported in Polish locale displays all diacritics correctly when opened in a PDF viewer
