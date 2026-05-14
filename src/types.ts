export interface IngestPayload {
  schema_version: "fams.v1";
  indicator_version: string;
  exchange: string;
  symbol: string;
  timeframe: string;
  bar_time_utc: string;
  trigger_time_utc: string;
  close: number;

  fams_scenario_code: number;
  fams_raw_scenario_code: number;
  fams_gate_reason_code: number;
  fams_secondary_gate_reason_code: number;

  fams_bar_confirmed: number;
  fams_no_trade_gate: number;
  fams_market_type: number;
  fams_trend_state: number;
  fams_htf_trend_state: number;
  fams_rvol: number;
  fams_extension_score: number;
  fams_weak_participation: number;
  fams_htf_conflict: number;
  fams_clean_interaction: number;
  fams_breakout_accepted: number;
  fams_breakout_failure: number;

  body_secret?: string;
}

export interface LatestStateRow extends IngestPayload {
  idempotency_hash: string;
  received_at_utc: string;
}

export type OperatingState =
  | "FINAL_SCENARIO_ACTIVE"
  | "RAW_SETUP_FORMING"
  | "STRUCTURAL_READY_WATCH"
  | "NO_TRADE_STILL"
  | "STALE_DATA";
