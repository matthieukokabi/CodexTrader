import express from "express";
import rateLimit from "express-rate-limit";
import { loadConfig } from "./config.js";
import { FamsDb } from "./db.js";
import { parsePayload } from "./validation.js";
import {
  decodeGateReason,
  decodeMarketType,
  decodeRawScenario,
  decodeScenario,
  decodeSecondaryGateReason,
  decodeTrend,
  formatAge
} from "./logic.js";
import { deriveState, sortStateRows } from "./deriveState.js";
import { renderDashboard } from "./dashboard.js";
import type { LatestStateRow, StateViewRow } from "./types.js";

const config = loadConfig();
const db = new FamsDb(config.dbPath);
const app = express();

app.set("trust proxy", false);
app.use(express.json({ limit: "256kb" }));

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

function toStateViewRow(row: LatestStateRow, now: Date): StateViewRow {
  const derived = deriveState(row, now);
  return {
    symbol: row.symbol,
    timeframe: row.timeframe,
    timeframe_minutes: derived.timeframeMinutes,
    market_type_code: row.fams_market_type,
    market_type: decodeMarketType(row.fams_market_type),
    final_scenario_code: row.fams_scenario_code,
    final_scenario: decodeScenario(row.fams_scenario_code),
    raw_scenario_code: row.fams_raw_scenario_code,
    raw_scenario: decodeRawScenario(row.fams_raw_scenario_code),
    operating_state: derived.operatingState,
    direction: derived.direction,
    readiness: derived.readiness,
    gate_reason_code: row.fams_gate_reason_code,
    gate_reason: decodeGateReason(row.fams_gate_reason_code),
    secondary_gate_reason_code: row.fams_secondary_gate_reason_code,
    secondary_gate_reason: decodeSecondaryGateReason(row.fams_secondary_gate_reason_code),
    trend_state_code: row.fams_trend_state,
    trend_state: decodeTrend(row.fams_trend_state),
    htf_trend_state_code: row.fams_htf_trend_state,
    htf_trend_state: decodeTrend(row.fams_htf_trend_state),
    rvol: row.fams_rvol,
    extension_score: row.fams_extension_score,
    weak_participation: row.fams_weak_participation,
    htf_conflict: row.fams_htf_conflict,
    clean_interaction: row.fams_clean_interaction,
    breakout_accepted: row.fams_breakout_accepted,
    breakout_failure: row.fams_breakout_failure,
    bar_confirmed: row.fams_bar_confirmed,
    no_trade_gate: row.fams_no_trade_gate,
    last_price: row.close,
    bar_time_utc: row.bar_time_utc,
    received_at_utc: row.received_at_utc,
    age_ms: derived.ageMs,
    age: formatAge(derived.ageMs),
    stale: derived.stale,
    state_priority: derived.statePriority,
    unknown_hygiene: derived.unknownHygiene
  };
}

function buildStateRows(now = new Date()): StateViewRow[] {
  const mapped = db.getLatestState().map((row) => toStateViewRow(row, now));
  return sortStateRows(mapped);
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "fams-dashboard", ts: new Date().toISOString() });
});

app.post("/api/webhook/tradingview/fams/:ingestKey", webhookLimiter, (req, res) => {
  try {
    if (req.params.ingestKey !== config.ingestKey) {
      return res.status(401).json({ ok: false, error: "unauthorized_ingest_key" });
    }

    const payload = parsePayload(req.body);

    if (config.bodySecret && payload.body_secret !== config.bodySecret) {
      return res.status(401).json({ ok: false, error: "unauthorized_body_secret" });
    }

    const ingestResult = db.ingest(payload);

    return res.status(200).json({
      ok: true,
      inserted: ingestResult.inserted,
      deduplicated: !ingestResult.inserted,
      idempotency_hash: ingestResult.idempotencyHash,
      received_at_utc: ingestResult.receivedAtUtc
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "invalid_payload", detail: error.message });
    }
    const detail = error instanceof Error ? error.message : "unknown_error";
    return res.status(400).json({ ok: false, error: "bad_request", detail });
  }
});

app.get("/api/state", (_req, res) => {
  const now = new Date();
  const rows = buildStateRows(now);
  return res.status(200).json({ ok: true, count: rows.length, rows, generated_at_utc: now.toISOString() });
});

app.get("/dashboard", (_req, res) => {
  const rows = buildStateRows(new Date());
  res.status(200).type("html").send(renderDashboard(rows));
});

const server = app.listen(config.port, config.host, () => {
  console.log(`fams-dashboard listening on http://${config.host}:${config.port}`);
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
