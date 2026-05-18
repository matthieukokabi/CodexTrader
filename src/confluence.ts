import { EXPECTED_TIMEFRAMES } from "./config/whitelist.js";
import type {
  ConfluenceCandidate,
  ConfluenceRollup,
  Direction,
  DirectionBias,
  HtfAlignment,
  OperatingState,
  StateViewRow,
  TradeBadge
} from "./types.js";

interface RankedRow extends StateViewRow {
  __candidate_rank: number;
}

function tradeBadgePriority(badge: TradeBadge): number {
  if (badge === "LONG READY" || badge === "SHORT READY") return 1;
  if (badge === "WATCH") return 2;
  if (badge === "NO_TRADE") return 3;
  if (badge === "STALE") return 4;
  return 5;
}

function statePriority(state: OperatingState): number {
  if (state === "FINAL_SCENARIO_ACTIVE") return 1;
  if (state === "RAW_SETUP_FORMING") return 2;
  if (state === "STRUCTURAL_READY_WATCH") return 3;
  if (state === "NO_TRADE_STILL") return 4;
  return 5;
}

function toCandidate(row: StateViewRow): ConfluenceCandidate {
  return {
    symbol_norm: row.symbol_norm,
    timeframe: row.timeframe,
    timeframe_canonical: row.timeframe_canonical,
    timeframe_minutes: row.timeframe_minutes,
    direction: row.direction,
    direction_bias: row.direction_bias,
    trade_badge: row.trade_badge,
    operating_state: row.operating_state,
    confidence_score: row.confidence_score,
    confidence_bucket: row.confidence_bucket,
    trend_state: row.trend_state,
    htf_trend_state: row.htf_trend_state,
    gate_reason: row.gate_reason,
    secondary_gate_reason: row.secondary_gate_reason,
    rvol: row.rvol,
    extension_score: row.extension_score,
    weak_participation: row.weak_participation,
    htf_conflict: row.htf_conflict,
    clean_interaction: row.clean_interaction
  };
}

function pickBest(rows: StateViewRow[]): ConfluenceCandidate | null {
  if (rows.length === 0) return null;

  const ranked: RankedRow[] = rows.map((row) => ({
    ...row,
    __candidate_rank: tradeBadgePriority(row.trade_badge)
  }));

  ranked.sort((a, b) => {
    if (a.__candidate_rank !== b.__candidate_rank) return a.__candidate_rank - b.__candidate_rank;

    const sa = statePriority(a.operating_state);
    const sb = statePriority(b.operating_state);
    if (sa !== sb) return sa - sb;

    if (a.confidence_score !== b.confidence_score) return b.confidence_score - a.confidence_score;

    const ta = a.timeframe_minutes ?? Number.MAX_SAFE_INTEGER;
    const tb = b.timeframe_minutes ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;

    return a.timeframe_canonical.localeCompare(b.timeframe_canonical, "en", { sensitivity: "base" });
  });

  return toCandidate(ranked[0]);
}

function deriveHtfAlignment(candidate: ConfluenceCandidate | null): HtfAlignment {
  if (!candidate) return "NO_CANDIDATE";
  return candidate.trend_state === candidate.htf_trend_state ? "ALIGNED" : "CONFLICT_OR_MIXED";
}

function deriveConflictReasons(candidate: ConfluenceCandidate | null, alignment: HtfAlignment): string[] {
  if (!candidate) return ["NO_CANDIDATE"];

  const reasons: string[] = [];
  if (candidate.htf_conflict === 1) reasons.push("HTF_CONFLICT");
  if (candidate.weak_participation === 1) reasons.push("WEAK_PARTICIPATION");
  if (candidate.clean_interaction === 0) reasons.push("NO_CLEAN_INTERACTION");

  if (reasons.length === 0 && alignment === "CONFLICT_OR_MIXED") {
    reasons.push("TREND_MIXED");
  }

  if (reasons.length === 0) {
    reasons.push("NONE");
  }

  return reasons;
}

function deriveRollupBias(rows: StateViewRow[]): DirectionBias {
  const hasLong = rows.some((row) => row.direction_bias === "LONG");
  const hasShort = rows.some((row) => row.direction_bias === "SHORT");

  if (hasLong && !hasShort) return "LONG";
  if (hasShort && !hasLong) return "SHORT";
  return "MIXED";
}

function sortRank(rollup: Omit<ConfluenceRollup, "sort_rank">): number {
  if (rollup.best_long?.trade_badge === "LONG READY") return 1;
  if (rollup.best_short?.trade_badge === "SHORT READY") return 2;

  const watch = rollup.best_long?.trade_badge === "WATCH" || rollup.best_short?.trade_badge === "WATCH";
  if (watch) return 3;

  const stale = rollup.best_long?.trade_badge === "STALE" || rollup.best_short?.trade_badge === "STALE";
  if (stale) return 4;

  if (rollup.direction_bias === "LONG") return 5;
  if (rollup.direction_bias === "SHORT") return 6;
  return 7;
}

function candidateConfidence(candidate: ConfluenceCandidate | null): number {
  return candidate?.confidence_score ?? -1;
}

export function buildConfluenceRollups(rows: StateViewRow[]): ConfluenceRollup[] {
  const bySymbol = new Map<string, StateViewRow[]>();

  rows.forEach((row) => {
    const list = bySymbol.get(row.symbol_norm) || [];
    list.push(row);
    bySymbol.set(row.symbol_norm, list);
  });

  const rollups: ConfluenceRollup[] = Array.from(bySymbol.entries()).map(([symbolNorm, symbolRows]) => {
    const longRows = symbolRows.filter((row) => row.direction === ("LONG" as Direction));
    const shortRows = symbolRows.filter((row) => row.direction === ("SHORT" as Direction));

    const bestLong = pickBest(longRows);
    const bestShort = pickBest(shortRows);

    const drivingCandidate = bestLong ?? bestShort;
    const alignment = deriveHtfAlignment(drivingCandidate);
    const conflictReasons = deriveConflictReasons(drivingCandidate, alignment);

    const tfSet = new Set(symbolRows.map((row) => row.timeframe_canonical));
    const missingTimeframes = EXPECTED_TIMEFRAMES.filter((tf) => !tfSet.has(tf));
    const coverageCount = EXPECTED_TIMEFRAMES.length - missingTimeframes.length;
    const directionBias = deriveRollupBias(symbolRows);

    const base: Omit<ConfluenceRollup, "sort_rank"> = {
      symbol_norm: symbolNorm,
      coverage_count: coverageCount,
      missing_timeframes: missingTimeframes,
      unknown_hygiene: symbolRows.some((row) => row.unknown_hygiene),
      direction_bias: directionBias,
      htf_alignment: alignment,
      conflict_reasons: conflictReasons,
      best_long: bestLong,
      best_short: bestShort
    };

    return {
      ...base,
      sort_rank: sortRank(base)
    };
  });

  return rollups.sort((a, b) => {
    if (a.sort_rank !== b.sort_rank) return a.sort_rank - b.sort_rank;

    const aBest = Math.max(candidateConfidence(a.best_long), candidateConfidence(a.best_short));
    const bBest = Math.max(candidateConfidence(b.best_long), candidateConfidence(b.best_short));
    if (aBest !== bBest) return bBest - aBest;

    return a.symbol_norm.localeCompare(b.symbol_norm, "en", { sensitivity: "base" });
  });
}
