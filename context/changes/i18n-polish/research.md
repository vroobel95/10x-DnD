---
date: 2026-06-20T00:00:00Z
researcher: vroobel95
git_commit: 211b85936784ec80c60d94ae809b442f4281a160
branch: main
repository: 10x-DnD
topic: "i18n library options for Polish localization (S-16) on Astro 6 + React islands + Cloudflare Workers"
tags: [research, i18n, localization, polish, astro, cloudflare, paraglide, intlayer, i18next]
status: complete
last_updated: 2026-06-20
last_updated_by: vroobel95
---

# Research: i18n libraries for Polish localization (S-16)

**Date**: 2026-06-20
**Researcher**: vroobel95
**Git Commit**: 211b85936784ec80c60d94ae809b442f4281a160
**Branch**: main
**Repository**: 10x-DnD

## Research Question

For the `i18n-polish` change (roadmap **S-16 — Polish i18n**), evaluate via Exa.ai web
research and recommend **three i18n libraries** that can be used to add Polish (`pl`)
language support to this project, accounting for its actual stack.

## Summary

The app has **no i18n today** — greenfield. There are no locale files, no `i18n` block
in [astro.config.mjs](astro.config.mjs), and zero translation usage anywhere in
[src/](src/) (grep for `i18n` / `useTranslation` / `t(` / `astro:i18n` / `locale`
returned nothing). So S-16 is a from-scratch setup, not a migration.

The binding constraint is the stack (from [AGENTS.md](AGENTS.md)): **Astro 6 SSR + React 19
islands, Tailwind 4, deployed on Cloudflare Workers** (`@astrojs/cloudflare`). Whatever we
pick must (a) work in both `.astro` files and React islands, (b) run on the `workerd`
edge runtime, and (c) ideally be type-safe and actively maintained in 2026.

Web research (Exa, sources dated 2025–2026) converges on a clear picture: the once-popular
i18next-based wrappers are **dead** (`astro-i18next` archived since 2023; `astro-i18n`
by Fernandez inactive since 2024), and the two "default answers in 2026" are **Paraglide
JS v2** and **Intlayer**. Astro's **built-in i18n routing** is the zero-dependency baseline
but only does routing/locale detection — it does *not* translate strings.

**Three recommended libraries** (full comparison below):

1. **Paraglide JS v2 (inlang)** — compiler-based, type-safe, tree-shakable. The leanest
   client bundle; explicitly documents Cloudflare Workers support. **Primary recommendation.**
2. **Intlayer** — TypeScript-first, per-component colocated dictionaries, batteries-included
   Astro integration (middleware, cookies, routing, SEO helpers). Most active release pulse.
3. **Astro built-in i18n routing + a typed `ui.ts` dictionary** — zero dependencies, native,
   ideal if the translatable string set stays small. The conservative baseline.

A scope note that matters for this project: i18n here has **two distinct surfaces** —
(1) **static UI chrome** (nav, buttons, auth pages, labels) which is what these libraries
solve, and (2) **AI-generated DnD content** (battle descriptions, enemies via
[@ai-sdk/anthropic](package.json)) which is *not* a library concern — it's a matter of
prompting the model in Polish. No i18n library translates LLM output; the locale just needs
to flow into the generation prompt.

## Detailed Findings

### Current state of the codebase (greenfield)

- **No i18n config**: grep for `i18n|locale|trailingSlash` in [astro.config.mjs](astro.config.mjs)
  returned no matches — there is no `i18n: {}` block.
- **No translation usage**: grep across [src/](src/) for `i18n`, `useTranslation`,
  `getRelativeLocaleUrl`, `astro:i18n`, `locale`, `t(` returned **no files**. All UI strings
  are currently hardcoded (presumably English).
- **Stack** ([AGENTS.md](AGENTS.md), [package.json](package.json)):
  - Astro `^6.3.1` SSR, `output: server` via `@astrojs/cloudflare ^13.5.0`.
  - React `^19.2.6` islands via `@astrojs/react ^5.0.4`.
  - Middleware already exists at [src/middleware.ts](src/middleware.ts) (auth) — any i18n
    middleware must compose with it.
  - AI content generation via `@ai-sdk/anthropic` + `ai` (Vercel AI SDK).
- **Astro 6 + Cloudflare nuance**: in Astro 6, `astro dev`/`preview` run on the real
  `workerd` runtime (Cloudflare Vite plugin), so dev now matches prod. `nodejs_compat`
  must be enabled in `wrangler` config for any library relying on `node:async_hooks`
  (`AsyncLocalStorage`) — relevant to Paraglide (see below).
  Source: [@astrojs/cloudflare docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/),
  [Cloudflare Workers Astro guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/).

### Option A — Paraglide JS v2 (inlang) · PRIMARY RECOMMENDATION

