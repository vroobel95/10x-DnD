# "Blood & Ink" Visual Redesign Implementation Plan

## Overview

Port the Lovable "Blood & Ink" design system onto the existing Astro app. The redesign is a
**visual-identity swap**, not a framework migration: the app stays Astro + React islands +
Supabase + Paraglide. We replace the S-08 maroon/cosmic palette with dark-by-default oklch tokens
(ink black, oxblood red, parchment ivory, gold), self-host three brand fonts, add a set of
decorative CSS utilities, and re-skin every surface to full presence parity with the export.

The design transfers cleanly because both apps use the **same mechanism** — Tailwind v4
`@theme inline` + CSS custom properties — so tokens drop into `src/styles/global.css` directly.
The route/component files in the export are **design reference**, not drop-in code: their React +
TanStack markup is re-expressed as Astro pages / React islands, and all hardcoded English copy
flows through Paraglide `m.*` keys.

## Current State Analysis

- **Theme** — `src/styles/global.css` uses the stock shadcn neutral-slate palette (light `:root`
  + `.dark`) plus a custom `bg-cosmic` navy gradient utility. The structure (`@theme inline`
  color-token block, `@custom-variant dark`, `@layer base`) is identical in shape to the export's
  `styles.css`, so the swap is a content replacement, not a restructure.
- **Fonts** — none loaded; the app renders in the default system font. The export uses MedievalSharp
  (display), Cabin (body), Cormorant Garamond (serif italic).
- **Shell** — `src/layouts/Layout.astro` sets `class="bg-cosmic ..."` on `<body>` and renders
  `Topbar.astro` (glassmorphic `white/10` + `backdrop-blur-xl`) + `Banner.astro` + a `<slot/>`.
- **Landing** — `src/components/Welcome.astro` is built around cosmic orbs, a starfield, gradient-clip
  rainbow headings, and hardcoded `#701c3b`/`#9f1239` CTAs. It already routes copy through `m.*`.
- **Pages/islands** — Astro pages fetch from Supabase and hydrate React islands: `CampaignList`,
  `CampaignBattleList`, `BattleHeader`, `EnvironmentSection`, `EnemiesSection`, `EnemyCard`, the
  auth forms (`SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `FormField`,
  `SubmitButton`, `ServerError`, `PasswordToggle`). `lucide-react` is already a dependency and used
  throughout, so icons are available with no new dependency.
- **Button** — `src/components/ui/button.tsx` is stock shadcn with `dark:` variants that never fire
  (the new system is always-dark with no `.dark` class). Used in auth/campaign forms.
- **Old-token spread** — 26 files reference superseded tokens (`#701c3b`, `#9f1239`, `bg-cosmic`,
  `rose-*`, `blue-100/200`, `purple-200`, `pink-200`, `indigo-*`, `white/5`, `white/10`,
  `backdrop-blur`). All must be removed.
- **i18n** — Paraglide is the hard rule (S-16). `src/paraglide/messages/*.js` holds per-key modules;
  EN + PL locales exist. New copy needs new keys in both locales.

## Desired End State

Every page of the app renders in the Blood & Ink identity: ink-black background with a subtle
paper-grain overlay, MedievalSharp headings, Cabin body, oxblood-red primary actions, parchment-ivory
text, gold accents. The landing hero, campaign lists, battle view, enemy stat blocks, and auth forms
all match the export's presence (Ornament dividers, sigils, chips, monster-card borders, stat-cell
ability grids, ornate tabs). No old maroon/cosmic token remains anywhere in `src/`. All visible copy —
including new flavor text — resolves through Paraglide in both EN and PL. The existing unit + e2e
suites stay green and `typecheck`/`lint`/`build` pass.

**Verification**: `rg` for the old-token set over `src/` returns zero matches; the app builds and the
test suite passes; a per-page manual review against the export confirms parity.

### Key Discoveries:

