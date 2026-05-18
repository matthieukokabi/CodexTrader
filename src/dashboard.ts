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
    <strong>Action required (top 5)</strong>
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

      const scenarioDirection = bestLong && bestShort ? "MIXED" : bestLong ? "LONG" : bestShort ? "SHORT" : "UNKNOWN";

      return `<div class="confluence-card"
  data-symbol-norm="${esc(rollup.symbol_norm)}"
  data-best-long-badge="${esc(longBadge)}"
  data-best-short-badge="${esc(shortBadge)}"
  data-rank="${esc(rollup.sort_rank)}"
  data-unknown="${rollup.unknown_hygiene ? "1" : "0"}"
  data-direction-bias="${esc(rollup.direction_bias)}">
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

  const flatRows = rows
    .map((row) => {
      return `<tr class="board-row"
  data-symbol="${esc(row.symbol)}"
  data-symbol-norm="${esc(row.symbol_norm)}"
  data-timeframe="${esc(row.timeframe)}"
  data-timeframe-minutes="${esc(row.timeframe_minutes ?? "")}" 
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
      ? `<div class="hygiene">
  <strong>Symbol Hygiene Warning</strong>
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
</div>`
      : "";

  const missingSection = renderMissingMatrix(missingExpectedPairs);
  const confluenceCards = renderConfluenceCards(confluenceRollups);
  const boardHealthWidget = renderBoardHealth(boardHealth);
  const checklistWidget = renderChecklistTable(symbolChecklist);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FAMS Trade Readiness Board v3.1</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 16px; background: #0b1020; color: #f0f4ff; }
      h1 { font-size: 20px; margin: 0 0 10px 0; }
      .meta { margin-bottom: 12px; color: #9fb2e6; }
      .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
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
      .missing { border-color: #4a5a8f; background: #141d36; color: #d0dcff; }
      .widget-grid { display: grid; gap: 6px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 8px; }
      .widget-grid .k { display: block; color: #9fb2e6; font-size: 11px; }
      .widget-grid .v { display: block; font-size: 13px; }
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
      .badge-unknown { background: #1a264d; color: #c7d2f7; border-color: #4a5a8f; }
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
      code { color: #cddcff; }
    </style>
  </head>
  <body>
    <h1>FAMS Trade Readiness Board v3.1</h1>
    <div class="meta">Generated at ${esc(now.toISOString())} | Visible items: <span id="visible-count">${rows.length}</span></div>

    <div class="counts">
      <span class="badge badge-green">FINAL_SCENARIO_ACTIVE: ${counts.FINAL_SCENARIO_ACTIVE || 0}</span>
      <span class="badge badge-yellow">RAW_SETUP_FORMING: ${counts.RAW_SETUP_FORMING || 0}</span>
      <span class="badge badge-orange">STRUCTURAL_READY_WATCH: ${counts.STRUCTURAL_READY_WATCH || 0}</span>
      <span class="badge badge-gray">NO_TRADE_STILL: ${counts.NO_TRADE_STILL || 0}</span>
      <span class="badge badge-red">STALE_DATA: ${counts.STALE_DATA || 0}</span>
    </div>

    ${boardHealthWidget}
    ${checklistWidget}

    <div class="toolbar">
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="long">Long Ready</button>
        <button class="filter-btn" data-filter="short">Short Ready</button>
        <button class="filter-btn" data-filter="watch">Watch</button>
        <button class="filter-btn" data-filter="stale">Stale</button>
        <button class="filter-btn" data-filter="unknown">Unknown</button>
        <button class="filter-btn" data-filter="bias-long">Bias Long</button>
        <button class="filter-btn" data-filter="bias-short">Bias Short</button>
        <button class="filter-btn" data-filter="bias-mixed">Bias Mixed</button>
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

    ${missingSection}
    ${hygienePanel}

    <div id="flat-view">
      <table>
        <thead>
          <tr>
            <th>symbol_norm</th>
            <th>tf</th>
            <th>trade</th>
            <th>dir</th>
            <th>bias</th>
            <th>state</th>
            <th>gate</th>
            <th>trend</th>
            <th>htf</th>
            <th>confidence</th>
            <th>rvol</th>
            <th>extension</th>
            <th>age</th>
            <th>last_update</th>
            <th>hygiene</th>
          </tr>
        </thead>
        <tbody id="board-body">
          ${flatRows}
        </tbody>
      </table>
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

        let activeFilter = "all";
        let activeView = "flat";
        let activeChecklistFilter = "all";

        function matchesFilter(row, filter) {
          const badge = row.dataset.tradeBadge || "";
          const bias = row.dataset.directionBias || "MIXED";

          if (filter === "all") return true;
          if (filter === "long") return badge === "LONG READY";
          if (filter === "short") return badge === "SHORT READY";
          if (filter === "watch") return badge === "WATCH";
          if (filter === "stale") return badge === "STALE";
          if (filter === "unknown") return badge === "UNKNOWN";
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

          if (filter === "all") return true;
          if (filter === "long") return longBadge === "LONG READY";
          if (filter === "short") return shortBadge === "SHORT READY";
          if (filter === "watch") return longBadge === "WATCH" || shortBadge === "WATCH" || rank === 3;
          if (filter === "stale") return longBadge === "STALE" || shortBadge === "STALE" || rank === 4;
          if (filter === "unknown") return unknown || rank === 7;
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
            if (btn.dataset[key] === value) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
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
                const ageText = row.children[12] ? row.children[12].textContent : "";
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

        function applyMain() {
          const query = searchInput ? String(searchInput.value || "") : "";
          const filteredRows = rows.filter(function (row) {
            return matchesFilter(row, activeFilter) && matchesSearch(row, query);
          });
          const filteredCards = confluenceCards.filter(function (card) {
            return matchesConfluenceFilter(card, activeFilter) && matchesConfluenceSearch(card, query);
          });

          rows.forEach(function (row) {
            const show = filteredRows.includes(row);
            row.style.display = activeView === "flat" && show ? "" : "none";
          });

          confluenceCards.forEach(function (card) {
            const show = filteredCards.includes(card);
            card.style.display = activeView === "confluence" && show ? "" : "none";
          });

          if (visibleCount) {
            visibleCount.textContent = String(activeView === "confluence" ? filteredCards.length : filteredRows.length);
          }

          if (activeView === "collapsed") {
            renderCollapsed(filteredRows);
          }
        }

        filterButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeFilter = btn.dataset.filter || "all";
            setActiveButtons(filterButtons, "filter", activeFilter);
            applyMain();
          });
        });

        viewButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeView = btn.dataset.view || "flat";
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

        if (checklistSearch) {
          checklistSearch.addEventListener("input", function () {
            applyChecklist();
          });
        }

        applyMain();
        applyChecklist();
      })();
    </script>
  </body>
</html>`;
}
