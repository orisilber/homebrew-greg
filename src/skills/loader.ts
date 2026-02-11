import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { SKILLS_DIR } from "../config/paths";

export interface Skill {
  name: string;        // filename without extension
  description: string; // from frontmatter, used for conditional matching
  content: string;     // the actual skill instructions
  filePath: string;    // full path to the skill file
}

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
