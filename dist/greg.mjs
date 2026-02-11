#!/usr/bin/env node
// src/utils/colors.ts
var C = {
  red: (s) => `\x1B[31m${s}\x1B[0m`,
  green: (s) => `\x1B[32m${s}\x1B[0m`,
  yellow: (s) => `\x1B[33m${s}\x1B[0m`,
  bold: (s) => `\x1B[1m${s}\x1B[0m`,
  dim: (s) => `\x1B[2m${s}\x1B[0m`,
  greenBold: (s) => `\x1B[1;32m${s}\x1B[0m`
};

// src/config/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

// src/config/paths.ts
import { homedir } from "os";
import { join, dirname } from "path";
var __dirname2 = dirname(new URL(import.meta.url).pathname);
var CONFIG_DIR = join(homedir(), ".config", "greg");
var CONFIG_FILE = join(CONFIG_DIR, "config.json");
var SKILLS_DIR = join(CONFIG_DIR, "skills");
var AFM_SWIFT_SRC = join(__dirname2, "..", "..", "swift", "afm-bridge.swift");
var AFM_BINARY = join(CONFIG_DIR, "afm-bridge");

// src/config/config.ts
function loadConfig() {
  if (!existsSync(CONFIG_FILE))
    return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return null;
  }
}
function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + `
`, {
    mode: 384
  });
}

// src/utils/input.ts
import { createInterface } from "readline";
function ask(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// src/llm/providers/afm.ts
import { mkdirSync as mkdirSync2, existsSync as existsSync2 } from "fs";
import { platform } from "os";
import { execSync, spawnSync } from "child_process";
function isAFMSupported() {
  return platform() === "darwin";
}
function ensureAFMBinary() {
  if (existsSync2(AFM_BINARY))
    return true;
  if (!existsSync2(AFM_SWIFT_SRC))
    return false;
  mkdirSync2(CONFIG_DIR, { recursive: true });
  try {
    execSync(`xcrun swiftc "${AFM_SWIFT_SRC}" -o "${AFM_BINARY}"`, {
      stdio: "pipe",
      timeout: 60000
    });
    return true;
  } catch {
    return false;
  }
}
function checkAFMAvailability() {
  if (!ensureAFMBinary())
    return "unavailable:noBinary";
  try {
    return execSync(`"${AFM_BINARY}" --check`, {
      encoding: "utf-8",
      timeout: 1e4
    }).trim();
  } catch {
    return "unavailable:error";
  }
}
function callAFM(systemPrompt, userPrompt) {
  if (!ensureAFMBinary()) {
    throw new Error("Could not compile AFM bridge. Is Xcode installed?");
  }
  const input = JSON.stringify({ systemPrompt, userPrompt });
  const result = spawnSync(AFM_BINARY, [], {
    input,
    encoding: "utf-8",
    timeout: 60000
  });
  if (result.status !== 0) {
    const err = (result.stderr || "").trim();
    throw new Error(err || "AFM bridge exited with an error");
  }
  return (result.stdout || "").trim();
}

// src/cli/commands/setup.ts
var DEFAULT_MODELS = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash"
};
async function setup() {
  console.error("");
  console.error(C.bold(`Welcome to Greg! Let's get you set up.
`));
  const afmSupported = isAFMSupported();
  let provider;
  while (true) {
    let menu = `Provider:
`;
    if (afmSupported) {
      menu += `  ${C.green("1")} Apple Intelligence (on-device, no API key)
`;
      menu += `  ${C.green("2")} Anthropic (Claude)
`;
      menu += `  ${C.green("3")} OpenAI (GPT)
`;
      menu += `  ${C.green("4")} Google Gemini
`;
      menu += `
Choose [1/2/3/4]: `;
    } else {
      menu += `  ${C.green("1")} Anthropic (Claude)
`;
      menu += `  ${C.green("2")} OpenAI (GPT)
`;
      menu += `  ${C.green("3")} Google Gemini
`;
      menu += `
Choose [1/2/3]: `;
    }
    const choice = await ask(menu);
    if (afmSupported) {
      if (choice === "1") {
        provider = "afm";
        break;
      }
      if (choice === "2") {
        provider = "anthropic";
        break;
      }
      if (choice === "3") {
        provider = "openai";
        break;
      }
      if (choice === "4") {
        provider = "gemini";
        break;
      }
    } else {
      if (choice === "1") {
        provider = "anthropic";
        break;
      }
      if (choice === "2") {
        provider = "openai";
        break;
      }
      if (choice === "3") {
        provider = "gemini";
        break;
      }
    }
    console.error(C.red("Invalid choice."));
  }
  let config;
  if (provider === "afm") {
    console.error(C.dim(`
Compiling AFM bridge...`));
    if (!ensureAFMBinary()) {
      console.error(C.red("Failed to compile. Is Xcode Command Line Tools installed?"));
      process.exit(1);
    }
    const status = checkAFMAvailability();
    if (status === "available") {
      console.error(C.green("Apple Intelligence is available."));
    } else if (status.includes("appleIntelligenceNotEnabled")) {
      console.error(C.yellow("Apple Intelligence is not enabled."));
      console.error(C.dim("Enable it in System Settings > Apple Intelligence & Siri."));
      console.error(C.dim(`Saving config anyway -- Greg will work once enabled.
`));
    } else if (status.includes("modelNotReady")) {
      console.error(C.yellow("Model is still downloading. Try again shortly."));
    } else {
      console.error(C.yellow(`AFM status: ${status}`));
      console.error(C.dim(`Saving config anyway.
`));
    }
    config = { provider: "afm" };
  } else {
    const keyHints = {
      anthropic: "sk-ant-api03-...",
      openai: "sk-proj-...",
      gemini: "AIza..."
    };
    let key;
    while (true) {
      key = await ask(`
API key (${C.dim(keyHints[provider])}): `);
      if (key)
        break;
      console.error(C.red("Please enter a valid key."));
    }
    config = { provider, apiKey: key, model: DEFAULT_MODELS[provider] };
  }
  saveConfig(config);
  console.error(C.green(`
Saved to ${CONFIG_FILE}`));
  console.error(C.dim("You can edit this file or run `greg --setup` anytime.\n"));
  return config;
}

