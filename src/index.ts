import express from "express";
import rateLimit from "express-rate-limit";
import { loadConfig } from "./config.js";
import {
  buildExpectedPairKey,
  EXPECTED_SYMBOL_NORMS,
  EXPECTED_TIMEFRAMES
} from "./config/whitelist.js";
import { buildConfluenceRollups } from "./confluence.js";
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
import type { ConfluenceRollup, LatestStateRow, MissingExpectedPair, StateViewRow } from "./types.js";

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

const CSV_COLUMNS: Array<keyof StateViewRow> = [
  "symbol",
  "timeframe",
  "timeframe_canonical",
  "timeframe_minutes",
  "symbol_norm",
  "collapsed_group_id",
  "market_type_code",
  "market_type",
  "final_scenario_code",
  "final_scenario",
  "raw_scenario_code",
  "raw_scenario",
  "direction",
  "readiness",
  "trade_badge",
  "confidence_score",
  "confidence_bucket",
  "operating_state",
  "state_priority",
  "gate_reason_code",
  "gate_reason",
  "secondary_gate_reason_code",
  "secondary_gate_reason",
  "trend_state_code",
  "trend_state",
  "htf_trend_state_code",
  "htf_trend_state",
  "rvol",
  "extension_score",
  "weak_participation",
  "htf_conflict",
  "clean_interaction",
  "breakout_accepted",
  "breakout_failure",
  "bar_confirmed",
  "no_trade_gate",
  "expected_symbol",
  "expected_timeframe",
  "expected_pair",
  "missing_expected",
  "last_price",
  "bar_time_utc",
  "received_at_utc",
  "age_ms",
  "age",
  "stale",
  "unknown_hygiene"
];

interface StateBundle {
  rows: StateViewRow[];
  missingExpectedPairs: MissingExpectedPair[];
  expectedPairCount: number;
  observedExpectedPairCount: number;
  confluenceRollups: ConfluenceRollup[];
}

const EXPECTED_MATRIX: MissingExpectedPair[] = EXPECTED_SYMBOL_NORMS.flatMap((symbolNorm) =>
  EXPECTED_TIMEFRAMES.map((timeframe) => ({
    symbol_norm: symbolNorm,
    timeframe,
    key: buildExpectedPairKey(symbolNorm, timeframe)
  }))
);

function toStateViewRow(row: LatestStateRow, now: Date): StateViewRow {
  const derived = deriveState(row, now);
  return {
    symbol: row.symbol,
    timeframe: row.timeframe,
    timeframe_canonical: derived.timeframeCanonical,
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
    expected_symbol: derived.expectedSymbol,
    expected_timeframe: derived.expectedTimeframe,
    expected_pair: derived.expectedPair,
    missing_expected: derived.missingExpected,
    last_price: row.close,
    bar_time_utc: row.bar_time_utc,
    received_at_utc: row.received_at_utc,
    age_ms: derived.ageMs,
    age: formatAge(derived.ageMs),
    stale: derived.stale,
    state_priority: derived.statePriority,
    unknown_hygiene: derived.unknownHygiene,
    confidence_score: derived.confidenceScore,
    confidence_bucket: derived.confidenceBucket,
    trade_badge: derived.tradeBadge,
    symbol_norm: derived.symbolNorm,
    collapsed_group_id: derived.collapsedGroupId
  };
}

function buildStateBundle(now = new Date()): StateBundle {
  const mapped = db.getLatestState().map((row) => toStateViewRow(row, now));
  const rows = sortStateRows(mapped);

  const observedExpectedKeys = new Set(
    rows
      .filter((row) => row.expected_pair)
      .map((row) => buildExpectedPairKey(row.symbol_norm, row.timeframe_canonical))
  );

  const missingExpectedPairs = EXPECTED_MATRIX.filter((pair) => !observedExpectedKeys.has(pair.key));
  const confluenceRollups = buildConfluenceRollups(rows);

  return {
    rows,
    missingExpectedPairs,
    expectedPairCount: EXPECTED_MATRIX.length,
    observedExpectedPairCount: observedExpectedKeys.size,
    confluenceRollups
  };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll("\"", "\"\"")}"`;
  }
  return str;
}

function toCsv(rows: StateViewRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows
    .map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","))
    .join("\n");
  return `${header}\n${body}`;
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
  const bundle = buildStateBundle(now);

  return res.status(200).json({
    ok: true,
    count: bundle.rows.length,
    rows: bundle.rows,
    expected_symbol_norms: EXPECTED_SYMBOL_NORMS,
    expected_timeframes: EXPECTED_TIMEFRAMES,
    expected_pair_count: bundle.expectedPairCount,
    observed_expected_pair_count: bundle.observedExpectedPairCount,
    missing_expected_count: bundle.missingExpectedPairs.length,
    missing_expected: bundle.missingExpectedPairs,
    missing_expected_pairs: bundle.missingExpectedPairs,
    generated_at_utc: now.toISOString()
  });
});

app.get("/api/confluence.json", (_req, res) => {
  const now = new Date();
  const bundle = buildStateBundle(now);

  return res.status(200).json({
    ok: true,
    count: bundle.confluenceRollups.length,
    rows: bundle.confluenceRollups,
    generated_at_utc: now.toISOString()
  });
});

app.get("/api/state.csv", (_req, res) => {
  const bundle = buildStateBundle(new Date());
  const csv = toCsv(bundle.rows);
  res.status(200).type("text/csv; charset=utf-8").send(csv);
});

app.get("/dashboard", (_req, res) => {
  const bundle = buildStateBundle(new Date());
  res
    .status(200)
    .type("html")
    .send(renderDashboard(bundle.rows, bundle.missingExpectedPairs, bundle.confluenceRollups));
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
