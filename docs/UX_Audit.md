# FAMS Trade Readiness Board UX Audit

Date: 2026-05-20
Repository: `matthieukokabi/CodexTrader` (`main`)

## Scope
This audit reviewed the current dashboard implementation and runtime behavior for:
- Local dev at `http://127.0.0.1:5900/dashboard`
- Production at `https://fams.agents4agents.tech/dashboard`

The focus is trader clarity, actionability, and reliability while preserving API compatibility for:
- `/api/state`
- `/api/confluence.json`
- `/api/health.json`

## Runtime Verification Summary
- Local codebase is up to date and validated (`npm run validate` passes).
- Local dashboard currently runs with an empty local DB in dev mode (`/api/state` row count `0`).
- Production dashboard has live data (`33` rows), all currently `trade_badge=UNKNOWN`.
- Production UI is now on v3.7 parity with local `main` (Top 5 strip, header-click sorting, blocker histogram, smarter first-load defaults, and row-level `why blocked` diagnostics visible).

## Key Findings

### What is working well
- Signal framework is visible: Actionability Snapshot, Trade Radar, Field Guide, Board Health, checklist.
- Filters and view toggles are present and keyboard-focusable.
- Confidence and bias are exposed in rows and confluence cards.
- No-result state handling exists and is directionally useful.

### Current friction points
1. **Actionability remains visually diluted in all-UNKNOWN sessions**
   - When no ready/watch setups exist, users still scan multiple modules to understand “why nothing is tradable.”
2. **Production/local UX mismatch**
   - Prod users do not yet see the newest clarity improvements currently on `main`.
3. **Sorting is available but not column-driven**
   - Sort mode exists, but users can’t sort directly by clicking key table headers.
4. **Blocker diagnosis is still split across multiple widgets**
   - Snapshot, empty-state, checklist, and row details each carry part of the story.
5. **Data hygiene and missing coverage are still cognitively heavy**
   - Even with warnings, users need a tighter prioritization of missing/unknown root causes.

---

## Immediate Enhancements (short-term)

1. **Pinned “Top 5 Candidates Now” strip (above snapshot)**
   - Always show up to 5 rows ranked by: readiness priority -> confidence -> freshness.
   - If none are actionable, show “Closest to actionable” with top blockers.

2. **Blocker histogram in Actionability Snapshot**
   - Add compact visual distribution of blocker reasons (counts + percentage).
   - Keep it text-first for accessibility (no chart library required).

3. **Smart default filter mode with user override preserved**
   - Default order:
     1) `Ready` if ready rows exist
     2) `Actionable` if watch/forming rows exist
     3) `Clean Only` if clean rows exist
     4) fallback `All`
   - Persist manual overrides in `localStorage` (already used) and only apply smart default on first load/no saved preference.

4. **Production deploy parity step**
   - Deploy latest `main` UX to production so users see current refinements.

5. **Table usability: header sort affordances**
   - Add clickable sort indicators on `symbol`, `confidence`, `age`, `pipeline state`.

## Medium-term Improvements

1. **Unified “Why blocked” model layer for UI reuse**
   - Precompute a concise `blocked_summary` and `blocked_flags[]` once in derivation/output mapping.
   - Reuse in snapshot, table row details, and confluence cards.

2. **Confidence clarity upgrade**
   - Add a compact confidence bar (0-100) beside bucket text.
   - Keep text and ARIA labels as primary source for accessibility.

3. **Next-update ETA by timeframe group**
   - Add simple ETA hints (e.g., “next 15m close in Xm”) in snapshot using current wall clock + TF cadence.

4. **Checklist prioritization by operational risk**
   - Rank unknown/missing symbols by impact: missing TF count + stale age + expected symbol criticality.

## Nice-to-have Ideas

1. **Query-parameter shareable views**
   - Mirror current filter/view/sort/search into URL params for easy sharing.

2. **Compact mode toggle**
   - Reduce column density for traders who prefer radar/checklist-first workflows.

3. **Lightweight sparkline for confidence trend**
   - Per symbol/timeframe confidence drift over recent events (if event history is available).

4. **Keyboard command palette**
   - Quick filter switching (`Ready`, `Actionable`, `Unknown`, `Stale`) with shortcuts.

---

## Accessibility and Labeling Recommendations
- Keep explicit labels already in use (`scenario dir`, `trend bias`, `pipeline state`, `blocker`).
- Add short tooltip text for:
  - `confidence score`
  - `rvol`
  - `extension`
  - `clean interaction`
- Ensure active filter/view buttons include `aria-pressed` and visible focus ring.
- Preserve semantic table headers and details/summary keyboard behavior.

## Backward Compatibility Statement
All recommendations are UI/derivation presentation-level and do **not** require breaking API contracts. Existing endpoint structures can remain unchanged, with only additive derived fields if needed.

## Suggested Execution Order
1. Deploy latest local UX changes to production for parity.
2. Implement Top 5 candidate strip + blocker histogram.
3. Add smart default filter logic and header-click sorting.
4. Consolidate blocker summaries across widgets.
5. Iterate confidence/ETA enhancements.

## Deployment and Environment Config (2026-05-20)

- Runtime env is now centralized in [src/config/env.ts](/Users/magikmad/Documents/Codex/2026-05-10/codex-tradingview-mcp-feasibility-audit-for/CodexTrader/src/config/env.ts).
- `NODE_ENV=production` behavior:
  - requires `FAMS_INGEST_KEY`
  - defaults to `FAMS_PORT=4890`
  - defaults to `FAMS_DB_PATH=/var/lib/fams-dashboard/fams.db`
- `NODE_ENV=development` behavior:
  - defaults to ingest key `dev-local-key` if not set
  - defaults to `FAMS_PORT=5900`
  - defaults to `FAMS_DB_PATH=./fams-local.db`

Production deploy command:

```bash
npm run deploy:prod
```

This runs `npm run build` and then restarts `fams-dashboard.service` via systemd:

```bash
sudo systemctl restart fams-dashboard.service
```

If running from a non-systemd/macOS environment, run deploy on the VPS host where the service exists.
