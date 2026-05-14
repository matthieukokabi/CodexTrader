import { z } from "zod";
import type { IngestPayload } from "./types.js";

function toNumber(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (cleaned.length === 0) return NaN;
    return Number(cleaned);
  }
  return value;
}

const numberField = z.preprocess(toNumber, z.number().finite());
const intField = z.preprocess(toNumber, z.number().int());

const schema = z.object({
  schema_version: z.literal("fams.v1"),
  indicator_version: z.string().min(1),
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  bar_time_utc: z.string().min(1),
  trigger_time_utc: z.string().min(1),
  close: numberField,

  fams_scenario_code: intField,
  fams_raw_scenario_code: intField,
  fams_gate_reason_code: intField,
  fams_secondary_gate_reason_code: intField,

  fams_bar_confirmed: intField,
  fams_no_trade_gate: intField,
  fams_market_type: intField,
  fams_trend_state: intField,
  fams_htf_trend_state: intField,
  fams_rvol: numberField,
  fams_extension_score: numberField,
  fams_weak_participation: intField,
  fams_htf_conflict: intField,
  fams_clean_interaction: intField,
  fams_breakout_accepted: intField,
  fams_breakout_failure: intField,

  body_secret: z.string().optional()
});

export function parsePayload(input: unknown): IngestPayload {
  return schema.parse(input) as IngestPayload;
}
