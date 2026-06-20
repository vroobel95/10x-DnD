# i18n-polish (S-16) — Plan Brief

> Full plan: `context/changes/i18n-polish/plan.md`
> Research: `context/changes/i18n-polish/research.md`
> Library reference: `context/changes/i18n-polish/paraglide-js-v2-reference.md`

## What & Why

Add English ⇄ Polish support to the app (roadmap S-16). A GM toggles language in the navbar;
the choice persists in a cookie. All UI strings follow the locale, and AI-generated content
(enemies, environment, profiles) is produced in the active language — with core D&D 5e terms
(AC/HP/STR, ability and condition names) kept in English.

## Starting Point

Greenfield i18n: no locale files, no `i18n` config, strings hardcoded — mostly English but with
a few already-Polish bits (Banner, config-status), so the app is currently language-inconsistent.
Stack is Astro 6 SSR + React islands on Cloudflare Workers; `nodejs_compat` is already enabled,
and the navbar (Topbar, S-08) already exists.

## Desired End State

A navbar toggle switches the whole UI EN⇄PL, persists across reloads via cookie, and translates
everything visible including form placeholders and error/toast messages. Polish generations
return Polish prose with English game terms; `<html lang>` reflects the active locale.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Library | Paraglide JS v2 | Compiler-based, type-safe, works in .astro + islands, only option with an explicit Cloudflare Workers story | Research |
| URL/locale strategy | Cookie-only, no URL prefix | Matches roadmap's cookie-persist outcome; no route restructuring; simplest middleware composition | Plan |
| Default locale | English (base), Polish added | Existing UI is already English → zero base-retranslation, lowest-risk extraction | Plan |
| AI content | Generate directly in active locale | Best quality, no translation layer, matches roadmap outcome | Plan |
| D&D terminology | Keep core terms (AC/HP/STR…) in English | Familiar to tabletop players; less glossary churn | Plan |
| String coverage | All user-facing strings incl. errors | Coherent translation; aligns with error-handling lessons | Plan |
| Phasing | Infra → UI strings → AI content | Each phase independently verifiable; toggle works early | Plan |
| Testing | E2E toggle/cookie flow + typecheck/lint/build gates | Covers the real flow on workerd; leans on existing Playwright | Plan |

## Scope

**In scope:** Paraglide setup; cookie locale + navbar toggle; dynamic `<html lang>`; translate
all UI strings (pages, forms, placeholders, error/toast, sanitized API errors); fold existing
Polish strings into the catalog; locale-aware AI generation.

**Out of scope:** URL-prefixed locales; Accept-Language auto-detect; re-translating stored
content; a third language / translation CMS; README/docs translation (S-14).

## Architecture / Approach

Paraglide's `paraglideVitePlugin` compiles `messages/{en,pl}.json` into typed `m.*()` functions.
`paraglideMiddleware` (composed before the existing Supabase auth middleware via `sequence()`)
resolves the locale from the cookie and exposes it through `getLocale()` for both `.astro` pages
and server API routes. A `LocaleSwitcher` React island calls `setLocale()` to switch + persist.
API generation endpoints read `getLocale()` and pass it into `ai.ts`, which appends a language
directive to the system prompts.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Infra + toggle | Paraglide wired, cookie middleware, dynamic `lang`, navbar toggle + proof strings | Middleware composition must not break auth; toggle must show on auth pages (Topbar gates on `user`) |
| 2. String extraction | All UI strings → catalog with `m.*()`; existing Polish folded in | Large surface; missing keys; module-scope strings (config-status) must resolve per-request |
| 3. AI localization | Locale-aware prompts + endpoint threading | Polish D&D prose quality; keeping core terms English consistently |

**Prerequisites:** S-08 navbar (done); `nodejs_compat` (already on); Playwright/Vitest (configured).
**Estimated effort:** ~3 sessions, one per phase (Phase 2 is the largest).

## Open Risks & Assumptions

- Topbar renders content only when `user` is set — the toggle must be restructured to show on
  auth pages too.
- `config-status.ts` builds strings at module scope; they must be resolved per-request to follow
  the locale.
- AI output is non-deterministic — Polish terminology consistency is verified manually, not by
  strict E2E assertions.
- Sanitized-error lessons must hold: only localized, sanitized error text reaches users.

## Success Criteria (Summary)

- Navbar toggle switches the entire UI EN⇄PL and persists across reloads (cookie).
- No leftover untranslated chrome or stray hardcoded-Polish strings; errors localized too.
- Polish generations return Polish prose with English core D&D terms; English output unchanged.
