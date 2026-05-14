import test from "node:test";
import assert from "node:assert/strict";
import { deriveOperatingState } from "../logic.js";
import type { LatestStateRow } from "../types.js";

function baseRow(): LatestStateRow {
  return {
    schema_version: "fams.v1",
    indicator_version: "FAMS v0.3.4 Lite",
    exchange: "CME_DL",
    symbol: "CME_MINI_DL:NQ1!",
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

test("returns FINAL_SCENARIO_ACTIVE for active final scenario", () => {
  const row = baseRow();
  row.fams_scenario_code = 1;
  const out = deriveOperatingState(row, new Date("2026-05-14T10:05:05Z"));
  assert.equal(out.operatingState, "FINAL_SCENARIO_ACTIVE");
});

test("returns RAW_SETUP_FORMING when raw active and blocked only by bar confirmation", () => {
  const row = baseRow();
  row.fams_raw_scenario_code = 2;
  row.fams_scenario_code = 4;
  row.fams_gate_reason_code = 1;
  row.fams_secondary_gate_reason_code = 0;
  const out = deriveOperatingState(row, new Date("2026-05-14T10:10:05Z"));
  assert.equal(out.operatingState, "RAW_SETUP_FORMING");
});

test("returns STRUCTURAL_READY_WATCH when structural blocker exists", () => {
  const row = baseRow();
  row.fams_raw_scenario_code = 1;
  row.fams_secondary_gate_reason_code = 4;
  const out = deriveOperatingState(row, new Date("2026-05-14T10:10:05Z"));
  assert.equal(out.operatingState, "STRUCTURAL_READY_WATCH");
});

test("returns STALE_DATA when age exceeds threshold", () => {
  const row = baseRow();
  const out = deriveOperatingState(row, new Date("2026-05-14T11:00:06Z"));
  assert.equal(out.operatingState, "STALE_DATA");
  assert.equal(out.stale, true);
});
