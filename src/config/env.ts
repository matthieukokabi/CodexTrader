export type RuntimeEnv = "production" | "development";

export interface AppConfig {
  nodeEnv: RuntimeEnv;
  host: string;
  port: number;
  ingestKey: string;
  bodySecret?: string;
  dbPath: string;
  logLevel: "info" | "debug";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function normalizeNodeEnv(value: string | undefined): RuntimeEnv {
  const normalized = value?.trim().toLowerCase();
  return normalized === "production" ? "production" : "development";
}

export function loadConfig(): AppConfig {
  const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
  const host = process.env.FAMS_HOST?.trim() || "127.0.0.1";

  const portDefault = nodeEnv === "production" ? "4890" : "5900";
  const portRaw = process.env.FAMS_PORT?.trim() || portDefault;
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("FAMS_PORT must be a valid TCP port number");
  }

  const dbPathDefault = nodeEnv === "production" ? "/var/lib/fams-dashboard/fams.db" : "./fams-local.db";
  const dbPath = process.env.FAMS_DB_PATH?.trim() || dbPathDefault;

  const ingestKey =
    nodeEnv === "production" ? required("FAMS_INGEST_KEY") : process.env.FAMS_INGEST_KEY?.trim() || "dev-local-key";

  return {
    nodeEnv,
    host,
    port,
    ingestKey,
    bodySecret: process.env.FAMS_BODY_SECRET?.trim() || undefined,
    dbPath,
    logLevel: process.env.FAMS_LOG_LEVEL?.trim() === "debug" ? "debug" : "info"
  };
}
