import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import type { GregConfig } from "../types";
import { CONFIG_DIR, CONFIG_FILE } from "./paths";

export function loadConfig(): GregConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as GregConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: GregConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}
