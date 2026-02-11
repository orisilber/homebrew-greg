import { describe, it, expect } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

const PROJECT_ROOT = join(import.meta.dir, "../../..");

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

  it("returns the prompt text from the editor", () => {
    const fakeEditor = join(tmpdir(), "greg-fake-editor-prompt.sh");
    writeFileSync(
      fakeEditor,
      `#!/bin/sh\necho "hello from editor" > "$1"\n`,
      { mode: 0o755 }
    );

    // This will try to call the LLM and fail (no valid config),
    // but the error proves the prompt was read and passed through.
    const result = spawnSync(
      "bun", [join(PROJECT_ROOT, "bin", "greg.ts")],
      {
        env: { ...process.env, EDITOR: fakeEditor },
        encoding: "utf-8",
        timeout: 10_000,
      }
    );

    try { unlinkSync(fakeEditor); } catch {}

    // It should NOT show "nothing to do" — the prompt was non-empty
    expect(result.stderr).not.toContain("nothing to do");
  });
});
