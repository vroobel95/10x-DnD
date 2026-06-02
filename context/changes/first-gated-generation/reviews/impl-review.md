<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-02 First Gated Generation

- **Plan**: context/changes/first-gated-generation/plan.md
- **Scope**: All Phases (1-4)
- **Date**: 2026-05-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Failed confirm/deny operations silently swallowed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/battles/EnemiesSection.tsx:45-68
- **Detail**: When the PATCH (confirm) or DELETE (deny) fetch returns a non-ok response, the error is silently swallowed — the loading state clears and the UI returns to its previous state with no indication of failure. Compare with handleGenerate (line 32-33) which properly checks !res.ok and sets an error message.
- **Fix A ⭐ Recommended**: Add per-action error state
  - Strength: Matches the error-handling pattern already used by handleGenerate in the same component.
  - Tradeoff: Adds an error state variable and error UI to each card section.
  - Confidence: HIGH — the pattern is already proven in this file.
  - Blind spot: None significant.
- **Fix B**: Show a generic toast/alert on failure
  - Strength: Simpler — one alert call, no new state.
  - Tradeoff: Less polished UX; doesn't match the inline error pattern used elsewhere.
  - Confidence: MEDIUM — works but feels inconsistent.
  - Blind spot: No toast system exists in this project yet.
- **Decision**: FIXED via Fix A + ACCEPTED-AS-RULE: Never silently swallow fetch errors in UI action handlers

### F2 — No prompt length limit on generate endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles/[id]/generate.ts:19-28
- **Detail**: The user-supplied prompt is passed directly to the AI model with no length limit. A malicious user could send a very large prompt (megabytes), consuming excessive Anthropic API tokens and potentially causing timeouts on the Cloudflare Worker.
- **Fix**: Add a max-length check after trimming, e.g.: if (prompt.length > 2000) return 400 with "Prompt too long".
- **Decision**: FIXED

### F3 — Hydration directive differs from plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/battles/[id].astro:74
- **Detail**: Plan specifies client:load but implementation uses client:only="react". client:load renders server-side HTML first then hydrates; client:only="react" skips SSR entirely and renders only on the client. The enemies section is blank until JavaScript loads.
- **Fix A ⭐ Recommended**: Switch to client:load as planned
  - Strength: Matches the plan. Faster initial paint — server-rendered HTML shows immediately while JS loads.
  - Tradeoff: Potential hydration mismatch bugs if React state diverges from server-rendered HTML.
  - Confidence: MEDIUM — client:only="react" may have been chosen deliberately.
  - Blind spot: Haven't tested whether client:load causes hydration errors.
- **Fix B**: Keep client:only="react" and document the deviation
  - Strength: Preserves working solution if hydration issues exist.
  - Tradeoff: Plan drift goes undocumented; slower initial paint.
  - Confidence: MEDIUM — depends on whether hydration issues exist.
  - Blind spot: Haven't verified the original reason for the switch.
- **Decision**: FIXED via Fix A

### F4 — Battle page query not scoped by campaign

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/battles/[id].astro:10-11
- **Detail**: The battle query fetches by ID alone without scoping through the user's campaign. The battles index page (index.astro:13-21) and the generate endpoint (generate.ts:36-41) both explicitly check campaign ownership at the application level. While Supabase RLS enforces access control, this page is inconsistent with the established defense-in-depth pattern.
- **Fix**: Add getUserCampaign check and scope the query by campaign_id, matching the pattern in index.astro.
- **Decision**: FIXED

### F5 — Empty API key fallback hides misconfiguration

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai.ts:19
- **Detail**: When ANTHROPIC_API_KEY is undefined, the code passes an empty string (apiKey: ANTHROPIC_API_KEY ?? ''). This produces an opaque Anthropic auth error at request time rather than failing fast with a clear message.
- **Fix**: Add an early guard: if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured').
- **Decision**: FIXED + ACCEPTED-AS-RULE: Fail fast on missing required secrets
