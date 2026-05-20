import { decodeGateReasonShort } from "./logic.js";
import type {
  BoardHealthSummary,
  CandidateStatus,
  ConfluenceRollup,
  MissingExpectedPair,
  StateViewRow,
  SymbolChecklistItem
} from "./types.js";

function esc(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stateClass(state: string): string {
  if (state === "FINAL_SCENARIO_ACTIVE") return "badge-green";
  if (state === "RAW_SETUP_FORMING") return "badge-yellow";
  if (state === "STRUCTURAL_READY_WATCH") return "badge-orange";
  if (state === "STALE_DATA") return "badge-red";
  return "badge-gray";
}

function stateLabel(state: string): string {
  if (state === "FINAL_SCENARIO_ACTIVE") return "READY";
  if (state === "RAW_SETUP_FORMING") return "FORMING";
  if (state === "STRUCTURAL_READY_WATCH") return "WATCH";
  if (state === "NO_TRADE_STILL") return "NO TRADE";
  if (state === "STALE_DATA") return "STALE";
  return state;
}

function trendClass(trend: string): string {
  if (trend === "BULLISH") return "badge-green";
  if (trend === "BEARISH") return "badge-red";
  return "badge-gray";
}

function confidenceClass(bucket: string): string {
  if (bucket === "HIGH") return "badge-conf-high";
  if (bucket === "MEDIUM") return "badge-conf-med";
  return "badge-conf-low";
}

function tradeBadgeClass(badge: string): string {
  if (badge === "LONG READY") return "badge-long";
  if (badge === "SHORT READY") return "badge-short";
  if (badge === "WATCH") return "badge-watch";
  if (badge === "STALE") return "badge-stale";
  if (badge === "UNKNOWN") return "badge-unknown";
  return "badge-no-trade";
}

function directionBiasClass(bias: string): string {
  if (bias === "LONG") return "badge-long";
  if (bias === "SHORT") return "badge-short";
  return "badge-gray";
}

function scenarioDirectionClass(direction: string): string {
  if (direction === "LONG") return "badge-long";
  if (direction === "SHORT") return "badge-short";
  if (direction === "MIXED") return "badge-yellow";
  return "badge-unknown";
}

function candidateStatusClass(status: CandidateStatus): string {
  if (status === "BEST") return "badge-green";
  if (status === "UNKNOWN") return "badge-unknown";
  if (status === "MISSING") return "badge-orange";
  return "badge-gray";
}

function rowDomId(row: StateViewRow): string {
  const raw = `${row.symbol_norm}-${row.timeframe_canonical}`.toLowerCase();
  return `row-${raw.replaceAll(/[^a-z0-9_-]+/g, "-").replaceAll(/-+/g, "-").replaceAll(/^-|-$/g, "")}`;
}

function topRowsByBadge(rows: StateViewRow[], tradeBadge: string, limit = 5): StateViewRow[] {
  return rows
    .filter((row) => row.trade_badge === tradeBadge)
    .sort((a, b) => {
      if (a.confidence_score !== b.confidence_score) return b.confidence_score - a.confidence_score;
      if (a.state_priority !== b.state_priority) return a.state_priority - b.state_priority;
      return a.age_ms - b.age_ms;
    })
    .slice(0, limit);
}

function topWatchRows(rows: StateViewRow[], limit = 5): StateViewRow[] {
  return rows
    .filter((row) => row.trade_badge === "WATCH")
    .sort((a, b) => {
      if (a.confidence_score !== b.confidence_score) return b.confidence_score - a.confidence_score;
      if (a.state_priority !== b.state_priority) return a.state_priority - b.state_priority;
      return a.age_ms - b.age_ms;
    })
    .slice(0, limit);
}

function renderRadarList(rows: StateViewRow[]): string {
  if (rows.length === 0) {
    return `<li><span class="badge badge-gray">none</span></li>`;
  }

  return rows
    .map(
      (row) => `<li><strong>${esc(row.symbol_norm)}</strong> <span class="badge badge-navy">${esc(
        row.timeframe_canonical
      )}</span> <span class="badge ${tradeBadgeClass(row.trade_badge)}">${esc(row.trade_badge)}</span> <span class="badge ${scenarioDirectionClass(
        row.direction
      )}">DIR ${esc(row.direction)}</span> <span class="badge ${directionBiasClass(row.direction_bias)}">BIAS ${esc(
        row.direction_bias
      )}</span> <span class="badge ${confidenceClass(row.confidence_bucket)}">${esc(row.confidence_bucket)} ${esc(
        row.confidence_score
      )}</span> <span class="badge badge-gray">gate ${esc(decodeGateReasonShort(row.gate_reason_code))}</span> <span class="badge badge-gray">age ${esc(
        row.age
      )}</span></li>`
    )
    .join("\n");
}

function renderTradeRadar(rows: StateViewRow[]): string {
  const longReady = topRowsByBadge(rows, "LONG READY");
  const shortReady = topRowsByBadge(rows, "SHORT READY");
  const watchList = topWatchRows(rows);
  const highConfidence = rows
    .filter((row) => row.confidence_score >= 70)
    .sort((a, b) => {
      if (a.trade_badge !== b.trade_badge) {
        const rank = (badge: string) =>
          badge === "LONG READY" || badge === "SHORT READY" ? 1 : badge === "WATCH" ? 2 : badge === "NO_TRADE" ? 3 : badge === "STALE" ? 4 : 5;
        return rank(a.trade_badge) - rank(b.trade_badge);
      }
      if (a.confidence_score !== b.confidence_score) return b.confidence_score - a.confidence_score;
      return a.age_ms - b.age_ms;
    })
    .slice(0, 5);

  return `<div class="widget radar">
  <strong>Trade Radar (Top Decision Rows)</strong>
  <div class="widget-grid radar-grid">
    <div>
      <span class="k">Long Ready</span>
      <ol class="radar-list">${renderRadarList(longReady)}</ol>
    </div>
    <div>
      <span class="k">Short Ready</span>
      <ol class="radar-list">${renderRadarList(shortReady)}</ol>
    </div>
    <div>
      <span class="k">Watch (Best Forming/Structural)</span>
      <ol class="radar-list">${renderRadarList(watchList)}</ol>
    </div>
    <div>
      <span class="k">High Confidence (>= 70)</span>
      <ol class="radar-list">${renderRadarList(highConfidence)}</ol>
    </div>
  </div>
</div>`;
}

function renderTopCandidatesStrip(rows: StateViewRow[]): string {
  const tradeRank = (badge: string): number => {
    if (badge === "LONG READY" || badge === "SHORT READY") return 1;
    if (badge === "WATCH") return 2;
    if (badge === "NO_TRADE") return 3;
    if (badge === "STALE") return 4;
    return 5;
  };

  const topCandidates = rows
    .slice()
    .sort((a, b) => {
      const ar = tradeRank(a.trade_badge);
      const br = tradeRank(b.trade_badge);
      if (ar !== br) return ar - br;
      if (a.confidence_score !== b.confidence_score) return b.confidence_score - a.confidence_score;
      return a.age_ms - b.age_ms;
    })
    .slice(0, 5);

  const items =
    topCandidates.length > 0
      ? topCandidates
          .map((row, index) => {
            const rowId = rowDomId(row);
            return `<li class="candidate-item">
  <span class="candidate-rank">#${index + 1}</span>
  <span class="candidate-symbol"><strong>${esc(row.symbol_norm)}</strong></span>
  <span class="badge badge-navy">${esc(row.timeframe_canonical)}</span>
  <span class="badge ${tradeBadgeClass(row.trade_badge)}">${esc(row.trade_badge)}</span>
  <span class="badge ${scenarioDirectionClass(row.direction)}">${esc(row.direction)}</span>
  <span class="badge ${directionBiasClass(row.direction_bias)}">BIAS ${esc(row.direction_bias)}</span>
  <span class="badge ${confidenceClass(row.confidence_bucket)}" title="Confidence score">${esc(row.confidence_score)}</span>
  <button class="candidate-jump" type="button" data-target-id="${esc(rowId)}" aria-label="Jump to ${esc(
              row.symbol_norm
            )} ${esc(row.timeframe_canonical)} row">Jump</button>
</li>`;
          })
          .join("\n")
      : `<li><span class="badge badge-gray">No candidate rows available yet</span></li>`;

  return `<div class="widget top-candidates" aria-label="Top candidate strip">
  <strong>Top 5 candidates now</strong>
  <ol class="candidate-list">${items}</ol>
</div>`;
}

function renderFieldGuide(): string {
  return `<details class="widget legend">
  <summary><strong>Field Guide</strong> - quick meaning of key signals</summary>
  <div class="legend-grid">
    <div><span class="k">Trade</span><span class="v">Final actionability from scenario + hygiene + staleness.</span></div>
    <div><span class="k">DIR</span><span class="v">Scenario-based direction only (LONG/SHORT/UNKNOWN).</span></div>
    <div><span class="k">BIAS</span><span class="v">Trend-based bias from Trend and HTF Trend agreement.</span></div>
    <div><span class="k">State</span><span class="v">Pipeline stage: FINAL active, RAW forming, STRUCTURAL watch, NO trade, or STALE.</span></div>
    <div><span class="k">Gate</span><span class="v">Primary blocker code that explains why a setup is held back.</span></div>
    <div><span class="k">Confidence</span><span class="v">0-100 score bucketed as LOW/MEDIUM/HIGH for prioritization.</span></div>
  </div>
</details>`;
}

function renderActionabilitySnapshot(rows: StateViewRow[]): string {
  const readyRows = rows.filter((row) => row.trade_badge === "LONG READY" || row.trade_badge === "SHORT READY");
  const watchRows = rows.filter((row) => row.trade_badge === "WATCH");
  const staleRows = rows.filter((row) => row.trade_badge === "STALE");
  const unknownRows = rows.filter((row) => row.trade_badge === "UNKNOWN");
  const cleanRows = rows.filter((row) => !row.unknown_hygiene);

  const blockerCounts = new Map<string, number>();
  rows
    .filter((row) => row.trade_badge !== "LONG READY" && row.trade_badge !== "SHORT READY")
    .forEach((row) => {
      const reason = row.secondary_gate_reason !== "NONE" ? row.secondary_gate_reason : row.gate_reason;
      blockerCounts.set(reason, (blockerCounts.get(reason) || 0) + 1);
    });

  const blockerSummary = Array.from(blockerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `<li><span class="badge badge-navy">${esc(reason)}</span> <strong>${count}</strong></li>`)
    .join("\n");

  const readyHeadline =
    readyRows.length > 0
      ? `<span class="badge badge-green">Ready now: ${readyRows.length}</span>`
      : `<span class="badge badge-red">No ready trades right now</span>`;

  return `<div class="widget snapshot">
  <strong>Actionability Snapshot</strong>
  <div class="snapshot-top">${readyHeadline}</div>
  <div class="widget-grid snapshot-grid">
    <div><span class="k">Rows total</span><span class="v">${rows.length}</span></div>
    <div><span class="k">Ready / Watch</span><span class="v">${readyRows.length} / ${watchRows.length}</span></div>
    <div><span class="k">Unknown hygiene</span><span class="v">${unknownRows.length}</span></div>
    <div><span class="k">Clean rows</span><span class="v">${cleanRows.length}</span></div>
    <div><span class="k">Stale rows</span><span class="v">${staleRows.length}</span></div>
  </div>
  <div class="snapshot-blockers">
    <span class="k">Top blockers (non-ready rows)</span>
    <ul>${blockerSummary || "<li><span class='badge badge-gray'>none</span></li>"}</ul>
  </div>
</div>`;
}

function renderReadinessBanner(rows: StateViewRow[], boardHealth: BoardHealthSummary): string {
  const readyRows = rows.filter((row) => row.trade_badge === "LONG READY" || row.trade_badge === "SHORT READY");
  const watchRows = rows.filter((row) => row.trade_badge === "WATCH");
  const staleRows = rows.filter((row) => row.trade_badge === "STALE");
  const unknownRows = rows.filter((row) => row.trade_badge === "UNKNOWN");
  const noTradeRows = rows.filter((row) => row.trade_badge === "NO_TRADE");

  if (readyRows.length > 0) {
    return `<div class="widget readiness-banner readiness-banner-ok">
  <strong>Ready trades available:</strong> ${readyRows.length} row(s) are currently actionable.
</div>`;
  }

  const blockerCounts = new Map<string, number>();
  rows.forEach((row) => {
    const reason = row.secondary_gate_reason !== "NONE" ? row.secondary_gate_reason : row.gate_reason;
    blockerCounts.set(reason, (blockerCounts.get(reason) || 0) + 1);
  });

  const topBlockers = Array.from(blockerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `<li><span class="badge badge-navy">${esc(reason)}</span> ${count}</li>`)
    .join("");

  return `<div class="widget readiness-banner readiness-banner-warn">
  <strong>No READY trades right now.</strong>
  <div class="readiness-details">
    <span class="badge badge-watch">WATCH: ${watchRows.length}</span>
    <span class="badge badge-no-trade">NO_TRADE: ${noTradeRows.length}</span>
    <span class="badge badge-red">STALE: ${staleRows.length}</span>
    <span class="badge badge-unknown">UNKNOWN: ${unknownRows.length}</span>
    <span class="badge badge-orange">Missing pairs: ${boardHealth.missing_symbol_timeframe_count}</span>
  </div>
  <div class="readiness-next-step">
    <strong>Why nothing is tradable:</strong>
    <ul>${topBlockers || "<li><span class='badge badge-gray'>NONE</span></li>"}</ul>
  </div>
</div>`;
}

function renderEmptyStateMessage(): string {
  return `<div id="empty-state" class="widget empty-state hidden" aria-live="polite"></div>`;
}

function renderWhyBlockedCell(row: StateViewRow): string {
  const isReady = row.trade_badge === "LONG READY" || row.trade_badge === "SHORT READY";
  if (isReady) {
    return `<span class="badge badge-green">READY</span>`;
  }

  const primary = decodeGateReasonShort(row.gate_reason_code);
  const secondary = decodeGateReasonShort(row.secondary_gate_reason_code);

  const checklist = [
    `Primary gate: ${primary}`,
    `Secondary gate: ${secondary}`,
    `Bar confirmed: ${row.bar_confirmed ? "YES" : "NO"}`,
    `HTF conflict: ${row.htf_conflict ? "YES" : "NO"}`,
    `Weak participation: ${row.weak_participation ? "YES" : "NO"}`,
    `Clean interaction: ${row.clean_interaction ? "YES" : "NO"}`,
    `Breakout accepted: ${row.breakout_accepted ? "YES" : "NO"}`,
    `Breakout failure: ${row.breakout_failure ? "YES" : "NO"}`
  ];

  return `<details class="why-blocked">
  <summary><span class="badge badge-navy">Why blocked</span></summary>
  <ul>${checklist.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
</details>`;
}

function renderMissingMatrix(missingExpectedPairs: MissingExpectedPair[]): string {
  if (missingExpectedPairs.length === 0) {
    return `<div class="missing"><strong>Missing expected symbols/timeframes</strong><div>None. Expected matrix is complete.</div></div>`;
  }

  const grouped = new Map<string, string[]>();
  missingExpectedPairs.forEach((pair) => {
    const list = grouped.get(pair.symbol_norm) || [];
    list.push(pair.timeframe);
    grouped.set(pair.symbol_norm, list);
  });

  const rows = Array.from(grouped.entries())
    .map(([symbolNorm, timeframes]) => ({
      symbolNorm,
      timeframes: [...timeframes].sort((a, b) => {
        const rank = (tf: string) => (tf === "15" ? 15 : tf === "60" ? 60 : tf === "240" ? 240 : tf === "1D" ? 1440 : 99999);
        return rank(a) - rank(b);
      })
    }))
    .sort((a, b) => {
      if (b.timeframes.length !== a.timeframes.length) return b.timeframes.length - a.timeframes.length;
      return a.symbolNorm.localeCompare(b.symbolNorm, "en", { sensitivity: "base" });
    });

  return `<div class="missing">
  <strong>Missing expected symbols/timeframes</strong>
  <div>Missing pairs: ${missingExpectedPairs.length}</div>
  <table>
    <thead><tr><th>symbol_norm</th><th>missing timeframes</th><th>count</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr><td>${esc(row.symbolNorm)}</td><td>${esc(row.timeframes.join(", "))}</td><td>${row.timeframes.length}</td></tr>`
        )
        .join("\n")}
    </tbody>
  </table>
