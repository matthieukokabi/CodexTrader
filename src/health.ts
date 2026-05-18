import { EXPECTED_TIMEFRAMES } from "./config/whitelist.js";
import type {
  BoardHealthSummary,
  CandidateStatus,
  ConfluenceCandidate,
  ConfluenceRollup,
  HealthBlocker,
  SymbolChecklistItem
} from "./types.js";

interface HealthBuildResult {
  summary: BoardHealthSummary;
  checklist: SymbolChecklistItem[];
}

function gatherBlockers(candidate: ConfluenceCandidate | null): Set<HealthBlocker> {
  const blockers = new Set<HealthBlocker>();
  if (!candidate) return blockers;

  if (candidate.htf_conflict === 1) blockers.add("HTF_CONFLICT");
  if (candidate.weak_participation === 1) blockers.add("WEAK_PARTICIPATION");
  if (candidate.clean_interaction === 0) blockers.add("NO_CLEAN_INTERACTION");
  if (candidate.secondary_gate_reason === "EXTENDED_AND_WEAK_PARTICIPATION") {
    blockers.add("EXTENDED_AND_WEAK_PARTICIPATION");
  }

  return blockers;
}

function deriveCandidateStatus(rollup: ConfluenceRollup): CandidateStatus {
  if (rollup.best_long || rollup.best_short) return "BEST";
  if (rollup.unknown_hygiene) return "UNKNOWN";
  if (rollup.missing_timeframes.length > 0) return "MISSING";
  return "EMPTY";
}

function statusRank(status: CandidateStatus): number {
  if (status === "UNKNOWN") return 1;
  if (status === "MISSING") return 2;
  if (status === "EMPTY") return 3;
  return 4;
}

export function buildBoardHealth(
  rollups: ConfluenceRollup[],
  expectedSymbolCount: number,
  expectedTimeframeCount: number,
  observedExpectedPairCount: number
): HealthBuildResult {
  const checklist = rollups.map((rollup) => {
    const blockerSet = new Set<HealthBlocker>();
    gatherBlockers(rollup.best_long).forEach((b) => blockerSet.add(b));
    gatherBlockers(rollup.best_short).forEach((b) => blockerSet.add(b));

    const item: SymbolChecklistItem = {
      symbol_norm: rollup.symbol_norm,
      expected_tf_count: expectedTimeframeCount,
      observed_tf_count: rollup.coverage_count,
      missing_tf_count: rollup.missing_timeframes.length,
      missing_tf_list: rollup.missing_timeframes,
      unknown_hygiene_symbol: rollup.unknown_hygiene,
      candidate_status: deriveCandidateStatus(rollup),
      blockers: Array.from(blockerSet),
      best_long: rollup.best_long,
      best_short: rollup.best_short
    };

    return item;
  });

  checklist.sort((a, b) => {
    if (a.missing_tf_count !== b.missing_tf_count) return b.missing_tf_count - a.missing_tf_count;

    const sa = statusRank(a.candidate_status);
    const sb = statusRank(b.candidate_status);
    if (sa !== sb) return sa - sb;

    return a.symbol_norm.localeCompare(b.symbol_norm, "en", { sensitivity: "base" });
  });

  const expectedSymbolTimeframeCount = expectedSymbolCount * expectedTimeframeCount;
  const missingSymbolTimeframeCount = Math.max(0, expectedSymbolTimeframeCount - observedExpectedPairCount);

  const actionRequired = checklist
    .filter((item) => item.missing_tf_count > 0 || item.candidate_status !== "BEST")
    .slice(0, 5)
    .map((item) => ({
      symbol_norm: item.symbol_norm,
      candidate_status: item.candidate_status,
      missing_tf_count: item.missing_tf_count,
      missing_tf_list: item.missing_tf_list
    }));

  const summary: BoardHealthSummary = {
    expected_symbol_count: expectedSymbolCount,
    expected_timeframe_count: expectedTimeframeCount,
    expected_symbol_timeframe_count: expectedSymbolTimeframeCount,
    observed_symbol_timeframe_count: observedExpectedPairCount,
    missing_symbol_timeframe_count: missingSymbolTimeframeCount,
    unknown_hygiene_symbol_count: checklist.filter((item) => item.unknown_hygiene_symbol).length,
    symbols_with_candidates_count: checklist.filter((item) => item.candidate_status === "BEST").length,
    action_required: actionRequired
  };

  return { summary, checklist };
}

export function expectedTimeframes(): string[] {
  return [...EXPECTED_TIMEFRAMES];
}
