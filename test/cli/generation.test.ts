import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import type { Provider } from "../../src/types";
import { object } from "../../src/llm/stream";

const ROOT = join(import.meta.dir, "../..");
const CLI = join(ROOT, "dist/greg.mjs");
const REDIRECT = join(ROOT, "test/helpers/redirect.mjs");
const TERMINAL = join(ROOT, "test/helpers/terminal.py");
type Scenario = "normal" | "incomplete" | "truncated" | "error" | "wait" | "barrier";

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(provider: Provider = "openai", scenario: Scenario = "normal", command?: string) {
  const root = mkdtempSync(join(tmpdir(), "greg-cli-"));
  const configDir = join(root, "config"); mkdirSync(configDir);
  const sentinel = join(root, "sentinel");
  const generated = command ?? `touch '${sentinel}'`;
  writeFileSync(join(configDir, "config.json"), JSON.stringify({
    provider, apiKey: "fixture-placeholder", model: provider === "gemini" ? "gemini-2.5-flash" : "fixture-model",
    customInstructions: "Prefer rg for text search.",
  }));
  const requests: Record<string, unknown>[] = [];
  const requestStarted = deferred();
  const release = deferred();
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(request) {
      requests.push(object(await request.json())); requestStarted.resolve();
      if (scenario === "error") return Response.json({ error: { message: "Fixture rate limit" } }, { status: 429 });
      const encoder = new TextEncoder();
      return new Response(new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: unknown) => {
            const text = `data:${JSON.stringify(event)}\r\n\r\n`;
            const bytes = encoder.encode(text);
            // Deliberately split at byte boundaries, including Unicode characters.
            for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
          };
          try {
            if (scenario === "wait") { await release.promise; return; }
            if (provider === "anthropic") send({ type: "content_block_delta", delta: { type: "text_delta", text: generated } });
            else if (provider === "gemini") send({ candidates: [{ content: { parts: [{ text: generated }] } }] });
            else send({ choices: [{ delta: { content: generated } }] });
            if (scenario === "barrier") await release.promise;
            if (scenario === "incomplete") return;
            const truncated = scenario === "truncated";
            if (provider === "anthropic") {
              send({ type: "message_delta", delta: { stop_reason: truncated ? "max_tokens" : "end_turn" } });
              send({ type: "message_stop" });
            } else if (provider === "gemini") send({ candidates: [{ finishReason: truncated ? "MAX_TOKENS" : "STOP" }] });
            else {
              send({ choices: [{ delta: {}, finish_reason: truncated ? "length" : "stop" }] });
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch { /* Client cancellation closes the stream. */ }
          finally { try { controller.close(); } catch {} }
        },
      }), { headers: { "Content-Type": "text/event-stream" } });
    },
  });
  const env = { ...process.env, GREG_CONFIG_DIR: configDir, GREG_SESSION_ID: root, GREG_FIXTURE_URL: `http://127.0.0.1:${server.port}` };
  const launch = (args: string[], options: { tty?: boolean; answer?: string; onOutput?: (text: string) => void; env?: Record<string, string> } = {}) => {
    const command = ["node", "--import", REDIRECT, CLI, ...args];
    const childEnv = { ...env, ...options.env };
    const child = options.tty
      ? spawn("python3", [TERMINAL, JSON.stringify({ command, cwd: root, env: childEnv, ...(options.answer === undefined ? {} : { answer: options.answer }) })], { stdio: ["ignore", "pipe", "pipe"] })
      : spawn(command[0], command.slice(1), { cwd: root, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text: string) => { out += text; options.onOutput?.(text); });
    child.stderr.on("data", (text: string) => { err += text; });
    const result = new Promise<{ status: number | null; out: string; err: string }>((resolve, reject) => {
      child.on("error", reject); child.on("close", status => resolve({ status, out, err }));
    });
    return { child, result };
  };
  return { root, sentinel, configDir, generated, requests, requestStarted, release, launch, env,
    close() { release.resolve(); server.stop(true); rmSync(root, { recursive: true, force: true }); } };
}

