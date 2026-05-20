import test from "node:test";
import assert from "node:assert/strict";
import { deriveState } from "../deriveState.js";
import type { LatestStateRow } from "../types.js";

function baseRow(): LatestStateRow {
  return {
    schema_version: "fams.v1",
    indicator_version: "FAMS v0.3.7 Lite",
    exchange: "CME_MINI_DL",
    symbol: "NQ1!",
    timeframe: "15",
    bar_time_utc: "2026-05-14T10:00:00Z",
    trigger_time_utc: "2026-05-14T10:00:01Z",
    close: 29333.75,
    fams_scenario_code: 4,
    fams_raw_scenario_code: 4,
    fams_gate_reason_code: 0,
    fams_secondary_gate_reason_code: 0,
    fams_bar_confirmed: 1,
    fams_no_trade_gate: 0,
    fams_market_type: 1,
    fams_trend_state: 1,
    fams_htf_trend_state: 1,
    fams_rvol: 1.0,
    fams_extension_score: 0.5,
    fams_weak_participation: 0,
    fams_htf_conflict: 0,
    fams_clean_interaction: 1,
    fams_breakout_accepted: 0,
    fams_breakout_failure: 0,
    idempotency_hash: "abc",
    received_at_utc: "2026-05-14T10:00:05Z"
  };
}

test("returns FINAL_SCENARIO_ACTIVE and LONG READY for active final long scenario", () => {
  const row = baseRow();
  row.fams_scenario_code = 1;
  row.fams_raw_scenario_code = 1;
  const out = deriveState(row, new Date("2026-05-14T10:05:05Z"));

  assert.equal(out.operatingState, "FINAL_SCENARIO_ACTIVE");
  assert.equal(out.readiness, "READY");
  assert.equal(out.direction, "LONG");
  assert.equal(out.tradeBadge, "LONG READY");
  assert.equal(out.unknownHygiene, false);
  assert.equal(out.expectedSymbol, true);
  assert.equal(out.expectedTimeframe, true);
  assert.equal(out.expectedPair, true);
  assert.equal(out.missingExpected, false);
});

test("returns RAW_SETUP_FORMING and WATCH when raw active and blocked only by bar confirmation", () => {
  const row = baseRow();
  row.fams_raw_scenario_code = 2;
  row.fams_scenario_code = 4;
  row.fams_gate_reason_code = 1;
  row.fams_secondary_gate_reason_code = 0;

  const out = deriveState(row, new Date("2026-05-14T10:10:05Z"));

  assert.equal(out.operatingState, "RAW_SETUP_FORMING");
  assert.equal(out.direction, "LONG");
  assert.equal(out.tradeBadge, "WATCH");
});

test("returns STRUCTURAL_READY_WATCH when structural blocker exists", () => {
  const row = baseRow();
  row.fams_raw_scenario_code = 1;
  row.fams_secondary_gate_reason_code = 4;

  const out = deriveState(row, new Date("2026-05-14T10:10:05Z"));

  assert.equal(out.operatingState, "STRUCTURAL_READY_WATCH");
  assert.equal(out.tradeBadge, "WATCH");
});

test("returns STALE_DATA when age exceeds threshold from bar_time_utc", () => {
  const row = baseRow();
  row.fams_raw_scenario_code = 1;

  const out = deriveState(row, new Date("2026-05-14T10:46:01Z"));

  assert.equal(out.operatingState, "STALE_DATA");
  assert.equal(out.stale, true);
  assert.equal(out.tradeBadge, "STALE");
});

test("applies weekend staleness override for 1D timeframe", () => {
  const row = baseRow();
  row.timeframe = "1D";
  row.bar_time_utc = "2026-05-15T00:00:00Z";
  row.fams_scenario_code = 1;
  row.fams_raw_scenario_code = 1;

  const weekendNow = new Date("2026-05-17T16:00:00Z"); // Sunday, +40h
  const weekdayNow = new Date("2026-05-18T16:00:00Z"); // Monday, +64h

  const weekendOut = deriveState(row, weekendNow);
  const weekdayOut = deriveState(row, weekdayNow);

  assert.equal(weekendOut.stale, false);
  assert.equal(weekendOut.operatingState, "FINAL_SCENARIO_ACTIVE");
  assert.equal(weekdayOut.stale, true);
  assert.equal(weekdayOut.operatingState, "STALE_DATA");
});

