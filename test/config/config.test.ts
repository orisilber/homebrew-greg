import { describe, it, beforeAll, afterAll, expect } from "bun:test";
import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync, chmodSync } from "fs";
import {
  loadConfig,
  saveConfig,
  CONFIG_FILE,
} from "../../src";

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
    chmodSync(CONFIG_FILE, 0o644);
    saveConfig(testConfig);
    expect(statSync(CONFIG_FILE).mode & 0o777).toBe(0o600);
  });

  it("reports corrupted config", () => {
    writeFileSync(CONFIG_FILE, "not json{{{");
    expect(() => loadConfig()).toThrow("Could not read");
  });

  it("supports gemini provider config", () => {
    const testConfig = { provider: "gemini" as const, apiKey: "AIzaXXX", model: "gemini-2.0-flash" };
    saveConfig(testConfig);
    const loaded = loadConfig();
    expect(loaded).toEqual(testConfig);
    expect(loaded!.provider).toBe("gemini");
  });

  it("supports openrouter provider config", () => {
    const testConfig = { provider: "openrouter" as const, apiKey: "sk-or-v1-XXX", model: "anthropic/claude-sonnet-4" };
    saveConfig(testConfig);
    const loaded = loadConfig();
    expect(loaded).toEqual(testConfig);
    expect(loaded!.provider).toBe("openrouter");
  });
});
