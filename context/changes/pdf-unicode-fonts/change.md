---
change_id: pdf-unicode-fonts
title: Make PDF export Unicode-safe (Polish / Latin Extended) via embedded font
status: implemented
created: 2026-06-23
updated: 2026-06-28
roadmap_id: S-17
archived_at: null
---

## Notes

PDF export (`buildBattlePdf`) throws on any non-Latin-1 character because it draws
with pdf-lib's built-in `StandardFonts.Helvetica`, which uses **WinAnsi** encoding and
cannot encode Latin Extended-A glyphs. In Polish locale this fires every time —
the localized labels alone contain `Ś`, `ś`, `ż` (`Środowisko`, `Oświetlenie`,
`Zagrożenia`) — and the route surfaces it as "Nie udało się wygenerować PDF".
Confirmed via a repro test that asserts `buildBattlePdf` rejects on Polish text.

Scope is the **whole builder**, not just the environment page: enemy-card text
(AI-generated names/abilities) breaks the same way whenever it is Polish. This is a
pre-existing limitation of the base `pdf-export` feature that i18n-polish exposed;
surfaced while implementing `pdf-export-environment` (which added always-Polish labels).

Likely fix: register `@pdf-lib/fontkit` and embed a Unicode TTF covering Latin
Extended-A (e.g. a subsetted DejaVu/Noto Sans), then switch every `drawText` font in
`src/lib/pdf/battle-pdf.ts` from `StandardFonts.Helvetica`/`HelveticaBold` to the
embedded regular/bold faces.

Key constraints to plan around:
- **Workerd**: no filesystem — the font bytes must be bundled/imported, not read from disk.
- **Bundle budget**: the worker is ~746 KB gzip with ~278 KB headroom under the 1 MB free
  limit (measured in `pdf-export-environment`); a full TTF eats into that — prefer a
  pre-subsetted Latin + Latin Extended-A font and/or pdf-lib `{ subset: true }`.
- Glyph coverage must include Polish (ą ć ę ł ń ó ś ż ź + uppercase).

Related: extends `context/changes/pdf-export/` and `context/changes/pdf-export-environment/`.
