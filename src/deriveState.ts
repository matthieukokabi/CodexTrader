import {
  buildExpectedPairKey,
  isExpectedSymbolNorm,
  isExpectedTimeframe,
  normalizeSymbolNormForMatch,
  normalizeTimeframeForMatch
} from "./config/whitelist.js";
import type {
  ConfidenceBucket,
  Direction,
  LatestStateRow,
  OperatingState,
  Readiness,
  TradeBadge
} from "./types.js";

const STATE_PRIORITY: Record<OperatingState, number> = {
  FINAL_SCENARIO_ACTIVE: 1,
  RAW_SETUP_FORMING: 2,
  STRUCTURAL_READY_WATCH: 3,
  NO_TRADE_STILL: 4,
  STALE_DATA: 5
};

const CONFIDENCE_BASE: Record<OperatingState, number> = {
  FINAL_SCENARIO_ACTIVE: 60,
  RAW_SETUP_FORMING: 45,
  STRUCTURAL_READY_WATCH: 35,
  NO_TRADE_STILL: 20,
  STALE_DATA: 10
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function canonicalizeTimeframe(timeframe: string): string {
  return normalizeTimeframeForMatch(timeframe);
}

function parseTimeframeToMinutes(timeframe: string): number | null {
  const tf = canonicalizeTimeframe(timeframe);
  if (tf === "15") return 15;
  if (tf === "60") return 60;
  if (tf === "240") return 240;
  if (tf === "1D") return 1440;
  if (/^\d+$/.test(tf)) return Number(tf);
  if (/^\d+M$/.test(tf)) return Number(tf.slice(0, -1));
  if (/^\d+H$/.test(tf)) return Number(tf.slice(0, -1)) * 60;
  if (tf === "1W") return 10080;
  return null;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function staleThresholdMs(timeframe: string, now: Date): number {
  const tf = canonicalizeTimeframe(timeframe);
  if (tf === "15") return 45 * 60 * 1000;
  if (tf === "60") return 135 * 60 * 1000;
  if (tf === "240") return 540 * 60 * 1000;
  if (tf === "1D") {
    return (isWeekend(now) ? 4320 : 2160) * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function canonicalizeSymbolNorm(exchange: string, symbol: string): string {
  const rawSymbol = symbol.trim();
  if (rawSymbol.includes(":")) {
    const [rawExchange, ...rawRest] = rawSymbol.split(":");
    const exchangePart = normalizeToken(rawExchange).toUpperCase();
    const tickerPart = rawRest.join(":").trim();
    return tickerPart ? `${exchangePart}:${tickerPart}` : exchangePart;
  }

  const exchangePart = normalizeToken(exchange);
  if (exchangePart) {
    return `${exchangePart.toUpperCase()}:${rawSymbol}`;
  }

  return rawSymbol;
}

export function deriveDirectionFromRow(row: LatestStateRow): Direction {
  if (row.fams_market_type === 4) return "UNKNOWN";
  if ([1, 2].includes(row.fams_raw_scenario_code) || [1, 2].includes(row.fams_scenario_code)) {
    return "LONG";
  }
  if (row.fams_raw_scenario_code === 3 || row.fams_scenario_code === 3) {
    return "SHORT";
  }
  return "UNKNOWN";
}

function deriveOperatingStateFromRow(row: LatestStateRow, stale: boolean): OperatingState {
  if (stale) {
    return "STALE_DATA";
  }

  if ([1, 2, 3].includes(row.fams_scenario_code)) {
    return "FINAL_SCENARIO_ACTIVE";
  }

  if (
    [1, 2, 3].includes(row.fams_raw_scenario_code) &&
    row.fams_scenario_code === 4 &&
    row.fams_gate_reason_code === 1 &&
    row.fams_secondary_gate_reason_code === 0
  ) {
    return "RAW_SETUP_FORMING";
  }

  if (
    [1, 2, 3].includes(row.fams_raw_scenario_code) &&
    row.fams_scenario_code === 4 &&
    [2, 3, 4, 5].includes(row.fams_secondary_gate_reason_code)
  ) {
    return "STRUCTURAL_READY_WATCH";
  }

  return "NO_TRADE_STILL";
}

function deriveReadiness(operatingState: OperatingState): Readiness {
  if (operatingState === "FINAL_SCENARIO_ACTIVE") return "READY";
  if (operatingState === "RAW_SETUP_FORMING") return "FORMING";
  if (operatingState === "STRUCTURAL_READY_WATCH") return "WATCH";
  if (operatingState === "STALE_DATA") return "STALE";
  return "NO_TRADE";
}

function deriveConfidenceScore(row: LatestStateRow, operatingState: OperatingState): number {
  let score = CONFIDENCE_BASE[operatingState];

  if (row.fams_trend_state === row.fams_htf_trend_state) {
    score += 10;
  }

  if (row.fams_rvol >= 1.5) {
    score += 15;
  } else if (row.fams_rvol >= 1.0) {
    score += 10;
  }

  if (row.fams_htf_conflict) {
    score -= 15;
  }

  if (row.fams_weak_participation) {
    score -= 10;
  }

  if (row.fams_clean_interaction) {
    score += 5;
  }

  return clamp(Math.round(score), 0, 100);
}

function deriveConfidenceBucket(score: number): ConfidenceBucket {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function deriveTradeBadge(
  unknownHygiene: boolean,
  stale: boolean,
  operatingState: OperatingState,
  direction: Direction
): TradeBadge {
  if (unknownHygiene) return "UNKNOWN";
  if (stale) return "STALE";

  if (operatingState === "FINAL_SCENARIO_ACTIVE") {
    if (direction === "LONG") return "LONG READY";
    if (direction === "SHORT") return "SHORT READY";
    return "WATCH";
  }

  if (operatingState === "RAW_SETUP_FORMING" || operatingState === "STRUCTURAL_READY_WATCH") {
    return "WATCH";
  }

  return "NO_TRADE";
}

export interface DerivedState {
  stale: boolean;
  ageMs: number;
  timeframeMinutes: number | null;
  timeframeCanonical: string;
  operatingState: OperatingState;
  statePriority: number;
  direction: Direction;
  readiness: Readiness;
  unknownHygiene: boolean;
  confidenceScore: number;
  confidenceBucket: ConfidenceBucket;
  tradeBadge: TradeBadge;
  symbolNorm: string;
  symbolNormMatch: string;
  collapsedGroupId: string;
  expectedSymbol: boolean;
  expectedTimeframe: boolean;
  expectedPair: boolean;
  missingExpected: boolean;
  expectedPairKey: string;
}

export function deriveState(row: LatestStateRow, now = new Date()): DerivedState {
  const barTime = Date.parse(row.bar_time_utc);
  const ageMs = Number.isNaN(barTime) ? Number.MAX_SAFE_INTEGER : Math.max(0, now.getTime() - barTime);
  const stale = ageMs > staleThresholdMs(row.timeframe, now);
  const operatingState = deriveOperatingStateFromRow(row, stale);
  const direction = deriveDirectionFromRow(row);
  const timeframeCanonical = canonicalizeTimeframe(row.timeframe);
  const timeframeMinutes = parseTimeframeToMinutes(row.timeframe);

  const symbolNorm = canonicalizeSymbolNorm(row.exchange, row.symbol);
  const symbolNormMatch = normalizeSymbolNormForMatch(symbolNorm);
  const expectedSymbol = isExpectedSymbolNorm(symbolNorm);
  const expectedTimeframe = isExpectedTimeframe(timeframeCanonical);
  const expectedPair = expectedSymbol && expectedTimeframe;
  const expectedPairKey = buildExpectedPairKey(symbolNorm, timeframeCanonical);

  const unknownHygiene = !expectedSymbol || row.fams_market_type === 4 || direction === "UNKNOWN";
  const confidenceScore = deriveConfidenceScore(row, operatingState);
  const confidenceBucket = deriveConfidenceBucket(confidenceScore);

  return {
    stale,
    ageMs,
    timeframeMinutes,
    timeframeCanonical,
    operatingState,
    statePriority: STATE_PRIORITY[operatingState],
    direction,
    readiness: deriveReadiness(operatingState),
    unknownHygiene,
    confidenceScore,
    confidenceBucket,
    tradeBadge: deriveTradeBadge(unknownHygiene, stale, operatingState, direction),
    symbolNorm,
    symbolNormMatch,
    collapsedGroupId: symbolNormMatch.replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "UNKNOWN_GROUP",
    expectedSymbol,
    expectedTimeframe,
    expectedPair,
    missingExpected: !expectedPair,
    expectedPairKey
  };
}

interface SortableStateRow {
  operating_state: OperatingState;
  symbol_norm: string;
  timeframe: string;
  timeframe_minutes: number | null;
}

export function sortStateRows<T extends SortableStateRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = STATE_PRIORITY[a.operating_state] ?? 99;
    const pb = STATE_PRIORITY[b.operating_state] ?? 99;
    if (pa !== pb) return pa - pb;

    const symbolCmp = a.symbol_norm.localeCompare(b.symbol_norm, "en", { sensitivity: "base" });
    if (symbolCmp !== 0) return symbolCmp;

    const ta = a.timeframe_minutes ?? Number.MAX_SAFE_INTEGER;
    const tb = b.timeframe_minutes ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;

    return a.timeframe.localeCompare(b.timeframe, "en", { sensitivity: "base" });
  });
}