// src/cli/commands/skills.ts
import { spawnSync as spawnSync2 } from "child_process";

// src/skills/manager.ts
import { writeFileSync as writeFileSync2, mkdirSync as mkdirSync3, existsSync as existsSync4 } from "fs";
import { join as join3 } from "path";

// src/skills/loader.ts
import { readdirSync, readFileSync as readFileSync2, existsSync as existsSync3 } from "fs";
import { join as join2, basename } from "path";
function parseSkillFile(raw, filePath) {
  const trimmed = raw.trim();
  if (!trimmed)
    return null;
  const name = basename(filePath).replace(/\.md$/, "");
  let description = "";
  let content = trimmed;
  const fmMatch = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    content = fmMatch[2].trim();
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }
  if (!content)
    return null;
  return { name, description, content, filePath };
}
function loadSkills() {
  if (!existsSync3(SKILLS_DIR))
    return [];
  const skills = [];
  try {
    const files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = join2(SKILLS_DIR, file);
      try {
        const raw = readFileSync2(filePath, "utf-8");
        const skill = parseSkillFile(raw, filePath);
        if (skill)
          skills.push(skill);
      } catch {}
    }
  } catch {}
  return skills;
}

// src/skills/manager.ts
function ensureSkillsDir() {
  mkdirSync3(SKILLS_DIR, { recursive: true });
}
function createSkillFile(name) {
  ensureSkillsDir();
  const fileName = name.endsWith(".md") ? name : `${name}.md`;
  const filePath = join3(SKILLS_DIR, fileName);
  if (!existsSync4(filePath)) {
    const template = `---
description: Describe when this skill should activate
---

Your skill instructions here.
`;
    writeFileSync2(filePath, template, { mode: 420 });
  }
  return filePath;
}
function listSkills() {
  return loadSkills().map((s) => ({
    name: s.name,
    description: s.description || "(always active)"
  }));
}

