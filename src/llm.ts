import { readFileSync, existsSync } from "fs";
import { homedir, platform, arch } from "os";
import { join } from "path";
import { execSync } from "child_process";
import type { GregConfig, TerminalContext } from "./shared";
import { stripCodeFences, C } from "./shared";
import { callAFM } from "./afm";
import { loadSkills, matchSkills, buildSkillsPromptSection } from "./skills";
import type { Skill } from "./skills";

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
  config: GregConfig, systemPrompt: string, userPrompt: string, maxTokens: number = 1024
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model, max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text ?? "";
}

async function callOpenAI(
  config: GregConfig, systemPrompt: string, userPrompt: string, maxTokens: number = 1024
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model, max_tokens: maxTokens,
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
  config: GregConfig, systemPrompt: string, userPrompt: string, maxTokens: number = 1024
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
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── LLM dispatcher ─────────────────────────────────────────────────────────

async function callLLM(
  config: GregConfig, systemPrompt: string, userPrompt: string, maxTokens: number = 1024
): Promise<string> {
  switch (config.provider) {
    case "afm":       return callAFM(systemPrompt, userPrompt);
    case "anthropic":  return await callAnthropic(config, systemPrompt, userPrompt, maxTokens);
    case "gemini":     return await callGemini(config, systemPrompt, userPrompt, maxTokens);
    case "openai": default:
      return await callOpenAI(config, systemPrompt, userPrompt, maxTokens);
  }
}

// ── AI skill matching ───────────────────────────────────────────────────────

async function matchSkillsWithAI(
  config: GregConfig, skills: Skill[], userPrompt: string
): Promise<Skill[]> {
  const globalSkills = skills.filter((s) => !s.description);
  const conditionalSkills = skills.filter((s) => s.description);

  if (conditionalSkills.length === 0) {
    logSkills(globalSkills);
    return globalSkills;
  }

  // AFM: use fast keyword matching (no extra API call)
  if (config.provider === "afm") {
    const matched = matchSkills(skills, userPrompt);
    logSkills(matched);
    return matched;
  }

  console.error(C.dim("  Matching skills..."));

  const skillList = conditionalSkills
    .map((s) => `- "${s.name}": ${s.description}`)
    .join("\n");

  const systemPrompt =
    `You select which skills are relevant to a user's CLI request. ` +
    `Return ONLY a JSON array of skill names that match. Return [] if none are relevant. ` +
    `No explanation, no markdown, no code fences.`;

  const matchPrompt = `Skills:\n${skillList}\n\nRequest: ${userPrompt}`;

  try {
    const raw = stripCodeFences(
      await callLLM(config, systemPrompt, matchPrompt, 100)
    );
    const names: string[] = JSON.parse(raw);
    const matched = conditionalSkills.filter((s) => names.includes(s.name));
    const result = [...globalSkills, ...matched];
    logSkills(result);
    return result;
  } catch {
    // Fall back to keyword matching on parse/network failure
    const result = matchSkills(skills, userPrompt);
    logSkills(result);
    return result;
  }
}

function logSkills(skills: Skill[]): void {
  for (const s of skills) {
    if (s.description) {
      console.error(C.green(`  Using skill: ${s.name}`));
    }
  }
}

// ── Command generation ──────────────────────────────────────────────────────

export async function getCommand(
  config: GregConfig, prompt: string
): Promise<string> {
  const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
  const ctx = getTerminalContext(limits);
  let systemPrompt = buildSystemPrompt(ctx);

  // Load and match skills (AI-powered for cloud providers, keyword for AFM)
  const allSkills = loadSkills();
  const matched = await matchSkillsWithAI(config, allSkills, prompt);
  const skillsSection = buildSkillsPromptSection(matched);
  if (skillsSection) {
    systemPrompt += "\n" + skillsSection;
  }

  console.error(C.dim("  Thinking..."));
  const raw = await callLLM(config, systemPrompt, prompt);
  return stripCodeFences(raw);
}
