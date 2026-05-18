import test from "node:test";
import assert from "node:assert/strict";
import { buildBoardHealth } from "../health.js";
import type { ConfluenceCandidate, ConfluenceRollup } from "../types.js";

function candidate(partial: Partial<ConfluenceCandidate>): ConfluenceCandidate {
  return {
    symbol_norm: "CME_MINI_DL:NQ1!",
    timeframe: "60",
    timeframe_canonical: "60",
    timeframe_minutes: 60,
    trade_badge: "WATCH",
    operating_state: "RAW_SETUP_FORMING",
    confidence_score: 55,
    confidence_bucket: "MEDIUM",
    trend_state: "BULLISH",
    htf_trend_state: "BULLISH",
    gate_reason: "BAR_UNCONFIRMED",
    secondary_gate_reason: "NONE",
    rvol: 1.1,
    extension_score: 0.9,
    weak_participation: 0,
    htf_conflict: 0,
    clean_interaction: 1,
    ...partial
  };
}

function rollup(partial: Partial<ConfluenceRollup>): ConfluenceRollup {
  return {
    symbol_norm: "CME_MINI_DL:NQ1!",
    coverage_count: 3,
    missing_timeframes: ["1D"],
    unknown_hygiene: false,
    htf_alignment: "ALIGNED",
    conflict_reasons: ["NONE"],
    best_long: null,
    best_short: null,
    sort_rank: 5,
    ...partial
  };
}

test("buildBoardHealth derives candidate status and blockers", () => {
  const data: ConfluenceRollup[] = [
    rollup({
      symbol_norm: "CME_MINI_DL:NQ1!",
      best_long: candidate({
        trade_badge: "LONG READY",
        operating_state: "FINAL_SCENARIO_ACTIVE",
        confidence_score: 78,
        confidence_bucket: "HIGH"
      }),
      missing_timeframes: ["1D"],
      coverage_count: 3,
      unknown_hygiene: false
    }),
    rollup({
      symbol_norm: "BINANCE:BTCUSDT",
      best_short: candidate({
        symbol_norm: "BINANCE:BTCUSDT",
        trade_badge: "WATCH",
        secondary_gate_reason: "EXTENDED_AND_WEAK_PARTICIPATION",
        htf_conflict: 1,
        weak_participation: 1,
        clean_interaction: 0,
        trend_state: "BEARISH",
        htf_trend_state: "MIXED"
      }),
      missing_timeframes: [],
      coverage_count: 4,
      unknown_hygiene: true
    }),
    rollup({
      symbol_norm: "TVC:UKOIL",
      missing_timeframes: ["15", "60", "240", "1D"],
      coverage_count: 0,
      unknown_hygiene: false,
      best_long: null,
      best_short: null
    })
  ];

  const out = buildBoardHealth(data, 3, 4, 7);

  const nq = out.checklist.find((x) => x.symbol_norm === "CME_MINI_DL:NQ1!");
  const btc = out.checklist.find((x) => x.symbol_norm === "BINANCE:BTCUSDT");
  const ukoil = out.checklist.find((x) => x.symbol_norm === "TVC:UKOIL");

  assert.equal(nq?.candidate_status, "BEST");
  assert.deepEqual(nq?.blockers, []);

  assert.equal(btc?.candidate_status, "BEST");
  assert.deepEqual(btc?.blockers.sort(), [
    "EXTENDED_AND_WEAK_PARTICIPATION",
    "HTF_CONFLICT",
    "NO_CLEAN_INTERACTION",
    "WEAK_PARTICIPATION"
  ]);

  assert.equal(ukoil?.candidate_status, "MISSING");
  assert.equal(ukoil?.missing_tf_count, 4);
});

test("buildBoardHealth summary counts and action required", () => {
  const data: ConfluenceRollup[] = [
    rollup({ symbol_norm: "A", coverage_count: 4, missing_timeframes: [], unknown_hygiene: false, best_long: candidate({}) }),
    rollup({ symbol_norm: "B", coverage_count: 1, missing_timeframes: ["60", "240", "1D"], unknown_hygiene: true }),
    rollup({ symbol_norm: "C", coverage_count: 2, missing_timeframes: ["240", "1D"], unknown_hygiene: false }),
    rollup({ symbol_norm: "D", coverage_count: 0, missing_timeframes: ["15", "60", "240", "1D"], unknown_hygiene: false })
  ];

  const out = buildBoardHealth(data, 4, 4, 7);

  assert.equal(out.summary.expected_symbol_timeframe_count, 16);
  assert.equal(out.summary.observed_symbol_timeframe_count, 7);
  assert.equal(out.summary.missing_symbol_timeframe_count, 9);
  assert.equal(out.summary.unknown_hygiene_symbol_count, 1);
  assert.equal(out.summary.symbols_with_candidates_count, 1);
  assert.equal(out.summary.action_required.length, 3);
  assert.equal(out.summary.action_required[0]?.symbol_norm, "D");
});