// src/cli/commands/skills.ts
async function skillsCommand(args) {
  const sub = args[0];
  if (sub === "add" && args[1]) {
    const filePath = createSkillFile(args[1]);
    const editor = process.env.EDITOR || "vim";
    spawnSync2(editor, [filePath], { stdio: "inherit" });
    console.error(C.green(`Skill saved: ${filePath}`));
    return;
  }
  if (sub === "edit" && args[1]) {
    const skills = listSkills();
    const match = skills.find((s) => s.name === args[1]);
    if (!match) {
      console.error(C.red(`Skill "${args[1]}" not found.`));
      console.error(C.dim("Available skills: " + (skills.map((s) => s.name).join(", ") || "none")));
      process.exit(1);
    }
    const filePath = `${SKILLS_DIR}/${args[1]}.md`;
    const editor = process.env.EDITOR || "vim";
    spawnSync2(editor, [filePath], { stdio: "inherit" });
    console.error(C.green(`Skill updated: ${filePath}`));
    return;
  }
  if (sub === "list" || !sub) {
    const skills = listSkills();
    if (skills.length === 0) {
      console.error(C.dim("No skills found."));
      console.error(C.dim(`Add one with: greg --skills add <name>`));
      console.error(C.dim(`Skills directory: ${SKILLS_DIR}`));
    } else {
      console.error(C.bold(`Skills:
`));
      for (const s of skills) {
        console.error(`  ${C.green(s.name)}  ${C.dim(s.description)}`);
      }
      console.error("");
      console.error(C.dim(`Directory: ${SKILLS_DIR}`));
    }
    return;
  }
  if (sub === "path") {
    console.log(SKILLS_DIR);
    return;
  }
  console.error(C.bold("Usage:"));
  console.error(`  greg --skills              ${C.dim("List all skills")}`);
  console.error(`  greg --skills list         ${C.dim("List all skills")}`);
  console.error(`  greg --skills add <name>   ${C.dim("Create and edit a new skill")}`);
  console.error(`  greg --skills edit <name>  ${C.dim("Edit an existing skill")}`);
  console.error(`  greg --skills path         ${C.dim("Print skills directory path")}`);
}

// src/cli/commands/editor.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join as join4 } from "path";
import { spawnSync as spawnSync3 } from "child_process";
function cleanupFile(path) {
  try {
    unlinkSync(path);
  } catch {}
}
function editorMode() {
  const tmpFile = join4(tmpdir(), `greg-${Date.now()}.txt`);
  writeFileSync3(tmpFile, "", { mode: 384 });
  const onExit = () => cleanupFile(tmpFile);
  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);
  process.on("exit", onExit);
  const editor = process.env.EDITOR || "vim";
  const result = spawnSync3(editor, [tmpFile], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(C.red("Editor exited with an error."));
    cleanupFile(tmpFile);
    process.exit(1);
  }
  const prompt = readFileSync3(tmpFile, "utf-8").trim();
  cleanupFile(tmpFile);
  if (!prompt) {
    return null;
  }
  return prompt;
}

// src/cli/commands/run.ts
import { execSync as execSync3 } from "child_process";

// src/utils/text.ts
function stripCodeFences(text) {
  return text.replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
}

// src/llm/context.ts
import { readFileSync as readFileSync4, existsSync as existsSync5 } from "fs";
import { homedir as homedir2, platform as platform2, arch } from "os";
import { join as join5 } from "path";
import { execSync as execSync2 } from "child_process";
var LIMITS_CLOUD = { maxHistoryLines: 30, maxDirLines: 50 };
var LIMITS_AFM = { maxHistoryLines: 5, maxDirLines: 15 };
function getTerminalContext(limits = LIMITS_CLOUD) {
  const cwd = process.cwd();
  const osName = platform2() === "darwin" ? "macOS" : platform2();
  const archName = arch();
  let history = "";
  try {
    const histFile = join5(homedir2(), ".zsh_history");
    if (existsSync5(histFile)) {
      const raw = readFileSync4(histFile, "utf-8");
      const lines = raw.split(`
`).map((l) => l.replace(/^: \d+:\d+;/, "").trim()).filter(Boolean).slice(-limits.maxHistoryLines);
      history = lines.join(`
`);
    }
  } catch {}
  let dirListing = "";
  try {
    const full = execSync2("ls -la", {
      encoding: "utf-8",
      timeout: 3000,
      cwd
    }).trim();
    const dirLines = full.split(`
`);
    if (dirLines.length > limits.maxDirLines) {
      dirListing = dirLines.slice(0, limits.maxDirLines).join(`
`) + `
... (${dirLines.length - limits.maxDirLines} more)`;
    } else {
      dirListing = full;
    }
  } catch {}
  return { cwd, osName, archName, history, dirListing };
}

