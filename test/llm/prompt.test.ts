import { describe, it, expect } from "bun:test";
import { buildSystemPrompt, getTerminalContext } from "../../src";

describe("buildSystemPrompt", () => {
  const ctx = { cwd: "/tmp/test", osName: "macOS", archName: "arm64", history: "", dirListing: "" };

  it("includes working directory", () => {
    expect(buildSystemPrompt(ctx)).toContain("/tmp/test");
  });

  it("includes OS info", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("macOS");
    expect(prompt).toContain("arm64");
  });

  it("includes directory listing", () => {
    const c = { ...ctx, dirListing: "drwxr-xr-x foo\n-rw-r--r-- bar.txt" };
    const prompt = buildSystemPrompt(c);
    expect(prompt).toContain("foo");
    expect(prompt).toContain("bar.txt");
  });

  it("includes command history", () => {
    const c = { ...ctx, history: "git status\nnpm test" };
    const prompt = buildSystemPrompt(c);
    expect(prompt).toContain("git status");
    expect(prompt).toContain("npm test");
  });

  it("enforces CLI-only rules", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("CLI-only");
    expect(prompt).toContain("No prose");
    expect(prompt).toContain("Never suggest opening a GUI");
  });
});

describe("getTerminalContext", () => {
  it("returns cwd matching process.cwd()", () => {
    expect(getTerminalContext().cwd).toBe(process.cwd());
  });

  it("returns a valid OS name", () => {
    expect(["macOS", "linux", "win32"]).toContain(getTerminalContext().osName);
  });

  it("returns non-empty directory listing", () => {
    expect(getTerminalContext().dirListing.length).toBeGreaterThan(0);
  });
});
