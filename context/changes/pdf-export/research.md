---
date: 2026-06-14T19:04:29+0200
researcher: vroobel95
git_commit: a85053b522e62415eaa59b04f8defdee20db7b30
branch: main
repository: 10x-DnD
topic: "PDF export — which library to use for exporting enemy cards to PDF"
tags: [research, codebase, pdf-export, cloudflare-workers, pdf-lib]
status: complete
last_updated: 2026-06-14
last_updated_by: vroobel95
---

# Research: PDF export — which library to use

**Date**: 2026-06-14T19:04:29+0200
**Researcher**: vroobel95
**Git Commit**: a85053b522e62415eaa59b04f8defdee20db7b30
**Branch**: main
**Repository**: 10x-DnD

## Research Question

For the `pdf-export` change (S-07 / FR-012), find the library to use for exporting a
battle's confirmed enemy cards to a printable PDF. External research conducted via
exa.ai.

## Summary

**Recommendation: `pdf-lib`** (package name `pdf-lib`, not `@pdf-lib/pdf-lib`).

The decisive constraint is the runtime: this app deploys to **Cloudflare Workers
(workerd)** via `output: "server"` + `adapter: cloudflare()` ([astro.config.mjs:12,29](https://github.com/vroobel95/10x-DnD/blob/a85053b522e62415eaa59b04f8defdee20db7b30/astro.config.mjs#L12-L29)).
Workers are V8 isolates — no filesystem, no native binaries, no Chromium, pure
JS/WASM only, with a 128 MB memory cap and a script-bundle limit of 1 MB (free) /
10 MB (paid). This eliminates the two most ergonomic options (HTML→PDF via headless
Chromium, and `@react-pdf/renderer`'s JSX layout) and leaves pure-JS generators.

Among those, `pdf-lib` is the safest pick:

- **Pure JS, zero native deps, ~330 KB min+gzip** — fits the 1 MB free-tier bundle
  limit with room to spare, runs in Workers **without** `nodejs_compat`.
- **Proven on Cloudflare** — multiple recent (2026) card/PDF projects ship it on
  Cloudflare Pages/Workers.
- **Built-in standard fonts** (Helvetica, etc.) need no font-file embedding — ideal
  when there is no filesystem. Custom fonts are still possible via `@pdf-lib/fontkit`.
- Confirms the recommendation already recorded in
  [change.md:23](https://github.com/vroobel95/10x-DnD/blob/a85053b522e62415eaa59b04f8defdee20db7b30/context/changes/pdf-export/change.md#L23).

Trade-off: `pdf-lib` is an editing-first library, so emitting from scratch means
**manual `(x, y)` layout** and ~10 ms/page abstraction overhead. For a fixed
stat-block card template that is acceptable. If manual positioning becomes painful,
`boxpdf` — a flexbox-lite declarative DSL layered **on top of** `pdf-lib`, explicitly
Workers-compatible without `nodejs_compat` — is the recommended add-on rather than
switching libraries.

**Rejected:** `@react-pdf/renderer` (its `renderToBuffer`/`renderToStream` are
Node-only APIs that fail on workerd even with `nodejs_compat`), `jsPDF` (browser-first,
needs Node `Buffer` shims, sprawling/hard-to-tree-shake), Puppeteer / Cloudflare
Browser Rendering (heavyweight, paid, overkill for a stat card), and external render
services (third-party dependency + per-call cost, unnecessary for MVP).

## Detailed Findings

### Runtime constraints (the deciding factor)

This is server-rendered on Cloudflare:

- `output: "server"` and `adapter: cloudflare()` — [astro.config.mjs:12,29](https://github.com/vroobel95/10x-DnD/blob/a85053b522e62415eaa59b04f8defdee20db7b30/astro.config.mjs#L12-L29)
- Stack confirms `deployment_target: cloudflare-pages` — [tech-stack.md:8](https://github.com/vroobel95/10x-DnD/blob/a85053b522e62415eaa59b04f8defdee20db7b30/context/foundation/tech-stack.md#L8)

Workers = V8 isolates, not containers (gPdf, 2026-05):

- CPU: **50 ms/request free**, 30 s paid (Bundled), 5 min (Unbound). Wall time billable.
- Memory: **128 MB** per isolate.
- Bundle: **1 MB free / 10 MB paid**.
- **No filesystem** (`fs.readFileSync` unavailable), **no native binaries** (no
  node-canvas, no Ghostscript), pure JS/WASM only.
- **Chromium-based renderers do not work, full stop.**

Implication for us: the PDF must be produced entirely in-memory inside the `fetch`
handler, in pure JS, returned as bytes. CPU budget matters on the free plan — generating
N cards with `pdf-lib` (~10 ms/page) for a typical handful of enemies is fine, but worth
keeping in mind if it ever runs on the 50 ms free tier.

### Library comparison

| Library | Workers-compatible | Bundle | Layout model | Verdict |
|---|---|---|---|---|
| **pdf-lib** | ✅ yes, no `nodejs_compat` | ~330 KB gz | manual `(x,y)` draw | **Recommended** |
| boxpdf (over pdf-lib) | ✅ yes, no `nodejs_compat` | + small DSL | declarative flexbox-lite (vstack/hstack/table/themes) | Optional layout helper |
| jsPDF | ⚠️ works but needs Buffer shims | heavier, hard to tree-shake | manual + plugins | Not preferred |
| @react-pdf/renderer | ❌ Node-only render APIs fail on workerd | ~3 MB (Yoga+PDFKit) | JSX/flexbox (Yoga) | **Rejected** |
| Puppeteer / CF Browser Rendering | ⚠️ paid add-on only | heavy | HTML/CSS | Overkill |
| External PDF API (gPdf, Browserless…) | ✅ via HTTP | 0 in bundle | HTML/CSS | Adds 3rd-party dep + cost |

#### pdf-lib — recommended
- "Pure JavaScript… no native dependencies. Works in any JavaScript runtime, including
  browsers, Node, Deno, and React Native." (pdf-lib.js.org)
- ~330 KB minified+gzipped; mature API, good docs (DEV card-generator comparison, 2026-05).
- Real-world Cloudflare Pages deployments confirmed (foldcardpdf.com, browser-only
  fold-card generator using pdf-lib at $0 on CF Pages).
- Caveat (gPdf): "great for editing existing PDFs, less great for emitting from scratch —
  its abstraction layer adds ~10 ms of overhead per page." Acceptable for a fixed template.

#### boxpdf — optional layout helper on top of pdf-lib
- "A box-layout DSL over pdf-lib. Runs in Node 18+, Cloudflare Workers, Deno, and browsers.
  No native dependencies, no WASM, no headless browser." `pdf-lib` is a peer dependency.
- "Both the core and the `boxpdf/inter` subpath run on Workers **without** `nodejs_compat`."
- Primitives: `vstack`, `hstack`, `text`, `table`, `image`, padding/margin/border, themes,
  pagination via `renderFlow`. This solves pdf-lib's manual-layout pain while keeping the
  same Workers-safe foundation.
- Risk: newer/smaller library (first releases 2026-05) — maturity/maintenance unknown.
  Adopt only if hand-rolled `(x,y)` layout proves too tedious.

#### @react-pdf/renderer — rejected despite JSX appeal
The library would let us reuse a JSX layout close to the existing `EnemyCard`, but it is
**not Workers-compatible**:
- GitHub issue [#2757](https://github.com/diegomura/react-pdf/issues/2757): "`renderToStream`
  / `renderToBuffer` are Node-specific APIs… The Edge runtime provided by Cloudflare does
  not allow the use of Node-specific APIs, making it impossible to use react-pdf in
  serverless and Edge-first environments without extensive patching or workarounds."
- A user reports exactly our stack — "astrojs with react, deployed to cf worker" — failing
  with the same Node-API error **even with `nodejs_compat` enabled**.
- Uses Yoga (WASM) + PDFKit, ~3 MB. Skip.

#### jsPDF — not preferred
- gPdf: "browser-first; same Buffer issue [needs Node `Buffer` shims], plus a sprawling API
  surface that's hard to tree-shake." Heavier than pdf-lib for our needs.

### What we are exporting (integration points)

Data model — enemy `stats` JSONB validated by Zod:
- `EnemyStats` Zod schema — `src/lib/schemas/enemy.ts:8-29`: required `name`, `cr` (string,
  e.g. "2", "1/2"), `hp`, `ac`, `speed` (string), `str/dex/con/int/wis/cha` (1–30); optional
  `saving_throws` (Record<string,number>), `skill_modifiers`; `abilities` array of up to 10
  `{name, description}`.
- `Enemy` interface — `src/types.ts:31-39`: `id`, `battle_id`, `name`, `status`
  (pending|confirmed), `stats` (JSONB), timestamps.
- DB table — `supabase/migrations/20260527000003_create_enemies.sql:11-19`; RLS enforces
  ownership via enemies.battle_id → battles.campaign_id → campaigns.user_id.

UI to mirror in the PDF layout:
- `src/components/battles/EnemyCard.tsx:237-386` renders the confirmed-enemy stat block:
  name + CR badge, HP/AC/Speed, ability-score grid with modifiers (modifier fn at
  `EnemyCard.tsx:30-33`), saving throws ("STR +2, WIS -1"), skill modifiers, abilities
  (bold name + description).

Where the export entry point lives:
- Battle detail page — `src/pages/battles/[id].astro:1-77`; auth via `Astro.locals.user`
  (line 12), battle fetched (lines 18-21), confirmed enemies filtered (lines 36-44),
  `BattleHeader` (line 63) and `EnemiesSection` (line 74) hydrated `client:load`. The
  "Export PDF" button most naturally belongs in `BattleHeader`.

API route to mirror for `GET /api/battles/[id]/export.pdf`:
- Auth + ownership pattern from `src/pages/api/battles/[id]/index.ts:7-96` and
  `src/pages/api/enemies/[id].ts:8-106`: get supabase client (null → 500), get
  `context.locals.user` (null → 401), verify campaign ownership
  (`campaigns.select("id").eq("user_id", user.id)` → battle in those campaigns), then fetch
  confirmed enemies (`enemies.select("*").eq("battle_id", id).eq("status","confirmed")`).
- Battle-fetch example — `src/pages/api/battles/[id]/generate.ts:37-48`.

**Binary responses are new to this codebase** — every existing route returns
`Response.json(...)`; there are no `Content-Type`/`Content-Disposition` headers or
Blob/ArrayBuffer/Uint8Array responses anywhere. The export route will be the first to
return `new Response(pdfBytes, { headers: { "Content-Type": "application/pdf",
"Content-Disposition": 'attachment; filename="battle-<id>.pdf"' } })`.

## Code References

- `astro.config.mjs:12,29` — `output: "server"` + `adapter: cloudflare()` (the constraint)
- `context/foundation/tech-stack.md:8` — `deployment_target: cloudflare-pages`
- `context/changes/pdf-export/change.md:18-27` — prior notes; pdf-lib already recommended
- `src/lib/schemas/enemy.ts:8-29` — `EnemyStats` Zod schema (PDF content fields)
- `src/types.ts:31-39` — `Enemy` interface
- `supabase/migrations/20260527000003_create_enemies.sql:11-19` — enemies table + RLS
- `src/components/battles/EnemyCard.tsx:237-386` — stat-block UI to reproduce; `:30-33` modifier fn
- `src/pages/battles/[id].astro:1-77` — battle detail page; export button host
- `src/pages/api/battles/[id]/index.ts:7-96` — auth/ownership route template
- `src/pages/api/enemies/[id].ts:8-106` — DB-error vs not-found split reference
- `src/pages/api/battles/[id]/generate.ts:37-48` — battle fetch example

## Architecture Insights

- **Runtime dictates the library** — on workerd the choice is narrowed to pure-JS
  generators before any DX preference; pdf-lib wins on compatibility + bundle + maturity.
- **No filesystem ⇒ prefer built-in standard fonts.** pdf-lib's standard fonts avoid font-file
  embedding entirely; only reach for `@pdf-lib/fontkit` if a custom typeface is required.
- **Spike still warranted** ([change.md:27](https://github.com/vroobel95/10x-DnD/blob/a85053b522e62415eaa59b04f8defdee20db7b30/context/changes/pdf-export/change.md#L27)):
  add `pdf-lib`, generate a one-card PDF in the dev Workers runtime (`wrangler`/`astro build`
  preview), and confirm the bundle stays within limits and the bytes render. Low risk given
  multiple shipping CF deployments, but it removes the only remaining unknown before `/10x-plan`.
- **Apply existing lessons to the new route**: sanitize Supabase errors before surfacing
  ([lessons.md:5](https://github.com/vroobel95/10x-DnD/blob/a85053b522e62415eaa59b04f8defdee20db7b30/context/foundation/lessons.md#L5)),
  split DB-error (500) from not-found (404), and reuse the shared campaign-ownership lookup
  rather than duplicating the query.

## Historical Context (from prior changes)

- `context/changes/pdf-export/change.md` — already scoped the feature: Cloudflare constraint
  identified, `pdf-lib` named as the MVP starting point, route shape `GET
  /api/battles/[id]/export.pdf`, card layout fields, and a bundle-size spike flagged as the
  open blocker. This research confirms that direction and corrects the package name
  (`pdf-lib`, not `@pdf-lib/pdf-lib`).

## Related Research

- None found under `context/changes/**/research.md` or `context/archive/**/research.md` for
  PDF/export topics; this is the first.

## Open Questions

- **Bundle/runtime spike** — verify `pdf-lib`'s footprint against the active plan's bundle
  limit (1 MB free vs 10 MB paid) and that generation stays within the CPU budget for the
  max expected enemy count. (Carried over from change.md.)
- **Which plan is the deploy on** — free (50 ms CPU, 1 MB) vs paid changes the safety margin;
  not blocking for pdf-lib but informs whether boxpdf/extra fonts are affordable.
- **Layout effort** — start with hand-rolled `(x,y)` in pdf-lib; decide on `boxpdf` only if
  the manual layout for the stat-block card proves too tedious to maintain.
