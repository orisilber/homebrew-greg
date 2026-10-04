import { spawnSync } from "child_process";
import { platform } from "os";
import type { GregConfig, GenerationOptions, RunOptions } from "../../types";
import { C } from "../../utils/colors";
import { ask, confirmsExecution } from "../../utils/input";
import { stripCodeFences } from "../../utils/text";
import { getTerminalContext, LIMITS_AFM, LIMITS_CLOUD } from "../../llm/context";
import { buildSystemPrompt } from "../../llm/prompt";
import { callLLM } from "../../llm/dispatcher";
import { DEFAULT_TIMEOUT_MS } from "../../config/config";
import { resolveSessionId, buildSessionContext, appendSession, type CommandResult } from "../../session/memory";
import { executeCommand } from "../execute";
import { isDangerous } from "../../safety/danger";

interface Timing {
  contextMs: number;
  firstTextMs?: number;
  generationMs: number;
  totalMs: number;
}

export async function getCommand(config: GregConfig, prompt: string, options: GenerationOptions = {}): Promise<string> {
  const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
  const ctx = getTerminalContext(limits, config.includeHistory);
  return stripCodeFences(await callLLM(config, buildSystemPrompt(ctx, config.customInstructions), prompt, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  }));
}

export async function runCommand(config: GregConfig, prompt: string, options: RunOptions = {}): Promise<void> {
  const started = performance.now();
  const sessionId = options.context === false || config.rememberSession === false ? null : resolveSessionId();
  const remember = (command: string, result: CommandResult) => {
    if (!sessionId) return;
    try {
      appendSession(sessionId, { request: prompt, command, cwd: process.cwd(), createdAt: Date.now(), result }, config.apiKey);
    } catch { console.error(C.yellow("Could not save terminal memory. This turn will not be remembered.")); }
  };
  const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let cancellationCode: number | undefined;
  const onInterrupt = () => { cancellationCode = 130; controller.abort(new Error("Cancelled.")); };
  const onTerminate = () => { cancellationCode = 143; controller.abort(new Error("Cancelled.")); };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs} ms.`)), timeoutMs);
  let streamed = false;
  let command: string;
  const timing: Timing = { contextMs: 0, generationMs: 0, totalMs: 0 };
  let generationStarted = started;
  const showStream = options.mode === "preview" && (options.stream ?? true) && !!process.stderr.isTTY;
  try {
    if (config.provider !== "afm" && !config.apiKey) throw new Error("No API key configured. Run greg --setup.");
    const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
    const ctx = getTerminalContext(limits, config.includeHistory);
    const systemPrompt = buildSystemPrompt(ctx, config.customInstructions)
      + (sessionId ? buildSessionContext(sessionId, config.provider) : "");
    timing.contextMs = performance.now() - started;
    generationStarted = performance.now();
    console.error(C.dim("  Generating command..."));
    const raw = await callLLM(config, systemPrompt, prompt, {
      signal: controller.signal,
      onText(text) {
        timing.firstTextMs ??= performance.now() - started;
        if (showStream) {
          if (!streamed) { process.stderr.write(C.dim("  Preview (not yet executed):\n  ")); streamed = true; }
          // Strip terminal escape/control characters from model output.
          process.stderr.write(text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ""));
        }
      },
    });
    controller.signal.throwIfAborted();
    command = stripCodeFences(raw);
    if (!command) throw new Error("No command generated.");
    if (/[\x00-\x08\x0b-\x1f\x7f]/.test(command)) throw new Error("Generated command contains control characters.");
  } catch (error) {
    if (streamed) process.stderr.write("\n");
    const failure: unknown = controller.signal.aborted ? controller.signal.reason : error;
    console.error(C.red(failure instanceof Error ? failure.message : "Generation failed."));
    process.exitCode = cancellationCode ?? 1;
    return;
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
    timing.generationMs = performance.now() - generationStarted;
    timing.totalMs = performance.now() - started;
    if (options.timings) {
      if (streamed) process.stderr.write("\n");
      // Local measurements only. Prompts, keys, and command text are never logged here.
      console.error(`Timings (ms): ${JSON.stringify({
        context: Math.round(timing.contextMs),
        firstText: timing.firstTextMs === undefined ? null : Math.round(timing.firstTextMs),
        generation: Math.round(timing.generationMs), total: Math.round(timing.totalMs),
      })}`);
    }
  }
  if (streamed) process.stderr.write("\n");

  if (options.mode === "preview" || options.mode === "copy") {
    process.stdout.write(command + "\n");
    if (options.mode === "copy") {
      if (platform() !== "darwin") throw new Error("--copy requires macOS. Use --preview to print the command.");
      const result = spawnSync("pbcopy", [], { input: command, encoding: "utf8", timeout: 3000 });
      if (result.error || result.status !== 0) { remember(command, { kind: "failed", message: "Could not copy the command." }); throw new Error("Could not copy the command to the clipboard."); }
      console.error(C.dim("Copied. Nothing executed."));
    }
    remember(command, { kind: options.mode === "copy" ? "copied" : "previewed" });
    return;
  }

  if (isDangerous(command)) {
    console.error(`\n${C.greenBold(command)}\n`);
    if (!process.stdin.isTTY) {
      console.error(C.yellow("This command needs confirmation. Run Greg in a terminal, or use --preview."));
      process.exitCode = 1;
      remember(command, { kind: "blocked" });
      return;
    }
    const answer = await ask(`${C.yellow("This command may have side effects. Run?")} [y/N] `);
    if (!confirmsExecution(answer)) { console.error(C.dim("Aborted.")); remember(command, { kind: "declined" }); return; }
  }
  const result = await executeCommand(command);
  remember(command, result);
  if (result.kind === "failed") { console.error(C.red(result.message)); process.exitCode = 1; return; }
  process.exitCode = result.exitCode ?? (result.signal === "SIGINT" ? 130 : result.signal === "SIGTERM" ? 143 : 1);
}
