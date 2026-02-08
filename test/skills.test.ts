import { describe, it, beforeAll, afterAll, expect } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseSkillFile,
  matchSkills,
  buildSkillsPromptSection,
  listSkills,
} from "../src";
import type { Skill } from "../src";

// ── parseSkillFile ──────────────────────────────────────────────────────────

describe("parseSkillFile", () => {
  it("parses frontmatter with description", () => {
    const raw = `---
description: Helps with git operations
---

Always use conventional commits.`;

    const skill = parseSkillFile(raw, "/tmp/git-helper.md");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("git-helper");
    expect(skill!.description).toBe("Helps with git operations");
    expect(skill!.content).toBe("Always use conventional commits.");
  });

  it("parses file without frontmatter as always-active skill", () => {
    const raw = "Always prefer jq for JSON processing.";
    const skill = parseSkillFile(raw, "/tmp/json-tips.md");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("json-tips");
    expect(skill!.description).toBe("");
    expect(skill!.content).toBe("Always prefer jq for JSON processing.");
  });

  it("returns null for empty files", () => {
    expect(parseSkillFile("", "/tmp/empty.md")).toBeNull();
    expect(parseSkillFile("   \n  ", "/tmp/blank.md")).toBeNull();
  });

  it("returns null for frontmatter-only files with no content", () => {
    const raw = `---
description: Empty skill
---`;
    expect(parseSkillFile(raw, "/tmp/empty-body.md")).toBeNull();
  });

  it("strips .md from name", () => {
    const skill = parseSkillFile("some content", "/path/to/my-skill.md");
    expect(skill!.name).toBe("my-skill");
  });

  it("handles multiline frontmatter", () => {
    const raw = `---
description: Docker and container management
extra: ignored
---

Use docker compose v2 syntax.`;

    const skill = parseSkillFile(raw, "/tmp/docker.md");
    expect(skill!.description).toBe("Docker and container management");
    expect(skill!.content).toBe("Use docker compose v2 syntax.");
  });
});

// ── matchSkills ─────────────────────────────────────────────────────────────

describe("matchSkills", () => {
  const skills: Skill[] = [
    { name: "git", description: "git version control commits branches", content: "Use conventional commits.", filePath: "/tmp/git.md" },
    { name: "docker", description: "docker containers images compose", content: "Use compose v2.", filePath: "/tmp/docker.md" },
    { name: "global", description: "", content: "Always be concise.", filePath: "/tmp/global.md" },
    { name: "network", description: "networking curl http requests api", content: "Check status codes.", filePath: "/tmp/network.md" },
  ];

  it("matches skills by keyword overlap", () => {
    const matched = matchSkills(skills, "commit my changes with git");
    const names = matched.map((s) => s.name);
    expect(names).toContain("git");
    expect(names).toContain("global"); // always active
  });

  it("includes skills with no description (always active)", () => {
    const matched = matchSkills(skills, "list files");
    const names = matched.map((s) => s.name);
    expect(names).toContain("global");
  });

  it("matches docker skill for container queries", () => {
    const matched = matchSkills(skills, "build a docker image");
    const names = matched.map((s) => s.name);
    expect(names).toContain("docker");
    expect(names).toContain("global");
  });

  it("matches network skill for http queries", () => {
    const matched = matchSkills(skills, "send an http request with curl");
    const names = matched.map((s) => s.name);
    expect(names).toContain("network");
  });

  it("returns only global skills when nothing matches", () => {
    const matched = matchSkills(skills, "what time is it");
    const names = matched.map((s) => s.name);
    expect(names).toEqual(["global"]);
  });

  it("returns empty array when no skills provided", () => {
    expect(matchSkills([], "anything")).toEqual([]);
  });
});

// ── buildSkillsPromptSection ────────────────────────────────────────────────

describe("buildSkillsPromptSection", () => {
  it("returns empty string for no skills", () => {
    expect(buildSkillsPromptSection([])).toBe("");
  });

  it("formats single skill", () => {
    const skills: Skill[] = [
      { name: "git", description: "git ops", content: "Use conventional commits.", filePath: "/tmp/git.md" },
    ];
    const section = buildSkillsPromptSection(skills);
    expect(section).toContain("ACTIVE SKILLS:");
    expect(section).toContain("[Skill: git]");
    expect(section).toContain("Use conventional commits.");
  });

  it("formats multiple skills", () => {
    const skills: Skill[] = [
      { name: "git", description: "git ops", content: "Use conventional commits.", filePath: "/tmp/git.md" },
      { name: "docker", description: "containers", content: "Use compose v2.", filePath: "/tmp/docker.md" },
    ];
    const section = buildSkillsPromptSection(skills);
    expect(section).toContain("[Skill: git]");
    expect(section).toContain("[Skill: docker]");
  });
});
