# Create Battle — Plan Brief

> Full plan: `context/changes/create-battle/plan.md`

## What & Why

S-01 upgrades the placeholder dashboard into a functional battle list and adds the create-battle flow. This is the thinnest slice that unblocks the north star (S-02: AI enemy generation), which requires a battle to exist before a GM can request enemies.

## Starting Point

Auth is complete; dashboard shows only the GM's email and sign-out button. The `battles` table exists with RLS (F-01), `src/types.ts` exports `Battle`, and every new user already has an auto-created campaign from the DB trigger. Zero application API routes exist yet.

## Desired End State

The dashboard lists the GM's battles with name, party level, and created date. "New Battle" navigates to `/battles/new`, where the GM fills in name (required), party level, and location. Submitting creates the battle and lands on its detail page — a skeleton that shows metadata and a placeholder for S-02's generation form. All `/battles/*` routes are auth-protected.

## Key Decisions Made

| Decision                  | Choice                                                    | Why (1 sentence)                                                                          |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Battle list location      | Dashboard becomes the battle list                         | GM lands directly on their battles after sign-in — no extra navigation layer              |
| Create battle form fields | Name (required) + party_level + location (optional)       | Full schema exposed upfront so S-02 can read context without a separate edit step         |
| Post-create destination   | Navigate to /battles/[id]                                 | Provides a clear landing page for S-02 to build on, rather than dropping back to the list |
| Battle list design        | Cards with name, party level, created date                | Surfaces the fields the GM filled in; matches existing glassmorphic card pattern          |
| Battle detail page scope  | Skeleton only — metadata + S-02 placeholder               | Keeps S-01 thin; S-02 fills the generation form in the same page                          |
| Form validation           | Server-side only (redirect with ?error=)                  | Matches existing auth API route pattern exactly; no new React state patterns in S-01      |
| API structure             | POST /api/battles (create) + GET /api/battles (list JSON) | POST follows auth route pattern; GET available for S-02 client-side use                   |
| Campaign not found        | Redirect with error message                               | Simple, matches existing error pattern; unlikely edge case in practice                    |

## Scope

**In scope:**

- `POST /api/battles` — create a battle (campaign lookup, validation, insert, redirect)
- `GET /api/battles` — return battles as JSON (for S-02 future use)
- Dashboard overhaul — battle list + "New Battle" link + `BattleCard.astro`
- `/battles/new.astro` + `CreateBattleForm.tsx` — create form
- `/battles/[id].astro` — skeleton detail page
- Middleware: add `/battles` to `PROTECTED_ROUTES`

**Out of scope:**

- Campaign management UI (auto-created campaign only)
- Client-side form validation
- Battle editing or deletion (S-03)
- Enemy generation form (S-02)
- Pagination on battle list

## Architecture / Approach

Four files modified or created per phase. The create-battle form follows the `signin.astro` + `SignInForm.tsx` pattern exactly — Astro page reads `?error` from URL params, passes to a React island via `client:load`, form POSTs to an API route, API route redirects with `?error=` on failure. Dashboard uses Supabase directly in the Astro frontmatter (idiomatic SSR); no client-side data fetch needed. RLS enforces ownership on the battle detail page — no explicit ownership check in code.

## Phases at a Glance

| Phase                                   | What it delivers                              | Key risk                                                |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| 1. API Layer                            | POST and GET /api/battles                     | Campaign lookup returns null for edge-case new accounts |
| 2. Dashboard Overhaul                   | Battle list + BattleCard on dashboard         | Empty state needs to be usable, not confusing           |
| 3. Create Battle Page & Form            | /battles/new with form, server error display  | party_level string→integer parsing                      |
| 4. Battle Detail Skeleton & Route Guard | /battles/[id] skeleton, /battles/\* protected | RLS null → redirect must not loop                       |

**Prerequisites:** F-01 (data-schema) implemented and migrations applied — the `battles` table and auto-campaign trigger must be live.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- The auto-created campaign trigger (F-01) must have fired before the GM creates their first battle. The risk window is tiny (user must sign up → confirm email → sign in → navigate to New Battle), but the error message handles the edge case gracefully.
- `party_level` and `location` are optional in the schema; the form must handle blank inputs as `null`, not empty strings.

## Success Criteria (Summary)

- GM signs in → sees dashboard with battle list and "New Battle" button
- GM creates a battle with name + party level + location → lands on battle detail skeleton
- Signing out and visiting `/battles/new` redirects to sign-in
