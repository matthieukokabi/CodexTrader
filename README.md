# FAMS Dashboard v1

Isolated, read-only dashboard for TradingView FAMS webhook ingestion.

## Scope
- Receives TradingView webhooks
- Persists events to SQLite
- Exposes read-only state API and dashboard
- No broker/execution/trading automation

## Local run
1. Copy `.env.example` to `.env` and set values.
2. `npm install`
3. `npm run build`
4. `node dist/index.js`

## Routes
- `POST /api/webhook/tradingview/fams/:ingestKey`
- `GET /api/state`
- `GET /dashboard`
- `GET /healthz`
