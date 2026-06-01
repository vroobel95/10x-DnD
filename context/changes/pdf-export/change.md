---
change_id: pdf-export
status: proposed
created: 2026-06-01
updated: 2026-06-01
roadmap_id: S-07
prd_refs: FR-012
---

# Change: PDF Export

## Outcome

GM can export a battle's confirmed enemy cards as a printable PDF — one card per enemy — suitable for use at the table.

## Notes

- PDF generation in Cloudflare Workers (workerd runtime) is constrained: Puppeteer/Chromium is not available; WASM-based PDF libraries or an external service are the viable options
- **Known viable approaches:**
  1. `@pdf-lib/pdf-lib` or `jsPDF` — pure JS, runs in Workers; produces programmatic PDFs but requires manual layout (no HTML-to-PDF)
  2. External render service (e.g., Browserless, HTML/CSS to PDF API) — sends HTML template, receives PDF bytes; adds a third-party dependency
  3. Cloudflare Browser Rendering (beta) — Puppeteer-compatible within Workers; available as a paid add-on
- **Recommended starting point:** `pdf-lib` for MVP — no external dependency, predictable cost, sufficient for a structured stat-block card layout
- Layout per card: name, CR, HP/AC, ability scores (STR/DEX/CON/INT/WIS/CHA), speed, saving throws, abilities list
- Export scoped to a single battle: "Export PDF" button on the battle detail page (after enemies are confirmed)
- Route: GET `/api/battles/[id]/export.pdf` — streams PDF bytes with `Content-Type: application/pdf` and `Content-Disposition: attachment`
- **Blocker / unknown:** Confirm `pdf-lib` WASM/JS bundle size fits within Workers script size limits and that the workerd runtime has no incompatibility — requires a spike before `/10x-plan`
- Prerequisites: S-02 (confirmed enemies exist), S-03 (enemy editing complete — export after the final state)
