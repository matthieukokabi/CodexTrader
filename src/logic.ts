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

const GATE_REASON_SHORT_MAP: Record<number, string> = {
  0: "NONE",
  1: "BAR",
  2: "HTF",
  3: "EXT+WEAK",
  4: "NO_STRUCT",
  5: "COOLDOWN"
};

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

export function decodeGateReasonShort(code: number): string {
  return GATE_REASON_SHORT_MAP[code] || `UNK_${code}`;
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
