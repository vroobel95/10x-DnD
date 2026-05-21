---
project: dnd-5enemy
researched_at: 2026-05-21T00:00:00Z
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd)
  database: Supabase (external PostgreSQL + auth)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project's tech stack already targets Cloudflare Workers: `@astrojs/cloudflare` v13 is installed, `wrangler.jsonc` is configured with `nodejs_compat` and the correct `main` entry point, and `astro.config.mjs` uses `output: "server"` with `cloudflare()` adapter. No platform migration is required. The developer confirmed existing familiarity with the platform (interview Q3), and Cloudflare Workers scored 5/5 Pass across all agent-friendly criteria — the only platform to do so. The Workers Paid plan ($5/month) is required because the Free tier's 10ms CPU budget will not survive a single SSR + Supabase auth round-trip; at 10k–100k monthly requests the total cost remains $5/month flat.

## Platform Comparison

| Platform               | CLI-first  | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | **Score** |
| ---------------------- | ---------- | ------------------ | ------------------- | ----------------- | ----------------- | --------- |
| **Cloudflare Workers** | ✅ Pass    | ✅ Pass            | ✅ Pass             | ✅ Pass           | ✅ Pass           | **10/10** |
| **Vercel**             | ✅ Pass    | ✅ Pass            | ⚠️ Partial          | ✅ Pass           | ⚠️ Partial        | **8/10**  |
| **Netlify**            | ⚠️ Partial | ✅ Pass            | ✅ Pass             | ⚠️ Partial        | ✅ Pass           | **8/10**  |
| **Railway**            | ✅ Pass    | ⚠️ Partial         | ✅ Pass             | ✅ Pass           | ⚠️ Partial        | **8/10**  |
| **Fly.io**             | ✅ Pass    | ⚠️ Partial         | ✅ Pass             | ✅ Pass           | ❌ Fail           | **7/10**  |
| **Render**             | ⚠️ Partial | ⚠️ Partial         | ✅ Pass             | ⚠️ Partial        | ⚠️ Partial        | **6/10**  |

**Scoring notes per platform:**

- **Cloudflare Workers**: Full CLI control via `wrangler` (deploy, rollback, tail logs, secret management). Fully serverless/managed — no OS patching, no Dockerfile. Docs published as Markdown on GitHub (`cloudflare/cloudflare-docs`) and via `.md` suffix on any docs URL. `wrangler deploy` is a single deterministic command. Multiple official MCP servers (observability, builds, docs, Workers). Workers Paid required: $5/mo.
- **Vercel**: `vercel deploy/rollback/logs` all GA. Serverless, fully managed. Docs live in a JS-rendered SPA — no confirmed `llms.txt` or GitHub-hosted Markdown (Partial). Vercel MCP at `mcp.vercel.com` is **beta** (Feb 2026). Cold-start prevention is Pro-only ($20/mo).
- **Netlify**: No CLI rollback — dashboard/REST API only (Partial). Lambda-based serverless, fully managed. `docs.netlify.com/llms.txt` confirmed (GA). No CLI `rollback` command means stable-deploy-API is Partial. Official `@netlify/mcp` is GA. **Critical for this app**: 60-second hard function timeout — AI generation (OpenAI calls) can exceed this limit; not scored against criteria but factored in shortlisting.
- **Railway**: Full CLI (`railway up`, `railway logs`, `railway deployment list` for rollback). Managed containers but you own service config — less fully-managed than Workers (Partial on criteria 2). Docs on GitHub as Markdown. `railway up` is one command. Official `@railway/mcp-server` is GA but self-described as "work in progress" (Partial). Requires `@astrojs/node` adapter swap.
- **Fly.io**: `flyctl` covers all operations. Managed VMs but you own a Dockerfile (Partial on criteria 2). GitHub-hosted MDX docs, "Copy page as Markdown" available. No dedicated `fly rollback` — requires `fly deploy --image <sha>` (two-step, still scriptable). **No official MCP server** (Fail). No free tier — pay-as-you-go only. Requires adapter swap.
- **Render**: CLI lacks `rollback` command (Partial on CLI + stable API). Managed containers but with free-tier spin-down in 15 minutes (Partial). `llms.txt` and `.md` suffix on docs pages confirmed. MCP at `mcp.render.com` cannot trigger deploys (Partial). Free tier unsuitable for production. Requires adapter swap.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

