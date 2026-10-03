import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "fs";
import type { GregConfig, Provider } from "../types";
import { CONFIG_DIR, CONFIG_FILE } from "./paths";

const providers: readonly Provider[] = ["afm", "anthropic", "openai", "gemini", "openrouter"];
export const DEFAULT_TIMEOUT_MS = 30_000;

export function parseConfig(value: unknown): GregConfig {
  if (typeof value !== "object" || value === null || !("provider" in value)
    || !providers.some(provider => provider === value.provider)) {
    throw new Error("Config must specify a supported provider.");
  }
  const provider = providers.find(provider => provider === value.provider);
  if (!provider) throw new Error("Unsupported provider.");
  // The object boundary is validated above; fields are checked before use below.
  const fields = value as Record<string, unknown>;
  const config: GregConfig = { provider };
  for (const field of ["apiKey", "model", "customInstructions"] as const) {
    if (field in fields) {
      const text = fields[field];
      if (typeof text !== "string") throw new Error(`Config ${field} must be a string.`);
      config[field] = text;
    }
  }
  if ("includeHistory" in value) {
    if (typeof value.includeHistory !== "boolean") throw new Error("Config includeHistory must be a boolean.");
    config.includeHistory = value.includeHistory;
  }
  if ("timeoutMs" in value) {
    if (typeof value.timeoutMs !== "number" || !Number.isSafeInteger(value.timeoutMs)
      || value.timeoutMs < 1 || value.timeoutMs > 600_000) {
      throw new Error("Config timeoutMs must be an integer between 1 and 600000.");
    }
    config.timeoutMs = value.timeoutMs;
  }
  return config;
}

export function loadConfig(): GregConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return parseConfig(JSON.parse(readFileSync(CONFIG_FILE, "utf-8")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid config";
    throw new Error(`Could not read ${CONFIG_FILE}: ${message}`);
  }
}

export function saveConfig(config: GregConfig): void {
  const validConfig = parseConfig(config);
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(validConfig, null, 2) + "\n", { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}
