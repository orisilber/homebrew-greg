import type { RunMode, RunOptions } from "../types";
import { C } from "../utils/colors";
import { loadConfig } from "../config/config";
import { setup } from "./commands/setup";
import { editorMode } from "./commands/editor";
import { resolveSessionId, forgetSession } from "../session/memory";
import { VERSION } from "../version";
import { runCommand } from "./commands/run";

export const HELP = `Usage: greg [options] [request]

  --preview       Print the command without executing it
  --copy          Copy the command to the macOS clipboard without executing it
  --timings       Show local context, first-text, and generation timings
  --timeout MS    Request deadline in milliseconds (default: 30000)
  --no-stream     Hide the live preview
  --no-context    Skip terminal memory for this request
  --forget        Clear memory for this terminal
  --version       Show the installed version
  --setup         Configure provider and API key
  --help          Show this help
  --              End options; remaining words are the request

With no request, Greg opens your editor.
`;

export function parseArgs(args: string[]): { action: "help" | "setup" | "forget" | "version" | "run"; promptArgs: string[]; options: RunOptions } {
  const options: RunOptions = {};
  const promptArgs: string[] = [];
  let mode: RunMode | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") { promptArgs.push(...args.slice(i + 1)); break; }
    // Once the request starts, preserve its flags and punctuation verbatim.
    if (!arg.startsWith("-")) { promptArgs.push(...args.slice(i)); break; }
    if (arg === "--help" || arg === "-h" || arg === "--setup" || arg === "--forget" || arg === "--version" || arg === "-v") {
      if (args.length !== 1) throw new Error(`${arg} cannot be combined with a request or other options.`);
      return { action: arg === "--setup" ? "setup" : arg === "--forget" ? "forget" : arg === "--version" || arg === "-v" ? "version" : "help", promptArgs, options };
    }
    if (arg === "--preview" || arg === "--copy") {
      if (mode) throw new Error("Choose only one of --preview and --copy.");
      mode = arg === "--copy" ? "copy" : "preview";
      options.mode = mode;
    } else if (arg === "--timings") options.timings = true;
    else if (arg === "--no-stream") options.stream = false;
    else if (arg === "--no-context") options.context = false;
    else if (arg === "--timeout") {
      const value = args[++i];
      if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 600_000) {
        throw new Error("--timeout requires an integer between 1 and 600000 milliseconds.");
      }
      options.timeoutMs = Number(value);
    } else throw new Error(`Unknown option: ${arg}. Run greg --help.`);
  }
  return { action: "run", promptArgs, options };
}

export async function route(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.action === "help") { process.stdout.write(HELP); return; }
  if (parsed.action === "version") { process.stdout.write(`greg ${VERSION}\n`); return; }
  if (parsed.action === "forget") {
    const id = resolveSessionId();
    if (!id) throw new Error("No terminal session found. Set GREG_SESSION_ID for scripted use.");
    forgetSession(id); console.error("Terminal memory cleared."); return;
  }
  if (parsed.action === "setup") { await setup(); return; }
  let prompt: string;
  if (!parsed.promptArgs.length) {
    const editorPrompt = editorMode();
    if (!editorPrompt) { console.error(C.dim("Empty prompt, nothing to do.")); return; }
    prompt = editorPrompt;
  } else prompt = parsed.promptArgs.join(" ");
  let config = loadConfig();
  if (!config) {
    if (!process.stdin.isTTY) throw new Error("No config found. Run greg --setup in a terminal.");
    config = await setup();
  }
  await runCommand(config, prompt, parsed.options);
}
