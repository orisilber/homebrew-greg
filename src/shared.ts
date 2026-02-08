import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { createInterface } from "readline";

// ── Types ───────────────────────────────────────────────────────────────────

export type Provider = "afm" | "anthropic" | "openai" | "gemini";

export interface GregConfig {
  provider: Provider;
  apiKey?: string;
  model?: string;
}

export interface TerminalContext {
  cwd: string;
  osName: string;
  archName: string;
  history: string;
  dirListing: string;
}

// ── Paths ───────────────────────────────────────────────────────────────────

const __dirname = dirname(new URL(import.meta.url).pathname);

export const CONFIG_DIR = join(homedir(), ".config", "greg");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const SKILLS_DIR = join(CONFIG_DIR, "skills");
export const AFM_SWIFT_SRC = join(__dirname, "afm-bridge.swift");
export const AFM_BINARY = join(CONFIG_DIR, "afm-bridge");

// ── Colors ──────────────────────────────────────────────────────────────────

export const C = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  greenBold: (s: string) => `\x1b[1;32m${s}\x1b[0m`,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function loadConfig(): GregConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as GregConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: GregConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function stripCodeFences(text: string): string {
  return text
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .trim();
}
