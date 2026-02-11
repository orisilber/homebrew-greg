import { readFileSync, existsSync } from "fs";
import { homedir, platform, arch } from "os";
import { join } from "path";
import { execSync } from "child_process";
import type { TerminalContext } from "../types";

export interface ContextLimits {
  maxHistoryLines: number;
  maxDirLines: number;
}

export const LIMITS_CLOUD: ContextLimits = { maxHistoryLines: 30, maxDirLines: 50 };
export const LIMITS_AFM: ContextLimits = { maxHistoryLines: 5, maxDirLines: 15 };

export function getTerminalContext(
  limits: ContextLimits = LIMITS_CLOUD
): TerminalContext {
  const cwd = process.cwd();
  const osName = platform() === "darwin" ? "macOS" : platform();
  const archName = arch();

  let history = "";
  try {
    const histFile = join(homedir(), ".zsh_history");
    if (existsSync(histFile)) {
      const raw = readFileSync(histFile, "utf-8");
      const lines = raw
        .split("\n")
        .map((l) => l.replace(/^: \d+:\d+;/, "").trim())
        .filter(Boolean)
        .slice(-limits.maxHistoryLines);
      history = lines.join("\n");
    }
  } catch {}

  let dirListing = "";
  try {
    const full = execSync("ls -la", {
      encoding: "utf-8",
      timeout: 3000,
      cwd,
    }).trim();
    const dirLines = full.split("\n");
    if (dirLines.length > limits.maxDirLines) {
      dirListing = dirLines.slice(0, limits.maxDirLines).join("\n")
        + `\n... (${dirLines.length - limits.maxDirLines} more)`;
    } else {
      dirListing = full;
    }
  } catch {}

  return { cwd, osName, archName, history, dirListing };
}
