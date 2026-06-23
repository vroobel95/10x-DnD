---
change_id: pdf-export-environment
title: Add battle environment to PDF export
status: implemented
created: 2026-06-22
updated: 2026-06-23
archived_at: null
---

## Notes

Adds the battle environment (terrain, lighting, hazards, ambiance, trivia) as a leading
page in the exported PDF, with labels localized by the route (`m.env_*`) and passed into
the otherwise-pure builder.

**Known limitation (deferred to `pdf-unicode-fonts`):** the PDF builder uses pdf-lib's
built-in WinAnsi Helvetica, so export throws on non-Latin-1 text (e.g. Polish diacritics
in the localized labels or AI content). This is pre-existing in `pdf-export` and exposed
here because the environment labels always contain Polish glyphs in `pl` locale. The
environment-page work itself is correct (verified in `en` locale); full locale support
lands with `pdf-unicode-fonts`. Manual check 2.8 (locale-switch in the PDF) is descoped to
that change.
