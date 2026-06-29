---
change_id: ui-redesign
title: "Blood & Ink" visual redesign (palette, fonts, presence) from Lovable export
status: implemented
created: 2026-06-23
updated: 2026-07-01
roadmap_id: S-18
archived_at: null
---

## Notes

A full visual-identity swap to Lovable's **"Blood & Ink"** design system, replacing the
S-08 maroon rebrand.

**Source files:** `C:\Users\ledze\Downloads\Battle Buddy AI` — a Vite + React 19 +
TanStack Router export (`src/routes/{index,campaigns,battle}.tsx`, `src/components/chrome.tsx`,
full `src/components/ui/` shadcn set, `src/styles.css`). Treat the route/component files as
**design reference**, not drop-in code.

**What changes:**
- **Palette** — dark-by-default oklch tokens: ink black (`--ink`, `--ink-deep`), oxblood red
  (`--blood`, `--blood-bright`), parchment ivory (`--ivory`), gold accent. Semantic mapping in
  `styles.css :root`.
- **Fonts** — MedievalSharp (display/headings), Cabin (sans/body), Cormorant Garamond (serif).
  Loaded in the export via a Google Fonts `<link>` in `__root.tsx` (preconnect + css2 URL).
- **Texture/presence** — a subtle paper-grain `body::before` overlay; restyled page layouts.

**Why this ports reasonably:** the design lives almost entirely in `src/styles.css`, which uses
Tailwind v4 `@theme inline` + CSS variables — the **same mechanism this Astro app already uses**.
So the theme tokens transfer cleanly into the app's global CSS.

**Key considerations for research/plan:**
- **Supersedes S-08** — Blood & Ink replaces the maroon palette; audit every component hard-coding
  the old maroon/purple tokens.
- **i18n (S-16) collision** — Lovable copy is hardcoded English; any changed text must flow through
  Paraglide `m.*` keys, never raw strings.
- **Framework gap** — route files are React + TanStack Router; re-apply their *presence* (layout,
  structure, copy) to the existing `.astro` pages rather than copying.
- **Font loading on Astro/Cloudflare** — decide Google Fonts `<link>` vs self-host / `@fontsource`.
- **Font ↔ PDF (S-17)** — keep brand fonts consistent with the Unicode-PDF work; still separate slices.

**Next:** `/10x-research ui-redesign` to map the file-by-file delta, then `/10x-plan ui-redesign`.
Roadmap slice: S-18.
