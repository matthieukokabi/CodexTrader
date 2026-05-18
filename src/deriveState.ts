import type { Direction, LatestStateRow, OperatingState, Readiness } from "./types.js";

const STATE_PRIORITY: Record<OperatingState, number> = {
  FINAL_SCENARIO_ACTIVE: 1,
  RAW_SETUP_FORMING: 2,
  STRUCTURAL_READY_WATCH: 3,
  NO_TRADE_STILL: 4,
  STALE_DATA: 5
};

function parseTimeframeToMinutes(timeframe: string): number | null {
  const tf = timeframe.trim().toUpperCase();
  if (/^\d+$/.test(tf)) return Number(tf);
  if (/^\d+M$/.test(tf)) return Number(tf.slice(0, -1));
  if (/^\d+H$/.test(tf)) return Number(tf.slice(0, -1)) * 60;
  if (tf === "D" || tf === "1D") return 1440;
  if (tf === "W" || tf === "1W") return 10080;
  return null;
}

function staleThresholdMs(timeframe: string): number {
  const minutes = parseTimeframeToMinutes(timeframe);
  if (minutes === 15) return 45 * 60 * 1000;
  if (minutes === 60) return 135 * 60 * 1000;
  if (minutes === 240) return 540 * 60 * 1000;
  if (minutes === 1440) return 2160 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function deriveDirection(row: LatestStateRow): Direction {
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

export interface DerivedState {
  stale: boolean;
  ageMs: number;
  timeframeMinutes: number | null;
  operatingState: OperatingState;
  statePriority: number;
  direction: Direction;
  readiness: Readiness;
  unknownHygiene: boolean;
}

export function deriveState(row: LatestStateRow, now = new Date()): DerivedState {
  const barTime = Date.parse(row.bar_time_utc);
  const ageMs = Number.isNaN(barTime) ? Number.MAX_SAFE_INTEGER : Math.max(0, now.getTime() - barTime);
  const stale = ageMs > staleThresholdMs(row.timeframe);
  const operatingState = deriveOperatingStateFromRow(row, stale);
  const direction = deriveDirection(row);
  const timeframeMinutes = parseTimeframeToMinutes(row.timeframe);
  return {
    stale,
    ageMs,
    timeframeMinutes,
    operatingState,
    statePriority: STATE_PRIORITY[operatingState],
    direction,
    readiness: deriveReadiness(operatingState),
    unknownHygiene: row.fams_market_type === 4 || direction === "UNKNOWN"
  };
}

interface SortableStateRow {
  operating_state: OperatingState;
  symbol: string;
  timeframe: string;
  timeframe_minutes: number | null;
}

export function sortStateRows<T extends SortableStateRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = STATE_PRIORITY[a.operating_state] ?? 99;
    const pb = STATE_PRIORITY[b.operating_state] ?? 99;
    if (pa !== pb) return pa - pb;

    const symbolCmp = a.symbol.localeCompare(b.symbol, "en", { sensitivity: "base" });
    if (symbolCmp !== 0) return symbolCmp;

    const ta = a.timeframe_minutes ?? Number.MAX_SAFE_INTEGER;
    const tb = b.timeframe_minutes ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;

    return a.timeframe.localeCompare(b.timeframe, "en", { sensitivity: "base" });
  });
}