describe("built CLI generation", () => {
  for (const provider of ["openai", "openrouter", "anthropic", "gemini"] as const) {
    it(`${provider}: one request, clean preview output, preferences, and timings`, async () => {
      const f = fixture(provider, "normal", "echo 'שלום'");
      try {
        const result = await f.launch(["--preview", "--timings", "show greeting"]).result;
        expect(result.status).toBe(0);
        expect(result.out).toBe("echo 'שלום'\n");
        expect(result.err).toContain('"firstText":');
        expect(f.requests.length).toBe(1);
        expect(JSON.stringify(f.requests[0])).toContain("Prefer rg");
        expect(JSON.stringify(f.requests[0])).not.toContain("Recent command history");
        expect(existsSync(f.sentinel)).toBe(false);
      } finally { f.close(); }
    });
    it(`${provider}: refuses truncated commands`, async () => {
      const f = fixture(provider, "truncated");
      try {
        const result = await f.launch(["make a file"]).result;
        expect(result.status).toBe(1);
        expect(result.err).toContain("Incomplete command");
        expect(existsSync(f.sentinel)).toBe(false);
      } finally { f.close(); }
    });
  }
  it("does not execute preview output", async () => {
    const f = fixture();
    try {
      const result = await f.launch(["--preview", "make a file"]).result;
      expect(result.status).toBe(0);
      expect(result.out.trim()).toBe(f.generated);
      expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("runs a recognized simple read command", async () => {
    const f = fixture("openai", "normal", "echo fixture-output");
    try { const result = await f.launch(["say hello"]).result; expect(result.status).toBe(0); expect(result.out).toBe("fixture-output\n"); }
    finally { f.close(); }
  });
  it("preserves binary command output while collecting a text excerpt", async () => {
    const f = fixture("openai", "normal", "cat binary-fixture.bin");
    try {
      const bytes = Buffer.from([0, 255, 254, 128, 10, 195, 169]);
      writeFileSync(join(f.root, "binary-fixture.bin"), bytes);
      const child = spawn("node", ["--import", REDIRECT, CLI, "read this file"], {
        cwd: f.root, env: f.env, stdio: ["ignore", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk)); child.stderr.resume();
      expect(await new Promise<number | null>(resolve => child.on("close", resolve))).toBe(0);
      expect(Buffer.concat(chunks)).toEqual(bytes);
    } finally { f.close(); }
  });
  it("refuses unknown commands without an interactive terminal", async () => {
    const f = fixture();
    try {
      const result = await f.launch(["make a file"]).result;
      expect(result.status).toBe(1); expect(result.err).toContain("needs confirmation");
      expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("fails closed when the provider disconnects before completion", async () => {
    const f = fixture("openai", "incomplete");
    try {
      const result = await f.launch(["make a file"]).result;
      expect(result.status).toBe(1); expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("cancels stalled requests at the configured deadline", async () => {
    const f = fixture("openai", "wait");
    try {
      const result = await f.launch(["--timeout", "100", "--preview", "make a file"]).result;
      expect(result.status).toBe(1); expect(result.err).toContain("timed out");
      expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("cancels a live request on Ctrl+C", async () => {
    const f = fixture("openai", "wait");
    try {
      const run = f.launch(["--preview", "make a file"]);
      await f.requestStarted.promise; run.child.kill("SIGINT");
      const result = await run.result;
      expect(result.status).toBe(130); expect(result.err).toContain("Cancelled");
      expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("reports provider errors without executing anything", async () => {
    const f = fixture("openai", "error");
    try { const result = await f.launch(["make a file"]).result; expect(result.status).toBe(1); expect(result.err).toContain("Fixture rate limit"); expect(existsSync(f.sentinel)).toBe(false); }
    finally { f.close(); }
  });
  it("shows streaming text before the generation completes", async () => {
    const f = fixture("openai", "barrier");
    let streamed = false;
    try {
      const run = f.launch(["--preview", "make a file"], { tty: true, onOutput(text) {
        if (text.includes("Preview (not yet executed)")) {
          streamed = true; expect(existsSync(f.sentinel)).toBe(false); f.release.resolve();
        }
      } });
      const result = await run.result;
      expect(streamed).toBe(true); expect(result.status).toBe(0); expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("declines an empty confirmation and executes only after explicit yes", async () => {
    const f = fixture();
    try {
      const declined = await f.launch(["make a file"], { tty: true, answer: "" }).result;
      expect(declined.status).toBe(0); expect(declined.out).toContain("Aborted."); expect(existsSync(f.sentinel)).toBe(false);
      const accepted = await f.launch(["make a file"], { tty: true, answer: "yes" }).result;
      expect(accepted.status).toBe(0); expect(existsSync(f.sentinel)).toBe(true);
    } finally { f.close(); }
  });
  it.skipIf(process.platform !== "darwin")("copies the command without execution or changing the real clipboard", async () => {
    const f = fixture();
    try {
      const bin = join(f.root, "bin"); mkdirSync(bin);
      const clipboard = join(f.root, "clipboard");
      writeFileSync(join(bin, "pbcopy"), '#!/bin/sh\ncat > "$GREG_FIXTURE_CLIPBOARD"\n', { mode: 0o755 });
      const result = await f.launch(["--copy", "make a file"], { env: { PATH: `${bin}:${process.env.PATH}`, GREG_FIXTURE_CLIPBOARD: clipboard } }).result;
      expect(result.status).toBe(0); expect(readFileSync(clipboard, "utf8")).toBe(f.generated); expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("carries commands and execution output into follow-ups in the same terminal", async () => {
    const f = fixture("openai", "normal", "echo followup-evidence");
    try {
      expect((await f.launch(["first request"]).result).status).toBe(0);
      await f.launch(["--preview", "modify that command"]).result;
      const prompt = JSON.stringify(f.requests.at(-1));
      expect(prompt).toContain("first request");
      expect(prompt).toContain("followup-evidence");
      expect(prompt).toContain('executed');
      expect(prompt).toContain('exitCode');
      expect(f.requests.length).toBe(2);
    } finally { f.close(); }
  });
  it("keeps preview and declined commands marked as not executed", async () => {
    const f = fixture();
    try {
      await f.launch(["--preview", "preview this"]).result;
      await f.launch(["decline this"], { tty: true, answer: "" }).result;
      await f.launch(["--preview", "modify that"]).result;
      const prompt = JSON.stringify(f.requests.at(-1));
      expect(prompt).toContain("previewed"); expect(prompt).toContain("declined");
      expect(existsSync(f.sentinel)).toBe(false);
    } finally { f.close(); }
  });
  it("carries a failed command's exit status and stderr into the next request", async () => {
    const f = fixture("openai", "normal", "cat missing-memory-fixture-file");
    try {
      expect((await f.launch(["first request"]).result).status).toBe(1);
      await f.launch(["--preview", "fix that error"]).result;
      const prompt = JSON.stringify(f.requests.at(-1));
      expect(prompt).toContain("missing-memory-fixture-file");
      expect(prompt).toContain("exitCode"); expect(prompt).toContain("No such file");
    } finally { f.close(); }
  });
  it("isolates terminals and lets a request bypass memory without replacing it", async () => {
    const f = fixture("openai", "normal", "echo remembered-turn");
    try {
      await f.launch(["--preview", "remember this request"]).result;
      await f.launch(["--preview", "another terminal"], { env: { GREG_SESSION_ID: "other-terminal" } }).result;
      expect(JSON.stringify(f.requests.at(-1))).not.toContain("remember this request");
      await f.launch(["--no-context", "--preview", "one-off request"]).result;
      expect(JSON.stringify(f.requests.at(-1))).not.toContain("remember this request");
      await f.launch(["--preview", "back to the first terminal"]).result;
      expect(JSON.stringify(f.requests.at(-1))).toContain("remember this request");
      expect(JSON.stringify(f.requests.at(-1))).not.toContain("one-off request");
    } finally { f.close(); }
  });
  it("forgets terminal memory without making a model request", async () => {
    const f = fixture();
    try {
      await f.launch(["--preview", "remember this request"]).result;
      expect((await f.launch(["--forget"]).result).status).toBe(0);
      expect(f.requests.length).toBe(1);
      await f.launch(["--preview", "fresh request"]).result;
      expect(JSON.stringify(f.requests.at(-1))).not.toContain("remember this request");
    } finally { f.close(); }
  });
  it("disables both reading and saving memory through configuration", async () => {
    const f = fixture("openai", "normal", "echo remembered-turn");
    try {
      const configFile = join(f.configDir, "config.json");
      const config = JSON.parse(readFileSync(configFile, "utf8"));
      writeFileSync(configFile, JSON.stringify({ ...config, rememberSession: false }));
      await f.launch(["--preview", "do not remember this"]).result;
      await f.launch(["--preview", "another private request"]).result;
      expect(JSON.stringify(f.requests.at(-1))).not.toContain("PREVIOUS GREG");
      expect(existsSync(join(f.configDir, "sessions"))).toBe(false);
    } finally { f.close(); }
  });
  it("automatically shares memory between Greg invocations in the same terminal shell", async () => {
    const f = fixture("openai", "normal", "echo shell-memory-evidence");
    try {
      const child = spawn("python3", [join(ROOT, "test/helpers/shell-session.py"), JSON.stringify({
        commands: ["first shell request", "modify that command"].map(request => ["node", "--import", REDIRECT, CLI, "--preview", request]),
        cwd: f.root,
        env: f.env,
      })], { stdio: ["ignore", "pipe", "pipe"] });
      const status = await new Promise(resolve => child.on("close", resolve));
      expect(status).toBe(0);
      expect(JSON.stringify(f.requests.at(-1))).toContain("first shell request");
      expect(JSON.stringify(f.requests.at(-1))).toContain("shell-memory-evidence");
    } finally { f.close(); }
  });

});
