import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { C } from "./shared";

function cleanupFile(path: string): void {
  try { unlinkSync(path); } catch {}
}

export function editorMode(): string | null {
  const tmpFile = join(tmpdir(), `greg-${Date.now()}.txt`);
  writeFileSync(tmpFile, "", { mode: 0o600 });

  // Ensure cleanup on unexpected termination (Ctrl+C, SIGTERM, etc.)
  const onExit = () => cleanupFile(tmpFile);
  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);
  process.on("exit", onExit);

  const editor = process.env.EDITOR || "vim";
  const result = spawnSync(editor, [tmpFile], { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(C.red("Editor exited with an error."));
    cleanupFile(tmpFile);
    process.exit(1);
  }

  const prompt = readFileSync(tmpFile, "utf-8").trim();
  cleanupFile(tmpFile);

  if (!prompt) {
    return null;
  }

  return prompt;
}
