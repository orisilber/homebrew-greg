import { describe, it, beforeAll, afterAll, expect } from "bun:test";
import { existsSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We test the manager functions directly by overriding SKILLS_DIR.
// Since the functions import SKILLS_DIR at module level, we test via
// the actual skill file creation and listing logic.

import { createSkillFile, listSkills } from "../../src";

describe("skills manager", () => {
  // These tests use the real SKILLS_DIR, so we clean up after ourselves.
  const testSkillName = `__test_skill_${Date.now()}`;
  let createdPath: string;

  afterAll(() => {
    try {
      if (createdPath && existsSync(createdPath)) {
        rmSync(createdPath);
      }
    } catch {}
  });

  it("creates a new skill file with template", () => {
    createdPath = createSkillFile(testSkillName);

    expect(existsSync(createdPath)).toBe(true);
    expect(createdPath).toEndWith(`${testSkillName}.md`);

    const content = readFileSync(createdPath, "utf-8");
    expect(content).toContain("description:");
    expect(content).toContain("Your skill instructions here.");
  });

  it("does not overwrite an existing skill file", () => {
    const originalContent = readFileSync(createdPath, "utf-8");

    // Call createSkillFile again with the same name
    const samePath = createSkillFile(testSkillName);
    expect(samePath).toBe(createdPath);

    const content = readFileSync(createdPath, "utf-8");
    expect(content).toBe(originalContent);
  });

  it("appends .md if not provided", () => {
    const path = createSkillFile(testSkillName);
    expect(path).toEndWith(".md");
  });

  it("does not double-append .md", () => {
    const path = createSkillFile(`${testSkillName}.md`);
    expect(path).not.toContain(".md.md");
  });

  it("listSkills includes the created skill", () => {
    const skills = listSkills();
    const found = skills.find((s) => s.name === testSkillName);
    expect(found).toBeDefined();
    // Template has a description in frontmatter
    expect(found!.description).toContain("Describe when");
  });
});
