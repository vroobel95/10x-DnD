---
starter_id: 10x-astro-starter
package_manager: npm
project_name: dnd-5enemy
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

DnD 5enemy is a 3-week, after-hours web app for a solo GM tool — exactly the profile the 10x Astro Starter was designed for. Astro 6 + React 19 handles the UI (enemy cards, battle views), Supabase provides auth (email + password or OAuth, matching the PRD's access control requirement) and a PostgreSQL database for persisting confirmed enemies and battles, and Cloudflare Pages gives edge deployment with minimal ops overhead. TypeScript end-to-end and Zod schemas at boundaries keep the codebase agent-navigable, which matters given the AI generation core. The short timeline and after-hours constraint favor a batteries-included starter over assembling a custom stack — Supabase auth and database are pre-wired, so the first working deploy can happen in hours, not days.
