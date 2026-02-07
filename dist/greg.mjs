#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/shared.ts
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync
} from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { createInterface } from "readline";
var __dirname2 = dirname(new URL(import.meta.url).pathname);
var CONFIG_DIR = join(homedir(), ".config", "greg");
var CONFIG_FILE = join(CONFIG_DIR, "config.json");
var AFM_SWIFT_SRC = join(__dirname2, "afm-bridge.swift");
var AFM_BINARY = join(CONFIG_DIR, "afm-bridge");
var C = {
  red: (s) => `\x1B[31m${s}\x1B[0m`,
  green: (s) => `\x1B[32m${s}\x1B[0m`,
  yellow: (s) => `\x1B[33m${s}\x1B[0m`,
  bold: (s) => `\x1B[1m${s}\x1B[0m`,
  dim: (s) => `\x1B[2m${s}\x1B[0m`,
  greenBold: (s) => `\x1B[1;32m${s}\x1B[0m`
};
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
function stripCodeFences(text) {
  return text.replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
}
// src/danger.ts
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
// src/afm.ts
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
// src/llm.ts
import { readFileSync as readFileSync2, existsSync as existsSync3 } from "fs";
import { homedir as homedir2, platform as platform2, arch } from "os";
import { join as join2 } from "path";
import { execSync as execSync2 } from "child_process";
var LIMITS_CLOUD = { maxHistoryLines: 30, maxDirLines: 50 };
var LIMITS_AFM = { maxHistoryLines: 5, maxDirLines: 15 };
function getTerminalContext(limits = LIMITS_CLOUD) {
  const cwd = process.cwd();
  const osName = platform2() === "darwin" ? "macOS" : platform2();
  const archName = arch();
  let history = "";
  try {
    const histFile = join2(homedir2(), ".zsh_history");
    if (existsSync3(histFile)) {
      const raw = readFileSync2(histFile, "utf-8");
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
function buildSystemPrompt(ctx) {
  return `You are Greg, a CLI-only assistant. You convert natural language into shell commands.

STRICT RULES:
- Respond with ONLY the raw shell command(s). Nothing else.
- No prose, no explanations, no markdown, no code fences, no comments.
- Use ONLY command-line tools and standard Unix/${ctx.osName} utilities available in zsh.
- Never suggest opening a GUI, browser, or editor. CLI tools only.
- Chain commands with &&, pipes, or semicolons as needed.
- Be concise, correct, and safe. Prefer non-destructive operations.
- CURRENT DIRECTORY ONLY: Unless the user explicitly asks for recursive behavior (e.g. "recursively", "all subdirectories", "nested"), operate ONLY on the current directory. Do NOT use recursive flags (-r, -R, --recursive) or recursive tools (find, **/ globs) by default.
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
async function callAnthropic(config, systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message);
  return data.content?.[0]?.text ?? "";
}
async function callOpenAI(config, systemPrompt, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
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
async function callGemini(config, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }]
    })
  });
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
async function getCommand(config, prompt) {
  const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
  const ctx = getTerminalContext(limits);
  const systemPrompt = buildSystemPrompt(ctx);
  let raw;
  switch (config.provider) {
    case "afm":
      raw = callAFM(systemPrompt, prompt);
      break;
    case "anthropic":
      raw = await callAnthropic(config, systemPrompt, prompt);
      break;
    case "gemini":
      raw = await callGemini(config, systemPrompt, prompt);
      break;
    case "openai":
    default:
      raw = await callOpenAI(config, systemPrompt, prompt);
      break;
  }
  return stripCodeFences(raw);
}
// src/setup.ts
var DEFAULT_MODELS = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash"
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
// src/editor.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync2, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join as join3 } from "path";
import { execSync as execSync3, spawnSync as spawnSync2 } from "child_process";
function cleanupFile(path) {
  try {
    unlinkSync(path);
  } catch {}
}
function editorMode() {
  const tmpFile = join3(tmpdir(), `greg-${Date.now()}.sh`);
  writeFileSync2(tmpFile, "", { mode: 448 });
  const onExit = () => cleanupFile(tmpFile);
  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);
  process.on("exit", onExit);
  const editor = process.env.EDITOR || "vim";
  const result = spawnSync2(editor, [tmpFile], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(C.red("Editor exited with an error."));
    cleanupFile(tmpFile);
    process.exit(1);
  }
  const script = readFileSync3(tmpFile, "utf-8").trim();
  cleanupFile(tmpFile);
  if (!script) {
    console.error(C.dim("Empty file, nothing to run."));
    process.exit(0);
  }
  console.error("");
  console.error(C.dim("─────────────────────────────────────────"));
  console.error(`  ${C.greenBold(script)}`);
  console.error(C.dim("─────────────────────────────────────────"));
  console.error("");
  try {
    execSync3(script, { stdio: "inherit", shell: "/bin/zsh" });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}
// bin/greg.ts
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--setup") {
    await setup();
    return;
  }
  if (args.length === 0) {
    editorMode();
    return;
  }
  let config = loadConfig();
  if (!config) {
    config = await setup();
  }
  const prompt = args.join(" ");
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
    const { execSync: execSync4 } = await import("child_process");
    execSync4(command, { stdio: "inherit", shell: "/bin/zsh" });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}
main();
