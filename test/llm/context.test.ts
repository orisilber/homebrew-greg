import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getTerminalContext, readRecentHistory } from "../../src/llm/context";
import { buildSystemPrompt } from "../../src/llm/prompt";

describe("bounded terminal context", () => {
  it("omits history unless requested", () => {
    expect(getTerminalContext().history).toBe("");
    const prompt = buildSystemPrompt(getTerminalContext(), "Prefer rg.");
    expect(prompt).toContain("Prefer rg.");
    expect(prompt).not.toContain("Recent command history");
  });
  it("reads the last complete history lines without including earlier content", () => {
    const dir = mkdtempSync(join(tmpdir(), "greg-history-"));
    try {
      const path = join(dir, "history");
      writeFileSync(path, "old-entry ".repeat(5000) + "\n: 123:0;first\n: 124:0;second\n: 125:0;last\n");
      expect(readRecentHistory(path, 2)).toBe("second\nlast");
      expect(readRecentHistory(path, 0)).toBe("");
    } finally { rmSync(dir, { recursive: true }); }
  });
});
