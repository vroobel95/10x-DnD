# Repository Guidelines

## Quickstart

- Use npm scripts from @package.json: dev, build, preview, lint, lint:fix, format.
- Node.js v22.14.0 is required (see @.nvmrc).
- Local environment setup and Supabase configuration: @README.md.

## Architecture

- Astro 6 SSR app with React islands, Tailwind 4, Supabase, deployed on Cloudflare Workers.
- API routes must export `const prerender = false` to keep SSR behavior.
- Auth flow: @src/lib/supabase.ts and @src/middleware.ts. Routes: @src/pages/api/auth/. Pages: @src/pages/auth/.
- Path alias: `@/*` maps to `./src/*` (see @tsconfig.json).

## Conventions

- Prefer Astro components for static content/layout; use React only when interactivity is needed.
- Tailwind class merging: use `cn()` from @src/lib/utils.ts; do not concatenate class strings manually.
- shadcn/ui components live in @src/components/ui/ (new-york variant). Add with `npx shadcn@latest add <name>`.
- API routes use uppercase `GET`, `POST` exports and validate input with zod.
- React hooks go in @src/components/hooks/.
- Services/helpers go in @src/lib/ (or @src/lib/services/ for business logic).
- Shared types (entities, DTOs) go in @src/types.ts.

## Data and Supabase

- Supabase migrations live in supabase/migrations/ using `YYYYMMDDHHmmss_short_description.sql`.
- Always enable RLS and add per-operation, per-role policies for new tables.
- Env vars: `SUPABASE_URL` and `SUPABASE_KEY` go in `.env` and `.dev.vars`.

## Automation

- Pre-commit: husky + lint-staged runs ESLint fix on `*.{ts,tsx,astro}` and Prettier on `*.{json,css,md}`.
- CI: GitHub Actions runs lint + build on push and PR to master; requires `SUPABASE_URL` and `SUPABASE_KEY` secrets.
