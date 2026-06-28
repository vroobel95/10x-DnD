---
date: 2026-06-28T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: f2da80efe934929c4966017fbd0669f03a6fbf16
branch: main
repository: 10x-DnD
topic: "Unicode-safe PDF export — embed Latin Extended-A font for Polish locale"
tags: [research, pdf-lib, fontkit, unicode, cloudflare-workers, fonts, polish]
status: complete
last_updated: 2026-06-28
last_updated_by: Claude Sonnet 4.6
---

# Research: Unicode-safe PDF export (S-17 / pdf-unicode-fonts)

**Date**: 2026-06-28  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: f2da80efe934929c4966017fbd0669f03a6fbf16  
**Branch**: main  
**Repository**: 10x-DnD

## Research Question

How do we fix `buildBattlePdf` throwing on Polish/Latin Extended-A characters, given that:
- The workerd runtime has no filesystem
- The worker bundle is ~746 KB gzip with ~278 KB headroom under Cloudflare's advisory 1 MB threshold
- Both regular and bold fonts are needed
- The fix must cover all 15 `drawText()` call sites in the builder

---

## Summary

The fix is well-defined and fully actionable:

1. Install `pdf-fontkit` (community fork that fixes subsetting bugs in the official `@pdf-lib/fontkit`)
2. Download **Noto Sans Regular + Bold** TTFs from the `notofonts/latin-greek-cyrillic` repo (v2.003 static build, ~348 KB each, ~200–250 KB gzip combined)
3. Rename them to `.bin` so the Cloudflare Vite plugin bundles them as `ArrayBuffer` — no `wrangler.jsonc` changes needed
4. Register fontkit on the `PDFDocument`, embed both faces with `{ subset: true }`, and swap all 15 `drawText()` font references from `StandardFonts.Helvetica/HelveticaBold` to the embedded fonts
5. The **hard** bundle limit is 3 MB gzip (Free) / 10 MB (Paid) — the "1 MB headroom" in `change.md` is Cloudflare's cold-start advisory, not a deployment blocker; the Noto Sans pair (~200–250 KB gzip) fits comfortably

---

## Detailed Findings

### Current PDF Builder State

**File**: [`src/lib/pdf/battle-pdf.ts`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/lib/pdf/battle-pdf.ts)

- Line 1: `import { PDFDocument, StandardFonts, rgb } from "pdf-lib";`
- Line 52: `const font = await pdfDoc.embedFont(StandardFonts.Helvetica);`
- Line 53: `const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);`
- `@pdf-lib/fontkit` is **not installed** and **not imported** anywhere
- No TTF/OTF/WOFF files exist anywhere in the project tree

**PDF export route**: [`src/pages/api/battles/[id]/export.pdf.ts`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/pages/api/battles/%5Bid%5D/export.pdf.ts)  
- Line 80: `pdfBytes = await buildBattlePdf(battle, enemies, envLabels);`

**pdf-lib version**: `"pdf-lib": "^1.17.1"` (package.json line 41)

### All 15 `drawText()` Call Sites

Every call uses either `font` (regular) or `fontBold`. All 15 are in `src/lib/pdf/battle-pdf.ts`:

| Line | Font var | Size | Content | Page |
|------|----------|------|---------|------|
| 66   | `font`     | 8pt  | `battle.name` header | Environment |
| 79   | `fontBold` | 20pt | `envLabels.sectionTitle` | Environment |
| 103  | `fontBold` | 10pt | field label (terrain/lighting/etc.) | Environment |
| 106  | `font`     | 9pt  | field body text | Environment |
| 129  | `font`     | 8pt  | `battle.name` header | Enemy |
| 149  | `fontBold` | 20pt | `s.name` (enemy name) | Enemy |
| 159  | `font`     | 10pt | CR label | Enemy |
| 170  | `font`     | 10pt | HP/AC/Speed stats line | Enemy |
| 231  | `fontBold` | 7pt  | ability name (table row 1) | Enemy |
| 244  | `fontBold` | 12pt | ability score (table row 2) | Enemy |
| 256  | `font`     | 9pt  | modifier string | Enemy |
| 282  | `font`     | 9pt  | saving throws string | Enemy |
| 301  | `font`     | 9pt  | skills string | Enemy |
| 325  | `fontBold` | 10pt | `ability.name` | Enemy |
| 334  | `font`     | 9pt  | `ability.description` | Enemy |

