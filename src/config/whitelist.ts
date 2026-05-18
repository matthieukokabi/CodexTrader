export const EXPECTED_SYMBOL_NORMS: string[] = [
  "CME_MINI_DL:NQ1!",
  "CME_MINI_DL:ES1!",
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BYBIT:HYPEUSDT.P",
  "BINANCE:XAUUSDT.P",
  "BINANCE:XAGUSDT.P",
  "TVC:UKOIL",
  "UKOIL"
];

export const EXPECTED_TIMEFRAMES: string[] = ["15", "60", "240", "1D"];

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizeSymbolNormForMatch(value: string): string {
  if (!value.includes(":")) {
    return normalizeToken(value);
  }

  const [rawExchange, ...rawRest] = value.split(":");
  const exchange = normalizeToken(rawExchange);
  const ticker = rawRest.join(":").trim();
  return `${exchange}:${ticker.toUpperCase()}`;
}

export function normalizeTimeframeForMatch(value: string): string {
  const tf = normalizeToken(value);
  if (tf === "15" || tf === "15M") return "15";
  if (tf === "60" || tf === "1H") return "60";
  if (tf === "240" || tf === "4H") return "240";
  if (tf === "D" || tf === "1D" || tf === "1440") return "1D";
  return tf;
}

export const EXPECTED_SYMBOL_MATCH_SET: Set<string> = new Set(
  EXPECTED_SYMBOL_NORMS.map((symbolNorm) => normalizeSymbolNormForMatch(symbolNorm))
);

export const EXPECTED_TIMEFRAME_MATCH_SET: Set<string> = new Set(
  EXPECTED_TIMEFRAMES.map((timeframe) => normalizeTimeframeForMatch(timeframe))
);

export const EXPECTED_PAIR_KEYS: string[] = EXPECTED_SYMBOL_NORMS.flatMap((symbolNorm) =>
  EXPECTED_TIMEFRAMES.map((timeframe) => `${normalizeSymbolNormForMatch(symbolNorm)}__${normalizeTimeframeForMatch(timeframe)}`)
);

export const EXPECTED_PAIR_KEY_SET: Set<string> = new Set(EXPECTED_PAIR_KEYS);

export function buildExpectedPairKey(symbolNorm: string, timeframeCanonical: string): string {
  return `${normalizeSymbolNormForMatch(symbolNorm)}__${normalizeTimeframeForMatch(timeframeCanonical)}`;
}

export function isExpectedSymbolNorm(symbolNorm: string): boolean {
  return EXPECTED_SYMBOL_MATCH_SET.has(normalizeSymbolNormForMatch(symbolNorm));
}

export function isExpectedTimeframe(timeframe: string): boolean {
  return EXPECTED_TIMEFRAME_MATCH_SET.has(normalizeTimeframeForMatch(timeframe));
}
