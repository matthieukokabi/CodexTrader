import type { LatestStateRow, OperatingState } from "./types.js";

const SCENARIO_MAP: Record<number, string> = {
  1: "BULLISH_CONTINUATION_ACTIVE",
  2: "BULLISH_PULLBACK_RETEST_ACTIVE",
  3: "WEAKNESS_REVERSAL_WATCH_ACTIVE",
  4: "NO_TRADE_STILL"
};

const RAW_SCENARIO_MAP: Record<number, string> = {
  1: "RAW_BULLISH_CONTINUATION",
  2: "RAW_BULLISH_PULLBACK",
  3: "RAW_WEAKNESS_WATCH",
  4: "RAW_NONE"
};

const MARKET_MAP: Record<number, string> = {
  1: "INDEX_FUTURES",
  2: "MAJOR_CRYPTO",
  3: "HIGH_BETA_ALT",
  4: "UNKNOWN"
};

const TREND_MAP: Record<number, string> = {
  1: "BULLISH",
  0: "MIXED",
  [-1]: "BEARISH"
};

const GATE_REASON_MAP: Record<number, string> = {
  0: "NONE",
  1: "BAR_UNCONFIRMED",
  2: "HTF_CONFLICT",
  3: "EXTENDED_AND_WEAK_PARTICIPATION",
  4: "NO_CLEAN_INTERACTION",
  5: "COOLDOWN_BLOCKED"
};

const SECONDARY_GATE_MAP: Record<number, string> = {
  0: "NONE",
  2: "HTF_CONFLICT",
  3: "EXTENDED_AND_WEAK_PARTICIPATION",
  4: "NO_CLEAN_INTERACTION",
  5: "COOLDOWN_BLOCKED"
};

function timeframeStaleMs(timeframe: string): number {
  const tf = timeframe.toUpperCase();
  if (tf === "15" || tf === "15M") return 45 * 60 * 1000;
  if (tf === "60" || tf === "1H") return 135 * 60 * 1000;
  if (tf === "240" || tf === "4H") return 9 * 60 * 60 * 1000;
  if (tf === "D" || tf === "1D" || tf === "1440") return 36 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

export function deriveOperatingState(row: LatestStateRow, now = new Date()): {
  stale: boolean;
  ageMs: number;
  operatingState: OperatingState;
} {
  const received = Date.parse(row.received_at_utc);
  const ageMs = Number.isNaN(received) ? Number.MAX_SAFE_INTEGER : Math.max(0, now.getTime() - received);
  const stale = ageMs > timeframeStaleMs(row.timeframe);

  if (stale) {
    return { stale, ageMs, operatingState: "STALE_DATA" };
  }

  if ([1, 2, 3].includes(row.fams_scenario_code)) {
    return { stale, ageMs, operatingState: "FINAL_SCENARIO_ACTIVE" };
  }

  if (
    [1, 2, 3].includes(row.fams_raw_scenario_code) &&
    row.fams_scenario_code === 4 &&
    row.fams_gate_reason_code === 1 &&
    row.fams_secondary_gate_reason_code === 0
  ) {
    return { stale, ageMs, operatingState: "RAW_SETUP_FORMING" };
  }

  if (
    [1, 2, 3].includes(row.fams_raw_scenario_code) &&
    row.fams_scenario_code === 4 &&
    [2, 3, 4, 5].includes(row.fams_secondary_gate_reason_code)
  ) {
    return { stale, ageMs, operatingState: "STRUCTURAL_READY_WATCH" };
  }

  return { stale, ageMs, operatingState: "NO_TRADE_STILL" };
}

export function decodeScenario(code: number): string {
  return SCENARIO_MAP[code] || `UNKNOWN_${code}`;
}

export function decodeRawScenario(code: number): string {
  return RAW_SCENARIO_MAP[code] || `UNKNOWN_${code}`;
}

export function decodeMarketType(code: number): string {
  return MARKET_MAP[code] || `UNKNOWN_${code}`;
}

export function decodeTrend(code: number): string {
  return TREND_MAP[code] || `UNKNOWN_${code}`;
}

export function decodeGateReason(code: number): string {
  return GATE_REASON_MAP[code] || `UNKNOWN_${code}`;
}

export function decodeSecondaryGateReason(code: number): string {
  return SECONDARY_GATE_MAP[code] || `UNKNOWN_${code}`;
}

export function formatAge(ageMs: number): string {
  if (!Number.isFinite(ageMs)) return "unknown";
  const seconds = Math.floor(ageMs / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
