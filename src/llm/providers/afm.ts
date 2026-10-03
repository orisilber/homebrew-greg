import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { platform } from "os";
import { createHash } from "crypto";
import { spawnSync, spawn } from "child_process";
import { CONFIG_DIR, AFM_SWIFT_SRC, AFM_BINARY } from "../../config/paths";
import type { GenerationOptions } from "../../types";
import { textCollector } from "../stream";

export function isAFMSupported(): boolean { return platform() === "darwin"; }

function sourceHash(): string { return createHash("sha256").update(readFileSync(AFM_SWIFT_SRC)).digest("hex"); }
function binaryIsCurrent(): boolean {
  try {
    return existsSync(AFM_BINARY) && readFileSync(AFM_BINARY + ".sha256", "utf8").trim() === sourceHash();
  } catch { return false; }
}

function compilationArgs(): string[] {
  return ["swiftc", AFM_SWIFT_SRC, "-module-cache-path", CONFIG_DIR + "/swift-cache", "-o", AFM_BINARY];
}

export function ensureAFMBinary(): boolean {
  if (binaryIsCurrent()) return true;
  if (!existsSync(AFM_SWIFT_SRC)) return false;
  mkdirSync(CONFIG_DIR, { recursive: true });
  const result = spawnSync("xcrun", compilationArgs(), { encoding: "utf8", timeout: 60_000 });
  if (result.status !== 0) return false;
  writeFileSync(AFM_BINARY + ".sha256", sourceHash());
  return true;
}

export function checkAFMAvailability(): string {
  if (!ensureAFMBinary()) return "unavailable:noBinary";
  const result = spawnSync(AFM_BINARY, ["--check"], { encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim() : "unavailable:error";
}

function runProcess(command: string, args: string[], options: GenerationOptions, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], signal: options.signal });
    const output = textCollector(options);
    let errorText = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text: string) => {
      try { output.append(text); } catch (error) { child.kill(); reject(error); }
    });
    child.stderr.on("data", (text: string) => { errorText = (errorText + text).slice(-4096); });
    child.on("error", reject);
    child.stdin.on("error", () => {}); // Exit/abort is reported by error or close.
    child.on("close", code => {
      if (options.signal?.aborted) { reject(options.signal.reason); return; }
      if (code !== 0) { reject(new Error(errorText.trim() || "AFM bridge exited with an error.")); return; }
      resolve(output.result());
    });
    child.stdin.end(input);
  });
}

export async function callAFM(systemPrompt: string, userPrompt: string, options: GenerationOptions = {}): Promise<string> {
  options.signal?.throwIfAborted();
  if (!binaryIsCurrent()) {
    if (!existsSync(AFM_SWIFT_SRC)) throw new Error("AFM bridge source is missing. Reinstall Greg.");
    mkdirSync(CONFIG_DIR, { recursive: true });
    // Compilation shares the request deadline and remains cancellable.
    await runProcess("xcrun", compilationArgs(), { signal: options.signal });
    writeFileSync(AFM_BINARY + ".sha256", sourceHash());
  }
  return runProcess(AFM_BINARY, ["--stream"], options, JSON.stringify({ systemPrompt, userPrompt }));
}
