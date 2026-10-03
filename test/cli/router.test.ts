import { describe, it, expect } from "bun:test";
import { join } from "path";
import { spawnSync } from "child_process";
import { parseArgs } from "../../src/cli/router";

const CLI = join(import.meta.dir, "../../bin/greg.ts");
function runGreg(args: string[]) {
  return spawnSync("bun", [CLI, ...args], { env: { ...process.env }, encoding: "utf8", timeout: 3000 });
}

describe("router", () => {
  it("shows help without configuring or contacting a provider", () => {
    const result = runGreg(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--preview");
    expect(result.stdout).not.toContain("--skills");
  });
  it("rejects removed skills commands", () => {
    const result = runGreg(["--skills", "list"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown option");
  });
  it("rejects invalid deadlines before making a request", () => {
    for (const value of ["0", "-1", "NaN", "1.5", "600001"]) {
      expect(runGreg(["--timeout", value, "list files"]).status).toBe(1);
    }
  });
  it("rejects conflicting modes", () => {
    expect(runGreg(["--copy", "--preview", "list files"]).status).toBe(1);
  });
  it("preserves flags inside the natural-language request", () => {
    expect(parseArgs(["--preview", "show", "git", "log", "--oneline"]).promptArgs)
      .toEqual(["show", "git", "log", "--oneline"]);
    expect(parseArgs(["--", "--help"]).promptArgs).toEqual(["--help"]);
  });
});