</div>`;
}

function renderBoardHealth(summary: BoardHealthSummary): string {
  const actionItems = summary.action_required
    .map(
      (item) =>
        `<li><code>${esc(item.symbol_norm)}</code> - <span class="badge ${candidateStatusClass(item.candidate_status)}">${esc(
          item.candidate_status
        )}</span> - missing ${item.missing_tf_count} (${esc(item.missing_tf_list.join(", ") || "none")})</li>`
    )
    .join("\n");

  return `<div class="widget">
  <strong>Board Health</strong>
  <div class="widget-grid">
    <div><span class="k">Expected symbols/timeframes</span><span class="v">${summary.expected_symbol_count} x ${summary.expected_timeframe_count} = ${summary.expected_symbol_timeframe_count}</span></div>
    <div><span class="k">Covered vs missing</span><span class="v">${summary.observed_symbol_timeframe_count} / ${summary.expected_symbol_timeframe_count} (missing ${summary.missing_symbol_timeframe_count})</span></div>
    <div><span class="k">Unknown hygiene symbols</span><span class="v">${summary.unknown_hygiene_symbol_count}</span></div>
    <div><span class="k">Symbols with candidates</span><span class="v">${summary.symbols_with_candidates_count}</span></div>
  </div>
  <div class="action-required">
    <strong>Data hygiene gaps (top 5)</strong>
    <ul>
      ${actionItems || "<li>None</li>"}
    </ul>
  </div>