All 15 are a drop-in font variable swap: `font` → embedded regular, `fontBold` → embedded bold.

### pdf-lib Fontkit API

Registering and embedding custom fonts:

```ts
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from 'pdf-fontkit'; // community fork — see font package section

import regularBuffer from '../assets/fonts/NotoSans-Regular.bin'; // ArrayBuffer
import boldBuffer    from '../assets/fonts/NotoSans-Bold.bin';    // ArrayBuffer

const pdfDoc = await PDFDocument.create();
pdfDoc.registerFontkit(fontkit); // synchronous

const font     = await pdfDoc.embedFont(regularBuffer, { subset: true });
const fontBold = await pdfDoc.embedFont(boldBuffer,    { subset: true });

// Usage — identical to current code, just different font variables:
page.drawText('Środowisko', { x: 50, y: 700, size: 12, font });
```

`embedFont` signature:
```ts
embedFont(
  font: StandardFonts | string | Uint8Array | ArrayBuffer,
  options?: { subset?: boolean; customName?: string; features?: TypeFeatures }
): Promise<PDFFont>
```

`PDFFont` returned by `embedFont` has the same `widthOfTextAtSize(text, size)` and `heightAtSize(size)` methods the builder already uses for layout — **no layout code changes needed**.

`{ subset: true }` causes pdf-lib to embed only glyphs actually drawn in the document, keeping PDF output small.

### Font Package Decision: `pdf-fontkit` over `@pdf-lib/fontkit`

