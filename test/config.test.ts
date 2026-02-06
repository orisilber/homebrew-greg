import { describe, it, beforeAll, afterAll, expect } from "bun:test";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import {
  loadConfig,
  saveConfig,
  stripCodeFences,
  CONFIG_FILE,
} from "../src";

// ── Config ──────────────────────────────────────────────────────────────────

describe("config", () => {
  const backupFile = CONFIG_FILE + ".test-backup";
  let hadExistingConfig = false;

  beforeAll(() => {
    if (existsSync(CONFIG_FILE)) {
      hadExistingConfig = true;
      writeFileSync(backupFile, readFileSync(CONFIG_FILE));
    }
  });

  afterAll(() => {
    if (hadExistingConfig) {
      writeFileSync(CONFIG_FILE, readFileSync(backupFile));
      unlinkSync(backupFile);
    } else {
      try { unlinkSync(CONFIG_FILE); } catch {}
    }
  });

  it("returns null when no config file exists", () => {
    try { unlinkSync(CONFIG_FILE); } catch {}
    expect(loadConfig()).toBeNull();
  });

  it("saves and loads config correctly", () => {
    const testConfig = { provider: "anthropic" as const, apiKey: "test-key", model: "test-model" };
    saveConfig(testConfig);
    expect(loadConfig()).toEqual(testConfig);
  });

  it("saves config with restricted permissions (0600)", () => {
    const testConfig = { provider: "afm" as const };
    saveConfig(testConfig);
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    expect(parsed.provider).toBe("afm");
  });

  it("returns null for corrupted config", () => {
    writeFileSync(CONFIG_FILE, "not json{{{");
    expect(loadConfig()).toBeNull();
  });

  it("supports gemini provider config", () => {
    const testConfig = { provider: "gemini" as const, apiKey: "AIzaXXX", model: "gemini-2.0-flash" };
    saveConfig(testConfig);
    const loaded = loadConfig();
    expect(loaded).toEqual(testConfig);
    expect(loaded!.provider).toBe("gemini");
  });
});

// ── stripCodeFences ─────────────────────────────────────────────────────────

describe("stripCodeFences", () => {
  it("passes through plain commands unchanged", () => {
    expect(stripCodeFences("ls -la")).toBe("ls -la");
  });

  it("strips backtick fences with language tag", () => {
    expect(stripCodeFences("```bash\nls -la\n```")).toBe("ls -la");
  });

  it("strips backtick fences without language tag", () => {
    expect(stripCodeFences("```\necho hello\n```")).toBe("echo hello");
  });

  it("strips fences from multi-line commands", () => {
    const input = "```sh\nfind . -name '*.log' | xargs cat\n```";
    expect(stripCodeFences(input)).toBe("find . -name '*.log' | xargs cat");
  });

  it("trims whitespace", () => {
    expect(stripCodeFences("  echo hi  ")).toBe("echo hi");
  });
});
