import { openSync, readSync, closeSync, fstatSync, readdirSync } from "fs";
import { homedir, platform, arch } from "os";
import { join } from "path";
import type { TerminalContext } from "../types";

export interface ContextLimits {
  maxHistoryLines: number;
  maxDirLines: number;
}

export const LIMITS_CLOUD: ContextLimits = { maxHistoryLines: 10, maxDirLines: 50 };
export const LIMITS_AFM: ContextLimits = { maxHistoryLines: 5, maxDirLines: 15 };

/** Read at most 16 KiB from the end; discard a potentially partial first line. */
export function readRecentHistory(filePath: string, maxLines: number): string {
  if (maxLines <= 0) return "";
  let fd: number | undefined;
  try {
    fd = openSync(filePath, "r");
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - 16_384);
    const buffer = Buffer.alloc(size - start);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, start);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
    if (start > 0) lines.shift();
    return lines.map(line => line.replace(/^: \d+:\d+;/, "").trim())
      .filter(Boolean).slice(-maxLines).join("\n");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function getTerminalContext(
  limits: ContextLimits = LIMITS_CLOUD,
  includeHistory = false
): TerminalContext {
  const cwd = process.cwd();
  let dirListing = "";
  try {
    // Avoid launching ls or collecting metadata for every file.
    const entries = readdirSync(cwd, { withFileTypes: true });
    dirListing = entries.slice(0, limits.maxDirLines)
      .map(entry => JSON.stringify(entry.name + (entry.isDirectory() ? "/" : ""))).join("\n");
    if (entries.length > limits.maxDirLines) {
      dirListing += `\n... (${entries.length - limits.maxDirLines} more)`;
    }
  } catch {}
  return {
    cwd,
    osName: platform() === "darwin" ? "macOS" : platform(),
    archName: arch(),
    history: includeHistory ? readRecentHistory(join(homedir(), ".zsh_history"), limits.maxHistoryLines) : "",
    dirListing,
  };
}