test("flags unknown hygiene when market type is unknown", () => {
  const row = baseRow();
  row.fams_market_type = 4;

  const out = deriveState(row, new Date("2026-05-14T10:10:05Z"));

  assert.equal(out.direction, "UNKNOWN");
  assert.equal(out.unknownHygiene, true);
  assert.equal(out.tradeBadge, "UNKNOWN");
});

test("flags unknown hygiene when symbol is outside whitelist", () => {
  const row = baseRow();
  row.exchange = "OANDA";
  row.symbol = "EURUSD";
  row.fams_scenario_code = 1;
  row.fams_raw_scenario_code = 1;

  const out = deriveState(row, new Date("2026-05-14T10:10:05Z"));

  assert.equal(out.symbolNorm, "OANDA:EURUSD");
  assert.equal(out.expectedSymbol, false);
  assert.equal(out.unknownHygiene, true);
  assert.equal(out.tradeBadge, "UNKNOWN");
});

test("computes confidence score and bucket with rule stack", () => {
  const row = baseRow();
  row.fams_scenario_code = 1;
  row.fams_raw_scenario_code = 1;
  row.fams_rvol = 1.6;
  row.fams_htf_conflict = 0;
  row.fams_weak_participation = 0;
  row.fams_clean_interaction = 1;
  row.fams_trend_state = 1;
  row.fams_htf_trend_state = 1;

  const out = deriveState(row, new Date("2026-05-14T10:05:05Z"));

  assert.equal(out.confidenceScore, 90);
  assert.equal(out.confidenceBucket, "HIGH");
});

test("normalizes symbol and collapsed group id while preserving ticker case", () => {
  const row = baseRow();
  row.exchange = "CME_MINI_DL";
  row.symbol = "es1!";

  const out = deriveState(row, new Date("2026-05-14T10:05:05Z"));

  assert.equal(out.symbolNorm, "CME_MINI_DL:es1!");
  assert.equal(out.symbolNormMatch, "CME_MINI_DL:ES1!");
  assert.equal(out.collapsedGroupId, "CME_MINI_DL_ES1");
});

test("marks non-canonical timeframe as not expected", () => {
  const row = baseRow();
  row.timeframe = "30";
  row.fams_scenario_code = 1;
  row.fams_raw_scenario_code = 1;

  const out = deriveState(row, new Date("2026-05-14T10:05:05Z"));

  assert.equal(out.timeframeCanonical, "30");
  assert.equal(out.expectedTimeframe, false);
  assert.equal(out.expectedPair, false);
  assert.equal(out.missingExpected, true);
});

test("derives direction bias from trend and htf trend without affecting unknown hygiene rules", () => {
  const row = baseRow();

  row.fams_trend_state = 1;
  row.fams_htf_trend_state = 1;
  let out = deriveState(row, new Date("2026-05-14T10:05:05Z"));
  assert.equal(out.directionBias, "LONG");

  row.fams_trend_state = -1;
  row.fams_htf_trend_state = -1;
  out = deriveState(row, new Date("2026-05-14T10:05:05Z"));
  assert.equal(out.directionBias, "SHORT");

  row.fams_trend_state = 1;
  row.fams_htf_trend_state = -1;
  out = deriveState(row, new Date("2026-05-14T10:05:05Z"));
  assert.equal(out.directionBias, "MIXED");

  // Scenario direction still drives unknown hygiene exactly as before.
  row.fams_raw_scenario_code = 4;
  row.fams_scenario_code = 4;
  out = deriveState(row, new Date("2026-05-14T10:05:05Z"));
  assert.equal(out.direction, "UNKNOWN");
  assert.equal(out.unknownHygiene, true);
});

test("derives normalized sparkline_points from recent close series", () => {
  const row = baseRow();
  const out = deriveState(row, new Date("2026-05-14T10:05:05Z"), [100, 110, 105, 115]);

  assert.equal(out.sparklinePoints.length, 4);
  assert.equal(out.sparklinePoints[0], 0);
  assert.ok(Math.abs((out.sparklinePoints[1] ?? 0) - 0.6666666667) < 1e-6);
  assert.ok(Math.abs((out.sparklinePoints[2] ?? 0) - 0.3333333333) < 1e-6);
  assert.equal(out.sparklinePoints[3], 1);
});

test("derives flat sparkline_points when recent closes are equal", () => {
  const row = baseRow();
  const out = deriveState(row, new Date("2026-05-14T10:05:05Z"), [5, 5, 5, 5]);

  assert.deepEqual(out.sparklinePoints, [0.5, 0.5, 0.5, 0.5]);
});