The project is already configured for Cloudflare Workers — `@astrojs/cloudflare` adapter installed, `wrangler.jsonc` present with `nodejs_compat` flag and correct entrypoint. No migration work required. The developer is familiar with the platform (interview Q3). Five-criterion perfect score means an agent can operate this platform entirely from the terminal without any dashboard interaction. Workers Paid at $5/mo handles the entire MVP request range with no per-request overage. Supabase as an external service is the standard pattern for Workers — no co-location needed.

#### 2. Vercel

Strong second option if Cloudflare Workers proves problematic. The `@astrojs/vercel` adapter is GA at v10, requires a swap from `@astrojs/cloudflare`. Function timeout of 300s (Hobby) is generous for AI generation — no timeout risk even for slow OpenAI calls. DX is excellent: per-PR preview URLs are automatic, zero config. Trade-offs: docs are not GitHub-hosted Markdown (agent must use Vercel MCP, which is still in beta); cold starts require Pro ($20/mo) to prevent; first-party Postgres/KV are deprecated (use Marketplace/Supabase). Adapter swap requires changing `astro.config.mjs` and updating env access patterns.

#### 3. Railway

Best option if the app ever needs long-lived server processes (e.g. server-sent events, background jobs). Persistent processes with no cold starts by default — the Node.js server stays running between requests. Railway's Hobby plan ($5/mo, $5 usage included) is cost-equivalent to Cloudflare Workers Paid. Trade-offs: requires `@astrojs/node` adapter swap, `host: '0.0.0.0'` config, and `start` script change in `package.json`. MCP server is available but self-described as a work in progress. No edge distribution — single-region latency profile.

---

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **CPU time budget can trap AI workloads.** Workers Paid allows 30s CPU time per request, but some OpenAI SDK streaming implementations maintain a CPU-active polling loop during token generation — accumulating CPU time in ways that only manifest under real load. An 8–12 second AI generation request that tests fine in `wrangler dev` could silently breach CPU limits at higher concurrency, triggering 1101 (CPU exceeded) errors with limited diagnostics.

2. **Bundle size limit (10 MB compressed, Paid) is a real ceiling.** Adding the OpenAI SDK, Vercel AI SDK, Supabase JS client, Zod, and Astro's SSR runtime together can approach this limit. Tree-shaking does not always work cleanly for all SDK code paths. CI typically runs only `astro build` — the `wrangler deploy` bundle-size check doesn't run unless explicitly added to CI, so this failure first appears in production.

3. **`@astrojs/cloudflare` v13 is a breaking change from the Pages era.** The `deployment_target: cloudflare-pages` note in `tech-stack.md` signals Pages-era patterns in the project's history. The v13 adapter removes `Astro.locals.runtime` entirely. Any existing middleware or route code using the old runtime access pattern (`Astro.locals.runtime.env.SUPABASE_KEY`) will compile but fail silently at runtime.

4. **Supabase involves multiple sequential network round-trips from the edge.** Each SSR request needing auth validation + a DB query fires 2–4 Supabase API calls from a Cloudflare PoP that may be geographically distant from Supabase's regional endpoint (default: `us-east-1`). Each round-trip adds 50–150ms of network latency from non-US PoPs. Cloudflare Hyperdrive can pool Supabase connections at the edge but is an additional service to configure.

5. **Per-PR preview deployments don't exist out of the box.** Vercel and Netlify auto-generate per-PR preview URLs with zero config. Cloudflare Workers requires a GitHub Actions workflow with `wrangler deploy --name dnd-5enemy-pr-${{ github.event.pull_request.number }}` or using Cloudflare Pages (static + functions) instead. For a solo project this is acceptable but is a meaningful DX gap during iterative development.

### Pre-Mortem — How This Could Fail

_Six months in:_ The app was live on Cloudflare Workers and working in the first weeks. AI enemy generation completed in 3–5 seconds locally and in `wrangler dev` (workerd runtime), well within stated limits. But real usage exposed two compounding issues. First: users in Europe saw 524 timeout errors ~15% of the time during generation. The root cause was not CPU time but network topology — the OpenAI call routed from a Cloudflare PoP in Frankfurt to an OpenAI US endpoint, then a Supabase write to us-east-1, then back. Four sequential network hops that the local `wrangler dev` preview, hitting localhost services, had never simulated.

