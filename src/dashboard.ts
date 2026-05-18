import { decodeGateReasonShort } from "./logic.js";
import type { StateViewRow } from "./types.js";

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

function directionClass(direction: string): string {
  if (direction === "LONG") return "badge-green";
  if (direction === "SHORT") return "badge-red";
  return "badge-gray";
}

function trendClass(trend: string): string {
  if (trend === "BULLISH") return "badge-green";
  if (trend === "BEARISH") return "badge-red";
  return "badge-gray";
}

export function renderDashboard(rows: StateViewRow[]): string {
  const now = new Date();

  const unknownRows = rows.filter((row) => row.unknown_hygiene);
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.operating_state] = (acc[row.operating_state] || 0) + 1;
    return acc;
  }, {});

  const tr = rows
    .map((row) => {
      const watch = row.operating_state === "RAW_SETUP_FORMING" || row.operating_state === "STRUCTURAL_READY_WATCH";
      const active = row.operating_state === "FINAL_SCENARIO_ACTIVE" || watch;
      const longReady = row.direction === "LONG" && active && !row.stale && !row.unknown_hygiene;
      const shortReady = row.direction === "SHORT" && active && !row.stale && !row.unknown_hygiene;

      return `<tr class="board-row"
  data-long-ready="${longReady ? "1" : "0"}"
  data-short-ready="${shortReady ? "1" : "0"}"
  data-watch="${watch ? "1" : "0"}"
  data-stale="${row.stale ? "1" : "0"}"
  data-unknown="${row.unknown_hygiene ? "1" : "0"}">
<td>${esc(row.symbol)}</td>
<td>${esc(row.timeframe)}</td>
<td><span class="badge ${directionClass(row.direction)}">${esc(row.direction)}</span></td>
<td><span class="badge ${stateClass(row.operating_state)}">${esc(row.operating_state)}</span></td>
<td><span class="badge badge-navy">${esc(decodeGateReasonShort(row.gate_reason_code))}</span></td>
<td><span class="badge ${trendClass(row.trend_state)}">${esc(row.trend_state)}</span></td>
<td><span class="badge ${trendClass(row.htf_trend_state)}">${esc(row.htf_trend_state)}</span></td>
<td>${esc(row.rvol.toFixed(3))}</td>
<td>${esc(row.extension_score.toFixed(3))}</td>
<td>${esc(row.age)}</td>
<td>${esc(row.received_at_utc)}</td>
<td>${row.unknown_hygiene ? '<span class="badge badge-red">WARN</span>' : '<span class="badge badge-green">OK</span>'}</td>
</tr>`;
    })
    .join("\n");

  const hygienePanel =
    unknownRows.length > 0
      ? `<div class="hygiene">
  <strong>Symbol Hygiene Warning</strong>
  <div>Rows with UNKNOWN market type or UNKNOWN direction are flagged and available under the <code>Unknown</code> filter.</div>
  <ul>
    ${unknownRows
      .map(
        (row) =>
          `<li>${esc(row.symbol)} / ${esc(row.timeframe)} - market=${esc(row.market_type)} direction=${esc(row.direction)}</li>`
      )
      .join("\n")}
  </ul>
</div>`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FAMS Trade Readiness Board</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 16px; background: #0b1020; color: #f0f4ff; }
      h1 { font-size: 20px; margin: 0 0 10px 0; }
      .meta { margin-bottom: 12px; color: #9fb2e6; }
      .counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 14px; }
      .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
      .filter-btn {
        background: #1a264d;
        color: #dbe8ff;
        border: 1px solid #2f3b63;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      .filter-btn.active { background: #2f5ed7; border-color: #7fa3ff; color: #ffffff; }
      .hygiene {
        border: 1px solid #8b3f00;
        background: #2a1b00;
        border-radius: 8px;
        padding: 10px;
        margin: 0 0 14px;
        color: #ffd4a8;
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
      code { color: #cddcff; }
    </style>
  </head>
  <body>
    <h1>FAMS Trade Readiness Board</h1>
    <div class="meta">Generated at ${esc(now.toISOString())} | Rows: <span id="visible-count">${rows.length}</span> / ${rows.length}</div>

    <div class="counts">
      <span class="badge badge-green">FINAL_SCENARIO_ACTIVE: ${counts.FINAL_SCENARIO_ACTIVE || 0}</span>
      <span class="badge badge-yellow">RAW_SETUP_FORMING: ${counts.RAW_SETUP_FORMING || 0}</span>
      <span class="badge badge-orange">STRUCTURAL_READY_WATCH: ${counts.STRUCTURAL_READY_WATCH || 0}</span>
      <span class="badge badge-gray">NO_TRADE_STILL: ${counts.NO_TRADE_STILL || 0}</span>
      <span class="badge badge-red">STALE_DATA: ${counts.STALE_DATA || 0}</span>
    </div>

    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="long">Long Ready</button>
      <button class="filter-btn" data-filter="short">Short Ready</button>
      <button class="filter-btn" data-filter="watch">Watch</button>
      <button class="filter-btn" data-filter="stale">Stale</button>
      <button class="filter-btn" data-filter="unknown">Unknown</button>
    </div>

    ${hygienePanel}

    <table>
      <thead>
        <tr>
          <th>symbol</th>
          <th>tf</th>
          <th>direction</th>
          <th>readiness</th>
          <th>gate</th>
          <th>trend</th>
          <th>htf</th>
          <th>rvol</th>
          <th>extension</th>
          <th>age</th>
          <th>last_update</th>
          <th>hygiene</th>
        </tr>
      </thead>
      <tbody id="board-body">
        ${tr}
      </tbody>
    </table>

    <script>
      (function () {
        const buttons = Array.from(document.querySelectorAll(".filter-btn"));
        const rows = Array.from(document.querySelectorAll(".board-row"));
        const visibleCount = document.getElementById("visible-count");

        function match(filter, row) {
          if (filter === "all") return true;
          if (filter === "long") return row.dataset.longReady === "1";
          if (filter === "short") return row.dataset.shortReady === "1";
          if (filter === "watch") return row.dataset.watch === "1";
          if (filter === "stale") return row.dataset.stale === "1";
          if (filter === "unknown") return row.dataset.unknown === "1";
          return true;
        }

        function applyFilter(filter) {
          let shown = 0;
          rows.forEach((row) => {
            const show = match(filter, row);
            row.style.display = show ? "" : "none";
            if (show) shown += 1;
          });
          if (visibleCount) {
            visibleCount.textContent = String(shown);
          }

          buttons.forEach((btn) => {
            if (btn.dataset.filter === filter) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
          });
        }

        buttons.forEach((btn) => {
          btn.addEventListener("click", () => applyFilter(btn.dataset.filter || "all"));
        });
      })();
    </script>
  </body>
</html>`;
}
