<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-03: Edit and Remove Confirmed Enemies

- **Plan**: context/changes/enemy-post-confirm-management/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  2 warnings  4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Note: `npm run check` script is absent from package.json; TypeScript verified via `npx tsc --noEmit` — passes clean. Lint passes.

## Findings

### F1 — PATCH conflates DB error with not-found

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/enemies/[id].ts:45-47, 60-62
- **Detail**: Both PATCH branches check `if (result.error || !result.data)` and return 404 "Enemy not found" for either case. If Supabase has a real DB error (network failure, schema violation), clients get a misleading 404 instead of a 500. The DELETE handler (lines 80-82) correctly separates these two cases — that pattern should be applied to PATCH as well.
- **Fix**: Split the condition: `if (result.error)` → 500 "Could not update enemy. Please try again." and `if (!result.data)` → 404 "Enemy not found". Apply to both PATCH branches (lines 45 and 60).
- **Decision**: FIXED + ACCEPTED-AS-RULE: Separate DB errors from not-found cases in Supabase mutation routes

### F2 — No application-layer ownership check in PATCH and DELETE

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/enemies/[id].ts:34-64, 78
- **Detail**: Both PATCH and DELETE verify `user !== null` then fire the Supabase query with only `.eq("id", context.params.id)`. Ownership enforcement is delegated entirely to the RLS policy (enemies → battles → campaigns → auth.uid()). RLS does correctly enforce this when the client is built from user cookies/headers. However, `generate.ts` (the sibling route) explicitly calls `getUserCampaign(supabase, user.id)` and joins the resource back through the campaign — a defense-in-depth pattern this route skips. The plan's Current State Analysis explicitly acknowledged this RLS-only approach as the existing design.
- **Fix A ⭐ Recommended**: Accept the current design; add an inline comment documenting that ownership is enforced by RLS and citing the policy.
  - Strength: No code change — plan explicitly endorsed this model; RLS is enforced via the user's JWT forwarded in createClient.
  - Tradeoff: Future maintainer who changes createClient (e.g. service role key) will bypass ownership silently.
  - Confidence: HIGH — RLS is currently active and correctly wired.
  - Blind spot: If createClient is ever refactored to use the service role key for these routes, the defense disappears with no guard.
- **Fix B**: Add explicit ownership check matching generate.ts pattern.
  - Strength: Eliminates single point of failure (RLS config). Consistent with project pattern across all mutation routes.
  - Tradeoff: Adds a DB round-trip per mutation; minor complexity.
  - Confidence: MED — getUserCampaign may need adapting for the enemies table join.
  - Blind spot: Need to verify getUserCampaign is importable in [id].ts without circular dependency.
- **Decision**: FIXED via Fix A

### F3 — EnemyEditForm extracted vs. plan's useEffect approach

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/battles/EnemyCard.tsx:49-235
- **Detail**: Plan change 3.2 specified useState<EnemyStats|null>(null) + useEffect keyed on isEditing inside EnemyCard. The implementation instead extracted a standalone EnemyEditForm component (lines 49–235) that owns its own useState<EnemyStats>(initialStats). Behavior is equivalent; extracted component is cleaner and more idiomatic React. This is structural drift, not a bug.
- **Fix**: Update the plan to reflect the extracted-component approach as an addendum.
- **Decision**: FIXED

### F4 — handleEditStart/onEditStart not listed in plan

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/battles/EnemiesSection.tsx:111-113, src/components/battles/EnemyCard.tsx:9
- **Detail**: Plan change 2.5 lists five props to pass to confirmed EnemyCard but omits onEditStart/handleEditStart. The Edit button in the read-only footer needs to call setEditingId — so the prop is functionally required. This is a plan gap filled correctly. No bug.
- **Fix**: Acknowledge in the plan as a discovered addition.
- **Decision**: FIXED

### F5 — editingId not cleared on save failure

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/battles/EnemiesSection.tsx:95-96, 104-105
- **Detail**: On a failed save, setActionError fires but setEditingId is not called. Edit form stays open while error banner appears at section level. Matches the existing handleConfirm/handleDeny pattern — internally consistent.
- **Fix**: No change required — consistent with project pattern. Could be improved in a future UX pass.
- **Decision**: SKIPPED

### F6 — removingId not cleared on delete failure

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/battles/EnemiesSection.tsx:131-134
- **Detail**: On DELETE failure, the inline "Confirm remove? Yes / Cancel" stays live alongside the section-level error banner. User can still click Cancel to dismiss. Consistent with the project's established error-handling pattern.
- **Fix**: No change required — same rationale as F5.
- **Decision**: SKIPPED
