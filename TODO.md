# TODO

- [x] Scaffold isolated FAMS dashboard repo.
- [x] Implement webhook ingest, validation, SQLite persistence, state derivation, and dashboard.
- [x] Add local build/test validation and systemd/env templates.
- [x] Upgrade dashboard to Trade Readiness Board UI with derived direction/readiness, filters, and symbol hygiene warnings.
- [x] Upgrade board v2 with confidence scoring, trade badge, symbol search, collapsed view, and CSV export.
- [x] Ship Cleanliness v2.1: whitelist enforcement, canonical symbol normalization, missing expected matrix, weekend 1D stale override, and safe maintenance cleanup script.
- [x] Ship Confluence v3: symbol confluence cards, multi-timeframe best long/short rollups, and /api/confluence.json endpoint.
- [x] Ship health widget + per-symbol trade checklist with /api/health.json rollups and blockers.
- [x] Ship Bias v3.1: trend-based direction_bias field, bias filters/badges, and bias-aware fallback sorting without changing scenario direction.
- [x] Enhance dashboard UX v3.2: trade radar, field guide, readiness/confidence filters, and sort controls for faster decision scanning.
- [x] Enhance dashboard UX v3.3: actionability snapshot, signal-first defaults, cleaner labels, and actionable/clean-only filters with persisted UI preferences.
- [x] Enhance dashboard UX v3.4: empty-state blocker diagnostics, sticky key columns, distinct unknown badges, and live auto-refresh countdown.
- [x] Enhance dashboard UX v3.5: trader-language state labels, no-ready diagnostic banner, filter count chips, and collapsed hygiene warning panel.
- [x] Enhance dashboard UX v3.6: per-row "why blocked" expandable diagnostics in flat view for gate/participation clarity.
- [ ] Configure nginx + TLS + public subdomain (manual next step).
- [ ] Create TradingView alerts and webhook wiring (manual next step).