**Do not use `@pdf-lib/fontkit`** for subsetting. Known bugs (officially acknowledged):
- `RangeError: Index out of range` on dash character (issue #1396)
- Corruption with variable fonts and some Google Fonts
- CJK subsetting failures (issues #494, #1232)

**Use `pdf-fontkit`** (npm: `pdf-fontkit`) — a community fork by @znacloud that fixes the subsetting logic. It is a **drop-in replacement**: same API, same `registerFontkit()` call, just different package name. Multiple users confirmed it works reliably with Latin-script TTFs.

For Polish (Latin Extended-A + standard ASCII), `@pdf-lib/fontkit` with `subset: true` would likely also work (the bugs surface mainly with CJK and variable fonts), but `pdf-fontkit` is the safer choice with no downside.

### Font Selection: Noto Sans (Recommended)

Three candidates evaluated:

| Font | Regular TTF | Bold TTF | Gzip (combined) | License | Notes |
|------|-------------|----------|-----------------|---------|-------|
| **Noto Sans v2.003** | ~348 KB | ~348 KB | **~200–250 KB** | OFL 1.1 | Best size/coverage ratio |
| DejaVu Sans | 739 KB | 689 KB | ~700–800 KB | Bitstream (permissive) | Exceeds advisory headroom |
| Lato (full) | 641 KB | 641 KB | ~400 KB | OFL 1.1 | Larger than Noto; Polish by design |

**Recommended: Noto Sans from `notofonts/latin-greek-cyrillic` repo** (v2.003 static builds)
- 100% Latin Extended-A coverage (all Polish glyphs: ą ć ę ł ń ó ś ż ź Ą Ć Ę Ł Ń Ó Ś Ż Ź)
- ~348 KB per file uncompressed; combined gzip ~200–250 KB
- Fits within the advisory 1 MB headroom (~278 KB remaining) when summed — close, but viable
- OFL 1.1 license (permissive, no attribution in PDF required)
- Source: https://github.com/notofonts/latin-greek-cyrillic/releases — download `NotoSans-v2.015.zip`, extract `NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` from the `hinted/ttf/` directory

**If bundle size becomes a concern after measurement**: use HarfBuzz `hb-subset` to pre-subset to Latin + Latin Extended-A only (≈50 code points). This reduces each file to <20 KB — leaving headroom to spare. This is a one-time offline step, not a runtime cost.

**Alternative if fonts must not count against the script limit**: put them in `public/fonts/` and fetch via `env.ASSETS.fetch()` at module-init (cached per isolate). Zero impact on worker script size; one subrequest on first cold-start only.

### Cloudflare Workers Font Bundling Strategy

**Hard limits** (corrected from change.md notes):
- Free plan: **3 MB gzip** (not 1 MB — the 1 MB figure is a cold-start advisory warning from `wrangler`)
- Paid plan: **10 MB gzip**
- Binary Data modules (`.bin` files) **count toward the worker script limit**

**Recommended: rename TTF → `.bin`, import as `ArrayBuffer`**

```ts
// src/lib/pdf/fonts.ts — module scope, cached per isolate
import regularBuffer from '../assets/fonts/NotoSans-Regular.bin';
import boldBuffer    from '../assets/fonts/NotoSans-Bold.bin';

export const REGULAR_FONT = new Uint8Array(regularBuffer);
export const BOLD_FONT    = new Uint8Array(boldBuffer);
```

Why `.bin`:
- `@astrojs/cloudflare` (via `@cloudflare/vite-plugin`) automatically handles `.bin` → `ArrayBuffer` with **no wrangler.jsonc or vite config changes**
- Works identically in `astro dev` (local workerd) and after `astro build` + `wrangler deploy`
- The `wrangler.jsonc` `rules` key is **ignored** in Astro/Vite builds — the Cloudflare Vite plugin handles module resolution

**What does NOT work**:
- `import font from './font.ttf?url'` — returns a URL string; no filesystem at runtime to resolve it
- `import font from './font.ttf' assert { type: 'arraybuffer' }` — import assertions of this type are not supported
- `fs.readFileSync()` — hard fail in workerd (no filesystem)
- Wrangler `rules` with `type: "Data"` — ignored when using the Cloudflare Vite plugin

**Potential Vite/ESM gotcha**: A reported bug shows `PDFDocument_default.registerFontkit is not a function` in some Vite+Workers setups due to ESM resolution. The fix is to add `pdf-fontkit` to `ssr.noExternal` in `astro.config.mjs`:

```ts
// astro.config.mjs
export default defineConfig({
  vite: {
    ssr: {
      noExternal: ['pdf-fontkit'],
    },
  },
});
```

This is a known Vite SSR bundling issue, not a pdf-lib bug. Add it preemptively or as the fix if `registerFontkit is not a function` appears during testing.

---

## Code References

- [`src/lib/pdf/battle-pdf.ts:1`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/lib/pdf/battle-pdf.ts#L1) — pdf-lib import (StandardFonts, rgb)
- [`src/lib/pdf/battle-pdf.ts:52-53`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/lib/pdf/battle-pdf.ts#L52-L53) — font embedding (both need replacing)
- [`src/lib/pdf/battle-pdf.ts:66`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/lib/pdf/battle-pdf.ts#L66) — first drawText (env page header)
- [`src/lib/pdf/battle-pdf.ts:334`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/lib/pdf/battle-pdf.ts#L334) — last drawText (ability description)
- [`src/pages/api/battles/[id]/export.pdf.ts:80`](https://github.com/vroobel95/10x-DnD/blob/f2da80efe934929c4966017fbd0669f03a6fbf16/src/pages/api/battles/%5Bid%5D/export.pdf.ts#L80) — buildBattlePdf call site

---

## Architecture Insights

**The pure builder pattern (established in pdf-export-environment) makes this change contained.** The route resolves all i18n labels and passes them as plain strings; the builder draws them. Switching fonts touches only:
1. The font imports (new module or top of `battle-pdf.ts`)
2. Lines 52–53 (the two `embedFont` calls)
3. All 15 `drawText()` font references (variable name swap only — no layout logic changes)

The builder's text-measurement API (`font.widthOfTextAtSize`, `font.heightAtSize`) is identical for embedded fonts — the wrapping and pagination code is untouched.

**Font initialization placement**: Place the `Uint8Array` construction at module scope (outside the async function) so the ArrayBuffer→Uint8Array conversion happens once per isolate, not per PDF request. Pass them into `buildBattlePdf` as parameters, or have the builder import from a shared `src/lib/pdf/fonts.ts` module.

**Bold/regular are two separate embed calls** — pdf-lib has no concept of font weight within a single `PDFFont`. Variable fonts (single file, `wght` axis) exist but fontkit's subsetting for variable fonts is even less reliable; use two separate static TTF files.

---

## Historical Context (from prior changes)

- [`context/changes/pdf-export/`](../../pdf-export/) — S-07: established pdf-lib approach; StandardFonts only; bundle ~330 KB gzip for pdf-lib alone; workerd constraints documented (no fs, no Chromium)
- [`context/changes/pdf-export-environment/`](../../pdf-export-environment/) — S-15: added environment page with localized labels; confirmed the WinAnsi throw; deferred this fix; bundle grew to ~746 KB gzip; pure builder pattern locked in (route resolves labels, builder draws strings)
- [`context/changes/pdf-unicode-fonts/change.md`](./change.md) — S-17: scope + constraints already documented; this research validates and refines them

---

## Open Questions

1. **Is the Workers plan Free or Paid?** The hard limit is 3 MB (Free) vs. 10 MB (Paid). Noto Sans ~200–250 KB gzip fits either plan. The "278 KB headroom under 1 MB" in change.md is relative to Cloudflare's 1 MB cold-start advisory — not a hard limit. Clarifying the plan tier removes the size anxiety entirely.

2. **Pre-subset the fonts offline?** Noto Sans ~348 KB × 2 ≈ ~200–250 KB gzip combined. That's inside the 278 KB advisory headroom. But if the bundle has grown since that measurement, using `hb-subset` to cut each font to Latin + Latin Extended-A (≈50 code points, <20 KB each) is a safe fallback and a one-time offline step.

3. **Bold Noto Sans availability**: Confirm `NotoSans-Bold.ttf` is available in the `notofonts/latin-greek-cyrillic` release zip (it should be — the repo ships Regular, Bold, Italic, BoldItalic). Only Regular and Bold are needed.

4. **`ssr.noExternal` required?** The ESM resolution issue is reported in Remix+Vite; Astro may not exhibit it. Add it only if `registerFontkit is not a function` appears in local dev or CI.

---

## Recommended Implementation Plan (high-level, for `/10x-plan`)

**Phase 1 — Asset preparation**
- Download `NotoSans-Regular.ttf` + `NotoSans-Bold.ttf` from `notofonts/latin-greek-cyrillic` v2.015
- Rename to `.bin`, place at `src/lib/pdf/assets/NotoSans-Regular.bin` and `NotoSans-Bold.bin`
- Measure gzip contribution: `wrangler deploy --dry-run` or `astro build && du -sh dist/_worker.js`

**Phase 2 — Dependency**
- `npm install pdf-fontkit`
- If needed: add `pdf-fontkit` to `ssr.noExternal` in `astro.config.mjs`

**Phase 3 — Builder update (`src/lib/pdf/battle-pdf.ts`)**
- Import both `.bin` files at module scope → `Uint8Array`
- Import `fontkit from 'pdf-fontkit'`
- Replace lines 52–53: register fontkit, embed both faces with `{ subset: true }`
- Swap all 15 `drawText()` font references (variable names only, no positional changes)

**Phase 4 — Verify**
- Run the existing repro test (asserts `buildBattlePdf` resolves on Polish text)
- `astro build` — confirm no bundle errors, check output size
- Manual: export a PDF in Polish locale, visually verify all characters render