// src/llm/prompt.ts
function buildSystemPrompt(ctx) {
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

// src/llm/providers/anthropic.ts
async function callAnthropic(config, systemPrompt, userPrompt, maxTokens = 1024) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message);
  return data.content?.[0]?.text ?? "";
}

// src/llm/providers/openai.ts
async function callOpenAI(config, systemPrompt, userPrompt, maxTokens = 1024) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content ?? "";
}

// src/llm/providers/gemini.ts
async function callGemini(config, systemPrompt, userPrompt, maxTokens = 1024) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    })
  });
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// src/llm/dispatcher.ts
async function callLLM(config, systemPrompt, userPrompt, maxTokens = 1024) {
  switch (config.provider) {
    case "afm":
      return callAFM(systemPrompt, userPrompt);
    case "anthropic":
      return await callAnthropic(config, systemPrompt, userPrompt, maxTokens);
    case "gemini":
      return await callGemini(config, systemPrompt, userPrompt, maxTokens);
    case "openai":
    default:
      return await callOpenAI(config, systemPrompt, userPrompt, maxTokens);
  }
}

// src/skills/matcher.ts
function tokenize(text) {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2));
}
function matchSkills(skills, userPrompt) {
  if (skills.length === 0)
    return [];
  const promptTokens = tokenize(userPrompt);
  return skills.filter((skill) => {
    if (!skill.description)
      return true;
    const descTokens = tokenize(skill.description);
    let matches = 0;
    for (const token of descTokens) {
      if (promptTokens.has(token))
        matches++;
    }
    return matches > 0;
  });
}
function logSkills(skills) {
  for (const s of skills) {
    if (s.description) {
      console.error(C.green(`  Using skill: ${s.name}`));
    }
  }
}
async function matchSkillsWithAI(config, skills, userPrompt) {
  const globalSkills = skills.filter((s) => !s.description);
  const conditionalSkills = skills.filter((s) => s.description);
  if (conditionalSkills.length === 0) {
    logSkills(globalSkills);
    return globalSkills;
  }
  if (config.provider === "afm") {
    const matched = matchSkills(skills, userPrompt);
    logSkills(matched);
    return matched;
  }
  console.error(C.dim("  Matching skills..."));
  const skillList = conditionalSkills.map((s) => `- "${s.name}": ${s.description}`).join(`
`);
  const systemPrompt = `You select which skills are relevant to a user's CLI request. ` + `Return ONLY a JSON array of skill names that match. Return [] if none are relevant. ` + `No explanation, no markdown, no code fences.`;
  const matchPrompt = `Skills:
${skillList}

Request: ${userPrompt}`;
  try {
    const raw = stripCodeFences(await callLLM(config, systemPrompt, matchPrompt, 100));
    const names = JSON.parse(raw);
    const matched = conditionalSkills.filter((s) => names.includes(s.name));
    const result = [...globalSkills, ...matched];
    logSkills(result);
    return result;
  } catch {
    const result = matchSkills(skills, userPrompt);
    logSkills(result);
    return result;
  }
}

// src/skills/prompt.ts
function buildSkillsPromptSection(skills) {
  if (skills.length === 0)
    return "";
  const sections = skills.map((s) => `[Skill: ${s.name}]
${s.content}`);
  return `
ACTIVE SKILLS:
${sections.join(`

`)}`;
}

