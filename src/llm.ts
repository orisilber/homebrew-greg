import { readFileSync, existsSync } from "fs";
import { homedir, platform, arch } from "os";
import { join } from "path";
import { execSync } from "child_process";
import type { GregConfig, TerminalContext } from "./shared";
import { stripCodeFences } from "./shared";
import { callAFM } from "./afm";

// ── Terminal context ────────────────────────────────────────────────────────

interface ContextLimits {
  maxHistoryLines: number;
  maxDirLines: number;
}

const LIMITS_CLOUD: ContextLimits = { maxHistoryLines: 30, maxDirLines: 50 };
const LIMITS_AFM: ContextLimits = { maxHistoryLines: 5, maxDirLines: 15 };

export function getTerminalContext(
  limits: ContextLimits = LIMITS_CLOUD
): TerminalContext {
  const cwd = process.cwd();
  const osName = platform() === "darwin" ? "macOS" : platform();
  const archName = arch();

  let history = "";
  try {
    const histFile = join(homedir(), ".zsh_history");
    if (existsSync(histFile)) {
      const raw = readFileSync(histFile, "utf-8");
      const lines = raw
        .split("\n")
        .map((l) => l.replace(/^: \d+:\d+;/, "").trim())
        .filter(Boolean)
        .slice(-limits.maxHistoryLines);
      history = lines.join("\n");
    }
  } catch {}

  let dirListing = "";
  try {
    const full = execSync("ls -la", {
      encoding: "utf-8",
      timeout: 3000,
      cwd,
    }).trim();
    const dirLines = full.split("\n");
    if (dirLines.length > limits.maxDirLines) {
      dirListing = dirLines.slice(0, limits.maxDirLines).join("\n")
        + `\n... (${dirLines.length - limits.maxDirLines} more)`;
    } else {
      dirListing = full;
    }
  } catch {}

  return { cwd, osName, archName, history, dirListing };
}

// ── System prompt ───────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: TerminalContext): string {
  return `You are Greg, a CLI-only assistant. You convert natural language into shell commands.

STRICT RULES:
- Respond with ONLY the raw shell command(s). Nothing else.
- No prose, no explanations, no markdown, no code fences, no comments.
- Use ONLY command-line tools and standard Unix/${ctx.osName} utilities available in zsh.
- Never suggest opening a GUI, browser, or editor. CLI tools only.
- Chain commands with &&, pipes, or semicolons as needed.
- Be concise, correct, and safe. Prefer non-destructive operations.
- CURRENT DIRECTORY ONLY: Unless the user explicitly says "recursively", "all subdirectories", "nested", etc., operate ONLY on the current directory. Use ls, grep on files in ".", or simple globs (*.ext) — NEVER use find, **/ globs, -r, -R, or --recursive flags by default. When the user DOES ask for recursive behavior: always pass an explicit path to find (e.g. "find . -type f"), never omit it — macOS find requires a starting path.
- RESULT COUNT: If the user specifies a number of results (e.g. "top 5", "first 3", "last 10", "5 largest"), you MUST strictly limit output to EXACTLY that count using head, tail, or equivalent. Never return more results than requested.

TERMINAL CONTEXT:
Working directory: ${ctx.cwd}
OS: ${ctx.osName} ${ctx.archName}
Shell: zsh

Directory contents:
${ctx.dirListing}

Recent command history:
${ctx.history}`;
}

// ── Provider calls ──────────────────────────────────────────────────────────

async function callAnthropic(
  config: GregConfig, systemPrompt: string, userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model, max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text ?? "";
}

async function callOpenAI(
  config: GregConfig, systemPrompt: string, userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model, max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(
  config: GregConfig, systemPrompt: string, userPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey!,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    }),
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function getCommand(
  config: GregConfig, prompt: string
): Promise<string> {
  const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
  const ctx = getTerminalContext(limits);
  const systemPrompt = buildSystemPrompt(ctx);

  let raw: string;
  switch (config.provider) {
    case "afm":       raw = callAFM(systemPrompt, prompt); break;
    case "anthropic":  raw = await callAnthropic(config, systemPrompt, prompt); break;
    case "gemini":     raw = await callGemini(config, systemPrompt, prompt); break;
    case "openai": default:
      raw = await callOpenAI(config, systemPrompt, prompt); break;
  }

  return stripCodeFences(raw);
}
