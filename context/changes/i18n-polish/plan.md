# i18n-polish (S-16) — English/Polish Internationalization Implementation Plan

## Overview

Add two-language support (English ⇄ Polish) to the app using **Paraglide JS v2**. A language
toggle in the navbar switches the locale; the choice is persisted in a cookie and survives
reloads. All user-facing UI strings (labels, placeholders, error/toast messages) follow the
active locale, and AI-generated content (enemy stat blocks, environment, main-enemy profile)
is produced directly in the active language — with core D&D 5e terms (AC, HP, STR, ability and
condition names) kept in English.

This implements roadmap slice **S-16** (see [roadmap.md](../../foundation/roadmap.md), S-16).

## Current State Analysis

The app has **zero i18n today** (greenfield):

- No `i18n` block in [astro.config.mjs](../../../astro.config.mjs); no locale files; no
  translation usage anywhere in `src/` (confirmed by grep in [research.md](research.md)).
- All UI strings are hardcoded, **mostly English** — but a few are **already Polish**
  ([Layout.astro:27-34](../../../src/layouts/Layout.astro#L27) Banner "Uwaga:"/"Dokumentacja",
  and [src/lib/config-status.ts](../../../src/lib/config-status.ts)). The app is currently
  language-inconsistent.
- `<html lang="en">` is hardcoded in [Layout.astro:15](../../../src/layouts/Layout.astro#L15).
- The navbar (S-08 prerequisite) is [Topbar.astro](../../../src/components/Topbar.astro) — but
  it only renders its content when `user` is set, so the toggle needs deliberate placement to
  appear on auth pages too.
- Existing middleware [src/middleware.ts](../../../src/middleware.ts) runs the Supabase auth
  flow; the Paraglide middleware must **compose** with it, not replace it.
- AI generation lives in [src/lib/ai.ts](../../../src/lib/ai.ts) with two English system
  prompts (`ENEMY_SYSTEM_PROMPT`, `ENVIRONMENT_SYSTEM_PROMPT`); callers are
  [generate.ts](../../../src/pages/api/battles/[id]/generate.ts) and
  [environment.ts](../../../src/pages/api/battles/[id]/environment.ts).
- **`nodejs_compat` is already enabled** in [wrangler.jsonc:6](../../../wrangler.jsonc#L6) — so
  Paraglide's `AsyncLocalStorage` requirement on Cloudflare Workers is already satisfied.
- Astro 6 dev/preview run on the real `workerd` runtime, so the locale flow can be tested
  locally exactly as it runs in production.

Stack: Astro 6 SSR + React 19 islands, Tailwind 4, `@astrojs/cloudflare`, Vitest + Playwright
already configured ([package.json](../../../package.json)).

## Desired End State

A logged-in (or visiting) GM sees a language toggle in the navbar. Clicking it switches the
entire UI between English and Polish; the choice is written to a cookie and the same language
is shown after a reload and across pages. All visible strings — including form placeholders,
validation messages, and error toasts — are translated. When the GM generates enemies or an
environment while Polish is active, the returned prose is in Polish while AC/HP/STR and other
core D&D 5e terms remain in English. `<html lang>` reflects the active locale.

**Verification**: an E2E test switches to Polish, asserts Polish UI strings appear, reloads,
and asserts the locale persisted via cookie; `npm run typecheck`, `npm run lint`, and
`npm run build` pass; a manual Polish generation shows Polish prose with English game terms.

### Key Discoveries:

- Paraglide v2 is a **single package** (`@inlang/paraglide-js`); add `paraglideVitePlugin`
  to [astro.config.mjs](../../../astro.config.mjs) `vite.plugins` and `paraglideMiddleware` to
  [src/middleware.ts](../../../src/middleware.ts). See [paraglide-js-v2-reference.md](paraglide-js-v2-reference.md).
- Cookie-only strategy (`strategy: ["cookie", "baseLocale"]`) means **no route restructuring**
  and the simplest composition with existing auth middleware.
- `getLocale()` works server-side after the middleware sets it via `AsyncLocalStorage`, so API
  routes can read the active locale without a URL param.
- Polish pluralization needs `one`/`few`/`many`/`other` categories (English needs only
  `one`/`other`) — relevant when any message uses `{count, plural, …}`.
- Lessons priors: sanitized API error strings ([lessons.md](../../foundation/lessons.md)) must
  now flow through message keys too; every fetch handler already surfaces errors, so those
  user-facing error strings are in scope for translation.

## What We're NOT Doing

- **No URL-prefixed locales** (`/pl/…`) — cookie-only, no route changes, no SEO/hreflang work.
- **No Accept-Language auto-detection** in v1 — English is the default until the user toggles
  (can be added later by prepending `preferredLanguage` to the strategy chain).
- **No translation of stored historical content** — enemies/environments already generated in
  one language are not retroactively re-translated; only new generations follow the locale.
- **No third language** and no translation-management platform/CMS.
- **No README/docs translation** (that is S-14's concern; out of scope here).
- **No change to the D&D term set kept in English** beyond the agreed rule (core stat
  terms/abbreviations stay English; surrounding prose is translated).

## Implementation Approach

Three sequential phases, each independently verifiable:

1. **Infrastructure + toggle** — stand up Paraglide, wire the cookie strategy and middleware,
   make `<html lang>` dynamic, add the navbar `LocaleSwitcher`, and convert a small set of
   "proof" strings (e.g., Topbar "Sign out", Home) so the switch is observable end-to-end.
2. **String extraction** — sweep every page and component, moving hardcoded strings into
   `messages/en.json` + `messages/pl.json` and replacing them with `m.*()` calls; fold the
   already-Polish Banner/config-status strings into the message catalog so the app stops being
   language-inconsistent.
3. **AI content localization** — thread `locale` from the generate/environment endpoints into
   `ai.ts`; append a language directive to both system prompts that requests the active
   language for prose while keeping core D&D 5e terms in English.

## Critical Implementation Details

- **Middleware ordering**: the Paraglide middleware must run so that `getLocale()` is available
  to everything downstream (auth flow, pages, API routes). Compose via Astro's `sequence()`
  with the i18n middleware **first**, then the existing auth middleware. The auth middleware
  must continue to receive the request and set `context.locals.user` exactly as today.
- **Toggle visibility**: [Topbar.astro](../../../src/components/Topbar.astro) currently gates
  all content behind `user &&`. The `LocaleSwitcher` must render regardless of auth state
  (so signin/signup pages can switch language), which means restructuring Topbar so the
  switcher sits outside the `user &&` block (or placing it in [Layout.astro](../../../src/layouts/Layout.astro)).
- **Locale switch mechanism**: `setLocale()` from the Paraglide runtime sets the cookie and
  triggers a navigation/reload so SSR re-renders in the new locale. The switcher is a React
  island (interactivity required); it calls `setLocale()` on change.

## Phase 1: i18n Infrastructure + Language Toggle

### Overview

Install and configure Paraglide v2 with `en` (base) + `pl`, wire cookie-based locale detection
through composed middleware, make the document language dynamic, and add a working navbar
toggle proven with a few converted strings.

### Changes Required:

#### 1. Paraglide project + message catalog scaffold

**File**: `project.inlang/settings.json`, `messages/en.json`, `messages/pl.json`

**Intent**: Initialize the inlang project so the compiler knows the locales and message file
locations. Seed with the handful of "proof" strings converted in this phase.

**Contract**: `baseLocale: "en"`, `locales: ["en", "pl"]`, message-format plugin with
`pathPattern: "./messages/{locale}.json"`. `messages/en.json` and `messages/pl.json` contain
matching keys for the proof strings. Generated output compiles to `./src/paraglide` (gitignored
or committed per repo convention — match how generated artifacts are handled elsewhere).

#### 2. Vite plugin wiring

**File**: [astro.config.mjs](../../../astro.config.mjs)

**Intent**: Register `paraglideVitePlugin` so messages compile during dev/build, without
disturbing the existing `cloudflare()` adapter, `react()`/`sitemap()` integrations, Tailwind
plugin, or `env` schema.

**Contract**: Add `paraglideVitePlugin({ project: "./project.inlang", outdir: "./src/paraglide" })`
to `vite.plugins` alongside `tailwindcss()`. No change to `output: "server"` or the adapter.

#### 3. Middleware composition

**File**: [src/middleware.ts](../../../src/middleware.ts)

**Intent**: Run Paraglide's locale resolution before the existing auth logic so `getLocale()`
is populated for the whole request, while preserving current auth/redirect behavior verbatim.

**Contract**: Export `onRequest = sequence(i18nMiddleware, authMiddleware)` where
`i18nMiddleware` wraps `paraglideMiddleware(context.request, …)` and `authMiddleware` is the
current handler (unchanged). `strategy: ["cookie", "baseLocale"]`, `cookieName` set explicitly.
The protected-route redirect and `sb-` cookie cleanup must behave identically to today.

#### 4. Dynamic document language

**File**: [src/layouts/Layout.astro](../../../src/layouts/Layout.astro)

**Intent**: Reflect the active locale in the root element instead of the hardcoded `en`.

**Contract**: `<html lang={getLocale()}>` (or equivalent Astro locale accessor) replaces
`<html lang="en">`.

#### 5. Language switcher (navbar toggle)

**File**: `src/components/LocaleSwitcher.tsx` (new), [src/components/Topbar.astro](../../../src/components/Topbar.astro)

**Intent**: Give the user a control to switch EN⇄PL from the navbar, visible on all pages
including auth pages. Restructure Topbar so the switcher renders outside the `user &&` block.

**Contract**: A React island rendered with a client directive (e.g. `client:load`) that reads
the current locale and on change calls `setLocale("en" | "pl")` from `./paraglide/runtime`.
Its own labels come from message keys. Topbar renders `<LocaleSwitcher />` regardless of auth
state; the existing user email + Sign out + Home remain gated behind `user`.

#### 6. Proof strings

**File**: [src/components/Topbar.astro](../../../src/components/Topbar.astro) (e.g. "Sign out"), plus 1–2 home/dashboard strings

**Intent**: Convert a small representative set of strings to `m.*()` so the toggle's effect is
visible end-to-end before the full sweep in Phase 2.

**Contract**: Selected literals replaced with `m.<key>()`; keys added to both message files.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build (compiles messages + Cloudflare build) passes: `npm run build`
- E2E toggle/persistence test passes: `npm run test:e2e`

#### Manual Verification:

- The navbar toggle is visible on both authenticated pages and the signin/signup pages.
- Switching to Polish changes the proof strings to Polish; switching back restores English.
- After a full page reload, the previously selected locale is still active (cookie persisted).
- `<html lang>` matches the active locale (inspect element).
- No regression in auth: protected routes still redirect to signin when logged out.

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 2: Extract & Translate All UI Strings

### Overview

Sweep all pages and components, moving every user-facing string into the message catalog and
replacing literals with `m.*()` calls — including form placeholders, validation/error/toast
messages, sanitized API error strings, and the already-Polish Banner/config-status strings.

### Changes Required:

#### 1. Astro pages

**File**: [src/pages/index.astro](../../../src/pages/index.astro),
[dashboard.astro](../../../src/pages/dashboard.astro),
[battles/index.astro](../../../src/pages/battles/index.astro),
[battles/[id].astro](../../../src/pages/battles/[id].astro),
[battles/new.astro](../../../src/pages/battles/new.astro),
[campaigns/index.astro](../../../src/pages/campaigns/index.astro),
[campaigns/[id].astro](../../../src/pages/campaigns/[id].astro),
[campaigns/new.astro](../../../src/pages/campaigns/new.astro),
[auth/signin.astro](../../../src/pages/auth/signin.astro),
[auth/signup.astro](../../../src/pages/auth/signup.astro),
[auth/forgot-password.astro](../../../src/pages/auth/forgot-password.astro),
[auth/reset-password.astro](../../../src/pages/auth/reset-password.astro),
[auth/confirm-email.astro](../../../src/pages/auth/confirm-email.astro)

**Intent**: Replace all visible literals (headings, labels, button text, helper copy) with
`m.*()` calls in the frontmatter/markup.

**Contract**: Each literal maps to a message key; keys added to `en.json` + `pl.json` with
parity. Page `title` strings localized where user-visible.

#### 2. Layout + shared components

**File**: [src/layouts/Layout.astro](../../../src/layouts/Layout.astro),
[src/components/Topbar.astro](../../../src/components/Topbar.astro),
[Banner.astro](../../../src/components/Banner.astro),
[Welcome.astro](../../../src/components/Welcome.astro),
[src/lib/config-status.ts](../../../src/lib/config-status.ts)

**Intent**: Fold the existing **already-Polish** Banner/config-status strings into the catalog
so they switch with locale instead of being hardcoded Polish; localize remaining shared chrome.

**Contract**: `config-status.ts` messages and Banner labels ("Uwaga:", "Dokumentacja", default
title "DnD 5enemy" if user-visible) become message keys. Note: `config-status` runs at module
scope — ensure its strings are resolved per-request (via `m.*()` at call site) rather than
captured at import time.

#### 3. React islands — battles

**File**: [BattleCard.astro](../../../src/components/battles/BattleCard.astro),
[BattleHeader.tsx](../../../src/components/battles/BattleHeader.tsx),
[EnemiesSection.tsx](../../../src/components/battles/EnemiesSection.tsx),
[EnemyCard.tsx](../../../src/components/battles/EnemyCard.tsx),
[EnvironmentSection.tsx](../../../src/components/battles/EnvironmentSection.tsx),
[CreateBattleForm.tsx](../../../src/components/battles/CreateBattleForm.tsx)

**Intent**: Replace literals — including stat-block labels, button text, loading/empty states,
placeholders, and fetch-error messages — with `m.*()`.

**Contract**: D&D stat labels follow the agreed rule (core terms/abbreviations like AC, HP,
STR, DEX, CON, INT, WIS, CHA, CR stay English; surrounding labels/prose translated). Error
strings surfaced by fetch handlers (per the lessons rule) become message keys.

#### 4. React islands — campaigns & auth

**File**: [CampaignList.tsx](../../../src/components/campaigns/CampaignList.tsx),
[CampaignBattleList.tsx](../../../src/components/campaigns/CampaignBattleList.tsx),
[CreateCampaignForm.tsx](../../../src/components/campaigns/CreateCampaignForm.tsx),
[SignInForm.tsx](../../../src/components/auth/SignInForm.tsx),
[SignUpForm.tsx](../../../src/components/auth/SignUpForm.tsx),
[ForgotPasswordForm.tsx](../../../src/components/auth/ForgotPasswordForm.tsx),
[ResetPasswordForm.tsx](../../../src/components/auth/ResetPasswordForm.tsx),
[FormField.tsx](../../../src/components/auth/FormField.tsx),
[SubmitButton.tsx](../../../src/components/auth/SubmitButton.tsx),
[ServerError.tsx](../../../src/components/auth/ServerError.tsx),
[PasswordToggle.tsx](../../../src/components/auth/PasswordToggle.tsx)

**Intent**: Replace all labels, placeholders, button text, aria-labels, and client-side
validation messages with `m.*()`.

**Contract**: Message keys with parity in both files; placeholders and `aria-label`s localized.

#### 5. API route error strings

**File**: [src/pages/api/](../../../src/pages/api/) routes that return user-facing error
messages (e.g. [battles.ts](../../../src/pages/api/battles.ts),
[enemies/[id].ts](../../../src/pages/api/enemies/[id].ts),
[battles/[id]/index.ts](../../../src/pages/api/battles/[id]/index.ts),
[battles/[id]/generate.ts](../../../src/pages/api/battles/[id]/generate.ts),
[auth/*](../../../src/pages/api/auth/))

**Intent**: Localize the sanitized, user-facing error strings these routes return, using
`getLocale()` (available server-side post-middleware). Keep the lessons rule intact: never
forward raw third-party error text; only localized, sanitized messages.

**Contract**: User-facing `error` strings in JSON responses / redirect params become `m.*()`
resolved via the request locale. HTTP status codes and non-user-facing logs unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes (Paraglide compiles with no missing keys): `npm run build`
- Unit/E2E suites pass: `npm run test` and `npm run test:e2e`

#### Manual Verification:

- Spot-check each major area (auth, dashboard, campaigns, battles) in Polish — no leftover
  English chrome (and no leftover hardcoded Polish that ignores the toggle).
- Form placeholders and validation/error messages appear in the active language.
- Triggering an API error (e.g. invalid input) shows a localized message.
- `en.json` and `pl.json` have matching key sets (no missing translations).

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 3: Localize AI-Generated Content

### Overview

Make AI generation produce content in the active locale by threading the locale from the API
endpoints into `ai.ts` and instructing the model to write prose in that language while keeping
core D&D 5e terms in English.

### Changes Required:

#### 1. AI module — locale-aware prompts

**File**: [src/lib/ai.ts](../../../src/lib/ai.ts)

**Intent**: Accept the active locale and steer output language for both generators, preserving
the existing schemas and JSON-only output contract.

**Contract**: `generateEnemies(battle, prompt, locale)` and `generateEnvironment(battle, locale)`
gain a `locale: "en" | "pl"` parameter. Each system prompt gets an appended language directive:
when `locale === "pl"`, instruct the model to write all prose/flavor (names, descriptions,
tactics, dialogue, environment fields) in Polish **but keep core D&D 5e game terms and stat
abbreviations in English** (ability scores, AC, HP, CR, condition names, dice notation). When
`locale === "en"`, behavior is unchanged. The `ANTHROPIC_API_KEY` guard and schemas stay as-is.

#### 2. Thread locale from endpoints

**File**: [src/pages/api/battles/[id]/generate.ts](../../../src/pages/api/battles/[id]/generate.ts),
[src/pages/api/battles/[id]/environment.ts](../../../src/pages/api/battles/[id]/environment.ts)

**Intent**: Resolve the request locale and pass it to the AI calls.

**Contract**: Read the active locale via `getLocale()` (server-side, post-middleware) and pass
it to `generateEnemies(…, locale)` / `generateEnvironment(…, locale)`. No change to request
validation, persistence, or response shape.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Existing tests pass: `npm run test` and `npm run test:e2e`

#### Manual Verification:

- With Polish active, generating enemies returns Polish names/descriptions/tactics/dialogue,
  while AC/HP/STR/CR and condition names remain English.
- With Polish active, generating an environment returns Polish terrain/lighting/hazards/
  ambiance/trivia prose.
- With English active, generation output is unchanged from current behavior.
- D&D terminology in Polish output reads consistently (core terms in English as specified).

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- (Optional, low priority) A parity check that `en.json` and `pl.json` expose the same key set
  — though Paraglide's compiler already flags missing keys at build time, so this is a safety
  net, not a requirement.

### Integration / E2E Tests (Playwright, `npm run test:e2e`):

- **Locale toggle + persistence** (Phase 1): load a page, switch to Polish via the navbar,
  assert a known Polish string is visible, reload, assert the Polish string is still visible
  (cookie persisted). Use role/label/text locators per the project's E2E rules; wait on state
  (`toBeVisible()` / `waitForURL()`), never `waitForTimeout()`. Unique-id/cleanup conventions
  per the `/10x-e2e` rules.
- **(Phase 3, manual-leaning)** Polish generation is verified manually rather than asserting on
  non-deterministic AI output; an E2E check may assert the request carries the active locale.

### Manual Testing Steps:

1. Toggle EN⇄PL in the navbar on an auth page and on an authed page; confirm both switch.
2. Reload and navigate between pages; confirm locale persists via cookie.
3. Walk auth, dashboard, campaigns, battles in Polish; confirm no leftover English or
   hardcoded-Polish chrome.
4. Trigger a form validation error and an API error in Polish; confirm localized messages.
5. Generate enemies and an environment in Polish; confirm Polish prose with English game terms.

## Performance Considerations

Paraglide compiles tree-shakable message functions, so the client island bundle stays lean.
The server bundle grows slightly with two locales' compiled messages — negligible for EN+PL on
Cloudflare Workers. No added per-request latency beyond the lightweight locale resolution
already covered by `nodejs_compat`/`AsyncLocalStorage` (already enabled).

## Migration Notes

No data migration. Locale lives in a cookie; first-time visitors default to English until they
toggle. Previously generated enemies/environments are not re-translated — only new generations
follow the active locale. The few already-Polish UI strings (Banner/config-status) move into
the catalog and become locale-driven.

## References

- Research: [research.md](research.md)
- Paraglide v2 reference (project-adapted): [paraglide-js-v2-reference.md](paraglide-js-v2-reference.md)
- Roadmap slice: [roadmap.md](../../foundation/roadmap.md) (S-16)
- Lessons priors: [lessons.md](../../foundation/lessons.md) (sanitize errors; surface fetch failures)
- Existing middleware to compose with: [src/middleware.ts](../../../src/middleware.ts)
- AI prompts to localize: [src/lib/ai.ts](../../../src/lib/ai.ts)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: i18n Infrastructure + Language Toggle

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — 98112ea
- [x] 1.2 Linting passes: `npm run lint` — 98112ea
- [x] 1.3 Build passes (compiles messages + Cloudflare build): `npm run build` — 98112ea
- [x] 1.4 E2E toggle/persistence test passes: `npm run test:e2e` — 98112ea

#### Manual

- [x] 1.5 Toggle visible on authed pages and signin/signup pages — 98112ea
- [x] 1.6 Switching to Polish changes proof strings; switching back restores English — 98112ea
- [x] 1.7 Locale persists across a full page reload (cookie) — 98112ea
- [x] 1.8 `<html lang>` matches the active locale — 98112ea
- [x] 1.9 No auth regression: protected routes still redirect when logged out — 98112ea

### Phase 2: Extract & Translate All UI Strings

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 3798544
- [x] 2.2 Linting passes: `npm run lint` — 3798544
- [x] 2.3 Build passes (no missing keys): `npm run build` — 3798544
- [x] 2.4 Unit/E2E suites pass: `npm run test` and `npm run test:e2e` — 3798544

#### Manual

- [x] 2.5 Each major area (auth, dashboard, campaigns, battles) fully Polish, no leftover English/hardcoded-Polish chrome — 3798544
- [x] 2.6 Form placeholders and validation/error messages localized — 3798544
- [x] 2.7 An API error shows a localized message — 3798544
- [x] 2.8 `en.json` and `pl.json` key sets match — 3798544

### Phase 3: Localize AI-Generated Content

#### Automated

- [x] 3.1 Type checking passes: `npm run typecheck`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Build passes: `npm run build`
- [x] 3.4 Existing tests pass: `npm run test` and `npm run test:e2e`

#### Manual

- [x] 3.5 Polish enemy generation returns Polish prose with English core game terms
- [x] 3.6 Polish environment generation returns Polish prose
- [x] 3.7 English generation output unchanged from current behavior
- [x] 3.8 Polish D&D terminology reads consistently (core terms in English)