</div>`;
}

function renderConfluenceCards(rollups: ConfluenceRollup[]): string {
  if (rollups.length === 0) {
    return `<div class="missing"><strong>Confluence</strong><div>No confluence rows available.</div></div>`;
  }

  return rollups
    .map((rollup) => {
      const bestLong = rollup.best_long;
      const bestShort = rollup.best_short;
      const longBadge = bestLong?.trade_badge ?? "NONE";
      const shortBadge = bestShort?.trade_badge ?? "NONE";
      const missingCount = rollup.missing_timeframes.length;
      const reasons = rollup.conflict_reasons.join(", ");
      const bestConfidence = Math.max(bestLong?.confidence_score ?? -1, bestShort?.confidence_score ?? -1);
      const hasForming =
        bestLong?.operating_state === "RAW_SETUP_FORMING" || bestShort?.operating_state === "RAW_SETUP_FORMING" ? "1" : "0";

      const scenarioDirection = bestLong && bestShort ? "MIXED" : bestLong ? "LONG" : bestShort ? "SHORT" : "UNKNOWN";

      return `<div class="confluence-card"
  data-symbol-norm="${esc(rollup.symbol_norm)}"
  data-best-long-badge="${esc(longBadge)}"
  data-best-short-badge="${esc(shortBadge)}"
  data-rank="${esc(rollup.sort_rank)}"
  data-unknown="${rollup.unknown_hygiene ? "1" : "0"}"
  data-direction-bias="${esc(rollup.direction_bias)}"
  data-best-confidence="${esc(bestConfidence)}"
  data-has-forming="${hasForming}">
  <div class="symbol-card-head">
    <span class="badge badge-navy">${esc(rollup.symbol_norm)}</span>
    <span class="badge ${directionBiasClass(rollup.direction_bias)}">BIAS ${esc(rollup.direction_bias)}</span>
    <span class="badge ${scenarioDirectionClass(scenarioDirection)}">DIR ${esc(scenarioDirection)}</span>
    <span class="badge ${missingCount === 0 ? "badge-green" : "badge-orange"}">coverage ${rollup.coverage_count}/4</span>
    <span class="badge ${missingCount === 0 ? "badge-green" : "badge-yellow"}">missing ${missingCount}</span>
    ${rollup.unknown_hygiene ? '<span class="badge badge-unknown">HYGIENE WARN</span>' : '<span class="badge badge-green">HYGIENE OK</span>'}
    <span class="badge ${rollup.htf_alignment === "ALIGNED" ? "badge-green" : rollup.htf_alignment === "NO_CANDIDATE" ? "badge-gray" : "badge-orange"}">HTF ${esc(rollup.htf_alignment)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>candidate</th>
        <th>trade</th>
        <th>dir</th>
        <th>bias</th>
        <th>tf</th>
        <th>state</th>
        <th>conf</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>best long</td>
        <td><span class="badge ${tradeBadgeClass(longBadge)}">${esc(longBadge)}</span></td>
        <td>${esc(bestLong?.direction ?? "-")}</td>
        <td>${esc(bestLong?.direction_bias ?? "-")}</td>
        <td>${esc(bestLong?.timeframe_canonical ?? "-")}</td>
        <td>${esc(bestLong?.operating_state ?? "-")}</td>
        <td>${esc(bestLong ? `${bestLong.confidence_bucket} ${bestLong.confidence_score}` : "-")}</td>
      </tr>
      <tr>
        <td>best short</td>
        <td><span class="badge ${tradeBadgeClass(shortBadge)}">${esc(shortBadge)}</span></td>
        <td>${esc(bestShort?.direction ?? "-")}</td>
        <td>${esc(bestShort?.direction_bias ?? "-")}</td>
        <td>${esc(bestShort?.timeframe_canonical ?? "-")}</td>
        <td>${esc(bestShort?.operating_state ?? "-")}</td>
        <td>${esc(bestShort ? `${bestShort.confidence_bucket} ${bestShort.confidence_score}` : "-")}</td>
      </tr>
    </tbody>
  </table>
  <div class="confluence-notes">
    <div><strong>Conflict reason:</strong> ${esc(reasons)}</div>
    <div><strong>Missing TFs:</strong> ${esc(rollup.missing_timeframes.join(", ") || "none")}</div>
  </div>
</div>`;
    })
    .join("\n");
}

function candidateSummary(direction: "LONG" | "SHORT", item: SymbolChecklistItem): string {
  const candidate = direction === "LONG" ? item.best_long : item.best_short;
  if (!candidate) return "-";
  return `${direction} | tf ${candidate.timeframe_canonical} | ${candidate.confidence_bucket} ${candidate.confidence_score} | gate ${candidate.gate_reason} | sec ${candidate.secondary_gate_reason}`;
}

function renderChecklistTable(checklist: SymbolChecklistItem[]): string {
  const rows = checklist
    .map(
      (item) => `<tr class="checklist-row"
  data-status="${esc(item.candidate_status)}"
  data-symbol-norm="${esc(item.symbol_norm)}">
  <td>${esc(item.symbol_norm)}</td>
  <td><span class="badge ${candidateStatusClass(item.candidate_status)}">${esc(item.candidate_status)}</span></td>
  <td><span class="badge ${directionBiasClass(item.direction_bias)}">${esc(item.direction_bias)}</span></td>
  <td>${item.missing_tf_count}</td>
  <td>${esc(item.missing_tf_list.join(", ") || "none")}</td>
  <td>${item.unknown_hygiene_symbol ? '<span class="badge badge-unknown">YES</span>' : '<span class="badge badge-green">NO</span>'}</td>
  <td>${esc(candidateSummary("LONG", item))}</td>
  <td>${esc(candidateSummary("SHORT", item))}</td>
  <td>${esc(item.blockers.join(", ") || "NONE")}</td>
</tr>`
    )
    .join("\n");

  return `<div class="widget">
  <div class="checklist-head">
    <strong>Per-Symbol Trade Checklist</strong>
    <div class="checklist-controls">
      <div class="checklist-filters">
        <button class="checklist-filter-btn active" data-check-filter="all">All</button>
        <button class="checklist-filter-btn" data-check-filter="BEST">BEST</button>
        <button class="checklist-filter-btn" data-check-filter="UNKNOWN">UNKNOWN</button>
        <button class="checklist-filter-btn" data-check-filter="MISSING">MISSING</button>
        <button class="checklist-filter-btn" data-check-filter="EMPTY">EMPTY</button>
      </div>
      <input id="checklist-search" type="text" placeholder="Search checklist symbol..." />
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>symbol_norm</th>
        <th>status</th>
        <th>bias</th>
        <th>missing_count</th>
        <th>missing_tfs</th>
        <th>unknown_hygiene</th>
        <th>best_long</th>
        <th>best_short</th>
        <th>blockers</th>
      </tr>
    </thead>
    <tbody id="checklist-body">
      ${rows}
    </tbody>
  </table>
</div>`;
}

export function renderDashboard(
  rows: StateViewRow[],
  missingExpectedPairs: MissingExpectedPair[],
  confluenceRollups: ConfluenceRollup[],
  boardHealth: BoardHealthSummary,
  symbolChecklist: SymbolChecklistItem[]
): string {
  const now = new Date();
  const unknownRows = rows.filter((row) => row.unknown_hygiene);

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.operating_state] = (acc[row.operating_state] || 0) + 1;
    return acc;
  }, {});

  const tradeCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.trade_badge] = (acc[row.trade_badge] || 0) + 1;
    return acc;
  }, {});

  const filterCounts = {
    all: rows.length,
    ready: (tradeCounts["LONG READY"] || 0) + (tradeCounts["SHORT READY"] || 0),
    long: tradeCounts["LONG READY"] || 0,
    short: tradeCounts["SHORT READY"] || 0,
    actionable: (tradeCounts["LONG READY"] || 0) + (tradeCounts["SHORT READY"] || 0) + (tradeCounts.WATCH || 0),
    forming: counts.RAW_SETUP_FORMING || 0,
    watch: tradeCounts.WATCH || 0,
    highConf: rows.filter((row) => row.confidence_score >= 70).length,
    stale: tradeCounts.STALE || 0,
    unknown: tradeCounts.UNKNOWN || 0,
    cleanOnly: rows.filter((row) => !row.unknown_hygiene).length,
    biasLong: rows.filter((row) => row.direction_bias === "LONG").length,
    biasShort: rows.filter((row) => row.direction_bias === "SHORT").length,
    biasMixed: rows.filter((row) => row.direction_bias === "MIXED").length
  };

  const readinessBanner = renderReadinessBanner(rows, boardHealth);

  const unknownHygieneBanner =
    boardHealth.unknown_hygiene_symbol_count > 0
      ? `<div class="widget readiness-banner readiness-banner-warn">
  <strong>Board data incomplete:</strong> ${boardHealth.unknown_hygiene_symbol_count} symbol(s) are flagged UNKNOWN hygiene.
  <div class="readiness-details">
    <span class="badge badge-unknown">Unknown hygiene symbols: ${boardHealth.unknown_hygiene_symbol_count}</span>
    <span class="badge badge-orange">Missing symbol/timeframe pairs: ${boardHealth.missing_symbol_timeframe_count}</span>
  </div>
</div>`
      : "";

  const flatRows = rows
    .map((row) => {
      const domRowId = rowDomId(row);
      return `<tr class="board-row"
  id="${esc(domRowId)}"
  data-symbol="${esc(row.symbol)}"
  data-symbol-norm="${esc(row.symbol_norm)}"
  data-timeframe="${esc(row.timeframe)}"
  data-timeframe-minutes="${esc(row.timeframe_minutes ?? "")}" 
  data-bar-time-utc="${esc(row.bar_time_utc)}"
  data-trade-badge="${esc(row.trade_badge)}"
  data-confidence-score="${esc(row.confidence_score)}"
  data-confidence-bucket="${esc(row.confidence_bucket)}"
  data-state-priority="${esc(row.state_priority)}"
  data-operating-state="${esc(row.operating_state)}"
  data-unknown="${row.unknown_hygiene ? "1" : "0"}"
  data-direction-bias="${esc(row.direction_bias)}"
  data-scenario-direction="${esc(row.direction)}">
<td>${esc(row.symbol_norm)}</td>
<td>${esc(row.timeframe_canonical)}</td>
<td><span class="badge ${tradeBadgeClass(row.trade_badge)}">${esc(row.trade_badge)}</span></td>
<td><span class="badge ${scenarioDirectionClass(row.direction)}">${esc(row.direction)}</span></td>
<td><span class="badge ${directionBiasClass(row.direction_bias)}">${esc(row.direction_bias)}</span></td>
<td><span class="badge ${stateClass(row.operating_state)}">${esc(row.operating_state)}</span></td>
<td><span class="badge badge-navy">${esc(decodeGateReasonShort(row.gate_reason_code))}</span></td>
<td>${renderWhyBlockedCell(row)}</td>
<td><span class="badge ${trendClass(row.trend_state)}">${esc(row.trend_state)}</span></td>
<td><span class="badge ${trendClass(row.htf_trend_state)}">${esc(row.htf_trend_state)}</span></td>
<td><span class="badge ${confidenceClass(row.confidence_bucket)}">${esc(row.confidence_bucket)} ${esc(row.confidence_score)}</span></td>
<td>${esc(row.rvol.toFixed(3))}</td>
<td>${esc(row.extension_score.toFixed(3))}</td>
<td>${esc(row.age)}</td>
<td>${esc(row.received_at_utc)}</td>
<td>${row.unknown_hygiene ? '<span class="badge badge-unknown">WARN</span>' : '<span class="badge badge-green">OK</span>'}</td>
</tr>`;
    })
    .join("\n");

  const hygienePanel =
    unknownRows.length > 0
      ? `<details class="hygiene">
  <summary><strong>Symbol Hygiene Warning</strong> (${unknownRows.length} rows)</summary>
  <div>Rows flagged when symbol is outside whitelist, market type is UNKNOWN, or direction is UNKNOWN.</div>
  <ul>
    ${unknownRows
      .slice(0, 30)
      .map(
        (row) =>
          `<li>${esc(row.symbol_norm)} / ${esc(row.timeframe_canonical)} - market=${esc(row.market_type)} direction=${esc(row.direction)}</li>`
      )
      .join("\n")}
  </ul>
</details>`
      : "";

  const missingSection = renderMissingMatrix(missingExpectedPairs);
  const confluenceCards = renderConfluenceCards(confluenceRollups);
  const boardHealthWidget = renderBoardHealth(boardHealth);
  const checklistWidget = renderChecklistTable(symbolChecklist);
  const snapshotWidget = renderActionabilitySnapshot(rows);
  const radarWidget = renderTradeRadar(rows);
  const topCandidatesWidget = renderTopCandidatesStrip(rows);
  const fieldGuide = renderFieldGuide();
  const emptyStateWidget = renderEmptyStateMessage();

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FAMS Trade Readiness Board v3.4 UX</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 16px; background: #0b1020; color: #f0f4ff; }
      h1 { font-size: 20px; margin: 0 0 10px 0; }
      .meta { margin-bottom: 12px; color: #9fb2e6; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .meta strong { color: #f0f4ff; }
      .meta .live-dot {
        width: 8px;
        height: 8px;
        background: #35a06b;
        border-radius: 999px;
        display: inline-block;
        box-shadow: 0 0 0 4px rgba(53, 160, 107, 0.2);
      }
      .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
      .sort-wrap { display: flex; align-items: center; gap: 6px; }
      .sort-wrap label { font-size: 12px; color: #9fb2e6; }
      .sort-wrap select {
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
      }
      .filters { display: flex; flex-wrap: wrap; gap: 8px; }
      .view-toggle { display: flex; gap: 8px; }
      .search-wrap { margin-left: auto; min-width: 240px; }
      .search-wrap input {
        width: 100%;
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
      }
      .filter-btn, .view-btn, .checklist-filter-btn {
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      .filter-btn.active, .view-btn.active, .checklist-filter-btn.active { background: #2f5ed7; border-color: #7fa3ff; color: #fff; }
      .counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 14px; }
      .hygiene, .missing, .widget {
        border: 1px solid #8b3f00;
        background: #2a1b00;
        border-radius: 8px;
        padding: 10px;
        margin: 0 0 14px;
        color: #ffd4a8;
      }
      .widget { border-color: #2f3b63; background: #101936; color: #dbe8ff; }
      .empty-state { border-color: #7f5f12; background: #2a2200; color: #ffe7a8; }
      .empty-state h3 { margin: 0 0 6px; font-size: 14px; }
      .empty-state p { margin: 4px 0; }
      .empty-state ul { margin: 8px 0 0; padding-left: 18px; }
      .readiness-banner { border-color: #4a5a8f; }
      .readiness-banner-ok { border-color: #2f8f57; background: #0f2a1a; color: #b7f4d0; }
      .readiness-banner-warn { border-color: #a46b13; background: #2a2200; color: #ffe7a8; }
      .readiness-details { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .readiness-next-step ul { margin: 8px 0 0; padding-left: 18px; }
      .missing { border-color: #4a5a8f; background: #141d36; color: #d0dcff; }
      .widget-grid { display: grid; gap: 6px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 8px; }
      .widget-grid .k { display: block; color: #9fb2e6; font-size: 11px; }
      .widget-grid .v { display: block; font-size: 13px; }
      .radar-list { margin: 6px 0 0; padding-left: 18px; }
      .radar-list li { margin: 4px 0; line-height: 1.45; }
      .legend summary { cursor: pointer; }
      .legend-grid { display: grid; gap: 6px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 8px; }
      .top-candidates { position: sticky; top: 6px; z-index: 20; }
      .candidate-list { margin: 8px 0 0; padding-left: 0; list-style: none; display: grid; gap: 6px; }
      .candidate-item {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 6px 8px;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        background: #0f1630;
      }
      .candidate-rank { color: #9fb2e6; min-width: 24px; font-weight: 700; }
      .candidate-jump {
        margin-left: auto;
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #4a5a8f;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }
      .candidate-jump:hover { background: #2f5ed7; border-color: #7fa3ff; color: #fff; }
      .snapshot-top { margin: 8px 0; }
      .snapshot-blockers ul { margin: 8px 0 0; padding-left: 18px; }
      .snapshot-blockers li { margin: 4px 0; }
      .action-required { margin-top: 10px; }
      .action-required ul { margin: 6px 0 0; padding-left: 18px; }
      .checklist-head { display: flex; gap: 10px; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
      .checklist-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .checklist-filters { display: flex; gap: 6px; flex-wrap: wrap; }
      #checklist-search {
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        min-width: 220px;
      }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #2f3b63; padding: 6px; text-align: left; white-space: nowrap; }
      th { position: sticky; top: 0; background: #15203f; }
      tr:nth-child(even) { background: #111a34; }
      .table-wrap { overflow: auto; border: 1px solid #2f3b63; border-radius: 8px; }
      .col-sort-btn {
        background: transparent;
        border: 0;
        color: inherit;
        font: inherit;
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .col-sort-btn .sort-indicator { color: #7f90c3; font-size: 10px; }
      .col-sort-btn[data-active="true"] .sort-indicator { color: #b8d4ff; }
      #flat-view table th:first-child, #flat-view table td:first-child {
        position: sticky;
        left: 0;
        z-index: 3;
        background: #15203f;
        min-width: 220px;
      }
      #flat-view table td:first-child { background: inherit; z-index: 2; }
      #flat-view table th:nth-child(2), #flat-view table td:nth-child(2) {
        position: sticky;
        left: 220px;
        z-index: 3;
        background: #15203f;
        min-width: 70px;
      }
      #flat-view table td:nth-child(2) { background: inherit; z-index: 2; }
      .board-row[data-trade-badge="LONG READY"] { box-shadow: inset 3px 0 0 #35a06b; }
      .board-row[data-trade-badge="SHORT READY"] { box-shadow: inset 3px 0 0 #3e7cc1; }
      .board-row[data-trade-badge="WATCH"] { box-shadow: inset 3px 0 0 #c46720; }
      .badge {
        display: inline-block;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        border: 1px solid transparent;
      }
      .badge-green { background: #10391f; color: #8ff0b2; border-color: #2f8f57; }
      .badge-yellow { background: #3f3200; color: #ffec8a; border-color: #c6a200; }
      .badge-orange { background: #4a2300; color: #ffbe87; border-color: #c46720; }
      .badge-red { background: #471515; color: #ffaaaa; border-color: #b54a4a; }
      .badge-gray { background: #262f4f; color: #c7d2f7; border-color: #4a5a8f; }
      .badge-navy { background: #1a264d; color: #c7d2f7; border-color: #4a5a8f; }
      .badge-long { background: #10391f; color: #8ff0b2; border-color: #2f8f57; }
      .badge-short { background: #153a67; color: #9fd2ff; border-color: #3e7cc1; }
      .badge-watch { background: #4a2300; color: #ffbe87; border-color: #c46720; }
      .badge-no-trade { background: #262f4f; color: #c7d2f7; border-color: #4a5a8f; }
      .badge-stale { background: #471515; color: #ffaaaa; border-color: #b54a4a; }
      .badge-unknown { background: #2d2152; color: #e0d4ff; border-color: #7f67cc; }
      .badge-conf-high { background: #153a24; color: #96f5be; border-color: #35a06b; font-weight: 700; }
      .badge-conf-med { background: #3f3200; color: #ffec8a; border-color: #c6a200; }
      .badge-conf-low { background: #462626; color: #ffb0b0; border-color: #b55a5a; }
      .hidden { display: none; }
      .collapsed-groups, .confluence-cards { display: grid; gap: 10px; }
      .symbol-card, .confluence-card {
        border: 1px solid #2f3b63;
        border-radius: 10px;
        padding: 10px;
        background: #101936;
      }
      .symbol-card-head {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .symbol-card table, .confluence-card table { font-size: 11px; }
      .symbol-card th, .symbol-card td, .confluence-card th, .confluence-card td { padding: 4px 6px; }
      .confluence-notes { margin-top: 8px; color: #b5c6ef; font-size: 12px; }
      .why-blocked summary { cursor: pointer; list-style: none; }
      .why-blocked summary::-webkit-details-marker { display: none; }
      .why-blocked ul { margin: 6px 0 0; padding-left: 16px; color: #c6d6ff; }
      .why-blocked li { margin: 2px 0; }
      .board-row.row-focus {
        outline: 2px solid #7fa3ff;
        outline-offset: -2px;
        box-shadow: inset 4px 0 0 #7fa3ff;
      }
      code { color: #cddcff; }
      :focus-visible { outline: 2px solid #7fa3ff; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <h1>FAMS Trade Readiness Board v3.4 UX</h1>
    <div class="meta"><span class="live-dot" aria-hidden="true"></span><strong>Live:</strong> refresh in <span id="refresh-countdown">60s</span> | <strong>Generated:</strong> ${esc(
      now.toISOString()
    )} | <strong>Visible items:</strong> <span id="visible-count">${rows.length}</span></div>

    ${readinessBanner}
    ${unknownHygieneBanner}

    <div class="counts">
      <span class="badge badge-green" title="FINAL_SCENARIO_ACTIVE">${stateLabel("FINAL_SCENARIO_ACTIVE")}: ${counts.FINAL_SCENARIO_ACTIVE || 0}</span>
      <span class="badge badge-yellow" title="RAW_SETUP_FORMING">${stateLabel("RAW_SETUP_FORMING")}: ${counts.RAW_SETUP_FORMING || 0}</span>
      <span class="badge badge-orange" title="STRUCTURAL_READY_WATCH">${stateLabel("STRUCTURAL_READY_WATCH")}: ${counts.STRUCTURAL_READY_WATCH || 0}</span>
      <span class="badge badge-gray" title="NO_TRADE_STILL">${stateLabel("NO_TRADE_STILL")}: ${counts.NO_TRADE_STILL || 0}</span>
      <span class="badge badge-red" title="STALE_DATA">${stateLabel("STALE_DATA")}: ${counts.STALE_DATA || 0}</span>
      <span class="badge badge-long">LONG READY: ${tradeCounts["LONG READY"] || 0}</span>
      <span class="badge badge-short">SHORT READY: ${tradeCounts["SHORT READY"] || 0}</span>
      <span class="badge badge-watch">WATCH: ${tradeCounts.WATCH || 0}</span>
      <span class="badge badge-no-trade">NO_TRADE: ${tradeCounts.NO_TRADE || 0}</span>
      <span class="badge badge-unknown">UNKNOWN: ${tradeCounts.UNKNOWN || 0}</span>
    </div>

    ${snapshotWidget}
    ${radarWidget}
    ${fieldGuide}
    ${boardHealthWidget}
    ${checklistWidget}
    ${topCandidatesWidget}

    <div class="toolbar">
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All (${filterCounts.all})</button>
        <button class="filter-btn" data-filter="ready">Ready (${filterCounts.ready})</button>
        <button class="filter-btn" data-filter="long">Long Ready (${filterCounts.long})</button>
        <button class="filter-btn" data-filter="short">Short Ready (${filterCounts.short})</button>
        <button class="filter-btn" data-filter="actionable">Actionable (${filterCounts.actionable})</button>
        <button class="filter-btn" data-filter="forming">Forming (${filterCounts.forming})</button>
        <button class="filter-btn" data-filter="watch">Watch (${filterCounts.watch})</button>
        <button class="filter-btn" data-filter="high-conf">High Conf (${filterCounts.highConf})</button>
        <button class="filter-btn" data-filter="stale">Stale (${filterCounts.stale})</button>
        <button class="filter-btn" data-filter="unknown">Unknown (${filterCounts.unknown})</button>
        <button class="filter-btn" data-filter="clean-only">Clean Only (${filterCounts.cleanOnly})</button>
        <button class="filter-btn" data-filter="bias-long">Bias Long (${filterCounts.biasLong})</button>
        <button class="filter-btn" data-filter="bias-short">Bias Short (${filterCounts.biasShort})</button>
        <button class="filter-btn" data-filter="bias-mixed">Bias Mixed (${filterCounts.biasMixed})</button>
      </div>
      <div class="sort-wrap">
        <label for="sort-mode">Sort</label>
        <select id="sort-mode" aria-label="Sort board rows">
          <option value="default" selected>State priority</option>
          <option value="confidence">Confidence high to low</option>
          <option value="age">Freshness (newest first)</option>
          <option value="symbol">Symbol A-Z</option>
        </select>
      </div>
      <div class="view-toggle">
        <button class="view-btn active" data-view="flat">Flat</button>
        <button class="view-btn" data-view="collapsed">Collapsed</button>
        <button class="view-btn" data-view="confluence">Confluence</button>
      </div>
      <div class="search-wrap">
        <input id="symbol-search" type="text" placeholder="Search symbol..." />
      </div>
    </div>

    ${emptyStateWidget}
    ${missingSection}
    ${hygienePanel}

    <div id="flat-view">
      <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th title="Canonical exchange:symbol key"><button class="col-sort-btn" type="button" data-sort="symbol" aria-label="Sort by symbol">symbol_norm <span class="sort-indicator" aria-hidden="true">↕</span></button></th>
            <th title="Canonical timeframe">timeframe</th>
            <th title="Final decision badge">trade status</th>
            <th title="Scenario-derived direction">scenario dir</th>
            <th title="Trend/HTF bias">trend bias</th>
            <th title="Operating state in the decision pipeline"><button class="col-sort-btn" type="button" data-sort="default" aria-label="Sort by pipeline state priority">pipeline state <span class="sort-indicator" aria-hidden="true">↕</span></button></th>
            <th title="Primary gate/block reason">blocker</th>
            <th title="Expanded explanation of gate/participation/structure blockers">why blocked</th>
            <th title="Current trend state">trend</th>
            <th title="Higher-timeframe trend state">htf trend</th>
            <th title="Confidence bucket and score"><button class="col-sort-btn" type="button" data-sort="confidence" aria-label="Sort by confidence score">confidence score <span class="sort-indicator" aria-hidden="true">↕</span></button></th>
            <th title="Relative volume">rvol</th>
            <th title="Extension score">extension</th>
            <th title="Age since bar time"><button class="col-sort-btn" type="button" data-sort="age" aria-label="Sort by freshness">age <span class="sort-indicator" aria-hidden="true">↕</span></button></th>
            <th title="Last webhook ingestion timestamp">last update</th>
            <th title="Symbol whitelist and hygiene status">hygiene</th>
          </tr>
        </thead>
        <tbody id="board-body">
          ${flatRows}
        </tbody>
      </table>
      </div>
    </div>

    <div id="collapsed-view" class="hidden">
      <div id="collapsed-groups" class="collapsed-groups"></div>
    </div>

    <div id="confluence-view" class="hidden">
      <div id="confluence-cards" class="confluence-cards">
        ${confluenceCards}
      </div>
    </div>

    <script>
      (function () {
        const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
        const viewButtons = Array.from(document.querySelectorAll(".view-btn"));
        const searchInput = document.getElementById("symbol-search");
        const sortModeSelect = document.getElementById("sort-mode");
        const visibleCount = document.getElementById("visible-count");
        const flatView = document.getElementById("flat-view");
        const collapsedView = document.getElementById("collapsed-view");
        const confluenceView = document.getElementById("confluence-view");
        const collapsedGroups = document.getElementById("collapsed-groups");
        const rows = Array.from(document.querySelectorAll(".board-row"));
        const confluenceCards = Array.from(document.querySelectorAll(".confluence-card"));

        const checklistRows = Array.from(document.querySelectorAll(".checklist-row"));
        const checklistSearch = document.getElementById("checklist-search");
        const checklistFilterButtons = Array.from(document.querySelectorAll(".checklist-filter-btn"));
        const candidateJumpButtons = Array.from(document.querySelectorAll(".candidate-jump"));
        const sortHeaderButtons = Array.from(document.querySelectorAll(".col-sort-btn"));

        let activeFilter = "all";
        let activeView = "flat";
        let activeChecklistFilter = "all";
        let activeSort = "confidence";

        function inferDefaultFilter() {
          const hasReady = rows.some(function (row) {
            const badge = row.dataset.tradeBadge || "";
            return badge === "LONG READY" || badge === "SHORT READY";
          });
          if (hasReady) return "ready";

          const hasWatch = rows.some(function (row) {
            return (row.dataset.tradeBadge || "") === "WATCH";
          });
          if (hasWatch) return "watch";

          const hasUnknown = rows.some(function (row) {
            return (row.dataset.tradeBadge || "") === "UNKNOWN";
          });
          if (hasUnknown) return "unknown";

          return "all";
        }

        function safeGetPreference(key, fallback) {
          try {
            const value = window.localStorage.getItem(key);
            return value || fallback;
          } catch (_err) {
            return fallback;
          }
        }

        function safeSetPreference(key, value) {
          try {
            window.localStorage.setItem(key, value);
          } catch (_err) {
            // Ignore storage failures (private mode, quota, etc.)
          }
        }

        const inferredFilter = inferDefaultFilter();
        activeFilter = safeGetPreference("fams.activeFilter", inferredFilter);
        activeView = safeGetPreference("fams.activeView", "flat");
        activeSort = safeGetPreference("fams.activeSort", "confidence");

        function matchesFilter(row, filter) {
          const badge = row.dataset.tradeBadge || "";
          const bias = row.dataset.directionBias || "MIXED";
          const state = row.dataset.operatingState || "";
          const conf = Number(row.dataset.confidenceScore || "0");
          const unknown = row.dataset.unknown === "1";

          if (filter === "all") return true;
          if (filter === "ready") return badge === "LONG READY" || badge === "SHORT READY";
          if (filter === "long") return badge === "LONG READY";
          if (filter === "short") return badge === "SHORT READY";
          if (filter === "actionable") return badge === "LONG READY" || badge === "SHORT READY" || badge === "WATCH";
          if (filter === "forming") return state === "RAW_SETUP_FORMING";
          if (filter === "watch") return badge === "WATCH";
          if (filter === "high-conf") return conf >= 70;
          if (filter === "stale") return badge === "STALE";
          if (filter === "unknown") return badge === "UNKNOWN";
          if (filter === "clean-only") return !unknown;
          if (filter === "bias-long") return bias === "LONG";
          if (filter === "bias-short") return bias === "SHORT";
          if (filter === "bias-mixed") return bias === "MIXED";
          return true;
        }

        function matchesConfluenceFilter(card, filter) {
          const longBadge = card.dataset.bestLongBadge || "";
          const shortBadge = card.dataset.bestShortBadge || "";
          const rank = Number(card.dataset.rank || "99");
          const unknown = card.dataset.unknown === "1";
          const bias = card.dataset.directionBias || "MIXED";
          const bestConfidence = Number(card.dataset.bestConfidence || "-1");
          const hasForming = card.dataset.hasForming === "1";

          if (filter === "all") return true;
          if (filter === "ready") return longBadge === "LONG READY" || shortBadge === "SHORT READY";
          if (filter === "long") return longBadge === "LONG READY";
          if (filter === "short") return shortBadge === "SHORT READY";
          if (filter === "actionable") return longBadge === "LONG READY" || shortBadge === "SHORT READY" || longBadge === "WATCH" || shortBadge === "WATCH" || rank === 3;
          if (filter === "forming") return hasForming;
          if (filter === "watch") return longBadge === "WATCH" || shortBadge === "WATCH" || rank === 3;
          if (filter === "high-conf") return bestConfidence >= 70;
          if (filter === "stale") return longBadge === "STALE" || shortBadge === "STALE" || rank === 4;
          if (filter === "unknown") return unknown || rank === 7;
          if (filter === "clean-only") return !unknown;
          if (filter === "bias-long") return bias === "LONG";
          if (filter === "bias-short") return bias === "SHORT";
          if (filter === "bias-mixed") return bias === "MIXED";
          return true;
        }

        function matchesSearch(row, query) {
          if (!query) return true;
          const q = query.toLowerCase();
          const symbol = (row.dataset.symbol || "").toLowerCase();
          const symbolNorm = (row.dataset.symbolNorm || "").toLowerCase();
          return symbol.includes(q) || symbolNorm.includes(q);
        }

        function matchesConfluenceSearch(card, query) {
          if (!query) return true;
          const q = query.toLowerCase();
          const symbolNorm = (card.dataset.symbolNorm || "").toLowerCase();
          return symbolNorm.includes(q);
        }

        function matchesChecklistFilter(row, filter) {
          if (filter === "all") return true;
          return (row.dataset.status || "") === filter;
        }

        function matchesChecklistSearch(row, query) {
          if (!query) return true;
          const q = query.toLowerCase();
          return (row.dataset.symbolNorm || "").toLowerCase().includes(q);
        }

        function timeframeRank(tf, tfMin) {
          const norm = String(tf || "").toUpperCase();
          if (norm === "15" || norm === "15M") return 15;
          if (norm === "60" || norm === "1H") return 60;
          if (norm === "240" || norm === "4H") return 240;
          if (norm === "D" || norm === "1D" || norm === "1440") return 1440;
          const m = Number(tfMin || "");
          return Number.isFinite(m) ? m : 999999;
        }

        function tradeClass(trade) {
          if (trade === "LONG READY") return "badge-long";
          if (trade === "SHORT READY") return "badge-short";
          if (trade === "WATCH") return "badge-watch";
          if (trade === "STALE") return "badge-stale";
          if (trade === "UNKNOWN") return "badge-unknown";
          return "badge-no-trade";
        }

        function biasClass(bias) {
          if (bias === "LONG") return "badge-long";
          if (bias === "SHORT") return "badge-short";
          return "badge-gray";
        }

        function dirClass(dir) {
          if (dir === "LONG") return "badge-long";
          if (dir === "SHORT") return "badge-short";
          if (dir === "MIXED") return "badge-yellow";
          return "badge-unknown";
        }

        function confClass(bucket) {
          if (bucket === "HIGH") return "badge-conf-high";
          if (bucket === "MEDIUM") return "badge-conf-med";
          return "badge-conf-low";
        }

        function setActiveButtons(buttons, key, value) {
          buttons.forEach(function (btn) {
            const isActive = btn.dataset[key] === value;
            if (isActive) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
        }

        function setActiveSortHeaders(activeMode) {
          sortHeaderButtons.forEach(function (btn) {
            const isActive = (btn.dataset.sort || "") === activeMode;
            btn.setAttribute("data-active", isActive ? "true" : "false");
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
        }

        function clearChildren(node) {
          while (node.firstChild) {
            node.removeChild(node.firstChild);
          }
        }

        function groupedRows(filteredRows) {
          const groups = new Map();
          filteredRows.forEach(function (row) {
            const key = row.dataset.symbolNorm || "UNKNOWN";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
          });

          return Array.from(groups.entries())
            .map(function (entry) {
              const key = entry[0];
              const groupRows = entry[1];

              groupRows.sort(function (a, b) {
                return timeframeRank(a.dataset.timeframe, a.dataset.timeframeMinutes) - timeframeRank(b.dataset.timeframe, b.dataset.timeframeMinutes);
              });

              const best = groupRows.slice().sort(function (a, b) {
                const ap = Number(a.dataset.statePriority || "99");
                const bp = Number(b.dataset.statePriority || "99");
                if (ap !== bp) return ap - bp;
                const ac = Number(a.dataset.confidenceScore || "0");
                const bc = Number(b.dataset.confidenceScore || "0");
                return bc - ac;
              })[0];

              return { key: key, rows: groupRows, best: best };
            })
            .sort(function (a, b) {
              const ap = Number(a.best.dataset.statePriority || "99");
              const bp = Number(b.best.dataset.statePriority || "99");
              if (ap !== bp) return ap - bp;
              const as = a.key.toLowerCase();
              const bs = b.key.toLowerCase();
              if (as < bs) return -1;
              if (as > bs) return 1;
              return 0;
            });
        }

        function renderCollapsed(filteredRows) {
          if (!collapsedGroups) return;
          clearChildren(collapsedGroups);

          const groups = groupedRows(filteredRows);
          groups.forEach(function (group) {
            const card = document.createElement("div");
            card.className = "symbol-card";

            const best = group.best;
            const bestTrade = best.dataset.tradeBadge || "NO_TRADE";
            const bestConfBucket = best.dataset.confidenceBucket || "LOW";
            const bestConfScore = best.dataset.confidenceScore || "0";

            const hasLongBias = group.rows.some(function (row) { return row.dataset.directionBias === "LONG"; });
            const hasShortBias = group.rows.some(function (row) { return row.dataset.directionBias === "SHORT"; });
            const groupBias = hasLongBias && !hasShortBias ? "LONG" : hasShortBias && !hasLongBias ? "SHORT" : "MIXED";

            const hasLongScenario = group.rows.some(function (row) { return row.dataset.scenarioDirection === "LONG"; });
            const hasShortScenario = group.rows.some(function (row) { return row.dataset.scenarioDirection === "SHORT"; });
            const groupScenario = hasLongScenario && hasShortScenario ? "MIXED" : hasLongScenario ? "LONG" : hasShortScenario ? "SHORT" : "UNKNOWN";

            const head = document.createElement("div");
            head.className = "symbol-card-head";
            head.innerHTML =
              '<span class="badge badge-navy">' + group.key + '</span>' +
              '<span class="badge ' + tradeClass(bestTrade) + '">' + bestTrade + '</span>' +
              '<span class="badge ' + dirClass(groupScenario) + '">DIR ' + groupScenario + '</span>' +
              '<span class="badge ' + biasClass(groupBias) + '">BIAS ' + groupBias + '</span>' +
              '<span class="badge ' + confClass(bestConfBucket) + '">' + bestConfBucket + ' ' + bestConfScore + '</span>';

            const table = document.createElement("table");
            const rowsHtml = group.rows
              .map(function (row) {
                const trade = row.dataset.tradeBadge || "NO_TRADE";
                const bucket = row.dataset.confidenceBucket || "LOW";
                const ageText = row.children[13] ? row.children[13].textContent : "";
                return '<tr>' +
                  '<td>' + (row.dataset.timeframe || "") + '</td>' +
                  '<td><span class="badge ' + tradeClass(trade) + '">' + trade + '</span></td>' +
                  '<td><span class="badge ' + dirClass(row.dataset.scenarioDirection || "UNKNOWN") + '">' + (row.dataset.scenarioDirection || "UNKNOWN") + '</span></td>' +
                  '<td><span class="badge ' + biasClass(row.dataset.directionBias || "MIXED") + '">' + (row.dataset.directionBias || "MIXED") + '</span></td>' +
                  '<td>' + (row.dataset.operatingState || "") + '</td>' +
                  '<td><span class="badge ' + confClass(bucket) + '">' + bucket + ' ' + (row.dataset.confidenceScore || "0") + '</span></td>' +
                  '<td>' + ageText + '</td>' +
                  '</tr>';
              })
              .join("");

            table.innerHTML =
              '<thead><tr><th>tf</th><th>trade</th><th>dir</th><th>bias</th><th>state</th><th>confidence</th><th>age</th></tr></thead>' +
              '<tbody>' + rowsHtml + '</tbody>';

            card.appendChild(head);
            card.appendChild(table);
            collapsedGroups.appendChild(card);
          });
        }

        function applyChecklist() {
          const q = checklistSearch ? String(checklistSearch.value || "") : "";
          checklistRows.forEach(function (row) {
            const show = matchesChecklistFilter(row, activeChecklistFilter) && matchesChecklistSearch(row, q);
            row.style.display = show ? "" : "none";
          });
        }

        function sortRowsForView(inputRows) {
          const sorted = inputRows.slice();

          if (activeSort === "confidence") {
            sorted.sort(function (a, b) {
              const ac = Number(a.dataset.confidenceScore || "0");
              const bc = Number(b.dataset.confidenceScore || "0");
              if (ac !== bc) return bc - ac;
              const ap = Number(a.dataset.statePriority || "99");
              const bp = Number(b.dataset.statePriority || "99");
              if (ap !== bp) return ap - bp;
              return (a.dataset.symbolNorm || "").localeCompare(b.dataset.symbolNorm || "", "en", { sensitivity: "base" });
            });
            return sorted;
          }

          if (activeSort === "age") {
            sorted.sort(function (a, b) {
              const at = Date.parse(a.dataset.barTimeUtc || "");
              const bt = Date.parse(b.dataset.barTimeUtc || "");
              const an = Number.isNaN(at) ? Number.NEGATIVE_INFINITY : at;
              const bn = Number.isNaN(bt) ? Number.NEGATIVE_INFINITY : bt;
              return bn - an;
            });
            return sorted;
          }

          if (activeSort === "symbol") {
            sorted.sort(function (a, b) {
              const as = a.dataset.symbolNorm || "";
              const bs = b.dataset.symbolNorm || "";
              const sc = as.localeCompare(bs, "en", { sensitivity: "base" });
              if (sc !== 0) return sc;
              return timeframeRank(a.dataset.timeframe, a.dataset.timeframeMinutes) - timeframeRank(b.dataset.timeframe, b.dataset.timeframeMinutes);
            });
            return sorted;
          }

          sorted.sort(function (a, b) {
            const ap = Number(a.dataset.statePriority || "99");
            const bp = Number(b.dataset.statePriority || "99");
            if (ap !== bp) return ap - bp;
            const as = a.dataset.symbolNorm || "";
            const bs = b.dataset.symbolNorm || "";
            const sc = as.localeCompare(bs, "en", { sensitivity: "base" });
            if (sc !== 0) return sc;
            return timeframeRank(a.dataset.timeframe, a.dataset.timeframeMinutes) - timeframeRank(b.dataset.timeframe, b.dataset.timeframeMinutes);
          });

          return sorted;
        }

        function filterLabel(filter) {
          if (filter === "ready") return "Ready (Long+Short)";
          if (filter === "long") return "Long Ready";
          if (filter === "short") return "Short Ready";
          if (filter === "actionable") return "Actionable";
          if (filter === "forming") return "Forming";
          if (filter === "watch") return "Watch";
          if (filter === "high-conf") return "High Confidence";
          if (filter === "stale") return "Stale";
          if (filter === "unknown") return "Unknown";
          if (filter === "clean-only") return "Clean Only";
          if (filter === "bias-long") return "Bias Long";
          if (filter === "bias-short") return "Bias Short";
          if (filter === "bias-mixed") return "Bias Mixed";
          return "All";
        }

        function buildTopBlockers() {
          const blocker = new Map();
          rows.forEach(function (row) {
            const trade = row.dataset.tradeBadge || "";
            if (trade === "LONG READY" || trade === "SHORT READY") return;
            const gateCell = row.children[6];
            const gate = gateCell ? String(gateCell.textContent || "").trim() : "UNKNOWN_GATE";
            blocker.set(gate, (blocker.get(gate) || 0) + 1);
          });

          return Array.from(blocker.entries())
            .sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 4);
        }

        function topRowsByConfidence(limit) {
          return rows
            .slice()
            .sort(function (a, b) {
              const ac = Number(a.dataset.confidenceScore || "0");
              const bc = Number(b.dataset.confidenceScore || "0");
              if (ac !== bc) return bc - ac;
              const ap = Number(a.dataset.statePriority || "99");
              const bp = Number(b.dataset.statePriority || "99");
              return ap - bp;
            })
            .slice(0, limit);
        }

        function renderEmptyStateFor(modeLabel, filteredCount) {
          const panel = document.getElementById("empty-state");
          if (!panel) return;
          if (filteredCount > 0) {
            panel.classList.add("hidden");
            panel.innerHTML = "";
            return;
          }

          const unknownCount = rows.filter(function (row) { return row.dataset.unknown === "1"; }).length;
          const staleCount = rows.filter(function (row) { return (row.dataset.tradeBadge || "") === "STALE"; }).length;
          const noTradeCount = rows.filter(function (row) { return (row.dataset.operatingState || "") === "NO_TRADE_STILL"; }).length;
          const blockers = buildTopBlockers();
          const closest = topRowsByConfidence(3)
            .map(function (row) {
              const symbol = row.dataset.symbolNorm || "UNKNOWN";
              const tf = row.dataset.timeframe || "-";
              const conf = row.dataset.confidenceScore || "0";
              const state = row.dataset.operatingState || "UNKNOWN";
              return "<li><strong>" + symbol + "</strong> <span class=\"badge badge-navy\">" + tf + "</span> <span class=\"badge badge-gray\">" + state + "</span> <span class=\"badge badge-conf-med\">conf " + conf + "</span></li>";
            })
            .join("");

          panel.classList.remove("hidden");
          panel.innerHTML =
            "<h3>No rows match " + modeLabel + " right now</h3>" +
            "<p>Try <strong>All</strong>, <strong>Unknown</strong>, or <strong>Clean Only</strong> to inspect why signals are blocked.</p>" +
            "<p><span class=\"badge badge-unknown\">Unknown hygiene: " + unknownCount + "</span> <span class=\"badge badge-red\">Stale: " + staleCount + "</span> <span class=\"badge badge-gray\">No-trade: " + noTradeCount + "</span></p>" +
            "<p><strong>Top blockers:</strong></p><ul>" +
            (blockers.length
              ? blockers
                  .map(function (entry) {
                    return "<li><span class=\"badge badge-navy\">" + entry[0] + "</span> <strong>" + entry[1] + "</strong></li>";
                  })
                  .join("")
              : "<li><span class=\"badge badge-gray\">none</span></li>") +
            "</ul><p><strong>Closest rows by confidence:</strong></p><ul>" + closest + "</ul>";
        }

        function applyMain() {
          const query = searchInput ? String(searchInput.value || "") : "";
          const filteredRows = rows.filter(function (row) {
            return matchesFilter(row, activeFilter) && matchesSearch(row, query);
          });
          const sortedRows = sortRowsForView(filteredRows);
          const filteredCards = confluenceCards.filter(function (card) {
            return matchesConfluenceFilter(card, activeFilter) && matchesConfluenceSearch(card, query);
          });

          const boardBody = document.getElementById("board-body");
          rows.forEach(function (row) {
            row.style.display = "none";
          });

          if (activeView === "flat" && boardBody) {
            sortedRows.forEach(function (row) {
              boardBody.appendChild(row);
              row.style.display = "";
            });
          });

          confluenceCards.forEach(function (card) {
            const show = filteredCards.includes(card);
            card.style.display = activeView === "confluence" && show ? "" : "none";
          });

          if (visibleCount) {
            visibleCount.textContent = String(activeView === "confluence" ? filteredCards.length : sortedRows.length);
          }

          if (activeView === "collapsed") {
            renderCollapsed(sortedRows);
          }

          const label = filterLabel(activeFilter);
          if (activeView === "confluence") {
            renderEmptyStateFor(label + " (confluence)", filteredCards.length);
          } else {
            renderEmptyStateFor(label, sortedRows.length);
          }
        }

        filterButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeFilter = btn.dataset.filter || "all";
            safeSetPreference("fams.activeFilter", activeFilter);
            setActiveButtons(filterButtons, "filter", activeFilter);
            applyMain();
          });
        });

        viewButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeView = btn.dataset.view || "flat";
            safeSetPreference("fams.activeView", activeView);
            setActiveButtons(viewButtons, "view", activeView);

            if (flatView && collapsedView && confluenceView) {
              flatView.classList.toggle("hidden", activeView !== "flat");
              collapsedView.classList.toggle("hidden", activeView !== "collapsed");
              confluenceView.classList.toggle("hidden", activeView !== "confluence");
            }

            applyMain();
          });
        });

        checklistFilterButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeChecklistFilter = btn.dataset.checkFilter || "all";
            setActiveButtons(checklistFilterButtons, "checkFilter", activeChecklistFilter);
            applyChecklist();
          });
        });

        if (searchInput) {
          searchInput.addEventListener("input", function () {
            applyMain();
          });
        }

        if (sortModeSelect) {
          sortModeSelect.addEventListener("change", function () {
            activeSort = String(sortModeSelect.value || "default");
            safeSetPreference("fams.activeSort", activeSort);
            setActiveSortHeaders(activeSort);
            applyMain();
          });
        }

        sortHeaderButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeSort = String(btn.dataset.sort || "default");
            safeSetPreference("fams.activeSort", activeSort);
            if (sortModeSelect) sortModeSelect.value = activeSort;
            setActiveSortHeaders(activeSort);
            applyMain();
          });
        });

        if (checklistSearch) {
          checklistSearch.addEventListener("input", function () {
            applyChecklist();
          });
        }

        candidateJumpButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            const targetId = btn.getAttribute("data-target-id");
            if (!targetId) return;

            activeView = "flat";
            activeFilter = "all";
            safeSetPreference("fams.activeView", activeView);
            safeSetPreference("fams.activeFilter", activeFilter);
            setActiveButtons(viewButtons, "view", activeView);
            setActiveButtons(filterButtons, "filter", activeFilter);
            if (flatView && collapsedView && confluenceView) {
              flatView.classList.remove("hidden");
              collapsedView.classList.add("hidden");
              confluenceView.classList.add("hidden");
            }
            applyMain();

            const targetRow = document.getElementById(targetId);
            if (!targetRow) return;
            targetRow.classList.add("row-focus");
            targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
            const details = targetRow.querySelector(".why-blocked");
            if (details && details.tagName === "DETAILS") {
              details.open = true;
            }
            window.setTimeout(function () {
              targetRow.classList.remove("row-focus");
            }, 2500);
          });
        });

        setActiveButtons(filterButtons, "filter", activeFilter);
        setActiveButtons(viewButtons, "view", activeView);
        if (sortModeSelect) {
          sortModeSelect.value = activeSort;
        }
        setActiveSortHeaders(activeSort);

        if (flatView && collapsedView && confluenceView) {
          flatView.classList.toggle("hidden", activeView !== "flat");
          collapsedView.classList.toggle("hidden", activeView !== "collapsed");
          confluenceView.classList.toggle("hidden", activeView !== "confluence");
        }

        const refreshCountdown = document.getElementById("refresh-countdown");
        let refreshRemaining = 60;
        if (refreshCountdown) {
          window.setInterval(function () {
            refreshRemaining -= 1;
            if (refreshRemaining <= 0) {
              window.location.reload();
              return;
            }
            refreshCountdown.textContent = String(refreshRemaining) + "s";
          }, 1000);
        }

        applyMain();
        applyChecklist();
      })();
    </script>
  </body>
</html>`;
}
