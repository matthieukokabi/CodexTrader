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

export type Direction = "LONG" | "SHORT" | "UNKNOWN";

export type DirectionBias = "LONG" | "SHORT" | "MIXED";

export type Readiness = "READY" | "FORMING" | "WATCH" | "NO_TRADE" | "STALE";

export type ConfidenceBucket = "LOW" | "MEDIUM" | "HIGH";

export type TradeBadge = "LONG READY" | "SHORT READY" | "WATCH" | "NO_TRADE" | "STALE" | "UNKNOWN";

export interface StateViewRow {
  symbol: string;
  timeframe: string;
  timeframe_minutes: number | null;
  timeframe_canonical: string;
  market_type_code: number;
  market_type: string;
  final_scenario_code: number;
  final_scenario: string;
  raw_scenario_code: number;
  raw_scenario: string;
  operating_state: OperatingState;
  direction: Direction;
  direction_bias: DirectionBias;
  readiness: Readiness;
  gate_reason_code: number;
  gate_reason: string;
  secondary_gate_reason_code: number;
  secondary_gate_reason: string;
  trend_state_code: number;
  trend_state: string;
  htf_trend_state_code: number;
  htf_trend_state: string;
  rvol: number;
  extension_score: number;
  weak_participation: number;
  htf_conflict: number;
  clean_interaction: number;
  breakout_accepted: number;
  breakout_failure: number;
  bar_confirmed: number;
  no_trade_gate: number;
  last_price: number;
  sparkline_points: number[];
  bar_time_utc: string;
  received_at_utc: string;
  age_ms: number;
  age: string;
  stale: boolean;
  state_priority: number;
  unknown_hygiene: boolean;
  confidence_score: number;
  confidence_bucket: ConfidenceBucket;
  trade_badge: TradeBadge;
  symbol_norm: string;
  collapsed_group_id: string;
  expected_symbol: boolean;
  expected_timeframe: boolean;
  expected_pair: boolean;
  missing_expected: boolean;
}

export interface MissingExpectedPair {
  symbol_norm: string;
  timeframe: string;
  key: string;
}

export type HtfAlignment = "ALIGNED" | "CONFLICT_OR_MIXED" | "NO_CANDIDATE";

export interface ConfluenceCandidate {
  symbol_norm: string;
  timeframe: string;
  timeframe_canonical: string;
  timeframe_minutes: number | null;
  direction: Direction;
  direction_bias: DirectionBias;
  trade_badge: TradeBadge;
  operating_state: OperatingState;
  confidence_score: number;
  confidence_bucket: ConfidenceBucket;
  trend_state: string;
  htf_trend_state: string;
  gate_reason: string;
  secondary_gate_reason: string;
  rvol: number;
  extension_score: number;
  weak_participation: number;
  htf_conflict: number;
  clean_interaction: number;
}

export interface ConfluenceRollup {
  symbol_norm: string;
  coverage_count: number;
  missing_timeframes: string[];
  unknown_hygiene: boolean;
  direction_bias: DirectionBias;
  htf_alignment: HtfAlignment;
  conflict_reasons: string[];
  best_long: ConfluenceCandidate | null;
  best_short: ConfluenceCandidate | null;
  sort_rank: number;
}

export type CandidateStatus = "BEST" | "UNKNOWN" | "MISSING" | "EMPTY";

export type HealthBlocker =
  | "HTF_CONFLICT"
  | "WEAK_PARTICIPATION"
  | "NO_CLEAN_INTERACTION"
  | "EXTENDED_AND_WEAK_PARTICIPATION";

export interface SymbolChecklistItem {
  symbol_norm: string;
  direction_bias: DirectionBias;
  expected_tf_count: number;
  observed_tf_count: number;
  missing_tf_count: number;
  missing_tf_list: string[];
  unknown_hygiene_symbol: boolean;
  candidate_status: CandidateStatus;
  blockers: HealthBlocker[];
  best_long: ConfluenceCandidate | null;
  best_short: ConfluenceCandidate | null;
}

export interface ActionRequiredItem {
  symbol_norm: string;
  candidate_status: CandidateStatus;
  missing_tf_count: number;
  missing_tf_list: string[];
}

export interface BoardHealthSummary {
  expected_symbol_count: number;
  expected_timeframe_count: number;
  expected_symbol_timeframe_count: number;
  observed_symbol_timeframe_count: number;
  missing_symbol_timeframe_count: number;
  unknown_hygiene_symbol_count: number;
  symbols_with_candidates_count: number;
  action_required: ActionRequiredItem[];
}
