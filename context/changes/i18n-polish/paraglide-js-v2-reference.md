# Paraglide JS v2 — Reference

> Source: Context7 (`/opral/paraglide-js`) — official inlang/opral docs & Astro example.
> Fetched 2026-06-20 for the `i18n-polish` change (S-16). Cross-reference: [research.md](research.md).
>
> **Project note:** Context7's Astro example uses `@astrojs/node`. **This project deploys on
> Cloudflare Workers via `@astrojs/cloudflare`** and already has auth middleware in
> [src/middleware.ts](../../../src/middleware.ts). The Cloudflare-specific adaptations and
> middleware-composition notes below are called out explicitly — follow those, not the raw
> Node example.

---

## 1. What Paraglide JS is

A **compiler-based** i18n library. Translation files (JSON, Inlang Message Format) are
compiled **at build time** into individual, tree-shakable TypeScript **message functions**
(one per key). Result: up to ~70% smaller client i18n bundles vs. runtime libraries, full
type safety with IDE autocomplete, works in both `.astro` files and React islands (CSR + SSR).

In **v2**, everything ships in a single package — `@inlang/paraglide-js`. No separate Astro
adapter package is required.

---

## 2. Install & initialize

```bash
npx @inlang/paraglide-js@latest init
```

This scaffolds:
- `project.inlang/` — the inlang project (settings: locales, baseLocale, plugins).
- `messages/` — per-locale message files (e.g. `messages/en.json`, `messages/pl.json`).
- Compiled output is generated into your configured `outdir` (e.g. `./src/paraglide`).

### `project.inlang/settings.json` (shape)

```json
{
  "baseLocale": "en",
  "locales": ["en", "pl"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

> For S-16: `baseLocale` + `locales` is where the **Polish-default vs. English-default**
> decision lands (Open Question #1 in research.md).

---

## 3. Vite plugin config

Context7's example (Node adapter — **adapt for Cloudflare**):

```diff
import { defineConfig } from "astro/config";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import node from "@astrojs/node";

export default defineConfig({
  vite: {
    plugins: [
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
      }),
    ],
  },
  output: "server",
  adapter: node({ mode: "standalone" }),
});
```

### ➜ Cloudflare adaptation for THIS project

Keep the existing `@astrojs/cloudflare` adapter and `output: "server"`; only add the Vite
plugin:

```diff
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
+import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [
+     paraglideVitePlugin({
+       project: "./project.inlang",
+       outdir: "./src/paraglide",
+     }),
    ],
  },
});
```

### Full plugin options (from the TanStack example — all valid in Astro)

```ts
paraglideVitePlugin({
  project: "./project.inlang",
  outdir: "./src/paraglide",
  outputStructure: "message-modules",            // per-message modules → best tree-shaking
  cookieName: "PARAGLIDE_LOCALE",
  strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
  urlPatterns: [
    { pattern: "/:path(.*)?", localized: [["en", "/:path(.*)?"]] },
  ],
})
```

---

## 4. Server middleware (composing with existing auth middleware)

Context7's minimal example:

```ts
import { paraglideMiddleware } from "./paraglide/server.js";

export const onRequest = defineMiddleware((context, next) => {
  return paraglideMiddleware(context.request, ({ request }) => next(request));
});
```

`paraglideMiddleware` resolves the request locale (per `strategy`) and sets it in
`AsyncLocalStorage` so `getLocale()` works during SSR.

### ➜ This project already has middleware

[src/middleware.ts](../../../src/middleware.ts) runs the Supabase auth flow. Paraglide must
**compose** with it, not replace it. Use Astro's `sequence()` to chain, or wrap the existing
handler so both run per request. The Paraglide wrapper should sit on the outside so the
locale is available to everything downstream:

```ts
import { sequence } from "astro:middleware";
import { paraglideMiddleware } from "./paraglide/server.js";

const i18n = defineMiddleware((context, next) =>
  paraglideMiddleware(context.request, ({ request }) => {
    context.request = request; // hand the (possibly de-localized) request downstream
    return next();
  })
);

// existing auth middleware = `authMiddleware`
export const onRequest = sequence(i18n, authMiddleware);
```

---

## 5. Using messages

```js
import { m } from "./paraglide/messages.js";
import { getLocale, setLocale, getTextDirection } from "./paraglide/runtime.js";

// Messages (typed; params are type-checked)
m.greeting({ name: "World" });   // "Hello World!"

