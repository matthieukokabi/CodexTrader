import test from "node:test";
import assert from "node:assert/strict";
import { renderDashboard } from "../dashboard.js";
import type {
  BoardHealthSummary,
  ConfluenceRollup,
  MissingExpectedPair,
  StateViewRow,
  SymbolChecklistItem
} from "../types.js";

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
    extension_score: 0,
    weak_participation: 0,
    htf_conflict: 0,
    clean_interaction: 1,
    breakout_accepted: 0,
    breakout_failure: 0,
    bar_confirmed: 1,
    no_trade_gate: 0,
    last_price: 100,
    sparkline_points: [0.5, 0.5, 0.5],
    bar_time_utc: "2026-05-20T05:00:00Z",
    received_at_utc: "2026-05-20T05:00:05Z",
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

function emptyHealth(): BoardHealthSummary {
  return {
    expected_symbol_count: 0,
    expected_timeframe_count: 0,
    expected_symbol_timeframe_count: 0,
    observed_symbol_timeframe_count: 0,
    missing_symbol_timeframe_count: 0,
    unknown_hygiene_symbol_count: 0,
    symbols_with_candidates_count: 0,
    action_required: []
  };
}

test("renderDashboard includes sparkline column and inline SVG", () => {
  const rows: StateViewRow[] = [mkRow({ sparkline_points: [0, 0.3, 0.7, 1] })];
  const html = renderDashboard(rows, [] as MissingExpectedPair[], [] as ConfluenceRollup[], emptyHealth(), [] as SymbolChecklistItem[]);

  assert.match(html, /sparkline/i);
  assert.match(html, /class="sparkline-svg"/);
  assert.match(html, /class="sparkline-path"/);
});

test("renderDashboard trend summary reflects up down flat sparkline mix", () => {
  const rows: StateViewRow[] = [
    mkRow({ symbol: "A", symbol_norm: "A", sparkline_points: [0, 0.2, 0.6, 1] }),
    mkRow({ symbol: "B", symbol_norm: "B", sparkline_points: [1, 0.7, 0.3, 0] }),
    mkRow({ symbol: "C", symbol_norm: "C", sparkline_points: [0.5, 0.55, 0.51, 0.5] })
  ];

  const html = renderDashboard(rows, [] as MissingExpectedPair[], [] as ConfluenceRollup[], emptyHealth(), [] as SymbolChecklistItem[]);

  assert.match(html, /Trend Summary \(current filter\)/);
  assert.match(html, /id="trend-up-count">1</);
  assert.match(html, /id="trend-down-count">1</);
  assert.match(html, /id="trend-flat-count">1</);
});