- **Model**: compiler-based. Translation JSON files compile at build time into individual,
  tree-shakable TypeScript message functions (`import { m } from "./paraglide/messages.js"`;
  `m.greeting({ name: "World" })`). Up to ~70% smaller client i18n bundles than runtime libs.
- **Type safety**: full — message keys and params are typed with IDE autocomplete.
- **Astro fit**: works in `.astro` and React islands (CSR + SSR). v2 is a single package
  (`@inlang/paraglide-js`) — no separate Astro adapter needed; add `paraglideVitePlugin`
  to `astro.config.mjs` and `paraglideMiddleware` to `src/middleware.ts`.
- **Cloudflare Workers**: explicitly documented. Keep `AsyncLocalStorage` **enabled** (the
  current recommended setup) on Cloudflare Workers *with `nodejs_compat` enabled*; a
  `disableAsyncLocalStorage` fallback exists only for runtimes lacking per-request isolation.
  Source: [paraglidejs.com/astro](https://paraglidejs.com/astro).
- **Known footnote (from the 2026 EdgeKits deep-dive)**: tree-shaking shrinks the *client*
  bundle, not the *server* bundle. On the Worker, all compiled message code is loaded for
  SSR; with many locales × many namespaces the server bundle grows. For a 2-locale
  (en + pl) app this is a non-issue.
  Source: [edgekits.dev Astro i18n 2026 guide](https://edgekits.dev/en/blog/astro-i18n-complete-guide-2026/).
- **Maintenance**: very active, frequent releases (2026).
- **Verdict from sources**: "one of two default answers in 2026… the closest thing to a
  'use this and don't think about i18n again' choice when your priority is the leanest
  possible client bundle."

### Option B — Intlayer

- **Model**: TypeScript-first content layer with **per-component colocation** — instead of a
  central `pl.json`, each concept lives in a `*.content.ts` file next to its component, all
  locales together via a `t({ en, pl })` helper. A build step writes generated types into
  `.intlayer/` (gitignored) for type-checked, autocompleted keys.
- **Astro fit**: two packages — `intlayer` (core) + `astro-intlayer` (integration). The
  integration is a normal Astro integration (`integrations: [intlayer(), react()]`) that
  ships a Vite plugin **plus middleware for locale detection, cookie persistence, and URL
  routing** — more batteries-included than Paraglide. React islands use
  `IntlayerProvider` + `useIntlayer`/`useLocale` hooks, with the server-detected locale
  passed as a prop into the island.
- **Content types**: richest of the three — native plurals, gender, conditions,
  enumerations, markdown/MDX, nested fragments. Also ships `generateSitemap` (hreflang
  `xhtml:link`) and `robots.txt` locale helpers.
- **Type safety**: full, via module augmentation + autogenerated types.
- **Cloudflare Workers**: docs target Astro + Vite generally; no explicit "Cloudflare
  Workers caveat" section was found in research (unlike Paraglide's explicit note). Treat
  edge compatibility as **verify-before-commit** (its middleware/cookie layer must run on
  `workerd`). Source: [intlayer.org/doc/environment/astro](https://intlayer.org/doc/environment/astro),
  [intlayer.org/doc/environment/astro/react](https://intlayer.org/doc/environment/astro/react).
- **Maintenance**: the most active on this list — `astro-intlayer` shipping multiple
  versions per week as of mid-2026. (Caveat: very fast churn can mean API instability.)
- **Verdict from sources**: "the second real answer in 2026, alongside Paraglide… pick
  Intlayer if you want colocated content next to components and richer content types out of
  the box, plus a batteries-included Astro integration."

### Option C — Astro built-in i18n routing + typed `ui.ts` dictionary

- **Model**: Astro's native `i18n` config (`defaultLocale`, `locales`, `routing`) handles
  **URL structure and locale detection only** — `Astro.currentLocale`, `Astro.preferredLocale`,
  and `astro:i18n` helpers like `getRelativeLocaleUrl()`. It deliberately **does not
  translate any strings**. You pair it with the official `ui.ts` recipe: a typed dictionary
  object + small `useTranslations(lang)` helper you write yourself
  (~30 lines, see [Astro i18n recipe](https://docs.astro.build/en/recipes/i18n/)).
- **Astro fit**: native, zero dependencies, no version-compat risk ever. Works perfectly in
  `.astro`. **Limitation**: React islands don't get the dictionary automatically — you must
  prop-drill the needed strings into each island (more boilerplate as island count grows).
- **Cloudflare Workers**: native Astro feature — fully compatible, nothing extra to verify.
- **Type safety**: as strong as you make your `ui.ts` object (keys are typed; no plural/param
  validation unless you build it).
- **Maintenance**: it's core Astro — maintained as long as Astro is.
- **Verdict from sources**: "For small sites (under 20 pages, 2-3 locales), the built-in
  Astro i18n routing plus a typed JSON utility function is enough. Don't add a library until
  you feel the specific pain that library solves."

### Why NOT the i18next family (rejected, but documented to close the question)

- **`astro-i18next` (yassinedoghri)**: archived in practice — last release `1.0.0-beta.21`
  in **March 2023**, open issues against newer Astro versions unanswered. Do not use.
- **`astro-i18n` (Fernandez)**: inactive since **2024**. Do not use.
- **Raw `i18next` / `react-i18next`**: battle-tested and works inside React islands, but
  (1) it's runtime-resolution (larger bundle, looser/string-keyed typing), (2) sources note
  i18next has had Astro 5+ SSR friction, and (3) it gives nothing in `.astro` files without a
  wrapper — and the wrappers are dead. Not recommended for a fresh 2026 Astro 6 setup.

## Code References

- [astro.config.mjs](astro.config.mjs) — no `i18n` block today; this is where `i18n: { defaultLocale, locales, routing }` and any Vite plugin (Paraglide) would be added.
- [src/middleware.ts](src/middleware.ts) — existing auth middleware; i18n middleware (Paraglide/Intlayer) must compose here.
- [AGENTS.md:11](AGENTS.md#L11) — "Astro 6 SSR app with React islands, Tailwind 4, Supabase, deployed on Cloudflare Workers."
- [AGENTS.md:12](AGENTS.md#L12) — API routes export `const prerender = false` (SSR); relevant to locale-aware routing.
- [package.json:22](package.json#L22) — `@ai-sdk/anthropic` powers AI content generation (the second, library-independent i18n surface).
- [package.json:24-25](package.json#L24-L25) — `@astrojs/cloudflare`, `@astrojs/react` confirm the runtime + islands constraints.

## Architecture Insights

- **Two i18n surfaces, one of which no library covers.** Static UI chrome → i18n library.
  AI-generated DnD content → pass locale into the Anthropic prompt; no library translates
  model output. The plan should treat these as separate workstreams.
- **Routing vs. translation are separable.** All three options can lean on Astro's native
  routing primitives; they differ mainly in how UI *strings* are stored, typed, and bundled.
- **Edge runtime is the real filter.** On Cloudflare `workerd`, prefer libraries with an
  explicit edge story. Paraglide documents it directly (AsyncLocalStorage + `nodejs_compat`).
  Native routing is inherently safe. Intlayer's edge behavior should be verified on `workerd`
  before committing.
- **Locale strategy decision is upstream of library choice.** Whether Polish is the default
  (`pl` primary, English secondary) or English stays default with `pl` added, and whether
  URLs are prefixed (`/pl/…`) or cookie/Accept-Language based, shapes routing config for all
  three. This is a planning decision (see Open Questions).
- **Composes with existing auth middleware.** Both library-middleware options must chain with
  [src/middleware.ts](src/middleware.ts) rather than replace it.

## Historical Context (from prior changes)

- Roadmap entry **S-16 (Polish i18n)** was added in commit `49eba1a`
  ("docs(roadmap): add S-15 … and S-16 (Polish i18n)") — this change implements it.
- No prior i18n research or plans exist under `context/changes/**` or `context/archive/**`
  (this is the first i18n exploration in the project).

## Related Research

- None yet — this is the first i18n research artifact for the project.

## Open Questions

These are **planning decisions** (resolve in `/10x-plan`), not unknowns about the libraries:

1. **Locale strategy**: Is Polish the new *default* (with English kept), or is English the
   default with Polish *added*? This drives `defaultLocale` and whether existing English
   strings are extracted or replaced.
2. **Routing strategy**: URL-prefixed locales (`/pl/...`, `/en/...`) for SEO, or a single
   URL space with cookie/`Accept-Language` detection? Affects all page routes and the
   existing auth flow.
3. **Scope of v1**: UI chrome only, or also localize the AI generation prompt so DnD content
   comes back in Polish? (The latter is a prompt change, not a library task.)
4. **Intlayer edge verification**: if Intlayer is chosen, confirm its middleware/cookie layer
   runs cleanly on Cloudflare `workerd` before committing — this wasn't confirmable from docs.

## Sources (Exa web research, 2025–2026)

- EdgeKits — "Astro i18n in 2026: The Complete Guide" (2026-04, updated 2026-05): https://edgekits.dev/en/blog/astro-i18n-complete-guide-2026/
- Paraglide JS — official Astro guide: https://paraglidejs.com/astro
- Intlayer — Astro and Astro+React guides: https://intlayer.org/doc/environment/astro , https://intlayer.org/doc/environment/astro/react
- Astro docs — i18n routing & recipe: https://docs.astro.build/en/recipes/i18n/ , https://v7.docs.astro.build/en/guides/internationalization/
- better-i18n — "Astro + i18n: Building Multi-Language Sites" (2026-03): https://better-i18n.com/en/blog/astro-i18n-multi-language-sites/
- Cloudflare — Astro on Workers guide (2026-04): https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Astro — @astrojs/cloudflare adapter docs: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