// Locale management
getLocale();          // "en"
getTextDirection();   // "ltr" | "rtl" for the current locale
setLocale("pl");      // switches to Polish (triggers reload/navigation per strategy)
```

- In **`.astro`** files: import `m` in the frontmatter and call message functions inline.
- In **React islands**: import `m` directly — message functions are plain functions, so they
  work in components. The current locale is resolved from the server context during SSR
  (via `AsyncLocalStorage`) and from the URL/cookie on the client.

### `getLocale()` behavior

Resolves the current locale based on configured strategies (URL, cookie, localStorage,
preferredLanguage…). **In SSR it reads the value set by `paraglideMiddleware` via
`AsyncLocalStorage`** — which is why the middleware (section 4) and `nodejs_compat`
(section 8) are both required on the server.

---

## 6. Message file format (Inlang Message Format)

`messages/en.json`:

```json
{
  "greeting": "Hello {name}!",
  "items_count": "{count, plural, one {# item} other {# items}}",
  "welcome_message": "Welcome to {appName}, {username}!"
}
```

`messages/pl.json` (Polish — note Polish has more plural categories: `one`/`few`/`many`/`other`):

```json
{
  "greeting": "Cześć {name}!",
  "items_count": "{count, plural, one {# przedmiot} few {# przedmioty} many {# przedmiotów} other {# przedmiotu}}",
  "welcome_message": "Witaj w {appName}, {username}!"
}
```

Supports: **interpolation** (`{name}`), **pluralization** (`{count, plural, ...}`), nesting.

---

## 7. Locale strategy & URL routing

### Strategy order

`strategy` is evaluated **sequentially — first match wins**. Always include `baseLocale` as
the final fallback.

```ts
strategy: ["url", "cookie", "baseLocale"]                    // SSR-friendly default
strategy: ["cookie", "baseLocale"]                           // cookie-only
strategy: ["preferredLanguage", "baseLocale"]               // Accept-Language / browser
strategy: ["url", "cookie", "preferredLanguage", "baseLocale"] // full chain
```

| Strategy | Resolves locale from |
|----------|----------------------|
| `url` | the URL (per `urlPatterns`) — best for SEO |
| `cookie` | the `cookieName` cookie (set by `setLocale`) |
| `preferredLanguage` | browser settings / `Accept-Language` header; exact match before base-language fallback |
| `baseLocale` | the configured `baseLocale` — always the final fallback |

### URL patterns (prefixed vs. unprefixed routes)

```js
urlPatterns: [
  // Routes WITHOUT a locale prefix (locale comes from cookie/fallback)
  {
    pattern: "/dashboard/:path(.*)?",
    localized: [
      ["en", "/dashboard/:path(.*)?"],
      ["pl", "/dashboard/:path(.*)?"], // same path for all locales
    ],
  },
  // Routes WITH a locale prefix
  {
    pattern: "/:path(.*)?",
    localized: [
      ["pl", "/pl/:path(.*)?"],
      ["en", "/:path(.*)?"],          // base locale stays at root
    ],
  },
]
```

> This is where Open Question #2 (URL-prefixed `/pl/…` vs. cookie/Accept-Language) is decided.

---

## 8. Cloudflare Workers deployment (CRITICAL for this project)

- **Keep `AsyncLocalStorage` ENABLED.** It's the recommended setup. Paraglide uses it to
  carry the per-request locale into `getLocale()` during SSR.
- **Requires `nodejs_compat`.** Cloudflare Workers provides `AsyncLocalStorage` /
  `node:async_hooks` **only when the `nodejs_compat` compatibility flag is enabled** in your
  `wrangler` config. Ensure it's set:

  ```jsonc
  // wrangler.jsonc
  {
    "compatibility_flags": ["nodejs_compat"]
  }
  ```

- **`disableAsyncLocalStorage`** is a compatibility *fallback only* for runtimes that lack
  `AsyncLocalStorage` but still isolate each request. **Do NOT use it on a normal multi-request
  server** — it can leak locale state between concurrent requests. Cloudflare Workers with
  `nodejs_compat` does NOT need this fallback.
- **Astro 6 note:** `astro dev`/`preview` now run on the real `workerd` runtime, so local dev
  exercises the same AsyncLocalStorage path as production — test the locale flow in `dev`.

---

## 9. Quick checklist for S-16 (Paraglide path)

- [ ] `npx @inlang/paraglide-js@latest init` → set `baseLocale` + `locales: ["en", "pl"]`.
- [ ] Add `paraglideVitePlugin` to [astro.config.mjs](../../../astro.config.mjs) (keep `cloudflare()` adapter).
- [ ] Compose `paraglideMiddleware` with existing auth middleware in [src/middleware.ts](../../../src/middleware.ts) via `sequence()`.
- [ ] Confirm `nodejs_compat` is in the `wrangler` config.
- [ ] Choose `strategy` + `urlPatterns` (resolves Open Questions #1, #2).
- [ ] Extract hardcoded UI strings → `messages/en.json`, translate → `messages/pl.json` (mind Polish plural categories).
- [ ] Replace string literals with `m.*()` calls in `.astro` files and React islands.
- [ ] Add a `LocaleSwitcher` calling `setLocale("pl" | "en")`.
- [ ] (Separate workstream) Pass locale into the Anthropic generation prompt so DnD content returns in Polish.

---

## Sources

- Paraglide Astro example: https://github.com/opral/paraglide-js/blob/main/examples/astro/README.md
- File formats: https://github.com/opral/paraglide-js/blob/main/docs/file-formats.md
- Strategy: https://github.com/opral/paraglide-js/blob/main/docs/strategy.md
- i18n routing: https://github.com/opral/paraglide-js/blob/main/docs/i18n-routing.md
- SSR: https://github.com/opral/paraglide-js/blob/main/docs/server-side-rendering.md
- Runtime API (`getLocale`): https://github.com/opral/paraglide-js/blob/main/docs-api/runtime/type/-internal-.md
- Official Astro guide: https://paraglidejs.com/astro