Second: a routine dependency update pulled in a new Supabase client version with a CJS-only code path in its auth helper. The `nodejs_compat` flag handled 95% of Node.js APIs, but this specific `require()` pattern at runtime was not pre-bundled by `optimizeDeps.include`. The error surfaced as intermittent silent auth failures — users were logged out on cached pages — not a build-time error. Three days elapsed before the deploy was identified as the root cause.

Third and final: a well-intentioned performance tweak enabled Cloudflare's "Auto Minify" on the zone. React hydration on enemy card islands started silently failing on cache-hit pages — the minifier rewrote inline JSON blobs that React's hydration checksums depend on. The bug only appeared on cache hits, not fresh requests, and took a week to isolate.

### Unknown Unknowns

- **`wrangler deploy` and `wrangler pages deploy` are not interchangeable.** If any CI workflow, README, or commit history references `wrangler pages deploy`, it deploys a stale Pages artifact instead of the active Workers deployment. The command succeeds silently; production does not update. Audit all deploy scripts before going live.
- **Cloudflare's Auto Minify causes React hydration mismatches.** Enabled by default on many Cloudflare zones, it rewrites inline scripts and JSON blobs in HTML, breaking React island hydration checksums. Must be disabled in the Cloudflare dashboard — no code-level workaround exists.
- **Workers Secrets are not available at `astro build` time.** Secrets set via `wrangler secret put` are runtime-only. The project uses Astro's `envField` with `context: "server"` and `access: "secret"` — this is correct and ensures build-time access reads from `.dev.vars` locally and from Workers Secrets at runtime. But any build-time logic that accidentally reads these values (e.g. a Vite plugin or `astro.config.mjs` expression) will receive `undefined` silently.
- **KV eventual consistency (up to 60 seconds) breaks auth-adjacent caching.** If KV is ever used to cache auth-derived state (user roles, preferences, rate-limit counters), a user who just signed up may see stale state for up to a minute at distant PoPs. Supabase JWT verification in middleware is stateless and unaffected, but any secondary KV assertion about auth state is a footgun.
- **The Astro `envField` env access pattern (`import.meta.env.SUPABASE_KEY`) is correct for this adapter version.** Older tutorials and AI-generated code may use `Astro.locals.runtime.env.SUPABASE_KEY` (removed in v13) or `import { env } from 'cloudflare:workers'` (valid but bypasses Astro's type-safe env schema). Only use `import.meta.env.*` for secrets defined in `astro.config.mjs` `env.schema`.

---

## Operational Story

- **Preview deploys**: No automatic per-PR preview URLs. Set up a GitHub Actions workflow that runs `npx wrangler deploy --name dnd-5enemy-preview-pr-${{ github.event.pull_request.number }}` on PR open/sync; tear down with `wrangler delete` on PR close. Alternatively, use `wrangler dev --remote` for personal testing against remote Workers bindings.
- **Secrets**: Stored in Cloudflare Workers Secrets vault, set via `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Locally, secrets go in `.dev.vars` (gitignored). To rotate: `wrangler secret put <KEY>` with the new value — takes effect on next deploy. GitHub Actions uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets to authenticate `wrangler deploy` in CI.
- **Rollback**: `npx wrangler rollback` reverts the Workers deployment to the previous version immediately (sub-second). To target a specific version: `npx wrangler deployments list` then `wrangler rollback --deployment-id <id>`. Note: database migrations (Supabase) do not roll back automatically — only the Workers code reverts.
- **Approval**: Deploys to production via `wrangler deploy` may be performed by an agent unattended. The following actions require a human: rotating `SUPABASE_KEY` (do via Supabase dashboard + `wrangler secret put`), deleting the Workers project, billing tier changes, enabling/disabling Cloudflare zone features (e.g. Auto Minify — keep disabled).
- **Logs**: `npx wrangler tail` streams live request and console logs to the terminal. Filter by status: `wrangler tail --status error`. For historical logs (last 24h), use `wrangler deployments list` + `wrangler tail --deployment-id <id>`. Structured logs via `console.log()` appear in the tail stream as JSON. Workers Observability dashboard (enabled in `wrangler.jsonc`) provides metrics at `dash.cloudflare.com`.

---

## Risk Register

| Risk                                                                                            | Source           | Likelihood | Impact | Mitigation                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ---------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI generation (OpenAI streaming) exceeds CPU time limit under real load                         | Devil's advocate | M          | H      | Benchmark OpenAI call with `wrangler dev --remote` under load before launch; if CPU usage approaches 30s, switch to streaming responses via `ReadableStream` so CPU time is distributed across tokens, not accumulated |
| Bundle size exceeds 10 MB compressed limit as AI SDKs are added                                 | Devil's advocate | M          | H      | Add `npx wrangler deploy --dry-run` to CI to catch bundle size failures before production; use `import { OpenAI } from 'openai'` with tree-shaking, avoid importing entire SDK namespaces                              |
| `Astro.locals.runtime` removed in v13 — old code patterns break silently                        | Devil's advocate | L          | M      | Search codebase for `Astro.locals.runtime` before first deploy; use only `import.meta.env.*` (Astro `envField`) or `import { env } from 'cloudflare:workers'` for env access                                           |
| Multi-hop network latency (Cloudflare PoP → OpenAI → Supabase) causes timeouts for non-US users | Pre-mortem       | M          | M      | Set Supabase project region to match primary user geography; use `openai.beta.chat.completions.stream()` with streaming so the 30s wall-clock timeout is reset per chunk, not per full response                        |
| CJS-only npm dependency breaks Workers runtime after update                                     | Pre-mortem       | L          | H      | Lock `@supabase/supabase-js` to a tested minor version in `package.json`; run `wrangler dev --remote` smoke tests after every dep update                                                                               |
| Cloudflare Auto Minify breaks React island hydration                                            | Unknown unknowns | L          | M      | Verify Auto Minify is disabled on the Cloudflare zone before any production traffic; add a post-deploy smoke test that checks a React island for hydration errors                                                      |
| `wrangler pages deploy` invoked instead of `wrangler deploy` in CI                              | Unknown unknowns | L          | H      | Audit all CI files and READMEs for `wrangler pages`; remove or replace with `wrangler deploy`                                                                                                                          |
| Workers Secrets unavailable at build time; build-time secret access silently returns undefined  | Unknown unknowns | L          | M      | Keep all secret access in Astro routes/middleware (server context), never in `astro.config.mjs` expressions or Vite plugin callbacks; validate with `wrangler dev` that secrets are defined in `.dev.vars`             |
| No per-PR preview URLs without custom CI setup                                                  | Research finding | H          | L      | Acceptable for solo MVP; document the `wrangler tail --remote` workflow for PR review; add preview deploy action post-MVP                                                                                              |
| Workers Paid ($5/mo) required — Free tier 10ms CPU limit                                        | Research finding | H          | H      | Upgrade to Workers Paid before any SSR + auth traffic; do not deploy to production on the Free tier                                                                                                                    |

---

## Getting Started

The project is already configured for Cloudflare Workers (adapter installed, `wrangler.jsonc` present). Steps to first production deploy:

1. **Rename the Workers project** in `wrangler.jsonc` — change `"name": "10x-astro-starter"` to `"name": "dnd-5enemy"` to match the project name.
2. **Authenticate wrangler**: `npx wrangler login` — opens a browser to authorize your Cloudflare account. For CI, create a scoped API token at `dash.cloudflare.com/profile/api-tokens` (template: "Edit Cloudflare Workers") and store as `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in GitHub repo secrets.
3. **Set production secrets**: `npx wrangler secret put SUPABASE_URL` then `npx wrangler secret put SUPABASE_KEY` — each prompts for the value interactively. Confirm with `npx wrangler secret list`.
4. **Upgrade to Workers Paid**: Navigate to `dash.cloudflare.com` → Workers & Pages → your plan → enable Workers Paid ($5/mo). The Free tier's 10ms CPU limit will not survive a single SSR request with Supabase auth.
5. **Build and deploy**: `npm run build && npx wrangler deploy` — builds the Astro SSR bundle and deploys to `dnd-5enemy.<your-subdomain>.workers.dev`. Verify with `npx wrangler tail` in a second terminal while loading the deployed URL.

---

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions workflows for automated deploys)
- Production-scale architecture (multi-region, HA, DR, Durable Objects for global state)
