import { describe, it, expect } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import { platform } from "os";
import { spawnSync } from "child_process";
import {
  isAFMSupported,
  ensureAFMBinary,
  checkAFMAvailability,
  AFM_BINARY,
  AFM_SWIFT_SRC,
} from "../../../src";

describe("AFM bridge", () => {
  it("detects macOS for AFM support", () => {
    expect(isAFMSupported()).toBe(platform() === "darwin");
  });

  it("Swift source file exists", () => {
    expect(existsSync(AFM_SWIFT_SRC)).toBe(true);
  });

  it("compiles the Swift bridge", () => {
    try { unlinkSync(AFM_BINARY); } catch {}
    expect(ensureAFMBinary()).toBe(true);
    expect(existsSync(AFM_BINARY)).toBe(true);
  });

  it("reports availability status via --check", () => {
    const status = checkAFMAvailability();
    expect(
      status.startsWith("available") || status.startsWith("unavailable")
    ).toBe(true);
  });

  it("bridge accepts valid JSON and exits cleanly (even if model unavailable)", () => {
    if (!existsSync(AFM_BINARY)) ensureAFMBinary();
    const input = JSON.stringify({ systemPrompt: "test", userPrompt: "test" });
    const result = spawnSync(AFM_BINARY, [], {
      input,
      encoding: "utf-8",
      timeout: 10_000,
    });
    expect([0, 1]).toContain(result.status);
  });

  it("bridge rejects invalid JSON", () => {
    if (!existsSync(AFM_BINARY)) ensureAFMBinary();
    const result = spawnSync(AFM_BINARY, [], {
      input: "not json",
      encoding: "utf-8",
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid JSON");
  });
});
