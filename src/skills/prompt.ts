import type { Skill } from "./loader";

/** Format matched skills into a prompt section */
export function buildSkillsPromptSection(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map(
    (s) => `[Skill: ${s.name}]\n${s.content}`
  );

  return `\nACTIVE SKILLS:\n${sections.join("\n\n")}`;
}
