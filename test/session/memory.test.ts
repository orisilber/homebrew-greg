import { describe, expect, it } from "bun:test";
import { createHash } from "crypto";
import { readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { CONFIG_DIR } from "../../src/config/paths";
import { appendSession, loadSession, forgetSession, OutputExcerpt, buildSessionContext } from "../../src/session/memory";

const id = (name: string) => createHash("sha256").update(name).digest("hex");
const turn = (request: string) => ({ request, command: "echo test", cwd: "/tmp", createdAt: Date.now(), result: { kind: "previewed" as const } });

describe("bounded terminal memory", () => {
  it("retains five complete turns in private files and redacts the provider key", () => {
    const session = id("retention");
    try {
      for (let i = 0; i < 7; i++) appendSession(session, turn(`request-${i} fixture-secret-key`), "fixture-secret-key");
      const records = loadSession(session);
      expect(records.length).toBe(5);
      expect(records.map(record => record.request)).toEqual([2, 3, 4, 5, 6].map(i => `request-${i} [redacted]`));
      expect(JSON.stringify(records)).not.toContain("fixture-secret-key");
      const directory = join(CONFIG_DIR, "sessions", session);
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      for (const file of readdirSync(directory)) expect(statSync(join(directory, file)).mode & 0o777).toBe(0o600);
    } finally { forgetSession(session); }
  });
  it("ignores expired and corrupt records", () => {
    const session = id("expired");
    try {
      appendSession(session, { ...turn("old"), createdAt: Date.now() - 25 * 3600_000 });
      expect(loadSession(session)).toEqual([]);
      const directory = join(CONFIG_DIR, "sessions", session);
      writeFileSync(join(directory, readdirSync(directory)[0]), "invalid JSON");
      expect(loadSession(session)).toEqual([]);
    } finally { forgetSession(session); }
  });
  it("bounds captured output while retaining both its beginning and end", () => {
    const output = new OutputExcerpt();
    output.append("first line\n"); output.append("middle ".repeat(10000)); output.append("\nlast error");
    expect(output.truncated).toBe(true);
    expect(output.value.length).toBeLessThanOrEqual(4096);
    expect(output.value).toContain("first line"); expect(output.value).toContain("last error");
  });
  it("sends a smaller, bounded context to Apple Intelligence", () => {
    const session = id("context-budget");
    try {
      for (let i = 0; i < 5; i++) appendSession(session, { ...turn(`turn ${i}`), command: "a".repeat(6000) });
      expect(buildSessionContext(session, "afm").length).toBeLessThan(4200);
      expect(buildSessionContext(session, "openai").length).toBeLessThan(9700);
    } finally { forgetSession(session); }
  });
});
