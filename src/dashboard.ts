import { decodeGateReasonShort } from "./logic.js";
import type { MissingExpectedPair, StateViewRow } from "./types.js";

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

export function renderDashboard(rows: StateViewRow[], missingExpectedPairs: MissingExpectedPair[]): string {
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
  data-unknown="${row.unknown_hygiene ? "1" : "0"}">
<td>${esc(row.symbol_norm)}</td>
<td>${esc(row.timeframe_canonical)}</td>
<td><span class="badge ${tradeBadgeClass(row.trade_badge)}">${esc(row.trade_badge)}</span></td>
<td>${esc(row.direction)}</td>
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

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FAMS Trade Readiness Board v2.1</title>
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
      .filter-btn, .view-btn {
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      .filter-btn.active, .view-btn.active { background: #2f5ed7; border-color: #7fa3ff; color: #fff; }
      .counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 14px; }
      .hygiene, .missing {
        border: 1px solid #8b3f00;
        background: #2a1b00;
        border-radius: 8px;
        padding: 10px;
        margin: 0 0 14px;
        color: #ffd4a8;
      }
      .missing { border-color: #4a5a8f; background: #141d36; color: #d0dcff; }
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
      .collapsed-groups { display: grid; gap: 10px; }
      .symbol-card {
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
      .symbol-card table { font-size: 11px; }
      .symbol-card th, .symbol-card td { padding: 4px 6px; }
      code { color: #cddcff; }
    </style>
  </head>
  <body>
    <h1>FAMS Trade Readiness Board v2.1</h1>
    <div class="meta">Generated at ${esc(now.toISOString())} | Visible rows: <span id="visible-count">${rows.length}</span> / ${rows.length}</div>

    <div class="counts">
      <span class="badge badge-green">FINAL_SCENARIO_ACTIVE: ${counts.FINAL_SCENARIO_ACTIVE || 0}</span>
      <span class="badge badge-yellow">RAW_SETUP_FORMING: ${counts.RAW_SETUP_FORMING || 0}</span>
      <span class="badge badge-orange">STRUCTURAL_READY_WATCH: ${counts.STRUCTURAL_READY_WATCH || 0}</span>
      <span class="badge badge-gray">NO_TRADE_STILL: ${counts.NO_TRADE_STILL || 0}</span>
      <span class="badge badge-red">STALE_DATA: ${counts.STALE_DATA || 0}</span>
    </div>

    <div class="toolbar">
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="long">Long Ready</button>
        <button class="filter-btn" data-filter="short">Short Ready</button>
        <button class="filter-btn" data-filter="watch">Watch</button>
        <button class="filter-btn" data-filter="stale">Stale</button>
        <button class="filter-btn" data-filter="unknown">Unknown</button>
      </div>
      <div class="view-toggle">
        <button class="view-btn active" data-view="flat">Flat</button>
        <button class="view-btn" data-view="collapsed">Collapsed</button>
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

    <script>
      (function () {
        const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
        const viewButtons = Array.from(document.querySelectorAll(".view-btn"));
        const searchInput = document.getElementById("symbol-search");
        const visibleCount = document.getElementById("visible-count");
        const flatView = document.getElementById("flat-view");
        const collapsedView = document.getElementById("collapsed-view");
        const collapsedGroups = document.getElementById("collapsed-groups");
        const rows = Array.from(document.querySelectorAll(".board-row"));

        let activeFilter = "all";
        let activeView = "flat";

        function matchesFilter(row, filter) {
          const badge = row.dataset.tradeBadge || "";
          if (filter === "all") return true;
          if (filter === "long") return badge === "LONG READY";
          if (filter === "short") return badge === "SHORT READY";
          if (filter === "watch") return badge === "WATCH";
          if (filter === "stale") return badge === "STALE";
          if (filter === "unknown") return badge === "UNKNOWN";
          return true;
        }

        function matchesSearch(row, query) {
          if (!query) return true;
          const q = query.toLowerCase();
          const symbol = (row.dataset.symbol || "").toLowerCase();
          const symbolNorm = (row.dataset.symbolNorm || "").toLowerCase();
          return symbol.includes(q) || symbolNorm.includes(q);
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

            const head = document.createElement("div");
            head.className = "symbol-card-head";
            head.innerHTML =
              '<span class="badge badge-navy">' + group.key + '</span>' +
              '<span class="badge ' + tradeClass(bestTrade) + '">' + bestTrade + '</span>' +
              '<span class="badge ' + confClass(bestConfBucket) + '">' + bestConfBucket + ' ' + bestConfScore + '</span>';

            const table = document.createElement("table");
            const rowsHtml = group.rows
              .map(function (row) {
                const trade = row.dataset.tradeBadge || "NO_TRADE";
                const bucket = row.dataset.confidenceBucket || "LOW";
                const ageText = row.children[11] ? row.children[11].textContent : "";
                return '<tr>' +
                  '<td>' + (row.dataset.timeframe || "") + '</td>' +
                  '<td><span class="badge ' + tradeClass(trade) + '">' + trade + '</span></td>' +
                  '<td>' + (row.dataset.operatingState || "") + '</td>' +
                  '<td><span class="badge ' + confClass(bucket) + '">' + bucket + ' ' + (row.dataset.confidenceScore || "0") + '</span></td>' +
                  '<td>' + ageText + '</td>' +
                  '</tr>';
              })
              .join("");

            table.innerHTML =
              '<thead><tr><th>tf</th><th>trade</th><th>state</th><th>confidence</th><th>age</th></tr></thead>' +
              '<tbody>' + rowsHtml + '</tbody>';

            card.appendChild(head);
            card.appendChild(table);
            collapsedGroups.appendChild(card);
          });
        }

        function apply() {
          const query = searchInput ? String(searchInput.value || "") : "";
          const filteredRows = rows.filter(function (row) {
            return matchesFilter(row, activeFilter) && matchesSearch(row, query);
          });

          rows.forEach(function (row) {
            const show = filteredRows.includes(row);
            row.style.display = activeView === "flat" && show ? "" : "none";
          });

          if (visibleCount) {
            visibleCount.textContent = String(filteredRows.length);
          }

          if (activeView === "collapsed") {
            renderCollapsed(filteredRows);
          }
        }

        filterButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeFilter = btn.dataset.filter || "all";
            setActiveButtons(filterButtons, "filter", activeFilter);
            apply();
          });
        });

        viewButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeView = btn.dataset.view || "flat";
            setActiveButtons(viewButtons, "view", activeView);

            if (flatView && collapsedView) {
              if (activeView === "flat") {
                flatView.classList.remove("hidden");
                collapsedView.classList.add("hidden");
              } else {
                flatView.classList.add("hidden");
                collapsedView.classList.remove("hidden");
              }
            }

            apply();
          });
        });

        if (searchInput) {
          searchInput.addEventListener("input", function () {
            apply();
          });
        }

        apply();
      })();
    </script>
  </body>
</html>`;
}
