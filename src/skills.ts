import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { join, basename } from "path";
import { SKILLS_DIR } from "./shared";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Skill {
  name: string;        // filename without extension
  description: string; // from frontmatter, used for conditional matching
  content: string;     // the actual skill instructions
  filePath: string;    // full path to the skill file
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a skill file with YAML-like frontmatter.
 *
 * Expected format:
 * ---
 * description: When this skill should activate
 * ---
 * Skill instructions here...
 */
export function parseSkillFile(raw: string, filePath: string): Skill | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const name = basename(filePath).replace(/\.md$/, "");
  let description = "";
  let content = trimmed;

  // Parse frontmatter between --- delimiters
  const fmMatch = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    content = fmMatch[2].trim();

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  if (!content) return null;

  return { name, description, content, filePath };
}

// ── Loading ─────────────────────────────────────────────────────────────────

/** Load all skill files from ~/.config/greg/skills/ */
export function loadSkills(): Skill[] {
  if (!existsSync(SKILLS_DIR)) return [];

  const skills: Skill[] = [];

  try {
    const files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = join(SKILLS_DIR, file);
      try {
        const raw = readFileSync(filePath, "utf-8");
        const skill = parseSkillFile(raw, filePath);
        if (skill) skills.push(skill);
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // directory read failed
  }

  return skills;
}

// ── Matching ────────────────────────────────────────────────────────────────

/** Tokenize text into lowercase words, stripping punctuation */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2) // skip tiny words like "a", "to", "in"
  );
}

/**
 * Select skills whose description matches the user prompt.
 * Skills with no description are always included.
 * Skills with a description are included if there's keyword overlap.
 */
export function matchSkills(skills: Skill[], userPrompt: string): Skill[] {
  if (skills.length === 0) return [];

  const promptTokens = tokenize(userPrompt);

  return skills.filter((skill) => {
    // No description = always active (like a global skill)
    if (!skill.description) return true;

    const descTokens = tokenize(skill.description);
    let matches = 0;
    for (const token of descTokens) {
      if (promptTokens.has(token)) matches++;
    }

    // At least one meaningful keyword overlap
    return matches > 0;
  });
}

// ── Prompt injection ────────────────────────────────────────────────────────

/** Format matched skills into a prompt section */
export function buildSkillsPromptSection(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map(
    (s) => `[Skill: ${s.name}]\n${s.content}`
  );

  return `\nACTIVE SKILLS:\n${sections.join("\n\n")}`;
}

// ── Management ──────────────────────────────────────────────────────────────

/** Ensure the skills directory exists */
export function ensureSkillsDir(): void {
  mkdirSync(SKILLS_DIR, { recursive: true });
}

/** Create a new skill file with the given name and open template */
export function createSkillFile(name: string): string {
  ensureSkillsDir();
  const fileName = name.endsWith(".md") ? name : `${name}.md`;
  const filePath = join(SKILLS_DIR, fileName);

  if (!existsSync(filePath)) {
    const template = `---
description: Describe when this skill should activate
---

Your skill instructions here.
`;
    writeFileSync(filePath, template, { mode: 0o644 });
  }

  return filePath;
}

/** List all skill names and descriptions */
export function listSkills(): { name: string; description: string }[] {
  return loadSkills().map((s) => ({
    name: s.name,
    description: s.description || "(always active)",
  }));
}
