import { describe, it, expect } from "bun:test";
import { join } from "path";
import { spawnSync } from "child_process";

const PROJECT_ROOT = join(import.meta.dir, "../..");

function runGreg(args: string[], env?: Record<string, string>) {
  return spawnSync(
    "bun",
    [join(PROJECT_ROOT, "bin", "greg.ts"), ...args],
    {
      env: { ...process.env, ...env },
      encoding: "utf-8",
      timeout: 10_000,
    }
  );
}

describe("router", () => {
  it("--skills list runs without error", () => {
    const result = runGreg(["--skills", "list"]);
    // Should exit 0 and show either skills or "No skills found"
    expect(result.status).toBe(0);
  });

  it("--skills path prints the skills directory", () => {
    const result = runGreg(["--skills", "path"]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toContain(".config/greg/skills");
  });

  it("--skills with no subcommand lists skills", () => {
    const result = runGreg(["--skills"]);
    expect(result.status).toBe(0);
  });

  it("--skills with unknown subcommand shows usage", () => {
    const result = runGreg(["--skills", "unknown"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Usage:");
  });

  it("--skills edit with nonexistent skill shows error", () => {
    const result = runGreg(["--skills", "edit", "__nonexistent_skill__"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not found");
  });

  it("joins multiple args into a single prompt", () => {
    // Running with args will try to call the LLM.
    // We just verify it doesn't treat them as separate commands.
    // The error message (no config or API error) proves args were joined into a prompt.
    const result = runGreg(["list", "all", "files"]);
    // Should attempt LLM call (not show "nothing to do" or usage)
    expect(result.stderr).not.toContain("nothing to do");
    expect(result.stderr).not.toContain("Usage:");
  });
});
