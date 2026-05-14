export interface AppConfig {
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

export function loadConfig(): AppConfig {
  const host = process.env.FAMS_HOST?.trim() || "127.0.0.1";
  const portRaw = process.env.FAMS_PORT?.trim() || "4890";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("FAMS_PORT must be a valid TCP port number");
  }

  const dbPath = process.env.FAMS_DB_PATH?.trim() || "/var/lib/fams-dashboard/fams.db";

  return {
    host,
    port,
    ingestKey: required("FAMS_INGEST_KEY"),
    bodySecret: process.env.FAMS_BODY_SECRET?.trim() || undefined,
    dbPath,
    logLevel: (process.env.FAMS_LOG_LEVEL?.trim() === "debug" ? "debug" : "info")
  };
}
