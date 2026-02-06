import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync, spawnSync } from "child_process";
import { C } from "./shared";

export function editorMode(): void {
  const tmpFile = join(tmpdir(), `greg-${Date.now()}.sh`);
  writeFileSync(tmpFile, "", { mode: 0o700 });

  const editor = process.env.EDITOR || "vim";
  const result = spawnSync(editor, [tmpFile], { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(C.red("Editor exited with an error."));
    try { unlinkSync(tmpFile); } catch {}
    process.exit(1);
  }

  const script = readFileSync(tmpFile, "utf-8").trim();
  try { unlinkSync(tmpFile); } catch {}

  if (!script) {
    console.error(C.dim("Empty file, nothing to run."));
    process.exit(0);
  }

  console.error("");
  console.error(C.dim("─────────────────────────────────────────"));
  console.error(`  ${C.greenBold(script)}`);
  console.error(C.dim("─────────────────────────────────────────"));
  console.error("");

  try {
    execSync(script, { stdio: "inherit", shell: "/bin/zsh" });
  } catch (err: any) {
    process.exit(err.status ?? 1);
  }
}
