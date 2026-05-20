import test from "node:test";
import assert from "node:assert/strict";
import { buildConfluenceRollups } from "../confluence.js";
import type { StateViewRow } from "../types.js";

function mkRow(overrides: Partial<StateViewRow>): StateViewRow {
  return {
    symbol: "NQ1!",
    timeframe: "15",
    timeframe_minutes: 15,
    timeframe_canonical: "15",
    market_type_code: 1,
    market_type: "INDEX_FUTURES",
    final_scenario_code: 4,
    final_scenario: "NO_TRADE_STILL",
    raw_scenario_code: 4,
    raw_scenario: "RAW_NONE",
    operating_state: "NO_TRADE_STILL",
    direction: "UNKNOWN",
    direction_bias: "MIXED",
    readiness: "NO_TRADE",
    gate_reason_code: 0,
    gate_reason: "NONE",
    secondary_gate_reason_code: 0,
    secondary_gate_reason: "NONE",
    trend_state_code: 0,
    trend_state: "MIXED",
    htf_trend_state_code: 0,
    htf_trend_state: "MIXED",
    rvol: 1,
    extension_score: 0.5,
    weak_participation: 0,
    htf_conflict: 0,
    clean_interaction: 1,
    breakout_accepted: 0,
    breakout_failure: 0,
    bar_confirmed: 1,
    no_trade_gate: 0,
    last_price: 100,
    sparkline_points: [0.3, 0.45, 0.5, 0.62, 0.7],
    bar_time_utc: "2026-05-18T10:00:00Z",
    received_at_utc: "2026-05-18T10:00:02Z",
    age_ms: 1000,
    age: "1s",
    stale: false,
    state_priority: 4,
    unknown_hygiene: false,
    confidence_score: 20,
    confidence_bucket: "LOW",
    trade_badge: "NO_TRADE",
    symbol_norm: "CME_MINI_DL:NQ1!",
    collapsed_group_id: "CME_MINI_DL_NQ1",
    expected_symbol: true,
    expected_timeframe: true,
    expected_pair: true,
    missing_expected: false,
    ...overrides
  };
}

test("buildConfluenceRollups selects best long and reports missing timeframe coverage", () => {
  const rows: StateViewRow[] = [
    mkRow({
      symbol_norm: "CME_MINI_DL:NQ1!",
      timeframe: "15",
      timeframe_canonical: "15",
      timeframe_minutes: 15,
      direction: "LONG",
      direction_bias: "LONG",
      trade_badge: "WATCH",
      operating_state: "RAW_SETUP_FORMING",
      state_priority: 2,
      confidence_score: 52,
      confidence_bucket: "MEDIUM",
      trend_state: "BULLISH",
      htf_trend_state: "BULLISH"
    }),
    mkRow({
      symbol_norm: "CME_MINI_DL:NQ1!",
      timeframe: "60",
      timeframe_canonical: "60",
      timeframe_minutes: 60,
      direction: "LONG",
      direction_bias: "LONG",
      trade_badge: "LONG READY",
      operating_state: "FINAL_SCENARIO_ACTIVE",
      state_priority: 1,
      confidence_score: 78,
      confidence_bucket: "HIGH",
      trend_state: "BULLISH",
      htf_trend_state: "BULLISH"
    }),
    mkRow({
      symbol_norm: "CME_MINI_DL:NQ1!",
      timeframe: "240",
      timeframe_canonical: "240",
      timeframe_minutes: 240,
      direction: "LONG",
      direction_bias: "LONG",
      trade_badge: "WATCH",
      operating_state: "STRUCTURAL_READY_WATCH",
      state_priority: 3,
      confidence_score: 48,
      confidence_bucket: "MEDIUM",
      trend_state: "BULLISH",
      htf_trend_state: "BULLISH"
    })
  ];

  const rollups = buildConfluenceRollups(rows);
  assert.equal(rollups.length, 1);

  const nq = rollups[0];
  assert.equal(nq.symbol_norm, "CME_MINI_DL:NQ1!");
  assert.equal(nq.coverage_count, 3);
  assert.deepEqual(nq.missing_timeframes, ["1D"]);
  assert.equal(nq.direction_bias, "LONG");
  assert.equal(nq.best_long?.trade_badge, "LONG READY");
  assert.equal(nq.best_long?.timeframe_canonical, "60");
  assert.equal(nq.best_short, null);
  assert.equal(nq.htf_alignment, "ALIGNED");
  assert.deepEqual(nq.conflict_reasons, ["NONE"]);
  assert.equal(nq.sort_rank, 1);
});

test("buildConfluenceRollups exposes structural conflict reasons", () => {
  const rows: StateViewRow[] = [
    mkRow({
      symbol_norm: "BINANCE:BTCUSDT",
      symbol: "BTCUSDT",
      timeframe: "15",
      timeframe_canonical: "15",
      timeframe_minutes: 15,
      direction: "SHORT",
      direction_bias: "MIXED",
      trade_badge: "WATCH",
      operating_state: "STRUCTURAL_READY_WATCH",
      state_priority: 3,
      confidence_score: 44,
      confidence_bucket: "LOW",
      trend_state: "BEARISH",
      htf_trend_state: "MIXED",
      htf_conflict: 1,
      weak_participation: 1,
      clean_interaction: 0,
      unknown_hygiene: false
    })
  ];

  const rollups = buildConfluenceRollups(rows);
  assert.equal(rollups.length, 1);

  const btc = rollups[0];
  assert.equal(btc.best_short?.trade_badge, "WATCH");
  assert.equal(btc.best_long, null);
  assert.equal(btc.direction_bias, "MIXED");
  assert.equal(btc.htf_alignment, "CONFLICT_OR_MIXED");
  assert.deepEqual(btc.conflict_reasons, ["HTF_CONFLICT", "WEAK_PARTICIPATION", "NO_CLEAN_INTERACTION"]);
  assert.equal(btc.sort_rank, 3);
});

test("buildConfluenceRollups sorts no-candidate symbols by bias long then short then mixed", () => {
  const rows: StateViewRow[] = [
    mkRow({ symbol_norm: "A", symbol: "A", direction: "UNKNOWN", direction_bias: "SHORT" }),
    mkRow({ symbol_norm: "B", symbol: "B", direction: "UNKNOWN", direction_bias: "MIXED" }),
    mkRow({ symbol_norm: "C", symbol: "C", direction: "UNKNOWN", direction_bias: "LONG" })
  ];

  const rollups = buildConfluenceRollups(rows);
  assert.equal(rollups.length, 3);
  assert.equal(rollups[0].symbol_norm, "C");
  assert.equal(rollups[0].sort_rank, 5);
  assert.equal(rollups[1].symbol_norm, "A");
  assert.equal(rollups[1].sort_rank, 6);
  assert.equal(rollups[2].symbol_norm, "B");
  assert.equal(rollups[2].sort_rank, 7);
});
