import { mkdirSync, existsSync } from "fs";
import { platform } from "os";
import { execSync, spawnSync } from "child_process";
import { CONFIG_DIR, AFM_SWIFT_SRC, AFM_BINARY } from "./shared";

export function isAFMSupported(): boolean {
  return platform() === "darwin";
}

export function ensureAFMBinary(): boolean {
  if (existsSync(AFM_BINARY)) return true;
  if (!existsSync(AFM_SWIFT_SRC)) return false;

  mkdirSync(CONFIG_DIR, { recursive: true });

  try {
    execSync(`xcrun swiftc "${AFM_SWIFT_SRC}" -o "${AFM_BINARY}"`, {
      stdio: "pipe",
      timeout: 60_000,
    });
    return true;
  } catch {
    return false;
  }
}

export function checkAFMAvailability(): string {
  if (!ensureAFMBinary()) return "unavailable:noBinary";
  try {
    return execSync(`"${AFM_BINARY}" --check`, {
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
  } catch {
    return "unavailable:error";
  }
}

export function callAFM(systemPrompt: string, userPrompt: string): string {
  if (!ensureAFMBinary()) {
    throw new Error("Could not compile AFM bridge. Is Xcode installed?");
  }

  const input = JSON.stringify({ systemPrompt, userPrompt });
  const result = spawnSync(AFM_BINARY, [], {
    input,
    encoding: "utf-8",
    timeout: 60_000,
  });

  if (result.status !== 0) {
    const err = (result.stderr || "").trim();
    throw new Error(err || "AFM bridge exited with an error");
  }

  return (result.stdout || "").trim();
}
