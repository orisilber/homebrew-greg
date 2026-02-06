import { describe, it, expect } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

const PROJECT_ROOT = join(import.meta.dir, "..");

describe("editor mode", () => {
  const MARKER = `greg_test_${Date.now()}`;

  it("opens editor, writes a command, and greg executes it", () => {
    const fakeEditor = join(tmpdir(), "greg-fake-editor.sh");
    writeFileSync(
      fakeEditor,
      `#!/bin/sh\necho "echo ${MARKER}" > "$1"\n`,
      { mode: 0o755 }
    );

    const result = spawnSync(
      "bun", [join(PROJECT_ROOT, "bin", "greg.ts")],
      { env: { ...process.env, EDITOR: fakeEditor }, encoding: "utf-8", timeout: 10_000 }
    );

    try { unlinkSync(fakeEditor); } catch {}

    expect(result.stdout).toContain(MARKER);
    expect(result.status).toBe(0);
  });

  it("exits cleanly when editor produces empty file", () => {
    const fakeEditor = join(tmpdir(), "greg-fake-editor-empty.sh");
    writeFileSync(fakeEditor, "#!/bin/sh\n", { mode: 0o755 });

    const result = spawnSync(
      "bun", [join(PROJECT_ROOT, "bin", "greg.ts")],
      { env: { ...process.env, EDITOR: fakeEditor }, encoding: "utf-8", timeout: 10_000 }
    );

    try { unlinkSync(fakeEditor); } catch {}

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("nothing to run");
  });

  it("shows the command before executing it", () => {
    const fakeEditor = join(tmpdir(), "greg-fake-editor-show.sh");
    writeFileSync(
      fakeEditor,
      `#!/bin/sh\necho "echo visible_command" > "$1"\n`,
      { mode: 0o755 }
    );

    const result = spawnSync(
      "bun", [join(PROJECT_ROOT, "bin", "greg.ts")],
      { env: { ...process.env, EDITOR: fakeEditor }, encoding: "utf-8", timeout: 10_000 }
    );

    try { unlinkSync(fakeEditor); } catch {}

    expect(result.stderr).toContain("visible_command");
    expect(result.stdout).toContain("visible_command");
  });

  it("handles multi-line scripts from editor", () => {
    const fakeEditor = join(tmpdir(), "greg-fake-editor-multi.sh");
    writeFileSync(
      fakeEditor,
      `#!/bin/sh\nprintf "echo line_one\\necho line_two\\n" > "$1"\n`,
      { mode: 0o755 }
    );

    const result = spawnSync(
      "bun", [join(PROJECT_ROOT, "bin", "greg.ts")],
      { env: { ...process.env, EDITOR: fakeEditor }, encoding: "utf-8", timeout: 10_000 }
    );

    try { unlinkSync(fakeEditor); } catch {}

    expect(result.stdout).toContain("line_one");
    expect(result.stdout).toContain("line_two");
  });
});
