import { describe, it, expect } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

const PROJECT_ROOT = join(import.meta.dir, "..");

describe("editor mode", () => {
  it("exits cleanly when editor produces empty file", () => {
    const fakeEditor = join(tmpdir(), "greg-fake-editor-empty.sh");
    writeFileSync(fakeEditor, "#!/bin/sh\n", { mode: 0o755 });

    const result = spawnSync(
      "bun", [join(PROJECT_ROOT, "bin", "greg.ts")],
      { env: { ...process.env, EDITOR: fakeEditor }, encoding: "utf-8", timeout: 10_000 }
    );

    try { unlinkSync(fakeEditor); } catch {}

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("nothing to do");
  });
});
