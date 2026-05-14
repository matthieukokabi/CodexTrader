import {
  decodeGateReason,
  decodeMarketType,
  decodeRawScenario,
  decodeScenario,
  decodeSecondaryGateReason,
  decodeTrend,
  deriveOperatingState,
  formatAge
} from "./logic.js";
import type { LatestStateRow } from "./types.js";

function esc(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderDashboard(rows: LatestStateRow[]): string {
  const now = new Date();
  const tr = rows
    .map((row) => {
      const derived = deriveOperatingState(row, now);
      const staleText = derived.stale ? "YES" : "NO";
      return `<tr>
<td>${esc(row.symbol)}</td>
<td>${esc(row.timeframe)}</td>
<td>${esc(decodeMarketType(row.fams_market_type))}</td>
<td>${esc(decodeScenario(row.fams_scenario_code))}</td>
<td>${esc(decodeRawScenario(row.fams_raw_scenario_code))}</td>
<td>${esc(derived.operatingState)}</td>
<td>${esc(decodeGateReason(row.fams_gate_reason_code))}</td>
<td>${esc(decodeSecondaryGateReason(row.fams_secondary_gate_reason_code))}</td>
<td>${esc(decodeTrend(row.fams_trend_state))}</td>
<td>${esc(decodeTrend(row.fams_htf_trend_state))}</td>
<td>${esc(row.fams_rvol.toFixed(4))}</td>
<td>${esc(row.fams_extension_score.toFixed(4))}</td>
<td>${esc(row.fams_weak_participation)}</td>
<td>${esc(row.fams_htf_conflict)}</td>
<td>${esc(row.fams_clean_interaction)}</td>
<td>${esc(row.fams_breakout_accepted)}</td>
<td>${esc(row.fams_breakout_failure)}</td>
<td>${esc(row.fams_bar_confirmed)}</td>
<td>${esc(row.close)}</td>
<td>${esc(row.bar_time_utc)}</td>
<td>${esc(row.received_at_utc)}</td>
<td>${esc(formatAge(derived.ageMs))}</td>
<td>${staleText}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FAMS Dashboard v1</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 16px; background: #0b1020; color: #f0f4ff; }
      h1 { font-size: 18px; margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #2f3b63; padding: 6px; text-align: left; white-space: nowrap; }
      th { position: sticky; top: 0; background: #15203f; }
      tr:nth-child(even) { background: #111a34; }
      .meta { margin-bottom: 12px; color: #9fb2e6; }
    </style>
  </head>
  <body>
    <h1>FAMS Dashboard v1 (Read-only)</h1>
    <div class="meta">Generated at ${esc(now.toISOString())} | Rows: ${rows.length}</div>
    <table>
      <thead>
        <tr>
          <th>symbol</th>
          <th>timeframe</th>
          <th>market_type</th>
          <th>final_scenario</th>
          <th>raw_scenario</th>
          <th>operating_state</th>
          <th>gate_reason</th>
          <th>secondary_gate_reason</th>
          <th>trend_state</th>
          <th>htf_trend_state</th>
          <th>rvol</th>
          <th>extension_score</th>
          <th>weak_participation</th>
          <th>htf_conflict</th>
          <th>clean_interaction</th>
          <th>breakout_accepted</th>
          <th>breakout_failure</th>
          <th>bar_confirmed</th>
          <th>last_price</th>
          <th>bar_time_utc</th>
          <th>received_at_utc</th>
          <th>age</th>
          <th>stale</th>
        </tr>
      </thead>
      <tbody>
        ${tr}
      </tbody>
    </table>
  </body>
</html>`;
}