- Token swap is content-only — `global.css` already mirrors the export's CSS structure
  (`src/styles/global.css` vs `C:\Repos\lovable-dnd-5enemy\src\styles.css`).
- The decorative utilities (`ink-card`, `monster-card`, `blood-button`, `chip`, `section-label`,
  `stat-cell`, `ornate-rule`) are framework-agnostic Tailwind v4 `@utility` blocks — copy verbatim.
- `lucide-react` is already installed and imported across the app — no new icon dependency.
- The export's `chrome.tsx` `TopBar` maps onto `Topbar.astro`, but we keep the **real** Paraglide
  `LocaleSwitcher` and real sign-out form (the export's EN/PL toggle and sign-out are mock).
- Astro pages are thin Supabase-fetch wrappers around React islands — restyling is split between the
  `.astro` page chrome (background/header wrapper) and the island markup.
- The export's mock `campaigns-store` (sigils, taglines, `lastPlayed`) is **not** in the data model;
  sigils are a presentation choice we derive locally, not new persisted fields (see "What We're NOT Doing").

## What We're NOT Doing

- **No framework migration** — staying on Astro + React islands + TanStack-free routing; not adopting
  TanStack Router, react-query, or the export's `campaigns-store`.
- **No data-model changes** — not adding `sigil`, `tagline`, `tones`, `startingLevel`, or `lastPlayed`
  columns. Sigils, where used, are derived client-side (e.g. a stable hash of the id) or a single
  default icon; taglines are omitted unless an existing field maps to them.
- **No new shadcn components** — only the existing `ui/button.tsx` is touched; the export's full
  `ui/` set is not imported. (Ornate tabs are built with utility classes, not `@radix-ui/react-tabs`,
  to avoid a new dependency — matching the app's current island patterns.)
- **No pixel-regression tooling** — visual snapshots (Playwright `toMatchSnapshot`, Argos) are a
  separate testing slice; parity here is verified by manual review.
- **No behavioral/logic changes** — fetch handlers, auth flows, PDF export, and API routes keep their
  current behavior; this slice only changes presentation and adds i18n keys.
- **No PDF restyle** — the S-17 Unicode-PDF font work is a separate slice; we keep PDF fonts as-is.

## Implementation Approach

Bottom-up: establish the global system first (tokens, fonts, utilities, base layer, button, shell)
so that every subsequent page inherits the new colors and type automatically, then re-skin surfaces
one vertical at a time (landing → campaigns → battles → auth/error). Each page phase adds its new
Paraglide keys inline (EN values, plus PL drafts) so no phase leaves raw strings behind. A final
phase does the cross-cutting cleanup: a grep sweep proving zero old tokens remain, a pass to confirm
PL completeness, and the full automated-verification run.

Because the global phase changes colors app-wide, the app will look coherent (if not yet
fully detailed) after Phase 1, and each later phase is independently reviewable.

## Critical Implementation Details

- **Always-dark, no `.dark` class** — the new `:root` IS the dark theme; remove the light/`.dark`
  split rather than keeping both. The `@custom-variant dark` line can stay (harmless) but no element
  should rely on `dark:` utilities firing. This is why `ui/button.tsx`'s `dark:` variants must be
  rewritten, not left in place.
- **Paper-grain stacking** — the export's grain is a fixed `body::before` at `z-index: 0`; page
  content must sit at `z-index: 10` (or in a `relative z-10` wrapper) or it renders under the grain.
  Preserve this layering when restyling `Layout.astro` / page wrappers.
- **Font weights** — `@fontsource` packages are weight-specific. Cabin needs 400/500/600/700,
  Cormorant Garamond needs 500/700 + italic, MedievalSharp is a single weight. Import only those to
  keep the bundle lean.

## Phase 1: Foundation & Shell

### Overview

Replace the global theme, self-host the fonts, port the decorative utilities and base layer, restyle
the shared Button, add the Ornament component, and re-skin the app shell (Layout + Topbar). After this
phase the whole app renders dark ink/blood/ivory with brand fonts and the global grain texture.

### Changes Required:

#### 1. Global theme & utilities

**File**: `src/styles/global.css`

**Intent**: Swap the entire palette to the Blood & Ink tokens (always-dark), expose the custom color
tokens as Tailwind utilities, port the decorative utilities and base layer, and remove `bg-cosmic`.

**Contract**: Mirror the export's `src/styles.css`:
- `:root` — raw palette (`--ink-deep/ink/ink-soft`, `--blood/blood-bright`, `--ivory/ivory-dim`,
  `--gold`) + semantic mapping (`--background`=ink-deep, `--foreground`=ivory, `--primary`=blood,
  `--card`=ink, `--border`/`--input`/`--ring`, `--destructive`); `--radius: 0.5rem`. Delete the
  light-mode values and the `.dark { … }` block.
- `@theme inline` — add `--font-display/-sans/-serif` and the `--color-ink*/-blood*/-ivory*/-gold`
  token mappings alongside the existing `--color-*` semantic mappings.
- `@layer base` — `html, body` background/foreground/font; `h1–h4` → `--font-display`; the
  `body::before` paper-grain overlay (fixed, `z-index 0`, radial-dot gradients).
- Port verbatim the `@utility` blocks: `ornate-rule`, `monster-card`, `ink-card`, `blood-button`,
  `chip`, `section-label`, `stat-cell`. Remove the `bg-cosmic` utility.

#### 2. Self-hosted fonts

**File**: `package.json`, `src/styles/global.css`

**Intent**: Install the three brand fonts as `@fontsource` packages and import the needed weights so
the app has no render-blocking third-party request on Cloudflare.

**Contract**: Add deps `@fontsource/medievalsharp`, `@fontsource/cabin`,
`@fontsource/cormorant-garamond`. Import the specific weights/styles at the top of `global.css`
(Cabin 400/500/600/700; Cormorant Garamond 500/700 + italic; MedievalSharp 400). Font-family names in
the `@theme` tokens must match the `@fontsource` family names.

#### 3. Shared Button restyle

**File**: `src/components/ui/button.tsx`

**Intent**: Rewrite the variants to the new system so every existing `<Button>` rebrands automatically;
drop the dead `dark:` variants.

**Contract**: Keep the `cva` API and variant names (`default`, `destructive`, `outline`, `secondary`,
`ghost`, `link`) and sizes so call sites are untouched. `default` adopts the `blood-button` look
(oxblood gradient, ivory text); `outline`/`secondary` adopt the ink-soft/border look; `destructive`
maps to the new `--destructive`. Remove `dark:` modifiers.

#### 4. Ornament component

**File**: `src/components/Ornament.astro` (new)

**Intent**: Provide the export's decorative divider (gradient rule + center diamond) as a reusable
Astro component for use across pages.

**Contract**: Astro component accepting an optional `class` prop, rendering the
`chrome.tsx` `Ornament` markup (two gradient rules flanking a 14×14 diamond SVG in `--gold`).

#### 5. Layout shell

**File**: `src/layouts/Layout.astro`

**Intent**: Remove `bg-cosmic` and let the global base layer own the background + grain; ensure page
content stacks above the grain.

**Contract**: Drop `bg-cosmic` from `<body>`; keep the flex/overflow structure. Ensure `<main>` (or a
wrapper) carries `relative z-10` so content renders above `body::before`. No change to Banner /
missing-config logic.

#### 6. Topbar re-skin

**File**: `src/components/Topbar.astro`

**Intent**: Re-skin the top bar to the export's `ink/80` backdrop chrome while keeping the real
LocaleSwitcher and real sign-out.

**Contract**: Replace the `white/10` glass card with the `border-border/60 bg-ink/80 backdrop-blur-sm`
header; email in `text-ivory-dim`; home + sign-out as `text-ivory-dim` / `text-blood-bright` icon
buttons (lucide `Home`, `LogOut`). Keep `<LocaleSwitcher client:load />` and the
`POST /api/auth/signout` form. No raw strings — keep existing `m.*` keys.

### Success Criteria:

#### Automated Verification:

- Dependencies install: `npm install`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Existing unit tests pass: `npm run test`

#### Manual Verification:

- App background is ink-black with a subtle paper grain on every route
- Headings render in MedievalSharp; body in Cabin; no FOUT/missing-font fallback
- Top bar matches the export (ink backdrop, ivory email, blood sign-out); LocaleSwitcher still toggles EN/PL
- Existing `<Button>` instances (auth/campaign forms) render in the new oxblood/ink styling
- No `bg-cosmic` or navy gradient visible anywhere

---

## Phase 2: Landing

### Overview

Restructure `Welcome.astro` from the cosmic-orb/starfield landing to the export's vignette + grain
hero with full presence: chip, MedievalSharp hero with blood-bright "5", Ornament, ink-card recent
campaigns, monster-card feature trio. Both the authed and guest branches are restyled.

### Changes Required:

#### 1. Landing restructure

**File**: `src/components/Welcome.astro`

**Intent**: Replace the cosmic background and rainbow gradient hero with the Blood & Ink landing;
remove all orbs/starfield and old tokens.

**Contract**: Drop the orb/starfield/`bg-cosmic` markup. Add the radial oxblood vignette wrapper
(`relative z-10` content over global grain). Hero: `chip` ("For Dungeon Masters"), `font-display`
title with `text-blood-bright` "5", `font-serif` italic tagline, `<Ornament>`. CTAs use the new
Button / `blood-button`. Recent campaigns → `ink-card` blocks with `chip` battle counts. Guest
feature trio → `monster-card` blocks with lucide icons. Preserve the authed/guest conditional and all
data props; route every string through `m.*` (see new keys below).

#### 2. New i18n keys

**File**: `src/paraglide/messages/*.js` (new key modules), EN + PL

**Intent**: Add Paraglide keys for the new landing copy.

**Contract**: New keys for: hero chip label, hero tagline/quote, the "Recent Campaigns" section label,
"View all" link, and any feature-card copy not already keyed. Add both EN values and PL translations.
Reuse existing `home_*` keys where they already cover the copy.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- No raw user-facing strings: `rg` for the new copy finds it only in `messages/`, not in `Welcome.astro`

#### Manual Verification:

- Guest landing matches the export: chip, blood-bright "5", tagline, Ornament, monster-card trio
- Authed landing shows ink-card recent campaigns with chips
- Switching to PL translates all landing copy including the new keys
- No orbs/starfield/old tokens remain on the landing

---

## Phase 3: Campaigns

### Overview

Re-skin the three campaign surfaces and their islands to ink-card rows/forms with the export's
presence: sigil-iconed list rows, icon-inset form inputs, and a restyled detail header + battle list.

### Changes Required:

#### 1. Campaigns list page + island

**File**: `src/pages/campaigns/index.astro`, `src/components/campaigns/CampaignList.tsx`

**Intent**: Restyle the list page chrome (header with `section-label` + Ornament) and the list rows to
`ink-card` with a sigil icon, blood-bright hover title, and meta line.

**Contract**: Page wrapper drops `bg-cosmic`; adds `section-label` ("Your Tome") + `font-display`
heading + `<Ornament>` and the "New Campaign" CTA. `CampaignList` rows become `ink-card` flex rows
with a derived sigil icon (lucide, chosen by stable hash of `campaign.id`), battle-count via the
existing plural keys, and the existing rename/delete actions restyled (destructive on hover). Keep all
fetch/state logic unchanged.

#### 2. New campaign page + form

**File**: `src/pages/campaigns/new.astro`, `src/components/campaigns/CreateCampaignForm.tsx`

**Intent**: Restyle to the export's centered `ink-card` form with icon-inset inputs and a `blood-button`
submit.

**Contract**: `section-label` + `font-display` heading + `<Ornament>`; form is an `ink-card`; inputs
get the `bg-ink-deep/60` + `focus:border-blood` treatment with leading lucide icons; submit uses the
new Button. Keep validation/submit behavior and existing `m.*` keys; add a section-label key if needed.

#### 3. Campaign detail page + battle list island

**File**: `src/pages/campaigns/[id].astro`, `src/components/campaigns/CampaignBattleList.tsx`

**Intent**: Restyle the detail header (back link, `font-display` title, New Battle CTA, Ornament) and
the battle rows to `ink-card`.

**Contract**: Page wrapper drops `bg-cosmic`; back link in `text-blood-bright`; title `font-display`;
battle rows → `ink-card` with meta (party level / location / date) using lucide icons; empty state →
`ink-card` centered with flavor italic. Keep data flow and CreateBattleForm behavior.

#### 4. New i18n keys

**File**: `src/paraglide/messages/*.js`, EN + PL

**Intent**: Add keys for new campaign section labels / flavor copy.

**Contract**: Keys for section labels ("Your Tome", "Begin a New Saga"), empty-state flavor, and any
new field labels; EN + PL.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit tests pass: `npm run test`

#### Manual Verification:

- Campaigns list shows sigil-iconed ink-card rows; rename/delete still work
- New-campaign form matches the export (ink-card, icon inputs, blood submit) and creates a campaign
- Campaign detail header + battle ink-cards render correctly; empty state shows flavor copy
- PL locale translates all new campaign copy
- No old tokens remain on any campaign surface

---

## Phase 4: Battles

### Overview

Re-skin the battle view: header chips, environment ink-card grid, ornate tabs, the generate-enemies
input, and the enemy stat blocks (stat-cell ability grid, monster-card confirmed cards with villain
block). This is the most decoration-dense surface.

### Changes Required:

#### 1. Battle page + header

**File**: `src/pages/battles/[id].astro`, `src/components/battles/BattleHeader.tsx`

**Intent**: Restyle the page wrapper and battle header (back link, `font-display` title, chip row for
party level / environment / created).

**Contract**: Wrapper drops `bg-cosmic`, `relative z-10`. Header: back link `text-blood-bright`,
`font-display` title, `chip` row. Keep existing data/props.

#### 2. Environment section

**File**: `src/components/battles/EnvironmentSection.tsx`

**Intent**: Restyle the environment blocks to the `ink-card` grid with `section-label` headers and
lucide icons; regenerate action uses the new Button.

**Contract**: `section-label` headers, two-column `ink-card` grid (terrain/lighting/hazards/ambiance/
trivia/features), empty state in `ink-card`. Keep regenerate fetch behavior and `m.*` keys.

#### 3. Enemies section (ornate tabs + generate)

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Add the ornate tab styling (Environment / Enemies) and restyle the generate-prompt textarea
+ button, the pending/confirmed sections.

**Contract**: Tabs built from utility classes (border-b blood, `data-[state=active]` blood underline) —
no new radix dependency; reuse the existing tab/section state. Generate textarea gets the
`bg-ink-deep/60` + `focus:border-blood` treatment; Generate uses the new Button with disabled state.
`section-label` headers for "Pending Review" / "Confirmed Enemies"; Export-PDF button restyled. Keep
all generate/confirm/deny fetch handlers and error surfacing (per lessons.md: surface fetch failures).

#### 4. Enemy card (stat block)

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: Restyle pending vs confirmed enemy cards to the export's stat-block look — `stat-cell`
ability grid, CR badge, HP/AC/Speed line, abilities list, and the monster-card villain block for
confirmed.

**Contract**: Pending → `ink-card`; confirmed → `monster-card`. `StatHeader` (name + CR badge),
`AbilityGrid` of `stat-cell`s (STR/DEX/CON/INT/WIS/CHA with computed modifiers), abilities list with
`font-display` accents, villain block (`text-gold` "MAIN VILLAIN", description, tactics italic, quotes)
gated on the villain flag. Confirm/Deny/Edit/Remove actions use the new Button styles. Keep all
existing props, data shape, and action handlers.

#### 5. New i18n keys

**File**: `src/paraglide/messages/*.js`, EN + PL

**Intent**: Add keys for new battle/enemy section labels and the villain label.

**Contract**: Keys for "Battle Environment", "Generate Enemies", "Pending Review", "Confirmed Enemies",
"MAIN VILLAIN", ability-score abbreviations if surfaced; EN + PL.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit tests pass: `npm run test`

#### Manual Verification:

- Battle header shows chips; tabs switch between Environment and Enemies with the ornate active style
- Environment renders the ink-card grid; regenerate still works
- Generate-enemies flow works; pending enemies show stat-cell ability grids
- Confirmed enemies render as monster-cards with the villain block where applicable; Export PDF works
- Fetch failures still surface to the user (no silent swallow)
- PL locale translates all new battle copy

---

## Phase 5: Auth & Error Pages

### Overview

Re-skin the auth pages and their form components to the ink-card + restyled-Button look, plus the
404 / error pages, so no surface is left on the old theme.

### Changes Required:

#### 1. Auth pages

**File**: `src/pages/auth/signin.astro`, `signup.astro`, `forgot-password.astro`,
`reset-password.astro`, `confirm-email.astro`

**Intent**: Restyle each auth page wrapper to centered ink-card layout with `section-label` +
`font-display` heading + Ornament; remove old tokens.

**Contract**: Drop `bg-cosmic` / glass tokens; centered `ink-card` container; headings `font-display`;
links in `text-blood-bright`. Keep existing form components, server-error handling, and `m.*` keys.

#### 2. Auth form components

**File**: `src/components/auth/FormField.tsx`, `SubmitButton.tsx`, `SignInForm.tsx`,
`SignUpForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, `ServerError.tsx`,
`PasswordToggle.tsx`

**Intent**: Restyle inputs, submit buttons, and error display to the new system.

**Contract**: Inputs get `bg-ink-deep/60` + `focus:border-blood`; `SubmitButton` uses the new Button;
`ServerError` uses the `--destructive` styling; password toggle icon in `text-ivory-dim`. Keep all
form logic, validation, and fetch behavior unchanged.

#### 3. Error / not-found pages

**File**: 404 / error surfaces (`src/pages/404.astro` if present, or the framework error page)

**Intent**: Restyle the not-found / error page to match (ink background, `font-display` heading,
blood-bright home link).

**Contract**: `font-display` heading, ivory body, `text-blood-bright` "back home" link, on the global
ink background. Route any copy through `m.*`.

#### 4. New i18n keys (if any)

**File**: `src/paraglide/messages/*.js`, EN + PL

**Intent**: Add keys for any new auth/error flavor copy introduced.

**Contract**: Only if new copy is added; EN + PL. Prefer reusing existing auth keys.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit tests pass: `npm run test`

#### Manual Verification:

- All five auth pages render in the new theme; sign-in / sign-up / forgot / reset flows still work
- Server errors and field validation display correctly in the new styling
- 404 / error page matches the theme
- PL locale translates auth + error copy

---

## Phase 6: Token-Audit Sweep, PL i18n & Verification

### Overview

Cross-cutting cleanup: prove no old tokens survive anywhere, confirm every new key has a PL
translation, and run the full automated suite + a final per-page manual parity review.

### Changes Required:

#### 1. Old-token grep sweep

**File**: all of `src/`

**Intent**: Confirm and remove any straggler old tokens missed during per-page phases.

**Contract**: `rg -n '701c3b|9f1239|bg-cosmic|rose-[0-9]|blue-100|blue-200|purple-200|pink-200|indigo-|from-blue|via-purple|to-pink'` over `src/` must return zero matches. Fix any remaining hits.
(`white/5`, `white/10`, `backdrop-blur` are reviewed case-by-case — the new Topbar legitimately uses a
backdrop blur; only old-palette usages are removed.)

#### 2. PL translation completeness

**File**: `src/paraglide/messages/*.js`

**Intent**: Ensure every new EN key added in Phases 2–5 has a corresponding PL value.

**Contract**: Each new key module resolves for both locales; no key falls back to EN under PL.

#### 3. Full verification run

**File**: — (no code change)

**Intent**: Run the complete gate.

**Contract**: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test`, and the e2e suite
(`npm run test:e2e`) all pass.

### Success Criteria:

#### Automated Verification:

- Old-token grep returns zero matches over `src/`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit tests pass: `npm run test`
- E2E tests pass: `npm run test:e2e`

#### Manual Verification:

- Per-page review (landing, campaigns ×3, battle, auth ×5, error) confirms parity with the export
- Switching EN↔PL on every page shows no untranslated (English-fallback) strings
- No visual regressions in interactive flows (rename, delete, generate, confirm, export, auth)

---

## Testing Strategy

### Unit Tests:

- Existing unit suite must stay green throughout (presentation-only changes should not affect it).
- If any helper is added (e.g. a sigil-from-id selector), add a small unit test for its determinism.

### Integration / E2E Tests:

- Existing Playwright e2e suite must pass after Phase 6 — flows (auth, campaign CRUD, battle generate/
  confirm, export) are unchanged behaviorally, so failures indicate a markup/locator regression to fix
  (route through PR review per the e2e healer guidance, don't auto-heal logic).

### Manual Testing Steps:

1. Load each route logged-out and logged-in; confirm ink background + grain + brand fonts.
2. Toggle EN↔PL on every page; confirm no English fallback on new copy.
3. Exercise each interactive flow (rename/delete campaign, create battle, generate/confirm/deny enemy,
   export PDF, full auth cycle) and confirm both behavior and new styling.
4. Compare each page side-by-side with the export for presence parity.

## Performance Considerations

- Self-hosted fonts avoid a render-blocking third-party request and are cache-friendly on Cloudflare;
  import only the needed weights to keep the bundle small.
- The paper-grain `body::before` is a static CSS gradient (no images, no JS) — negligible cost.
- Removing the starfield/orb DOM and blur layers from the landing slightly reduces paint cost.

## Migration Notes

- No data migration. Sigils/taglines from the export are presentation-only and derived locally, not
  persisted — so no schema change and no backfill.
- The change is visual; rollback is reverting the branch. No feature flag needed.

## References

- Design source: `C:\Repos\lovable-dnd-5enemy` — `src/styles.css`, `src/components/chrome.tsx`,
  `src/routes/{index,campaigns.index,campaigns.new,campaigns.$id,battle.$id}.tsx`, `src/routes/__root.tsx`
- Change identity: `context/changes/ui-redesign/change.md` (roadmap slice S-18; supersedes S-08)
- Lessons: `context/foundation/lessons.md` (surface fetch failures; sanitize errors — preserve these
  behaviors while restyling)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation & Shell

#### Automated

- [x] 1.1 Dependencies install: `npm install` — 006d9cf
- [x] 1.2 Type checking passes: `npm run typecheck` — 006d9cf
- [x] 1.3 Linting passes: `npm run lint` — 006d9cf
- [x] 1.4 Production build succeeds: `npm run build` — 006d9cf
- [x] 1.5 Existing unit tests pass: `npm run test` — 006d9cf

#### Manual

- [x] 1.6 App background is ink-black with a subtle paper grain on every route — 006d9cf
- [x] 1.7 Headings render in MedievalSharp; body in Cabin; no FOUT/missing-font fallback — 006d9cf
- [x] 1.8 Top bar matches the export; LocaleSwitcher still toggles EN/PL — 006d9cf
- [x] 1.9 Existing `<Button>` instances render in the new oxblood/ink styling — 006d9cf
- [x] 1.10 No `bg-cosmic` or navy gradient visible anywhere — 006d9cf

### Phase 2: Landing

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 0b92f48
- [x] 2.2 Linting passes: `npm run lint` — 0b92f48
- [x] 2.3 Build succeeds: `npm run build` — 0b92f48
- [x] 2.4 New copy appears only in `messages/`, not in `Welcome.astro` — 0b92f48

#### Manual

- [x] 2.5 Guest landing matches the export (chip, blood-bright "5", tagline, Ornament, monster-card trio) — 0b92f48
- [x] 2.6 Authed landing shows ink-card recent campaigns with chips — 0b92f48
- [x] 2.7 Switching to PL translates all landing copy including new keys — 0b92f48
- [x] 2.8 No orbs/starfield/old tokens remain on the landing — 0b92f48

### Phase 3: Campaigns

#### Automated

- [x] 3.1 Type checking passes: `npm run typecheck` — 64b1d31
- [x] 3.2 Linting passes: `npm run lint` — 64b1d31
- [x] 3.3 Build succeeds: `npm run build` — 64b1d31
- [x] 3.4 Unit tests pass: `npm run test` — 64b1d31

#### Manual

- [x] 3.5 Campaigns list shows sigil-iconed ink-card rows; rename/delete still work — 64b1d31
- [x] 3.6 New-campaign form matches the export and creates a campaign — 64b1d31
- [x] 3.7 Campaign detail header + battle ink-cards render; empty state shows flavor copy — 64b1d31
- [x] 3.8 PL locale translates all new campaign copy — 64b1d31
- [x] 3.9 No old tokens remain on any campaign surface — 64b1d31

### Phase 4: Battles

#### Automated

- [x] 4.1 Type checking passes: `npm run typecheck` — 4ff606d
- [x] 4.2 Linting passes: `npm run lint` — 4ff606d
- [x] 4.3 Build succeeds: `npm run build` — 4ff606d
- [x] 4.4 Unit tests pass: `npm run test` — 4ff606d

#### Manual

- [x] 4.5 Battle header shows chips (stacked sections instead of tabs — see Phase 4 note) — 4ff606d
- [x] 4.6 Environment renders the ink-card grid; regenerate still works — 4ff606d
- [x] 4.7 Generate flow works; pending enemies show stat-cell ability grids — 4ff606d
- [x] 4.8 Confirmed enemies render as monster-cards with the villain block; Export PDF works — 4ff606d
- [x] 4.9 Fetch failures still surface to the user (no silent swallow) — 4ff606d
- [x] 4.10 PL locale translates all new battle UI copy (generated-content language tracked separately) — 4ff606d

### Phase 5: Auth & Error Pages

#### Automated

- [x] 5.1 Type checking passes: `npm run typecheck` — 3a26c20
- [x] 5.2 Linting passes: `npm run lint` — 3a26c20
- [x] 5.3 Build succeeds: `npm run build` — 3a26c20
- [x] 5.4 Unit tests pass: `npm run test` — 3a26c20

#### Manual

- [x] 5.5 All five auth pages render in the new theme; auth flows still work — 3a26c20
- [x] 5.6 Server errors and field validation display correctly in the new styling — 3a26c20
- [x] 5.7 404 / error page matches the theme — 3a26c20
- [x] 5.8 PL locale translates auth + error copy — 3a26c20

### Phase 6: Token-Audit Sweep, PL i18n & Verification

#### Automated

- [x] 6.1 Old-token grep returns zero matches over `src/` — dd0f603
- [x] 6.2 Type checking passes: `npm run typecheck` — dd0f603
- [x] 6.3 Linting passes: `npm run lint` — dd0f603
- [x] 6.4 Build succeeds: `npm run build` — dd0f603
- [x] 6.5 Unit tests pass: `npm run test` — dd0f603
- [x] 6.6 E2E tests pass: `npm run test:e2e` — e2b8e54

#### Manual

- [x] 6.7 Per-page review confirms parity with the export — e4e0bff
- [x] 6.8 EN↔PL on every page shows no English-fallback strings — e4e0bff
- [x] 6.9 No visual regressions in interactive flows — e4e0bff
