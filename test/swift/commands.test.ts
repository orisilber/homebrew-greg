import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { spawnSync } from "child_process";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const SRC = join(PROJECT_ROOT, "swift/ui/Sources/CommandProcessor.swift");
const TEST = join(PROJECT_ROOT, "swift/ui/Tests/main.swift");
const BIN = join(PROJECT_ROOT, "swift/ui/Tests/test_commands_bin");

describe("Swift UI — CommandProcessor", () => {
  it("source and test files exist", () => {
    expect(existsSync(SRC)).toBe(true);
    expect(existsSync(TEST)).toBe(true);
  });

  it("compiles the test binary", () => {
    if (platform() !== "darwin") return; // Swift only on macOS
    const result = spawnSync(
      "xcrun",
      ["swiftc", "-o", BIN, SRC, TEST],
      { encoding: "utf-8", timeout: 30_000 }
    );
    expect(result.status).toBe(0);
    expect(existsSync(BIN)).toBe(true);
  });

  it("all CommandProcessor tests pass", () => {
    if (platform() !== "darwin") return;
    const result = spawnSync(BIN, [], {
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("passed");
    expect(result.stdout).toContain("0 failed");
  });
});
