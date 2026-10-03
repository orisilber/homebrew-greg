import { homedir } from "os";
import { join, dirname, resolve } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const sourceDir = dirname(fileURLToPath(import.meta.url));

export const CONFIG_DIR = process.env.GREG_CONFIG_DIR
  ? resolve(process.env.GREG_CONFIG_DIR)
  : join(homedir(), ".config", "greg");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const AFM_SWIFT_SRC = existsSync(join(sourceDir, "afm-bridge.swift"))
  ? join(sourceDir, "afm-bridge.swift")
  : join(sourceDir, "..", "..", "swift", "afm-bridge.swift");
export const AFM_BINARY = join(CONFIG_DIR, "afm-bridge");
