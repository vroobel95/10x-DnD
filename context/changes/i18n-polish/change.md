---
change_id: i18n-polish
title: I18n polish
status: impl_reviewed
created: 2026-06-20
updated: 2026-06-21
archived_at: null
---

## Notes

i18n (S-16) implemented in 3 phases — Paraglide JS v2, cookie-based EN/PL toggle, all UI
strings + API errors translated, AI content generated in the active locale.

### Follow-up issues found during manual testing (out of scope for S-16 — open a separate change)

These are pre-existing app behaviors unrelated to i18n (verified: my changes to the affected
components were text-only). Logged here so they aren't lost:

- **Create Battle form**: clicking "Create Battle" before the `client:load` island hydrates (or
  a fast double-click) resets the name field and shows "battle name is required". Hydration race
  in `CreateBattleForm` (and likely the other auth/campaign forms).
- **Generate Environment button**: needs several clicks before it registers/disables — same
  hydration latency on the `EnvironmentSection` island.
- **AI enemy count**: a prompt like "2 ice wolves" sometimes returns 1 enemy. The base prompt
  says "Return exactly as many enemies as requested"; the model doesn't always comply. Consider
  strengthening the count instruction or post-validating the returned count.
