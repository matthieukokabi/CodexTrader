import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { backup as sqliteBackup, DatabaseSync } from "node:sqlite";
import { deriveState } from "../deriveState.js";
import { isExpectedSymbolNorm } from "../config/whitelist.js";
import type { LatestStateRow } from "../types.js";

interface CleanupCandidate {
  symbol: string;
  timeframe: string;
  symbolNorm: string;
  timeframeCanonical: string;
  reasons: string[];
}

function timestampUtc(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes()
  )}${pad(d.getUTCSeconds())}Z`;
}

async function createBackup(dbPath: string, backupPath: string): Promise<void> {
  mkdirSync(dirname(backupPath), { recursive: true });
  const source = new DatabaseSync(dbPath);
  try {
    await sqliteBackup(source, backupPath);
  } finally {
    source.close();
  }
}

function loadLatestStateRows(db: DatabaseSync): LatestStateRow[] {
  const stmt = db.prepare(`
    SELECT
      schema_version, indicator_version, exchange, symbol, timeframe,
      bar_time_utc, trigger_time_utc, close,
      fams_scenario_code, fams_raw_scenario_code, fams_gate_reason_code, fams_secondary_gate_reason_code,
      fams_bar_confirmed, fams_no_trade_gate, fams_market_type,
      fams_trend_state, fams_htf_trend_state, fams_rvol, fams_extension_score,
      fams_weak_participation, fams_htf_conflict, fams_clean_interaction,
      fams_breakout_accepted, fams_breakout_failure,
      idempotency_hash, received_at_utc
    FROM latest_state
  `);

  return stmt.all() as unknown as LatestStateRow[];
}

function collectCleanupCandidates(rows: LatestStateRow[]): CleanupCandidate[] {
  return rows
    .map((row) => {
      const derived = deriveState(row, new Date());
      const reasons: string[] = [];

      if (!isExpectedSymbolNorm(derived.symbolNorm)) {
        reasons.push("SYMBOL_NOT_WHITELISTED");
      }
      if (row.fams_market_type === 4) {
        reasons.push("MARKET_TYPE_UNKNOWN");
      }
      if (derived.direction === "UNKNOWN") {
        reasons.push("DIRECTION_UNKNOWN");
      }

      return {
        symbol: row.symbol,
        timeframe: row.timeframe,
        symbolNorm: derived.symbolNorm,
        timeframeCanonical: derived.timeframeCanonical,
        reasons
      };
    })
    .filter((candidate) => candidate.reasons.length > 0);
}

async function main(): Promise<void> {
  const dbPath = process.env.FAMS_DB_PATH?.trim() || "/var/lib/fams-dashboard/fams.db";
  const dryRun = process.env.FAMS_MAINTENANCE_DRY_RUN === "1";
  const backupPath = `${dbPath}.bak.${timestampUtc()}`;

  await createBackup(dbPath, backupPath);

  const db = new DatabaseSync(dbPath);
  try {
    const rows = loadLatestStateRows(db);
    const candidates = collectCleanupCandidates(rows);

    console.log(`Backup created: ${backupPath}`);
    console.log(`Rows scanned: ${rows.length}`);
    console.log(`Rows matching cleanup criteria: ${candidates.length}`);

    if (candidates.length === 0) {
      console.log("No rows matched cleanup criteria.");
      return;
    }

    candidates.forEach((candidate) => {
      console.log(
        `${candidate.symbolNorm} / ${candidate.timeframeCanonical} (raw tf=${candidate.timeframe}) -> ${candidate.reasons.join(","
        )}`
      );
    });

    if (dryRun) {
      console.log("Dry run enabled (FAMS_MAINTENANCE_DRY_RUN=1). No rows deleted.");
      return;
    }

    const del = db.prepare("DELETE FROM latest_state WHERE symbol = ? AND timeframe = ?");
    db.exec("BEGIN IMMEDIATE");
    try {
      candidates.forEach((candidate) => {
        del.run(candidate.symbol, candidate.timeframe);
      });
      db.exec("COMMIT");
      console.log(`Deleted rows: ${candidates.length}`);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
