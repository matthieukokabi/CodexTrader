import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { IngestPayload, LatestStateRow } from "./types.js";

export class FamsDb {
  private readonly db: DatabaseSync;

  constructor(private readonly dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_hash TEXT NOT NULL UNIQUE,
        schema_version TEXT NOT NULL,
        indicator_version TEXT NOT NULL,
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        bar_time_utc TEXT NOT NULL,
        trigger_time_utc TEXT NOT NULL,
        close REAL NOT NULL,
        fams_scenario_code INTEGER NOT NULL,
        fams_raw_scenario_code INTEGER NOT NULL,
        fams_gate_reason_code INTEGER NOT NULL,
        fams_secondary_gate_reason_code INTEGER NOT NULL,
        fams_bar_confirmed INTEGER NOT NULL,
        fams_no_trade_gate INTEGER NOT NULL,
        fams_market_type INTEGER NOT NULL,
        fams_trend_state INTEGER NOT NULL,
        fams_htf_trend_state INTEGER NOT NULL,
        fams_rvol REAL NOT NULL,
        fams_extension_score REAL NOT NULL,
        fams_weak_participation INTEGER NOT NULL,
        fams_htf_conflict INTEGER NOT NULL,
        fams_clean_interaction INTEGER NOT NULL,
        fams_breakout_accepted INTEGER NOT NULL,
        fams_breakout_failure INTEGER NOT NULL,
        received_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS latest_state (
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        idempotency_hash TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        indicator_version TEXT NOT NULL,
        exchange TEXT NOT NULL,
        bar_time_utc TEXT NOT NULL,
        trigger_time_utc TEXT NOT NULL,
        close REAL NOT NULL,
        fams_scenario_code INTEGER NOT NULL,
        fams_raw_scenario_code INTEGER NOT NULL,
        fams_gate_reason_code INTEGER NOT NULL,
        fams_secondary_gate_reason_code INTEGER NOT NULL,
        fams_bar_confirmed INTEGER NOT NULL,
        fams_no_trade_gate INTEGER NOT NULL,
        fams_market_type INTEGER NOT NULL,
        fams_trend_state INTEGER NOT NULL,
        fams_htf_trend_state INTEGER NOT NULL,
        fams_rvol REAL NOT NULL,
        fams_extension_score REAL NOT NULL,
        fams_weak_participation INTEGER NOT NULL,
        fams_htf_conflict INTEGER NOT NULL,
        fams_clean_interaction INTEGER NOT NULL,
        fams_breakout_accepted INTEGER NOT NULL,
        fams_breakout_failure INTEGER NOT NULL,
        received_at_utc TEXT NOT NULL,
        PRIMARY KEY (symbol, timeframe)
      );

      CREATE INDEX IF NOT EXISTS idx_latest_received_at ON latest_state(received_at_utc);
      CREATE INDEX IF NOT EXISTS idx_events_symbol_tf_bar ON events(symbol, timeframe, bar_time_utc);
    `);
  }

  static computeIdempotencyHash(payload: IngestPayload): string {
    const value = [
      payload.symbol,
      payload.timeframe,
      payload.bar_time_utc,
      payload.fams_scenario_code,
      payload.fams_raw_scenario_code
    ].join("|");
    return createHash("sha256").update(value).digest("hex");
  }

  ingest(payload: IngestPayload): { inserted: boolean; idempotencyHash: string; receivedAtUtc: string } {
    const idempotencyHash = FamsDb.computeIdempotencyHash(payload);
    const receivedAtUtc = new Date().toISOString();

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        idempotency_hash, schema_version, indicator_version, exchange, symbol, timeframe,
        bar_time_utc, trigger_time_utc, close,
        fams_scenario_code, fams_raw_scenario_code, fams_gate_reason_code, fams_secondary_gate_reason_code,
        fams_bar_confirmed, fams_no_trade_gate, fams_market_type,
        fams_trend_state, fams_htf_trend_state, fams_rvol, fams_extension_score,
        fams_weak_participation, fams_htf_conflict, fams_clean_interaction,
        fams_breakout_accepted, fams_breakout_failure, received_at_utc
      ) VALUES (
        ?,?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,?
      )
    `);

