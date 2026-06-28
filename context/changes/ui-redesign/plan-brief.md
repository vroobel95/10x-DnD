# "Blood & Ink" Visual Redesign — Plan Brief

> Full plan: `context/changes/ui-redesign/plan.md`

## What & Why

Swap the app's visual identity to Lovable's **"Blood & Ink"** design system — dark-by-default ink
black, oxblood red, parchment ivory, and gold, with MedievalSharp/Cabin/Cormorant fonts and a paper-
grain texture. The current S-08 maroon-on-cosmic-navy look reads as a generic dark theme; the redesign
gives the product its Monster-Manual character. This is a **re-skin, not a rewrite** — the Astro +
React-islands + Supabase + Paraglide stack is untouched.

## Starting Point

The app already uses Tailwind v4 `@theme inline` + CSS variables — the **same mechanism** as the
Lovable export — so the palette swap is a content replacement in `src/styles/global.css`. Today the
landing leans on cosmic orbs/starfield + gradient-clip headings, the shell is glassmorphic, no brand
fonts load, and 26 files carry old maroon/cosmic tokens. `lucide-react` is already installed.

## Desired End State

Every surface — landing, campaigns, battles, auth, error — renders in Blood & Ink with full presence
parity to the export (Ornament dividers, sigils, chips, monster-card borders, stat-cell ability grids,
ornate tabs). No old token remains in `src/`, all copy (including new flavor text) resolves through
Paraglide in EN + PL, and the existing unit/e2e suites stay green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Font loading | Self-host via `@fontsource` | No render-blocking third-party request on Cloudflare; matches the already-bundled PDF fonts | Plan |
| Scope | All surfaces in one slice | Avoids leaving any page on the old theme mid-redesign | Plan |
| Fidelity | Full presence parity | The decoration *is* the redesign; half-measures read as generic dark | Plan |
| Old S-08 tokens | Hard audit + remove now | change.md says this supersedes S-08; prevents drift/leaks | Plan |
| New copy | Paraglide keys, EN + PL | Honors the S-16 no-raw-strings rule | Plan |
| Shared Button | Restyle variants to new system | Every existing `<Button>` rebrands automatically | Plan |
| Landing background | Vignette + global grain | Coherent with parchment/ink; starfield would clash | Plan |
| Verification | Manual parity + green suite | Catches regressions cheaply; pixel snapshots are a separate slice | Plan |

## Scope

**In scope:** global theme/fonts/utilities, app shell (Layout + Topbar), landing, all campaign
surfaces, battle view + enemy/environment, auth + error pages, new EN/PL i18n keys, old-token removal.

**Out of scope:** framework migration, data-model/schema changes (sigils/taglines derived locally,
not persisted), new shadcn components, PDF restyle (S-17), pixel-regression tooling, any behavioral
change to fetch/auth/export logic.

## Architecture / Approach

Bottom-up. Phase 1 establishes the global system (tokens, fonts, utilities, base layer + grain,
restyled Button, Ornament, shell) so every later page inherits the new look automatically. Phases 2–5
re-skin one vertical at a time (landing → campaigns → battles → auth/error), each adding its own
Paraglide keys inline so no phase leaves raw strings. Phase 6 is the cross-cutting sweep: grep proving
zero old tokens, PL completeness, and the full automated gate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Foundation & Shell | New tokens, fonts, utilities, grain, Button, Ornament, Layout, Topbar | Font-family/weight mismatch causing fallback (FOUT) |
| 2. Landing | Vignette hero, ink-card recents, monster-card trio | Restructure depth — full markup change, not class swap |
| 3. Campaigns | Sigil ink-card list, icon-inset form, detail page | Deriving sigils without persisted fields |
| 4. Battles | Ornate tabs, stat-cell grids, monster-card enemies + villain | Most decoration-dense; preserve fetch error-surfacing |
| 5. Auth & Error | Restyled auth forms + 404/error | Keeping validation/server-error behavior intact |
| 6. Audit & Verify | Zero old tokens, PL complete, full suite green | e2e locator regressions from markup changes |

**Prerequisites:** none — `lucide-react` already installed; `@fontsource` packages added in Phase 1.
**Estimated effort:** ~4–6 implementation sessions across 6 phases.

## Open Risks & Assumptions

- Markup changes may break e2e locators (especially battle/auth flows) — route fixes through PR review,
  don't auto-heal logic.
- PL translations for new flavor copy will be reasonable drafts, refinable later.
- Sigils/taglines are presentation-only and derived/omitted — no schema change assumed.
- Ornate tabs are built from utility classes (no new radix dependency), matching current island patterns.

## Success Criteria (Summary)

- Every page renders in Blood & Ink with brand fonts; no old maroon/cosmic token anywhere in `src/`.
- All copy translates in both EN and PL with no English fallback.
- `typecheck`/`lint`/`build` pass and the existing unit + e2e suites stay green.
