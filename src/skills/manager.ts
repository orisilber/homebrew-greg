import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { SKILLS_DIR } from "../config/paths";
import { loadSkills } from "./loader";

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