// src/safety/danger.ts
var DANGEROUS_PATTERNS = [
  /\brm\b/,
  /\brmdir\b/,
  /\bunlink\b/,
  /\btrash\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bchgrp\b/,
  /\btruncate\b/,
  /\bmkdir\b/,
  /\btouch\b/,
  /\bln\b/,
  /[^|]>/,
  /\btee\b/,
  /\bdd\b/,
  /\bsed\s.*-i\b/,
  /\bperl\s.*-[ip]/,
  /\bpatch\b/,
  /\bbrew\s+(install|uninstall|remove|cleanup|autoremove)\b/,
  /\bnpm\s+(install|uninstall|remove|ci|link|prune)\b/,
  /\bbun\s+(install|remove|link|add)\b/,
  /\bpip\s+(install|uninstall)\b/,
  /\bapt(-get)?\s+(install|remove|purge|autoremove)\b/,
  /\bgit\s+(push|reset|clean|checkout\s+--?\s|stash\s+drop|branch\s+-[dD]|rebase|merge|commit|add|tag\s+-d)\b/,
  /\bsudo\b/,
  /\bkill\b/,
  /\bkillall\b/,
  /\bpkill\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\blaunchctl\b/,
  /\bsystemctl\b/,
  /\bdocker\s+(rm|rmi|prune|stop|kill|system\s+prune)\b/,
  /\bmkfs\b/,
  /\bfdisk\b/,
  /\bdiskutil\b/,
  /\bcurl\b.*-[Xx]\s*(POST|PUT|DELETE|PATCH)/,
  /\bcurl\b.*-o\b/,
  /\bwget\b/
];
function isDangerous(command) {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

// src/cli/commands/run.ts
async function getCommand(config, prompt) {
  const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
  const ctx = getTerminalContext(limits);
  let systemPrompt = buildSystemPrompt(ctx);
  const allSkills = loadSkills();
  const matched = await matchSkillsWithAI(config, allSkills, prompt);
  const skillsSection = buildSkillsPromptSection(matched);
  if (skillsSection) {
    systemPrompt += `
` + skillsSection;
  }
  console.error(C.dim("  Thinking..."));
  const raw = await callLLM(config, systemPrompt, prompt);
  return stripCodeFences(raw);
}
async function runCommand(config, prompt) {
  let command;
  try {
    command = await getCommand(config, prompt);
  } catch (err) {
    console.error(C.red(`
API error: ${err.message}`));
    if (err.message.includes("auth") || err.message.includes("key") || err.message.includes("401") || err.message.includes("unavailable")) {
      console.error(C.dim("Run `greg --setup` to reconfigure."));
    }
    process.exit(1);
  }
  if (!command) {
    console.error(C.red("No command generated."));
    process.exit(1);
  }
  console.error("");
  console.error(C.dim("─────────────────────────────────────────"));
  console.error(`  ${C.greenBold(command)}`);
  console.error(C.dim("─────────────────────────────────────────"));
  console.error("");
  if (isDangerous(command)) {
    const choice = await ask(`${C.yellow("⚠ This may modify files or have side effects. Run?")} [${C.green("Y")}/${C.red("n")}] `);
    if (choice.toLowerCase() === "n") {
      console.error(C.dim("Aborted."));
      process.exit(0);
    }
  }
  try {
    execSync3(command, { stdio: "inherit", shell: "/bin/zsh" });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

// src/cli/router.ts
async function route(args) {
  if (args[0] === "--setup") {
    await setup();
    return;
  }
  if (args[0] === "--skills") {
    await skillsCommand(args.slice(1));
    return;
  }
  let config = loadConfig();
  if (!config) {
    config = await setup();
  }
  let prompt;
  if (args.length === 0) {
    const editorPrompt = editorMode();
    if (!editorPrompt) {
      console.error(C.dim("Empty prompt, nothing to do."));
      process.exit(0);
    }
    prompt = editorPrompt;
  } else {
    prompt = args.join(" ");
  }
  await runCommand(config, prompt);
}

// bin/greg.ts
route(process.argv.slice(2));