    const result = insert.run(
      idempotencyHash,
      payload.schema_version,
      payload.indicator_version,
      payload.exchange,
      payload.symbol,
      payload.timeframe,
      payload.bar_time_utc,
      payload.trigger_time_utc,
      payload.close,
      payload.fams_scenario_code,
      payload.fams_raw_scenario_code,
      payload.fams_gate_reason_code,
      payload.fams_secondary_gate_reason_code,
      payload.fams_bar_confirmed,
      payload.fams_no_trade_gate,
      payload.fams_market_type,
      payload.fams_trend_state,
      payload.fams_htf_trend_state,
      payload.fams_rvol,
      payload.fams_extension_score,
      payload.fams_weak_participation,
      payload.fams_htf_conflict,
      payload.fams_clean_interaction,
      payload.fams_breakout_accepted,
      payload.fams_breakout_failure,
      receivedAtUtc
    ) as { changes?: number };

    const inserted = (result?.changes || 0) > 0;

    if (inserted) {
      const upsert = this.db.prepare(`
        INSERT INTO latest_state (
          symbol, timeframe, idempotency_hash, schema_version, indicator_version, exchange,
          bar_time_utc, trigger_time_utc, close,
          fams_scenario_code, fams_raw_scenario_code, fams_gate_reason_code, fams_secondary_gate_reason_code,
          fams_bar_confirmed, fams_no_trade_gate, fams_market_type,
          fams_trend_state, fams_htf_trend_state, fams_rvol, fams_extension_score,
          fams_weak_participation, fams_htf_conflict, fams_clean_interaction,
          fams_breakout_accepted, fams_breakout_failure, received_at_utc
        ) VALUES (
          ?,?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,?
        )
        ON CONFLICT(symbol, timeframe) DO UPDATE SET
          idempotency_hash = excluded.idempotency_hash,
          schema_version = excluded.schema_version,
          indicator_version = excluded.indicator_version,
          exchange = excluded.exchange,
          bar_time_utc = excluded.bar_time_utc,
          trigger_time_utc = excluded.trigger_time_utc,
          close = excluded.close,
          fams_scenario_code = excluded.fams_scenario_code,
          fams_raw_scenario_code = excluded.fams_raw_scenario_code,
          fams_gate_reason_code = excluded.fams_gate_reason_code,
          fams_secondary_gate_reason_code = excluded.fams_secondary_gate_reason_code,
          fams_bar_confirmed = excluded.fams_bar_confirmed,
          fams_no_trade_gate = excluded.fams_no_trade_gate,
          fams_market_type = excluded.fams_market_type,
          fams_trend_state = excluded.fams_trend_state,
          fams_htf_trend_state = excluded.fams_htf_trend_state,
          fams_rvol = excluded.fams_rvol,
          fams_extension_score = excluded.fams_extension_score,
          fams_weak_participation = excluded.fams_weak_participation,
          fams_htf_conflict = excluded.fams_htf_conflict,
          fams_clean_interaction = excluded.fams_clean_interaction,
          fams_breakout_accepted = excluded.fams_breakout_accepted,
          fams_breakout_failure = excluded.fams_breakout_failure,
          received_at_utc = excluded.received_at_utc
      `);

      upsert.run(
        payload.symbol,
        payload.timeframe,
        idempotencyHash,
        payload.schema_version,
        payload.indicator_version,
        payload.exchange,
        payload.bar_time_utc,
        payload.trigger_time_utc,
        payload.close,
        payload.fams_scenario_code,
        payload.fams_raw_scenario_code,
        payload.fams_gate_reason_code,
        payload.fams_secondary_gate_reason_code,
        payload.fams_bar_confirmed,
        payload.fams_no_trade_gate,
        payload.fams_market_type,
        payload.fams_trend_state,
        payload.fams_htf_trend_state,
        payload.fams_rvol,
        payload.fams_extension_score,
        payload.fams_weak_participation,
        payload.fams_htf_conflict,
        payload.fams_clean_interaction,
        payload.fams_breakout_accepted,
        payload.fams_breakout_failure,
        receivedAtUtc
      );
    }

    return { inserted, idempotencyHash, receivedAtUtc };
  }

  getLatestState(): LatestStateRow[] {
    const stmt = this.db.prepare(`
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
      ORDER BY symbol ASC, timeframe ASC
    `);

    return stmt.all() as unknown as LatestStateRow[];
  }

  close(): void {
    this.db.close();
  }
}
