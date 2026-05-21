# Plan: First Production Deploy — Cloudflare Workers

## TL;DR

Deploy `dnd-5enemy` to Cloudflare Workers. The project is already configured (`@astrojs/cloudflare` v13, `wrangler.jsonc` present, correct entrypoint). Three things block production: (1) project name in `wrangler.jsonc` still reads `10x-astro-starter`, (2) Cloudflare account auth and secrets not yet set, (3) CI has no deploy step. This plan covers all three.

---

## Phase 1 — Code Fix (automated, 1 file)

**Step 1.** Rename project in `wrangler.jsonc`  
Change `"name": "10x-astro-starter"` → `"name": "dnd-5enemy"`  
File: `wrangler.jsonc`

---

## Phase 2 — Manual Human Gates (order matters)

**Step 2.** Upgrade to Workers Paid  
`dash.cloudflare.com` → Workers & Pages → Your plan → Enable Workers Paid ($5/mo).  
_Required BEFORE deploy — Free tier 10ms CPU limit fails on every SSR+auth request._

**Step 3.** Authenticate wrangler locally  
`npx wrangler login`  
Opens browser OAuth flow. For CI, create a scoped API token at `dash.cloudflare.com/profile/api-tokens` (template: "Edit Cloudflare Workers").

**Step 4.** Set production secrets

```
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

Confirm with `npx wrangler secret list`.  
Locally, create `.dev.vars` (gitignored) with the same values for `astro dev`.

---

## Phase 3 — Build & Deploy (automated)

**Step 5.** Build and deploy  
`npm run build && npx wrangler deploy`  
Deploys to `dnd-5enemy.<your-subdomain>.workers.dev`.

**Step 6.** Smoke test  
`npx wrangler tail` in a second terminal → load the deployed URL → verify SSR response, no 1101 errors, auth flow works.

---

## Phase 4 — CI/CD Wiring (1 file)

**Step 7.** Add deploy job to `.github/workflows/ci.yml`  
New job `deploy` that depends on `ci` job, runs only on `push` to `master`, uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets, and runs `npm run build && npx wrangler deploy`.

**Step 8.** Add GitHub repo secrets  
In GitHub repo Settings → Secrets → Actions: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

---

## Relevant Files

- `wrangler.jsonc` — change `name` field
- `.github/workflows/ci.yml` — add deploy job
- `.dev.vars` — create locally (gitignored), not committed

## Verification

1. `npx wrangler deploy` exits 0 with URL output
2. `npx wrangler tail` shows live request logs when the deployed URL is loaded
3. Sign-up and sign-in flow works on the deployed URL
4. `npx wrangler secret list` shows both `SUPABASE_URL` and `SUPABASE_KEY`
5. CI pipeline passes and auto-deploys on next push to master

## Decisions / Scope

- Auto Minify: must be verified as disabled in Cloudflare dashboard (risk from infrastructure.md)
- `wrangler pages deploy` not used — only `wrangler deploy` (Workers, not Pages)
- No per-PR preview deploys (out of scope for MVP)
- No `.dev.vars` committed — user must create locally
